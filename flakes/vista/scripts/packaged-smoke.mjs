#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { encodeRouteOwner } from '../blocks/src/owner-identity.ts'

// Node reads this flag at startup; clearing it later cannot repair package resolution.
if (process.env.NODE_PRESERVE_SYMLINKS === '1') {
  console.error(
    'packaged smoke requires NODE_PRESERVE_SYMLINKS to be unset before Node starts; run env -u NODE_PRESERVE_SYMLINKS node flakes/vista/scripts/packaged-smoke.mjs or use a vista:packaged-smoke task',
  )
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')

const args = process.argv.slice(2)
const hasFlag = (flag) => args.includes(flag)
const valueAfter = (flag) => {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

const noBrowser = hasFlag('--no-browser')
const keep = hasFlag('--keep') || process.env.VISTA_SMOKE_KEEP === '1'

const requirePlaywrightEnvironment = () => {
  if (noBrowser || process.env.PLAYWRIGHT_BROWSERS_PATH !== undefined) return
  console.error(
    [
      'browser smoke requires the Nix/devenv Playwright browser environment',
      '',
      'Run through the repo devenv task:',
      '  devenv tasks run vista:packaged-smoke:full',
      '',
      'For service/CLI-only proof, pass --no-browser.',
    ].join('\n'),
  )
  process.exit(1)
}

const freePort = async () => {
  const server = createNetServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

const sh = (cmd, commandArgs, options = {}) => {
  const result = execFileSync(cmd, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    timeout: options.timeout ?? 120_000,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    env: options.env ?? process.env,
  })
  return typeof result === 'string' ? result.trim() : ''
}

requirePlaywrightEnvironment()

const packagePath =
  valueAfter('--package') ??
  process.env.VISTA_PACKAGE ??
  sh('nix', ['build', '.#vista', '--no-link', '--print-out-paths'])

const workspace = join(packagePath, 'libexec', 'workspace')
const tmp = mkdtempSync(join(tmpdir(), 'vista-packaged-smoke-'))
const appsDir = join(tmp, 'apps')
const cache = join(tmp, 'cache')
const logs = join(tmp, 'logs')
mkdirSync(logs, { recursive: true })

let service
let telemetryBackend
let browser
let failed = false
let currentStep = 'initializing'
let cleanupPromise

const step = async (name, fn) => {
  currentStep = name
  console.error(`[vista packaged smoke] ${name}`)
  return await fn()
}

const tailFile = (path, lines = 80) => {
  if (!existsSync(path)) return '<missing>'
  const body = readFileSync(path, 'utf8')
  return body.split(/\r?\n/).slice(-lines).join('\n')
}

const reportFailure = (error) => {
  console.error(`[vista packaged smoke] failed during: ${currentStep}`)
  console.error(error)
  console.error(`[vista packaged smoke] kept smoke root: ${tmp}`)
  console.error(`\n--- vista-service.log ---\n${tailFile(join(logs, 'vista-service.log'))}`)
  console.error(`\n--- fake-telemetry.log ---\n${tailFile(join(logs, 'fake-telemetry.log'))}`)
}

const stopChild = async (child) => {
  if (child === undefined || child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.kill('SIGTERM')
  let timeout
  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve(true), 5_000)
    }),
  ])
  clearTimeout(timeout)
  if (!timedOut || child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGKILL')
  await exited
}
const cleanup = () => {
  cleanupPromise ??= (async () => {
    if (browser !== undefined) {
      await browser.close().catch(() => undefined)
      browser = undefined
    }
    await Promise.all([stopChild(service), stopChild(telemetryBackend)])
    if (!keep && !failed) rmSync(tmp, { recursive: true, force: true })
  })()
  return cleanupPromise
}

const exitAfterCleanup = (code) => {
  void cleanup().finally(() => process.exit(code))
}

process.on('SIGINT', () => exitAfterCleanup(130))
process.on('SIGTERM', () => exitAfterCleanup(143))

