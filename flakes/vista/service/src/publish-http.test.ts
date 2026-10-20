import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import { connect, createServer as createTcpServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import { Effect, Layer, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { Rpc, RpcGroup } from 'effect/rpc'
import * as RpcClient from 'effect/rpc/RpcClient'
import type { RpcClientError } from 'effect/rpc/RpcClientError'
import { layerJson } from 'effect/rpc/RpcSerialization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resolveVistaBuildInfo } from './build-info.ts'
import { VISTA_CHANGELOG_FILE, VISTA_CHANGELOG_PATH_ENV } from './changelog-companion.ts'
import { PublishInput, PublishOk, RetireOk, SlugInput, VistaControlApi } from './control.ts'
import { callLive } from './data/client/provider.ts'
import { OverviewApi } from './data/providers/overview.provider.ts'
import { VISTA_FAVICON_FILE, vistaFaviconPath } from './favicon.ts'
import { appSourcePath } from './paths.ts'
import {
  invalidateVerifiedPublications,
  PublicationReceipt,
  publicationTrustRoot,
  verifyStaticPublication,
} from './publish.ts'
import { encodeRouteOwner, decodeRouteOwner } from './read.ts'
import { versionDir } from './registry.ts'
import type { StartedService } from './server.ts'
import { freePort } from './test-support.ts'
import { wireCall } from './wire.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER_A = 'dev3.http-owner!'
const OWNER_B = 'dev4.http-owner'
const OWNER_ST = 'agent/compoundingtech/st-ios'
const OWNER_PERCENT = 'dev3.agent%2Fvista%2Fauthor'
const OWNER_TILDE = 'dev3.agent~vista~author'
const OWNER_PREFIX = 'o-6162.owner'
const SLUG = 'shared-http'
const ORIGINAL_CHANGELOG_PATH = process.env[VISTA_CHANGELOG_PATH_ENV]
const OwnerClaimApi = RpcGroup.make(Rpc.make('read', { payload: {}, success: Schema.String }))
if (process.env.VISTA_REQUIRE_FILTER === '1' && !process.env.VISTA_PUBLISHED_SURFACE_FILTER) {
  throw new Error('The owner-filter lane requires VISTA_PUBLISHED_SURFACE_FILTER')
}
if (process.env.VISTA_REQUIRE_FILTER === '1' && !process.env.VISTA_RETAINED_FIXTURE_APPS) {
  throw new Error('The owner-filter lane requires its pinned pre-cutover publication fixture')
}

let dir: string
let port: number
let close: (() => Promise<void>) | undefined

const appSource = (owner: string, slug: string): string =>
  appSourcePath(join(dir, 'sources'), owner, slug)

const seedApp = (owner: string, slug: string, title: string): void => {
  const source = appSource(owner, slug)
  const providers = join(source, 'providers')
  mkdirSync(providers, { recursive: true })
  writeFileSync(
    join(providers, 'owner.query.ts'),
    `import { contract } from '@vista/blocks/query'
import { Schema } from 'effect'
import { Rpc, RpcGroup } from 'effect/rpc'
export const ownerClaim = contract({
  id: 'owner-claim',
  group: RpcGroup.make(Rpc.make('read', { payload: {}, success: Schema.String })),
})
`,
  )
  writeFileSync(
    join(providers, 'owner.provider.ts'),
    `import { implement, mountProvider } from '@vista/data/provider'
import { Effect, Layer } from 'effect'
import { ownerClaim } from './owner.query.ts'
export default mountProvider(implement(ownerClaim, {
  purity: 'pure',
  handlers: { read: () => Effect.succeed(${JSON.stringify(owner)}) },
}), Layer.empty)
`,
  )
  writeFileSync(
    join(source, 'app.tsx'),
    `import { AppRoot, Decision } from '@vista/blocks'
import { bind, useBinding } from '@vista/blocks/query'
import { ownerClaim } from './providers/owner.query.ts'
const ownerBinding = bind(ownerClaim.ops.read, {}, { mode: 'live' })
const OwnerClaim = () => {
  const result = useBinding(ownerBinding)
  return <p data-testid="owner-claim">{result._tag === 'Success' ? result.value.value : result._tag}</p>
}
export default function PublishedApp() {
  return (
    <AppRoot title=${JSON.stringify(title)} template="architecture-review" scope="scope">
      <Decision id="decision" status="locked" provenance="test/Decision">
        <main>${title}</main>
      </Decision>
      <OwnerClaim />
    </AppRoot>
  )
}
`,
  )
}

const withControl = <A, E>(
  f: (client: RpcClient.FromGroup<typeof VistaControlApi, RpcClientError>) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    const client = yield* RpcClient.make(VistaControlApi)
    return yield* f(client)
  }).pipe(
    Effect.scoped,
    Effect.provide(
      RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${port}/_rpc/control` }).pipe(
        Layer.provide(layerJson),
        Layer.provide(FetchHttpClient.layer),
      ),
    ),
  )

const publish = (owner: string, slug: string) =>
  Effect.runPromise(
    withControl((client) =>
      wireCall(
        'vista.publish',
        PublishInput,
        PublishOk,
      )((envelope) => client['vista.publish'](envelope), {
        owner,
        slug,
        author: 'tester',
        changeSummary: 'HTTP route fixture',
      }),
    ),
  )

// Retained publications are disk fixtures, never new publishes under dotted owners.
// Reuse the real managed publication's static build, then construct and pin
// each historical fixture before serving it. These test-only writes do not
// migrate real apps or invoke publication under a dotted identity.
const seedRetainedPublication = (owner: string, title: string): void => {
  const sourceVersion = versionDir(OWNER_ST, SLUG, 1)
  const retainedVersion = versionDir(owner, SLUG, 1)
  cpSync(sourceVersion, retainedVersion, { recursive: true })
  const receipt = Schema.decodeSync(Schema.fromJsonString(PublicationReceipt))(
    readFileSync(join(sourceVersion, 'publication.json'), 'utf8'),
  )
  const fixtureSegment = encodeRouteOwner(OWNER_ST)
  const retainedSegment = encodeRouteOwner(owner)
  for (const { path } of receipt.inventory) {
    if (!/\.(?:css|html|js|json|ts|tsx)$/.test(path)) continue
    const target = join(retainedVersion, path)
    writeFileSync(
      target,
      readFileSync(target, 'utf8')
        .replaceAll(fixtureSegment, retainedSegment)
        .replaceAll(JSON.stringify(OWNER_ST), JSON.stringify(owner))
        .replaceAll('Native Subject Owner', title),
    )
  }
  const metaPath = join(retainedVersion, 'meta.json')
  writeFileSync(
    metaPath,
    readFileSync(metaPath, 'utf8')
      .replaceAll(JSON.stringify(OWNER_ST), JSON.stringify(owner))
      .replaceAll('Native Subject Owner', title),
  )
  const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex')
  const retainedReceipt = {
    ...receipt,
    owner,
    basePath: receipt.basePath.replace(fixtureSegment, retainedSegment),
    semantics: {
      ...receipt.semantics,
      sha256: digest(readFileSync(join(retainedVersion, receipt.semantics.path))),
    },
    inventory: receipt.inventory.map(({ path }) => {
      const bytes = readFileSync(join(retainedVersion, path))
      return { path, sha256: digest(bytes), size: bytes.byteLength }
    }),
  }
  const encodedReceipt = JSON.stringify(retainedReceipt)
  writeFileSync(join(retainedVersion, 'publication.json'), encodedReceipt)
  const trustRoot = publicationTrustRoot(owner, SLUG, 1)
  mkdirSync(dirname(trustRoot), { recursive: true })
  writeFileSync(
    trustRoot,
    JSON.stringify({ schemaVersion: 1, receiptSha256: digest(encodedReceipt) }),
  )
  symlinkSync('v1', join(dirname(retainedVersion), 'latest'))
  expect(verifyStaticPublication(owner, SLUG, 1)).toEqual(retainedReceipt)
}

const retire = (owner: string, slug: string) =>
  Effect.runPromise(
    withControl((client) =>
      wireCall(
        'vista.app.retire',
        SlugInput,
        RetireOk,
      )((envelope) => client['vista.app.retire'](envelope), { owner, slug }),
    ),
  )

beforeAll(async () => {
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-publish-http-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  if (process.env.VISTA_RETAINED_FIXTURE_APPS) {
    cpSync(process.env.VISTA_RETAINED_FIXTURE_APPS, process.env.VISTA_APPS, { recursive: true })
  }
  const changelogPath = join(dir, VISTA_CHANGELOG_FILE)
  writeFileSync(
    changelogPath,
    JSON.stringify({
      schemaVersion: 1,
      product: 'vista',
      build: { machineVersion: resolveVistaBuildInfo().machineVersion },
      entries: [],
    }),
  )
  process.env[VISTA_CHANGELOG_PATH_ENV] = changelogPath

  seedApp(OWNER_A, SLUG, 'Owner A')
  seedApp(OWNER_B, SLUG, 'Owner B')
  seedApp(OWNER_ST, SLUG, 'Native Subject Owner')
  seedApp(OWNER_PERCENT, SLUG, 'Literal Percent Owner')
  seedApp(OWNER_TILDE, SLUG, 'Literal Tilde Owner')
  seedApp(OWNER_PREFIX, SLUG, 'Literal Codec Prefix Owner')

  const { startService } = await import('./server.ts')
  port = await freePort()
  const started: StartedService = await startService(port)
  close = started.close
  await publish(OWNER_ST, SLUG)
  for (const [owner, title] of [
    [OWNER_A, 'Owner A'],
    [OWNER_B, 'Owner B'],
    [OWNER_PERCENT, 'Literal Percent Owner'],
    [OWNER_TILDE, 'Literal Tilde Owner'],
    [OWNER_PREFIX, 'Literal Codec Prefix Owner'],
  ] as const) {
    seedRetainedPublication(owner, title)
  }
}, 240_000)

afterAll(async () => {
  await close?.()
  if (ORIGINAL_CHANGELOG_PATH === undefined) delete process.env[VISTA_CHANGELOG_PATH_ENV]
  else process.env[VISTA_CHANGELOG_PATH_ENV] = ORIGINAL_CHANGELOG_PATH
  if (dir) rmSync(dir, { recursive: true, force: true })
})

// Use the production binary and its LocalAPI wire fixture, as in published-surface's
// Rust integration tests. No target parsing/authorization is reimplemented here.
const withManagedFilter = async (
  run: (fixture: {
    socket: string
    seen: string[]
    exchange: (
      target: string,
      peer?: string,
      method?: string,
      extra?: string,
    ) => Promise<{ status: number; head: string; body: string }>
  }) => Promise<void>,
): Promise<void> => {
  const binary = process.env.VISTA_PUBLISHED_SURFACE_FILTER
  if (!binary)
    throw new Error(
      'Set VISTA_PUBLISHED_SURFACE_FILTER to the built published-surface-filter binary',
    )
  const root = mkdtempSync(join(tmpdir(), 'vista-ps-'))
  const socket = join(root, 'filter.sock')
  const whoisSocket = join(root, 'whois.sock')
  const seen: string[] = []
  const recorder = createTcpServer((downstream) => {
    let head = Buffer.alloc(0)
    const capture = (bytes: Buffer) => {
      head = Buffer.concat([head, bytes])
      const end = head.indexOf('\r\n\r\n')
      if (end < 0) return
      seen.push(head.subarray(0, end).toString().split(' ')[1]!)
      downstream.off('data', capture)
      const upstream = connect(port, '127.0.0.1', () => {
        upstream.write(head)
        downstream.pipe(upstream)
        upstream.pipe(downstream)
        downstream.resume()
      })
      downstream.pause()
      upstream.on('error', () => downstream.destroy())
      downstream.on('close', () => upstream.destroy())
      downstream.on('error', () => upstream.destroy())
    }
    downstream.on('data', capture)
  })
  const whois = createServer((req, res) => {
    const peer = new URL(req.url!, 'http://localapi').searchParams.get('addr')
    if (peer === '100.64.0.9') {
      res.writeHead(404).end('no match for IP:port')
      return
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        Node: { Name: 'fixture.tail8108.ts.net.', StableID: `n${peer}`, Tags: [] },
        UserProfile: {
          LoginName: peer === '100.64.0.1' ? 'owner@example.com' : 'other@example.com',
        },
        CapMap: {},
      }),
    )
  })
  await new Promise<void>((resolve) => recorder.listen(0, '127.0.0.1', resolve))
  await new Promise<void>((resolve) => whois.listen(whoisSocket, resolve))
  const address = recorder.address()
  if (!address || typeof address === 'string') throw new Error('Missing recorder TCP address')
  const principal = { principal: { logins: ['owner@example.com'] } }
  const config = join(root, 'filter.json')
  writeFileSync(
    config,
    JSON.stringify({
      service: 'vista-test',
      listen: socket,
      tailscaledSocket: whoisSocket,
      upstream: `http://127.0.0.1:${address.port}`,
      policy: {
        version: 1,
        unmatched: 'deny',
        rules: [
          { prefix: '/', methods: ['GET', 'HEAD'], authority: 'public' },
          { prefix: '/r/*/*/draft/', websocket: 'allow', authority: principal },
          { prefix: '/r/*/*/*/_data/', authority: principal },
          { prefix: '/_rpc/control', authority: principal },
          { prefix: '/_rpc/read', authority: principal },
          { prefix: '/_rpc-inspector', authority: principal },
          { prefix: '/_answer', authority: principal },
          { prefix: '/_interview/', authority: principal },
        ],
      },
    }),
  )
  const child = spawn(binary, ['serve', '--config', config], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  try {
    await new Promise<void>((resolve, reject) => {
      let diagnostics = ''
      child.once('error', reject)
      child.once('exit', (code) => reject(new Error(`Filter exited ${code}: ${diagnostics}`)))
      child.stderr.on('data', (bytes) => {
        diagnostics += bytes.toString()
        if (diagnostics.includes('listening on')) resolve()
      })
    })
    const exchange = (target: string, peer = '100.64.0.9', method = 'GET', extra = '') =>
      new Promise<{ status: number; head: string; body: string }>((resolve, reject) => {
        const connection = connect(socket)
        let response = Buffer.alloc(0)
        connection.on('error', reject)
        connection.on('connect', () =>
          connection.write(
            `${method} ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Forwarded-For: ${peer}\r\nConnection: close\r\n${method === 'POST' ? 'Content-Length: 0\r\n' : ''}${extra}\r\n`,
          ),
        )
        connection.on('data', (bytes) => {
          response = Buffer.concat([
            response,
            typeof bytes === 'string' ? Buffer.from(bytes) : bytes,
          ])
        })
        connection.on('end', () => {
          const text = response.toString()
          const [head, ...body] = text.split('\r\n\r\n')
          resolve({ status: Number(head!.split(' ')[1]), head: head!, body: body.join('\r\n\r\n') })
        })
      })
    await run({ socket, seen, exchange })
  } finally {
    child.kill('SIGTERM')
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) resolve()
      else child.once('exit', () => resolve())
    })
    await Promise.all([
      new Promise<void>((resolve) => recorder.close(() => resolve())),
      new Promise<void>((resolve) => whois.close(() => resolve())),
    ])
    rmSync(root, { recursive: true, force: true })
  }
}

const openBrowserGateway = async (socket: string) => {
  const gateway = createServer((req, res) => {
    const upstream = httpRequest(
      {
        socketPath: socket,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, 'x-forwarded-for': '100.64.0.1' },
      },
      (response) => {
        res.writeHead(response.statusCode!, response.headers)
        response.pipe(res)
      },
    )
    upstream.on('error', (error) => res.destroy(error))
    req.pipe(upstream)
  })
  gateway.on('upgrade', (req, downstream, head) => {
    const upgrade = httpRequest({
      socketPath: socket,
      path: req.url,
      headers: { ...req.headers, 'x-forwarded-for': '100.64.0.1' },
    })
    upgrade.on('upgrade', (response, upstream, upstreamHead) => {
      let responseHead = `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`
      for (let index = 0; index < response.rawHeaders.length; index += 2) {
        responseHead += `${response.rawHeaders[index]}: ${response.rawHeaders[index + 1]}\r\n`
      }
      downstream.write(`${responseHead}\r\n`)
      if (upstreamHead.length > 0) downstream.write(upstreamHead)
      if (head.length > 0) upstream.write(head)
      upstream.pipe(downstream)
      downstream.pipe(upstream)
      downstream.on('close', () => upstream.destroy())
      upstream.on('error', () => downstream.destroy())
      downstream.on('error', () => upstream.destroy())
    })
    upgrade.on('response', () => downstream.destroy())
    upgrade.on('error', () => downstream.destroy())
    upgrade.end()
  })
  await new Promise<void>((resolve) => gateway.listen(0, '127.0.0.1', resolve))
  const address = gateway.address()
  if (!address || typeof address === 'string') throw new Error('Missing browser gateway address')
  return { gateway, address }
}