const fakeTelemetry = async () => {
  const fixtureDir = join(
    workspace,
    'flakes',
    'vista',
    'service',
    'src',
    'data',
    'providers',
    '__fixtures__',
  )
  const child = spawn(process.execPath, [
    '-e',
    String.raw`
const { readFileSync } = require('node:fs')
const { createServer } = require('node:http')
const { join } = require('node:path')

const fixtureDir = process.argv[1]
const fixtures = {
  metric: readFileSync(join(fixtureDir, 'prom-matrix.json')),
  trace: readFileSync(join(fixtureDir, 'tempo-trace.json')),
  traceSearch: readFileSync(join(fixtureDir, 'tempo-search.json')),
  flamegraph: readFileSync(join(fixtureDir, 'pyro-flamebearer.json')),
}

const sendFixture = (res, fixture) => {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(fixture)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  console.error(req.method + ' ' + url.pathname)
  if (req.method === 'GET' && url.pathname === '/prometheus/api/v1/query_range') {
    sendFixture(res, fixtures.metric)
    return
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/traces/')) {
    sendFixture(res, fixtures.trace)
    return
  }
  if (req.method === 'GET' && url.pathname === '/api/search') {
    sendFixture(res, fixtures.traceSearch)
    return
  }
  if (
    req.method === 'POST' &&
    url.pathname === '/querier.v1.QuerierService/SelectMergeStacktraces'
  ) {
    sendFixture(res, fixtures.flamegraph)
    return
  }
  res.writeHead(404).end('not found')
})

server.listen(0, '127.0.0.1', () => {
  console.log(JSON.stringify({ port: server.address().port }))
})

process.on('SIGTERM', () => server.close(() => process.exit(0)))
`,
    fixtureDir,
  ])
  telemetryBackend = child

  const logPath = join(logs, 'fake-telemetry.log')
  let buffer = ''
  child.stderr.on('data', (chunk) => writeFileSync(logPath, chunk, { flag: 'a' }))

  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('fake telemetry backend did not start')),
      10_000,
    )
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      reject(new Error(`fake telemetry backend exited before ready: code=${code} signal=${signal}`))
    })
    child.stdout.on('data', (chunk) => {
      writeFileSync(logPath, chunk, { flag: 'a' })
      buffer += String(chunk)
      const newline = buffer.indexOf('\n')
      if (newline === -1) return
      const line = buffer.slice(0, newline).trim()
      try {
        const parsed = JSON.parse(line)
        clearTimeout(timeout)
        resolve(parsed.port)
      } catch (error) {
        clearTimeout(timeout)
        reject(error)
      }
    })
  })

  return { child, port }
}

const managedAppSource = (sources, owner, slug) =>
  join(sources, '_owned.v1', encodeOwner(owner), slug)

const stageSample = (sample, sources, owner, slug) => {
  const source = join(workspace, 'flakes', 'vista', 'service', 'samples', sample)
  const appSource = managedAppSource(sources, owner, slug)
  mkdirSync(dirname(appSource), { recursive: true })
  cpSync(source, appSource, { recursive: true })
  return appSource
}

const stageInline = (sources, owner, slug, files) => {
  const appSource = managedAppSource(sources, owner, slug)
  mkdirSync(appSource, { recursive: true })
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(appSource, name), body)
  }
  return appSource
}