// Baseline aa570 already fails draft CSS/optimizer transport through the filter.
// Keep this expected failure executable until the Vista draft follow-up is fixed.
// Follow-up: https://github.com/schickling/dotfiles/issues/5308 (draft-only diagnostics).
it.skipIf(!process.env.VISTA_PUBLISHED_SURFACE_FILTER).fails(
  'mounts and reloads a draft through the managed filter (known baseline failure)',
  async () => {
    await withManagedFilter(async ({ socket, seen }) => {
      const { gateway, address } = await openBrowserGateway(socket)
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text())
        })
        page.on('response', (response) => {
          if (response.status() >= 400)
            errors.push(`${response.status()} ${response.statusText()} ${response.url()}`)
        })
        const owner = OWNER_ST
        const draftBase = `/r/${encodeRouteOwner(owner)}/${SLUG}/draft/`
        let hmrTarget: string | undefined
        const connected = new Promise<void>((resolve) => {
          page.on('websocket', (websocket) => {
            const url = new URL(websocket.url())
            if (!url.pathname.startsWith(`${draftBase}__vista_hmr__`)) return
            hmrTarget = `${url.pathname}${url.search}`
            websocket.on('framereceived', ({ payload }) => {
              if (JSON.parse(String(payload)).type === 'connected') resolve()
            })
          })
        })
        expect(
          (
            await page.goto(`http://127.0.0.1:${address.port}${draftBase}`, {
              waitUntil: 'networkidle',
              timeout: 90_000,
            })
          )?.status(),
        ).toBe(200)
        const css = await page.request.get(
          `http://127.0.0.1:${address.port}${draftBase}virtual:stylex.css`,
        )
        expect(css.status()).toBe(200)
        expect(css.headers()['content-type']).toContain('text/css')
        expect(await css.text()).not.toBe('')
        expect(seen.some((target) => target.startsWith(`${draftBase}virtual:stylex.css?t=`))).toBe(
          true,
        )
        expect(seen.some((target) => target.startsWith('/virtual:stylex.css'))).toBe(false)
        expect(errors).toEqual([])
        await connected
        expect(seen).toContain(hmrTarget)
        await page.getByTestId('owner-claim').filter({ hasText: owner }).waitFor()
        expect(await page.getByTestId('owner-claim').textContent()).toBe(owner)
        expect((await page.reload({ waitUntil: 'networkidle', timeout: 90_000 }))?.status()).toBe(
          200,
        )
        await page.getByTestId('owner-claim').filter({ hasText: owner }).waitFor()
      } finally {
        await browser.close()
        await new Promise<void>((resolve) => gateway.close(() => resolve()))
      }
    })
  },
  120_000,
)

describe('RPC-only publication and owned HTTP routes', () => {
  it('refuses a dotted owner over RPC while retaining its published canonical route', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        withControl((client) =>
          wireCall(
            'vista.publish',
            PublishInput,
            PublishOk,
          )((envelope) => client['vista.publish'](envelope), {
            owner: OWNER_B,
            slug: SLUG,
            author: 'tester',
            changeSummary: 'refused',
          }),
        ),
      ),
    )
    expect(error).toMatchObject({ _tag: 'Vista.PublishFailed', owner: OWNER_B })
    expect(error.message).toContain('publish from a managed seat')
    expect(error.message).toContain('is a legacy dotted identity')
    expect(error.message).toContain(OWNER_B)
    const retained = await fetch(
      `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER_B)}/${SLUG}/v1/`,
    )
    expect(retained.status).toBe(200)
    expect(await retained.text()).toContain('assets/')
  })
  it('serves only pinned PNG thumbnails outside the signed inventory, with publication trust intact', async () => {
    const directory = versionDir(OWNER_PERCENT, SLUG, 1)
    const thumbnail = join(directory, 'thumbnail.png')
    const receiptPath = join(directory, 'publication.json')
    const receipt = readFileSync(receiptPath)
    const url = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER_PERCENT)}/${SLUG}/v1/_thumbnail.png`
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    )
    try {
      rmSync(thumbnail, { force: true })
      expect((await fetch(url)).status).toBe(404)
      writeFileSync(thumbnail, png)
      invalidateVerifiedPublications(OWNER_PERCENT, SLUG)
      const response = await fetch(url)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(Buffer.from(await response.arrayBuffer())).toEqual(png)
      expect(readFileSync(receiptPath)).toEqual(receipt)
      const head = await fetch(url, { method: 'HEAD' })
      expect(head.status).toBe(200)
      expect(head.headers.get('content-length')).toBe(String(png.length))
      expect(await head.text()).toBe('')
      expect((await fetch(url, { method: 'POST' })).status).toBe(405)
      expect((await fetch(url.replace('/v1/', '/v999/'))).status).toBe(404)
      expect((await fetch(url.replace('/v1/', '/latest/'))).status).toBe(404)
      writeFileSync(thumbnail, '<script>alert(1)</script>')
      expect((await fetch(url)).status).toBe(404)
      rmSync(thumbnail)
      symlinkSync(receiptPath, thumbnail)
      expect((await fetch(url)).status).toBe(404)
      rmSync(thumbnail)
      writeFileSync(thumbnail, png)
      rmSync(receiptPath)
      invalidateVerifiedPublications(OWNER_PERCENT, SLUG)
      expect((await fetch(url)).status).toBe(409)
      writeFileSync(receiptPath, '{}')
      invalidateVerifiedPublications(OWNER_PERCENT, SLUG)
      expect((await fetch(url)).status).toBe(409)
    } finally {
      rmSync(thumbnail, { force: true })
      writeFileSync(receiptPath, receipt)
      invalidateVerifiedPublications(OWNER_PERCENT, SLUG)
    }
  })
  it.skipIf(
    !process.env.VISTA_PUBLISHED_SURFACE_FILTER || !process.env.VISTA_RETAINED_FIXTURE_APPS,
  )(
    'mounts the real retained pre-cutover slash-owner shell at its canonical owner URL',
    async () => {
      const owner = 'agent/retained/fixture'
      const slug = 'retained-shell'
      const basePath = `/r/${encodeRouteOwner(owner)}/${slug}/v1/`
      const receipt = Schema.decodeSync(Schema.fromJsonString(PublicationReceipt))(
        readFileSync(join(versionDir(owner, slug, 1), 'publication.json'), 'utf8'),
      )
      // Emitted by 945d48458b10fe5dd95c3fd0a12586ae40ae27be, not a rewritten
      // current build: this must exercise the immutable pre-codec AppShell.
      expect(receipt.basePath).toBe('/r/agent%2Fretained%2Ffixture/retained-shell/v1/')
      // The pre-cutover AppShell parses the owner inline with decodeURIComponent;
      // its replacement uses decodeRouteOwner. Check the actual immutable JS,
      // not just the legacy receipt emitted by the archived publisher.
      const retainedScripts = receipt.inventory
        .filter((entry) => entry.path.startsWith('site/') && entry.path.endsWith('.js'))
        .map((entry) => readFileSync(join(versionDir(owner, slug, 1), entry.path), 'utf8'))
        .join('\n')
      expect(retainedScripts).toMatch(/owner:\s*decodeURIComponent\(/)
      await withManagedFilter(async ({ socket, exchange }) => {
        for (const entry of receipt.inventory.filter((entry) => entry.path.startsWith('site/'))) {
          const target = `${basePath}${entry.path.slice('site/'.length)}`
          expect((await exchange(target)).status, target).toBe(200)
        }
        const { gateway, address } = await openBrowserGateway(socket)
        const browser = await chromium.launch({ headless: true })
        try {
          const page = await browser.newPage()
          const errors: string[] = []
          const resources: { url: string; status: number }[] = []
          page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
          page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text())
          })
          page.on('requestfailed', (request) =>
            errors.push(`${request.url()}: ${request.failure()?.errorText}`),
          )
          page.on('response', (response) =>
            resources.push({ url: response.url(), status: response.status() }),
          )
          expect(
            (
              await page.goto(`http://127.0.0.1:${address.port}${basePath}`, {
                waitUntil: 'networkidle',
              })
            )?.status(),
          ).toBe(200)
          await page
            .getByRole('heading', { name: 'Retained pre-cutover shell', exact: true })
            .waitFor()
          await page.locator('[data-vista-version-control] button').waitFor()
          await page.getByRole('button', { name: 'Inspect RPC activity', exact: true }).click()
          const identity = page.getByRole('button', {
            name: `This app: ${owner}/${slug}/v1 ×`,
            exact: true,
          })
          await identity.waitFor()
          expect(await identity.textContent()).not.toContain(encodeRouteOwner(owner))
          await page.waitForLoadState('networkidle')
          expect(resources.some(({ url }) => url.includes('/assets/') && url.endsWith('.js'))).toBe(
            true,
          )
          for (const resource of resources) expect(resource.status, resource.url).toBe(200)
          expect(errors).toEqual([])
        } finally {
          await browser.close()
          await new Promise<void>((resolve) => gateway.close(() => resolve()))
        }
      })
    },
    120_000,
  )

  it('redirects safe legacy literal owners, including o- dotted owners, to canonical pinned and draft routes', async () => {
    for (const owner of [OWNER_B, OWNER_PREFIX]) {
      for (const selector of ['v1', 'latest', 'draft']) {
        const suffix = `/${SLUG}/${selector}/?view=exact`
        const response = await fetch(`http://127.0.0.1:${port}/r/${owner}${suffix}`, {
          redirect: 'manual',
        })
        expect(response.status).toBe(308)
        expect(response.headers.get('location')).toBe(`/r/${encodeRouteOwner(owner)}${suffix}`)
        expect(
          (await fetch(`http://127.0.0.1:${port}${response.headers.get('location')}`)).status,
        ).toBe(200)
      }
    }
  })

  it.skipIf(!process.env.VISTA_PUBLISHED_SURFACE_FILTER)(
    'admits emitted native, percent and tilde publications through the real managed filter',
    async () => {
      await withManagedFilter(async ({ socket, exchange, seen }) => {
        for (const owner of [OWNER_ST, OWNER_PERCENT, OWNER_TILDE, OWNER_B]) {
          const receipt = Schema.decodeSync(Schema.fromJsonString(PublicationReceipt))(
            readFileSync(join(versionDir(owner, SLUG, 1), 'publication.json'), 'utf8'),
          )
          // Intentionally consume the producer's bytes, not a test-constructed safe URL.
          // Before #5308 the native subject emits %2F and this assertion sees HTTP 400.
          const response = await exchange(receipt.basePath)
          expect(response.status, response.body).toBe(200)
          expect(seen.at(-1)).toBe(receipt.basePath)
          for (const entry of receipt.inventory.filter((entry) => entry.path.startsWith('site/'))) {
            const target = `${receipt.basePath}${entry.path.slice('site/'.length)}`
            const asset = await exchange(target)
            expect(asset.status, target).toBe(200)
            expect(seen.at(-1)).toBe(target)
          }
          const latest = `/r/${receipt.basePath.split('/')[2]}/${SLUG}/latest/`
          expect((await exchange(latest)).status).toBe(200)
          expect(seen.at(-1)).toBe(latest)
          {
            const { gateway, address } = await openBrowserGateway(socket)
            try {
              const providerTarget = `${receipt.basePath}_data/overview/`
              const result = await Effect.runPromise(
                callLive(
                  `http://127.0.0.1:${address.port}${providerTarget}`,
                  OverviewApi,
                  (client) => client.get({ repo: 'schickling/dotfiles', pr: 42 }),
                ),
              )
              expect(result).toEqual(
                expect.objectContaining({ repo: 'schickling/dotfiles', pr: 42 }),
              )
              expect(seen).toContain(providerTarget)
              const claimTarget = `${receipt.basePath}_data/owner-claim/`
              const claim = await Effect.runPromise(
                callLive(
                  `http://127.0.0.1:${address.port}${claimTarget}`,
                  OwnerClaimApi,
                  (client) => client.read({}),
                ),
              )
              expect(claim).toBe(owner)
              expect(seen).toContain(claimTarget)
              if (
                process.env.PLAYWRIGHT_BROWSERS_PATH ||
                process.env.VISTA_REQUIRE_BROWSER === '1'
              ) {
                const browser = await chromium.launch({ headless: true })
                try {
                  const page = await browser.newPage()
                  const errors: string[] = []
                  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
                  page.on('console', (message) => {
                    if (message.type() === 'error') errors.push(message.text())
                  })
                  page.on('response', (response) => {
                    if (response.status() >= 400)
                      errors.push(`${response.status()} ${response.statusText()} ${response.url()}`)
                  })
                  const navigation = await page.goto(
                    `http://127.0.0.1:${address.port}${receipt.basePath}`,
                  )
                  expect(navigation?.status()).toBe(200)
                  const titles: Record<string, string> = {
                    [OWNER_ST]: 'Native Subject Owner',
                    [OWNER_PERCENT]: 'Literal Percent Owner',
                    [OWNER_TILDE]: 'Literal Tilde Owner',
                    [OWNER_B]: 'Owner B',
                  }
                  const title = titles[owner]!
                  await page.getByRole('heading', { name: title, exact: true }).waitFor()
                  await page.getByTestId('owner-claim').filter({ hasText: owner }).waitFor()
                  expect(await page.getByTestId('owner-claim').textContent()).toBe(owner)
                  expect(await page.title()).toContain(title)
                  await page.locator('[data-vista-version-control] button').click()
                  await page.getByRole('option').filter({ hasText: 'Latest' }).click()
                  await page.waitForURL(`http://127.0.0.1:${address.port}${latest}`)
                  await page.getByRole('heading', { name: title, exact: true }).waitFor()
                  expect(errors).toEqual([])
                } finally {
                  await browser.close()
                }
              }
            } finally {
              await new Promise<void>((resolve) => gateway.close(() => resolve()))
            }
          }
        }
        expect((await exchange('/', '100.64.0.9')).status).toBe(200)
        const owner = encodeRouteOwner(OWNER_ST)
        const draft = `/r/${owner}/${SLUG}/draft/`
        const data = `/r/${owner}/${SLUG}/latest/_data/overview/`
        for (const peer of ['100.64.0.2', '100.64.0.9']) {
          for (const [target, method, extra] of [
            [draft, 'GET', ''],
            [data, 'POST', ''],
            [draft, 'GET', 'Upgrade: websocket\r\n'],
          ]) {
            const before = seen.length
            expect((await exchange(target!, peer, method!, extra!)).status).toBe(403)
            expect(seen).toHaveLength(before)
          }
        }
        expect((await exchange(draft, '100.64.0.1')).status).toBe(200)
        expect(seen.at(-1)).toBe(draft)
        const css = await exchange(`${draft}virtual:stylex.css?t=1`, '100.64.0.1')
        expect(css.status).toBe(200)
        expect(css.head).toContain('text/css')
        const runtime = await exchange(`${draft}@id/virtual:stylex:runtime`, '100.64.0.1')
        expect(runtime.status).toBe(200)
        expect(runtime.body).toContain("'./virtual:stylex.css'")
        expect(runtime.body).not.toContain("'/virtual:stylex.css'")
        expect((await exchange('/virtual:stylex.css', '100.64.0.1')).status).toBe(404)
        // The fixture RPC body is empty: Vista rejects it, but the trusted filter
        // must forward exactly this owner/version rather than grant a public write.
        const before = seen.length
        await exchange(data, '100.64.0.1', 'POST')
        expect(seen).toHaveLength(before + 1)
        expect(seen.at(-1)).toBe(data)
        expect((await exchange(`/r/${owner}/${SLUG}/v1/`, '100.64.0.1', 'POST')).status).toBe(405)
        expect((await exchange(`/r/${owner}/${SLUG}/v1/`, '100.64.0.1', 'HEAD')).status).toBe(200)
      })
    },
    240_000,
  )

  it.skipIf(!process.env.VISTA_PUBLISHED_SURFACE_FILTER)(
    'uses WhoIs, not forged login or tags, for draft and data authority',
    async () => {
      await withManagedFilter(async ({ exchange, seen }) => {
        const owner = encodeRouteOwner(OWNER_ST)
        for (const peer of ['100.64.0.2', '100.64.0.9']) {
          for (const [target, method] of [
            [`/r/${owner}/${SLUG}/draft/`, 'GET'],
            [`/r/${owner}/${SLUG}/latest/_data/owner-claim/`, 'POST'],
          ]) {
            const before = seen.length
            const response = await exchange(
              target!,
              peer,
              method!,
              'Tailscale-User-Login: owner@example.com\r\nTailscale-User-Tags: tag:owner\r\nTailscale-Tags: tag:owner\r\n',
            )
            expect(response.status, target).toBe(403)
            expect(seen).toHaveLength(before)
          }
        }
      })
    },
    120_000,
  )

  it.skipIf(!process.env.VISTA_PUBLISHED_SURFACE_FILTER)(
    'protects the inspector, answer and interview routes with the dev3 principal rules',
    async () => {
      await withManagedFilter(async ({ exchange, seen }) => {
        for (const [target, method] of [
          ['/_rpc-inspector', 'GET'],
          ['/_answer', 'POST'],
          ['/_interview/coverage', 'GET'],
        ]) {
          for (const peer of ['100.64.0.2', '100.64.0.9']) {
            const before = seen.length
            expect((await exchange(target!, peer, method!)).status, target).toBe(403)
            expect(seen).toHaveLength(before)
          }
          const before = seen.length
          const response = await exchange(target!, '100.64.0.1', method!)
          // An empty body/nonexistent interview can be rejected by Vista. Prove
          // admission by the backend tap rather than requiring application success.
          expect(response.status, target).not.toBe(403)
          expect(seen).toHaveLength(before + 1)
          expect(seen.at(-1)).toBe(target)
        }
      })
    },
    120_000,
  )

  it.skipIf(!process.env.VISTA_PUBLISHED_SURFACE_FILTER)(
    'rejects raw encoded delimiters in every resource position before Vista is hit',
    async () => {
      await withManagedFilter(async ({ exchange, seen }) => {
        const receipt = Schema.decodeSync(Schema.fromJsonString(PublicationReceipt))(
          readFileSync(join(versionDir(OWNER_ST, SLUG, 1), 'publication.json'), 'utf8'),
        )
        expect((await exchange(receipt.basePath)).status).toBe(200)
        const owner = encodeRouteOwner(OWNER_ST)
        for (const escape of ['%2F', '%5C', '%3F', '%23', '%3B', '%252F', '%25', '%2f', '%41']) {
          for (const target of [
            `/r/${owner}${escape}x/${SLUG}/v1/`,
            `/r/${owner}/${SLUG}${escape}x/v1/`,
            `/r/${owner}/${SLUG}/v1${escape}draft/`,
            `/r/${owner}/${SLUG}/v1/assets/x${escape}y.js`,
          ]) {
            const before = seen.length
            expect((await exchange(target, '100.64.0.1')).status, target).toBe(400)
            expect(seen).toHaveLength(before)
          }
        }
        const oldTarget = `/r/agent%2Fcompoundingtech%2Fst-ios/${SLUG}/v1/`
        const before = seen.length
        const oldResponse = await exchange(oldTarget)
        expect(oldResponse.status).toBe(400)
        expect(oldResponse.body).toContain('percent-encoded delimiter')
        expect(seen).toHaveLength(before)
      })
    },
    120_000,
  )

  it('keeps equal slugs isolated by exact encoded owner and rejects the legacy route', async () => {
    const encodedA = encodeRouteOwner(OWNER_A)
    const encodedB = encodeRouteOwner(OWNER_B)
    expect(encodedA).toBe(`o-${Buffer.from(OWNER_A).toString('hex')}`)

    const [legacy, ownerA, ownerB] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/r/${SLUG}/v1/`),
      fetch(`http://127.0.0.1:${port}/r/${encodedA}/${SLUG}/v1/`),
      fetch(`http://127.0.0.1:${port}/r/${encodedB}/${SLUG}/v1/`),
    ])
    expect(legacy.status).toBe(404)
    expect(ownerA.status).toBe(200)
    expect(ownerB.status).toBe(200)
    expect(await ownerA.text()).toContain(`/r/${encodedA}/${SLUG}/v1/assets/`)
    expect(await ownerB.text()).toContain(`/r/${encodedB}/${SLUG}/v1/assets/`)

    const feed = (await (await fetch(`http://127.0.0.1:${port}/_vista/apps`)).json()) as {
      apps: ReadonlyArray<{
        owner: string
        slug: string
        latest: number | null
        versions: ReadonlyArray<{
          id: string
          label: string
          title?: string
          timestamp: string
          publisher: string
          changeSummary: string
        }>
      }>
    }
    expect(feed.apps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: OWNER_A,
          slug: SLUG,
          latest: 1,
          versions: [
            expect.objectContaining({
              id: 'v1',
              label: 'v1',
              title: 'Owner A',
              timestamp: expect.any(String),
              publisher: 'tester',
              changeSummary: 'HTTP route fixture',
            }),
          ],
        }),
        expect.objectContaining({ owner: OWNER_B, slug: SLUG, latest: 1 }),
      ]),
    )
  })

  it('verifies native-subject receipts and isolates literal percent claims from encoded slashes', async () => {
    for (const owner of [OWNER_ST, OWNER_PERCENT, OWNER_TILDE, OWNER_A]) {
      const encodedOwner = encodeRouteOwner(owner)
      expect(decodeRouteOwner(encodedOwner)).toBe(owner)
      const basePath = `/r/${encodedOwner}/${SLUG}/v1/`
      const response = await fetch(`http://127.0.0.1:${port}${basePath}`)
      expect(response.status).toBe(200)
      expect(await response.text()).toContain(`${basePath}assets/`)
      const receipt = Schema.decodeSync(Schema.fromJsonString(PublicationReceipt))(
        readFileSync(join(versionDir(owner, SLUG, 1), 'publication.json'), 'utf8'),
      )
      expect(receipt.owner).toBe(owner)
      expect(receipt.basePath).toBe(basePath)
    }
    expect(versionDir(OWNER_ST, SLUG, 1)).not.toBe(versionDir(OWNER_PERCENT, SLUG, 1))
    for (const routeOwner of [
      'agent/vista/http-owner',
      'agent%2fvista%2fhttp-owner',
      'agent%252Fvista%252Fhttp-owner',
      'agent%2Fvista%2F..',
      'dev%2F3.owner',
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}/r/${routeOwner}/${SLUG}/v1/`)
      expect(response.status).not.toBe(200)
    }
  })

  it('serves the canonical favicon and exact changelog companion bytes', async () => {
    const encodedOwner = encodeRouteOwner(OWNER_A)
    const publishedBase = `/r/${encodedOwner}/${SLUG}/v1/`
    const [favicon, publishedFavicon, draftChangelog, publishedChangelog] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/favicon.ico`),
      fetch(`http://127.0.0.1:${port}${publishedBase}${VISTA_FAVICON_FILE}`),
      fetch(`http://127.0.0.1:${port}/r/${encodedOwner}/${SLUG}/draft/${VISTA_CHANGELOG_FILE}`),
      fetch(`http://127.0.0.1:${port}${publishedBase}${VISTA_CHANGELOG_FILE}`),
    ])
    expect(favicon.status).toBe(200)
    expect(favicon.headers.get('content-type')).toBe('image/svg+xml')
    expect(Buffer.from(await favicon.arrayBuffer())).toEqual(readFileSync(vistaFaviconPath()))
    expect(publishedFavicon.status).toBe(200)
    expect(publishedFavicon.headers.get('content-type')).toBe('image/svg+xml')
    expect(Buffer.from(await publishedFavicon.arrayBuffer())).toEqual(
      readFileSync(vistaFaviconPath()),
    )
    expect(draftChangelog.status).toBe(200)
    expect(publishedChangelog.status).toBe(200)
    const expectedChangelog = readFileSync(process.env[VISTA_CHANGELOG_PATH_ENV]!)
    expect(Buffer.from(await draftChangelog.arrayBuffer())).toEqual(expectedChangelog)
    expect(Buffer.from(await publishedChangelog.arrayBuffer())).toEqual(expectedChangelog)
  })

  it('fails visibly when the advertised draft companion is missing', async () => {
    const configured = process.env[VISTA_CHANGELOG_PATH_ENV]!
    process.env[VISTA_CHANGELOG_PATH_ENV] = join(dir, 'missing-changelog.v1.json')
    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER_A)}/${SLUG}/draft/${VISTA_CHANGELOG_FILE}`,
      )
      expect(response.status).toBe(500)
      expect(await response.text()).toContain('Vista changelog companion is unavailable')
    } finally {
      process.env[VISTA_CHANGELOG_PATH_ENV] = configured
    }
  })

  it('routes a trailing-slash live call through an owner-scoped latest surface', async () => {
    const result = await Effect.runPromise(
      callLive(
        `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER_A)}/${SLUG}/latest/_data/overview/`,
        OverviewApi,
        (client) => client.get({ repo: 'schickling/dotfiles', pr: 42 }),
      ),
    )
    expect(result).toEqual({
      repo: 'schickling/dotfiles',
      pr: 42,
      changedFiles: 9,
      additions: 207,
      deletions: 63,
      verdict: 'small change — looks routine',
    })
  })

  it('builds one verified index and checks only requested bytes thereafter', async () => {
    const encodedOwner = encodeRouteOwner(OWNER_A)
    const claimed = versionDir(OWNER_A, SLUG, 1)
    const receipt = Schema.decodeSync(Schema.fromJsonString(PublicationReceipt))(
      readFileSync(join(claimed, 'publication.json'), 'utf8'),
    )
    expect(receipt).toEqual(
      expect.objectContaining({
        owner: OWNER_A,
        slug: SLUG,
        basePath: `/r/${encodedOwner}/${SLUG}/v1/`,
      }),
    )
    expect(receipt.inventory).not.toContainEqual(expect.objectContaining({ path: '.publishing' }))

    const url = `http://127.0.0.1:${port}/r/${encodedOwner}/${SLUG}/v1/`
    expect((await fetch(url)).status).toBe(200)

    // The first request verified the complete immutable version. A later
    // unrelated mutation must not trigger another tree walk for index.html.
    writeFileSync(join(claimed, 'app.tsx'), 'tampered after activation')
    const cachedIndex = await fetch(url)
    expect(cachedIndex.status, await cachedIndex.text()).toBe(200)

    // Requested bytes are still checked against the immutable index.
    const asset = receipt.inventory.find((entry) => entry.path.endsWith('.js'))!
    rmSync(join(claimed, asset.path))
    const assetUrl = `${url}${asset.path.slice('site/'.length)}`
    const untrusted = await fetch(assetUrl)
    expect(untrusted.status).toBe(409)
    expect(await untrusted.text()).toBe('publication trust verification failed')
  })

  it('returns 410 for a retired draft/latest while keeping pinned verified versions readable', async () => {
    const encodedOwner = encodeRouteOwner(OWNER_B)
    expect(await retire(OWNER_B, SLUG)).toEqual({ owner: OWNER_B, slug: SLUG })

    const [draft, latest, pinned] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/r/${encodedOwner}/${SLUG}/draft/`),
      fetch(`http://127.0.0.1:${port}/r/${encodedOwner}/${SLUG}/latest/`),
      fetch(`http://127.0.0.1:${port}/r/${encodedOwner}/${SLUG}/v1/`),
    ])
    expect(draft.status).toBe(410)
    expect(latest.status).toBe(410)
    expect(pinned.status).toBe(200)
    expect(existsSync(versionDir(OWNER_B, SLUG, 1))).toBe(true)
  })
})