const encodeOwner = (owner) =>
  encodeURIComponent(owner).replace(
    /[!'()*]/g,
    (character) => `%${character.codePointAt(0).toString(16).toUpperCase()}`,
  )

const assertCapturedPublication = (owner, slug, provider) => {
  const version = join(appsDir, '_owned', encodeOwner(owner), slug, 'v1')
  const snapshotPath = join(version, 'snapshot.json')
  const siteSnapshotPath = join(version, 'site', 'snapshot.json')
  if (!existsSync(snapshotPath) || !existsSync(siteSnapshotPath)) {
    throw new Error(`${slug}: publication omitted its captured snapshot`)
  }
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
  const captured = Object.values(snapshot.entries ?? {}).some(
    (entry) =>
      entry?.provider === provider &&
      typeof entry.operation === 'string' &&
      Object.hasOwn(entry, 'encodedValue'),
  )
  if (!captured) throw new Error(`${slug}: snapshot has no captured ${provider} response`)
}

const waitForService = async (vista, env) => {
  const deadline = Date.now() + 60_000
  let last = ''
  while (Date.now() < deadline) {
    try {
      // `debug service` now renders via @overeng/tui-react (decision 0063): the
      // machine-output flag is `--output json`, not the removed `--json` bypass.
      return sh(vista, ['debug', 'service', '--output', 'json'], { env })
    } catch (error) {
      last = String(error.stderr ?? error.message ?? error)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw new Error(`vista service did not become reachable: ${last}`)
}

const publish = (vista, slug, env, cwd) =>
  sh(vista, ['publish', slug, '-m', `smoke ${slug}`, '--local'], { cwd, env, timeout: 180_000 })

const publishJson = (vista, slug, env, cwd) =>
  JSON.parse(
    sh(vista, ['publish', slug, '-m', `smoke ${slug}`, '--json', '--local'], {
      cwd,
      env,
      timeout: 180_000,
    }),
  )

const main = async () => {
  const fake = await step('start fake telemetry backends', () => fakeTelemetry())
  telemetryBackend = fake.child
  const telemetryPort = fake.port
  const port = await step('allocate service port', () => freePort())
  const sources = join(tmp, 'sources')
  const smokeOwner = 'agent/vista/packaged-smoke'
  const encodedSmokeOwner = encodeRouteOwner(smokeOwner)
  const inheritedEnv = { ...process.env }
  delete inheritedEnv.ST_AGENT
  /**
   * Devenv preserves workspace symlinks for source development. The packaged
   * workspace relies on Node's normal realpath deduplication so Effect schemas
   * and runtimes resolve to one module instance.
   */
  delete inheritedEnv.NODE_PRESERVE_SYMLINKS
  const env = {
    ...inheritedEnv,
    VISTA_ROOT: workspace,
    VISTA_APPS: appsDir,
    VISTA_CACHE: cache,
    VISTA_SOURCES: sources,
    ST_AGENT: smokeOwner,
    VISTA_DEPS: join(workspace, 'node_modules'),
    VISTA_URL: `http://127.0.0.1:${port}`,
    VISTA_MIMIR_URL: `http://127.0.0.1:${telemetryPort}`,
    VISTA_TEMPO_URL: `http://127.0.0.1:${telemetryPort}`,
    VISTA_PYROSCOPE_URL: `http://127.0.0.1:${telemetryPort}`,
    VISTA_AUTHOR: 'packaged-smoke',
    OTEL_SERVICE_NAME: 'vista-service',
    OTEL_SERVICE_VERSION: '0.1.0',
    // The packaged wrapper turns the per-review render smoke on by default
    // (`--set-default VISTA_RENDER_SMOKE 1`, decision 0058). This lane already
    // verifies rendering independently and has a `--no-browser` variant, so keep
    // its behaviour identical by disabling the publish-time smoke here (it would
    // otherwise launch chromium on every publish — impossible under `--no-browser`
    // — and require esm.sh reachable in-browser for the esm-sh-smoke publish).
    VISTA_RENDER_SMOKE: '0',
  }

  const vista = join(packagePath, 'bin', 'vista')
  const vistaService = join(packagePath, 'bin', 'vista-service')
  const serviceLog = writeFileSync(join(logs, 'vista-service.log'), '')
  void serviceLog
  await step('start packaged vista-service', async () => {
    service = spawn(vistaService, [String(port)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const logPath = join(logs, 'vista-service.log')
    service.stdout.on('data', (chunk) => writeFileSync(logPath, chunk, { flag: 'a' }))
    service.stderr.on('data', (chunk) => writeFileSync(logPath, chunk, { flag: 'a' }))
  })

  await step('wait for packaged service RPC', () => waitForService(vista, env))
  await step('verify packaged vista-service process identity', () => {
    if (process.platform !== 'linux') return
    if (service?.pid === undefined) throw new Error('packaged vista-service has no process ID')
    const argv0 = readFileSync(`/proc/${service.pid}/cmdline`, 'utf8').split('\0')[0]
    if (argv0 !== 'vista-service') {
      throw new Error(`packaged vista-service argv0 is ${JSON.stringify(argv0)}`)
    }
  })

  await step('publish scaffold smoke', async () => {
    sh(vista, ['new', 'scaffold-smoke'], { cwd: tmp, env })
    publish(vista, 'scaffold-smoke', env, tmp)
  })

  await step('publish frozen-provider smoke', async () => {
    stageSample('data-panel-app', sources, smokeOwner, 'freeze-smoke')
    publish(vista, 'freeze-smoke', env, tmp)
  })

  for (const [sample, slug, provider] of [
    ['doctrine-app', 'doctrine-smoke'],
    ['heavy-blocks-app', 'heavy-smoke'],
    // R58 category-closer (decision 0052): drives the Renderer->ChartBlock->
    // recharts->es-toolkit CJS closure — the exact transitive-CJS path whose
    // raw-served missing-`default` interop caused the service-wide blank render.
    ['chart-app', 'chart-smoke'],
    ['telemetry-island-app', 'telemetry-metric-smoke', 'otel'],
    ['telemetry-trace-app', 'telemetry-trace-smoke', 'trace'],
    ['telemetry-flamegraph-app', 'telemetry-flamegraph-smoke', 'pyroscope'],
  ]) {
    await step(`publish sample ${slug}`, async () => {
      stageSample(sample, sources, smokeOwner, slug)
      publish(vista, slug, env, tmp)
      if (provider !== undefined) assertCapturedPublication(smokeOwner, slug, provider)
    })
  }

  const immutableOwner = 'agent/vista/packaged-smoke/worker'
  const immutableSlug = 'immutable-semantic-smoke'
  const immutableEnv = { ...env, ST_AGENT: immutableOwner }
  const encodedOwner = encodeOwner(immutableOwner)
  let immutableProof
  await step('publish owner-scoped immutable semantic smoke', async () => {
    const source = stageSample('doctrine-app', sources, immutableOwner, immutableSlug)
    const result = publishJson(vista, immutableSlug, immutableEnv, tmp)
    if (result.owner !== immutableOwner || result.slug !== immutableSlug || result.version !== 1) {
      throw new Error(`unexpected owner-scoped publish result: ${JSON.stringify(result)}`)
    }

    const version = join(appsDir, '_owned', encodedOwner, immutableSlug, 'v1')
    const receiptPath = join(version, 'publication.json')
    const semanticsPath = join(version, 'vista-semantics.json')
    if (!existsSync(receiptPath) || !existsSync(semanticsPath)) {
      throw new Error('static publication omitted publication.json or vista-semantics.json')
    }
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
    const semantics = JSON.parse(readFileSync(semanticsPath, 'utf8'))
    if (
      receipt.owner !== immutableOwner ||
      receipt.slug !== immutableSlug ||
      receipt.version !== 1 ||
      receipt.semantics?.path !== 'vista-semantics.json' ||
      !receipt.inventory?.some(({ path }) => path === 'site/index.html')
    ) {
      throw new Error(`invalid static publication receipt: ${JSON.stringify(receipt)}`)
    }
    if (
      semantics.app?.title !== 'Published apps served from immutable source' ||
      !Array.isArray(semantics.nodes) ||
      semantics.nodes.length === 0
    ) {
      throw new Error(`invalid semantic publication manifest: ${JSON.stringify(semantics)}`)
    }
    immutableProof = {
      source,
      version,
      url: `${env.VISTA_URL}${receipt.basePath}`,
      encodedOwner,
      latestUrl: `${env.VISTA_URL}${receipt.basePath.replace(/v1\/$/, 'latest/')}`,
      title: semantics.app.title,
      expectedHtml: readFileSync(join(version, 'site', 'index.html'), 'utf8'),
    }
  })

  const loadImmutableHtml = async () => {
    const response = await fetch(immutableProof.url, { signal: AbortSignal.timeout(30_000) })
    const body = await response.text()
    if (response.status !== 200 || body !== immutableProof.expectedHtml) {
      throw new Error(
        `immutable publication returned status ${response.status} or non-receipted bytes`,
      )
    }
  }

  const assertReceiptlessUnavailable = async () => {
    const receiptless = join(appsDir, '_owned', immutableProof.encodedOwner, immutableSlug, 'v2')
    mkdirSync(receiptless)
    writeFileSync(
      join(receiptless, 'meta.json'),
      JSON.stringify({
        owner: immutableOwner,
        slug: immutableSlug,
        version: 2,
        author: 'packaged-smoke',
        timestamp: new Date().toISOString(),
        changeSummary: 'receiptless version must stay unavailable',
        parent: 1,
      }),
    )
    writeFileSync(
      join(receiptless, 'index.html'),
      '<!doctype html><main>RECEIPTLESS SOURCE MUST NOT RENDER</main>',
    )
    const url = `${env.VISTA_URL}/r/${encodeRouteOwner(immutableOwner)}/${immutableSlug}/v2/`
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    const body = await response.text()
    if (response.status !== 409 || body.includes('RECEIPTLESS SOURCE MUST NOT RENDER')) {
      throw new Error(`receiptless publication did not fail closed with 409: ${response.status}`)
    }
  }

  await step('publish pinned esm.sh runtime-policy smoke', async () => {
    stageInline(sources, smokeOwner, 'esm-sh-smoke', {
      'app.tsx': `import { AppRoot } from '@vista/blocks'
import 'https://esm.sh/zod@3.25.76'
export default function VistaApp() {
  return <AppRoot title="esm.sh pinned ok" template="architecture-review" scope="runtime policy" />
}
`,
    })
    publish(vista, 'esm-sh-smoke', env, tmp)
  })

  await step('assert blocked import diagnostic', async () => {
    const source = stageInline(sources, smokeOwner, 'blocked-import-smoke', {
      'app.tsx': `import 'lodash'
import { AppRoot } from '@vista/blocks'
export default function VistaApp() {
  return <AppRoot title="Blocked import" template="architecture-review" scope="runtime policy" />
}
`,
    })
    let diagnostic
    try {
      sh(vista, ['check', source, '--json'], { cwd: tmp, env })
    } catch (error) {
      if (error.status !== 1) throw error
      diagnostic = JSON.parse(error.stdout)
    }
    if (
      diagnostic?.diagnostic?.code !== 'import' ||
      !diagnostic.diagnostic.consequences.some((problem) => problem.includes('lodash'))
    ) {
      throw new Error(
        `blocked app did not report its forbidden import: ${JSON.stringify(diagnostic)}`,
      )
    }
    let rejected = false
    try {
      publish(vista, 'blocked-import-smoke', env, tmp)
    } catch (error) {
      if (error.status !== 1) throw error
      rejected = true
    }
    if (
      !rejected ||
      existsSync(join(appsDir, '_owned', encodedSmokeOwner, 'blocked-import-smoke', 'v1'))
    ) {
      throw new Error('blocked import was published')
    }
  })

  if (noBrowser) {
    await step('HTTP: immutable publication survives source removal', async () => {
      await loadImmutableHtml()
      rmSync(immutableProof.source, { recursive: true })
      await loadImmutableHtml()
      await assertReceiptlessUnavailable()
    })
  }

  if (!noBrowser) {
    await step('browser render proof', async () => {
      const requireFromWorkspace = createRequire(join(workspace, 'package.json'))
      const { chromium } = requireFromWorkspace('@playwright/test')
      browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        const browserErrors = []
        page.on('console', (message) => {
          if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
        })
        page.on('pageerror', (error) => browserErrors.push(`pageerror: ${String(error)}`))
        await step('browser: immutable semantic publication survives source removal', async () => {
          browserErrors.length = 0
          const initial = await page.goto(immutableProof.url, { waitUntil: 'networkidle' })
          if (initial?.status() !== 200) {
            throw new Error(`immutable publication initially returned ${initial?.status()}`)
          }
          await page
            .getByText('Published apps served from immutable source')
            .first()
            .waitFor({ timeout: 45_000 })

          rmSync(immutableProof.source, { recursive: true })
          const reloaded = await page.reload({ waitUntil: 'networkidle' })
          if (reloaded?.status() !== 200) {
            throw new Error(`immutable publication reload returned ${reloaded?.status()}`)
          }
          await page
            .getByText('Published apps served from immutable source')
            .first()
            .waitFor({ timeout: 45_000 })
          if (browserErrors.length > 0) {
            throw new Error(
              `immutable publication produced browser errors:\n${browserErrors.join('\n')}`,
            )
          }
          await assertReceiptlessUnavailable()
        })
        await step('browser: AppShell version control', async () => {
          await page.goto(`${env.VISTA_URL}/r/${encodedSmokeOwner}/doctrine-smoke/v1/`, {
            waitUntil: 'networkidle',
          })
          browserErrors.length = 0
          await page.reload({ waitUntil: 'networkidle' })
          try {
            await page.locator('.vista-shell').waitFor({ timeout: 45_000 })
          } catch (error) {
            throw new Error(
              `AppShell did not render; browser errors:\n${browserErrors.join('\n') || '<none>'}`,
              { cause: error },
            )
          }
          await page.getByRole('button', { name: 'Vista version' }).waitFor({ timeout: 45_000 })
        })
        await step('browser: heavy kit graph', async () => {
          await page.goto(`${env.VISTA_URL}/r/${encodedSmokeOwner}/heavy-smoke/v1/`, {
            waitUntil: 'networkidle',
          })
          await page.reload({ waitUntil: 'networkidle' })
          await page.locator('.react-flow__node').first().waitFor({ timeout: 45_000 })
        })
        // R58 category-closer (decision 0052): the chart review renders the
        // real recharts/es-toolkit CJS closure. Unlike the positive-selector
        // steps above, this ALSO asserts zero dep-resolution console errors —
        // the exact `does not provide an export named 'default'` /
        // `Failed to resolve import` signature the blank render produced. This
        // is the render-proof that ACTUALLY runs in CI (packaged-smoke is
        // pr-required and hard-fails without a browser), closing the gap the
        // `skipIf(!HAS_BROWSER)` browser vitest left open.
        await step('browser: chart interop (recharts -> es-toolkit)', async () => {
          const depErrors = []
          const isDepError = (t) =>
            /does not provide an export named|Failed to resolve import|Failed to fetch dynamically imported/.test(
              t,
            )
          const onConsole = (m) => {
            if (m.type() === 'error' && isDepError(m.text())) depErrors.push(m.text())
          }
          const onPageError = (e) => {
            if (isDepError(String(e))) depErrors.push(String(e))
          }
          page.on('console', onConsole)
          page.on('pageerror', onPageError)
          try {
            await page.goto(`${env.VISTA_URL}/r/${encodedSmokeOwner}/chart-smoke/v1/`, {
              waitUntil: 'networkidle',
            })
            await page.reload({ waitUntil: 'networkidle' })
            // A recharts SVG mounts only if es-toolkit's CJS interop resolved.
            await page
              .locator('.vista-chart svg, .recharts-surface')
              .first()
              .waitFor({ timeout: 45_000 })
            const rootText = (await page.locator('#root').textContent()) ?? ''
            if (rootText.trim().length === 0) {
              throw new Error('R58: chart review #root is empty — blank render')
            }
            if (depErrors.length > 0) {
              throw new Error(
                `R58: chart review produced dep-resolution console errors (the blank-render ` +
                  `signature):\n${depErrors.join('\n')}`,
              )
            }
          } finally {
            page.off('console', onConsole)
            page.off('pageerror', onPageError)
          }
        })

        const reactError =
          /Invalid hook call|does not provide an export named|Failed to resolve import|Failed to fetch dynamically imported|Cannot read properties of null \(reading 'use|dispatcher is null|Should have a queue/
        const assertTelemetryRoute = async ({ kind, slug, mode }) => {
          const errors = []
          const onConsole = (message) => {
            if (message.type() === 'error' && reactError.test(message.text())) {
              errors.push(`[console] ${message.text()}`)
            }
          }
          const onPageError = (error) => {
            if (reactError.test(String(error))) errors.push(`[pageerror] ${String(error)}`)
          }
          page.on('console', onConsole)
          page.on('pageerror', onPageError)
          try {
            const url = `${env.VISTA_URL}/r/${encodedSmokeOwner}/${slug}/${mode === 'frozen' ? 'v1' : 'draft'}/`
            const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
            if (response?.status() !== 200) {
              throw new Error(`${kind} ${mode} route returned ${response?.status()}`)
            }
            await page.reload({ waitUntil: 'networkidle', timeout: 90_000 })

            const selector =
              kind === 'metric'
                ? '[data-testid="telemetry-island"] canvas'
                : kind === 'trace'
                  ? '[data-testid="telemetry-island-trace"]'
                  : '[data-testid="telemetry-island-flamegraph"] canvas'
            const rendered = page.locator(selector).first()
            await rendered.waitFor({ state: 'visible', timeout: 45_000 })

            if (kind === 'trace') {
              await page.getByText('genie/command').first().waitFor({ timeout: 30_000 })
              await page.getByText('genie/discoverAndValidate').first().waitFor({ timeout: 30_000 })
            } else {
              const geometry = await rendered.evaluate((canvas) => ({
                displayWidth: canvas.getBoundingClientRect().width,
                displayHeight: canvas.getBoundingClientRect().height,
                pixelWidth: canvas.width,
                pixelHeight: canvas.height,
              }))
              if (
                geometry.displayWidth <= 0 ||
                geometry.displayHeight <= 0 ||
                geometry.pixelWidth <= 0 ||
                geometry.pixelHeight <= 0
              ) {
                throw new Error(
                  `${kind} ${mode} canvas has zero geometry: ${JSON.stringify(geometry)}`,
                )
              }
            }

            const otherMode = mode === 'frozen' ? 'live' : 'frozen'
            if ((await page.locator(`[data-vista-badge="${mode}"]`).count()) === 0) {
              throw new Error(`${kind} ${mode} route omitted its ${mode} badge`)
            }
            if ((await page.locator(`[data-vista-badge="${otherMode}"]`).count()) !== 0) {
              throw new Error(`${kind} ${mode} route also rendered a ${otherMode} badge`)
            }

            const versions = await page.evaluate(() => ({
              host: globalThis.__VISTA_HOST_REACT__,
              island: globalThis.__VISTA_ISLAND_REACT__,
            }))
            if (
              !String(versions.host).startsWith('19.') ||
              !String(versions.island).startsWith('19.')
            ) {
              throw new Error(
                `${kind} ${mode} React coexistence failed: ${JSON.stringify(versions)}`,
              )
            }
            if (errors.length > 0) {
              throw new Error(
                `${kind} ${mode} produced React/interop errors:\n${errors.join('\n')}`,
              )
            }
          } finally {
            page.off('console', onConsole)
            page.off('pageerror', onPageError)
          }
        }

        for (const [kind, slug] of [
          ['metric', 'telemetry-metric-smoke'],
          ['trace', 'telemetry-trace-smoke'],
          ['flamegraph', 'telemetry-flamegraph-smoke'],
        ]) {
          for (const mode of ['frozen', 'live']) {
            await step(`browser: ${kind} telemetry island (${mode})`, () =>
              assertTelemetryRoute({ kind, slug, mode }),
            )
          }
        }

        await step('browser: pinned esm.sh runtime import', async () => {
          await page.goto(`${env.VISTA_URL}/r/${encodedSmokeOwner}/esm-sh-smoke/v1/`, {
            waitUntil: 'networkidle',
          })
          await page.getByText('esm.sh pinned ok').waitFor({ timeout: 45_000 })
        })
      } finally {
        await browser.close()
        browser = undefined
      }
    })
  }

  console.log(
    JSON.stringify(
      {
        package: packagePath,
        roots: { tmp, appsDir, cache },
        serviceUrl: env.VISTA_URL,
        browser: !noBrowser,
        status: 'ok',
      },
      null,
      2,
    ),
  )
}

main()
  .then(cleanup)
  .catch(async (error) => {
    failed = true
    reportFailure(error)
    await cleanup()
    process.exitCode = 1
  })
