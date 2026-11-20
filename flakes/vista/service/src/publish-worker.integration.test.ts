import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Effect, Fiber, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import * as RpcClient from 'effect/rpc/RpcClient'
import { layerJson } from 'effect/rpc/RpcSerialization'
import { expect, it, vi } from 'vitest'

import { freePort, installTestChangelog } from './test-support.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER = 'agent/compoundingtech/publish-memory-test'
const SLUG = 'publish-worker-memory'
const PUBLICATIONS = 10
const WARMUP_PUBLICATIONS = 3
const MIB = 1024 * 1024

// Initial conservative ceilings, not a measured steady-state claim. Three full
// publishes absorb lazy imports/JIT and cache initialization. Across the remaining
// seven, allow 256 MiB RSS+swap and 64 MiB external growth. Keep RSS+swap together:
// swapping retained native allocations out must not make a leak look fixed.
// Calibrate from repeated cold-process runs on CI and the affected Linux host:
// compare each post-warmup peak against publication 3, retain >=2x the largest
// fixed-run delta, and verify the pre-fix implementation still exceeds the cap.
const MAX_FOOTPRINT_GROWTH = 256 * MIB
const MAX_EXTERNAL_GROWTH = 64 * MIB

type MemorySample = {
  publication: number
  pid: number
  rssBytes: number
  swapBytes: number
  externalBytes: number
  workerChildren: { pid: number; argv: string[] }[]
}

// Children can belong to the libuv task that spawned them, rather than the
// process leader. Inspect every task so a worker cannot evade the exit assertion.
const childPids = (): number[] => {
  const children = new Set<number>()
  for (const task of readdirSync('/proc/self/task')) {
    let text: string
    try {
      text = readFileSync(`/proc/self/task/${task}/children`, 'utf8').trim()
    } catch (error) {
      // A native thread may exit between listing tasks and reading its children.
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue
      throw error
    }
    if (text !== '') for (const pid of text.split(/\s+/)) children.add(Number(pid))
  }
  return [...children].sort((left, right) => left - right)
}

const workerChildren = (): MemorySample['workerChildren'] =>
  childPids().flatMap((pid) => {
    let argv: string[]
    try {
      argv = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
      throw error
    }
    // Zombies have an empty cmdline. Count them too: exit without reaping is
    // not sufficient, and argv matching alone would silently miss that leak.
    if (argv.length === 0) return [{ pid, argv }]
    // Source tests launch the dedicated entry; packaged services dispatch the
    // same executable with the publish-worker subcommand. Ignore unrelated
    // persistent helpers (for example, the standing Vite runtime's esbuild).
    return argv.some(
      (argument) =>
        argument === 'publish-worker' || /(?:^|\/)publish-worker\.(?:ts|js)$/.test(argument),
    )
      ? [{ pid, argv }]
      : []
  })

const sampleMemory = (publication: number): MemorySample => {
  const status = readFileSync('/proc/self/status', 'utf8')
  const statusBytes = (field: string): number => {
    const match = new RegExp(`^${field}:\\s+(\\d+)\\s+kB$`, 'm').exec(status)
    if (match === null) throw new Error(`Missing ${field} in /proc/self/status`)
    return Number(match[1]) * 1024
  }
  return {
    publication,
    pid: process.pid,
    rssBytes: statusBytes('VmRSS'),
    swapBytes: statusBytes('VmSwap'),
    externalBytes: process.memoryUsage().external,
    workerChildren: workerChildren(),
  }
}

it.skipIf(process.platform !== 'linux')(
  'bounds standing-service memory across ten real publications and reaps every publish worker',
  async () => {
    // The suite uses isolated Vitest forks. Install all mutable roots before
    // importing service modules; no publication or trust state touches user data.
    mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
    const directory = mkdtempSync(join(HERE, '..', 'tmp', 'vista-publish-worker-'))
    vi.stubEnv('VISTA_APPS', join(directory, 'apps'))
    vi.stubEnv('VISTA_SOURCES', join(directory, 'sources'))
    vi.stubEnv('VISTA_CACHE', join(directory, 'cache'))
    vi.stubEnv('VISTA_LIVE_STATE', join(directory, 'live-state'))
    vi.stubEnv('ROLLDOWN_WORKER_THREADS', '4')
    let close: (() => Promise<void>) | undefined
    let restoreChangelog: (() => void) | undefined
    const samples: MemorySample[] = []
    try {
      restoreChangelog = await installTestChangelog(directory)
      // Static imports would initialize module-scoped paths before the private
      // environment above; this intentionally tests that module-load boundary.
      const { PublishInput, PublishOk, VistaControlApi, encodeRouteOwner } =
        await import('./control.ts')
      const { appSourcePath } = await import('./paths.ts')
      const { startService } = await import('./server.ts')
      const { wireCall } = await import('./wire.ts')
      const source = appSourcePath(join(directory, 'sources'), OWNER, SLUG)
      mkdirSync(source, { recursive: true })
      const port = await freePort()
      const started = await startService(port)
      close = started.close
      const origin = `http://127.0.0.1:${port}`
      const protocol = RpcClient.layerProtocolHttp({ url: `${origin}/_rpc/control` }).pipe(
        Layer.provide(layerJson),
        Layer.provide(FetchHttpClient.layer),
      )

      for (let publication = 1; publication <= PUBLICATIONS; publication++) {
        writeFileSync(
          join(source, 'app.tsx'),
          `import { AppRoot, Decision } from '@vista/blocks'
export default function PublishedApp() {
  return (
    <AppRoot title="Publish worker memory" template="architecture-review" scope="scope">
      <Decision id="decision" status="locked" provenance="test/Decision">
        <main>Publication ${publication}</main>
      </Decision>
    </AppRoot>
  )
}
`,
        )
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const client = yield* RpcClient.make(VistaControlApi)
            return yield* wireCall(
              'vista.publish',
              PublishInput,
              PublishOk,
            )((envelope) => client['vista.publish'](envelope), {
              owner: OWNER,
              slug: SLUG,
              author: 'publish-memory-regression',
              changeSummary: `Publication ${publication}`,
            })
          }).pipe(Effect.scoped, Effect.provide(protocol)),
        )
        expect(result.version).toBe(publication)
        const sample = sampleMemory(publication)
        samples.push(sample)
        console.info('Publication parent memory:', JSON.stringify(sample))
        expect(
          sample.workerChildren,
          `publication ${publication} replied before its worker exited`,
        ).toEqual([])

        // Exercise the actual served artifact, not just an RPC success envelope.
        const response = await fetch(
          `${origin}/r/${encodeRouteOwner(OWNER)}/${SLUG}/v${publication}/`,
        )
        expect(response.status).toBe(200)
        expect(await response.text()).toContain('<html')
      }

      const warmup = samples[WARMUP_PUBLICATIONS - 1]!
      const steady = samples.slice(WARMUP_PUBLICATIONS)
      const peakFootprintGrowth =
        Math.max(...steady.map((sample) => sample.rssBytes + sample.swapBytes)) -
        (warmup.rssBytes + warmup.swapBytes)
      const peakExternalGrowth =
        Math.max(...steady.map((sample) => sample.externalBytes)) - warmup.externalBytes
      const diagnostics = JSON.stringify({ samples, peakFootprintGrowth, peakExternalGrowth })
      expect(peakFootprintGrowth, diagnostics).toBeLessThan(MAX_FOOTPRINT_GROWTH)
      expect(peakExternalGrowth, diagnostics).toBeLessThan(MAX_EXTERNAL_GROWTH)
      expect(workerChildren()).toEqual([])

      // Hold a real capture open after claiming. Interrupt the parent fiber and
      // verify cleanup also evicts a registry loaded in the standing process
      // (the same ownership split as browser render smoke).
      const providerDirectory = join(source, 'providers')
      mkdirSync(providerDirectory)
      writeFileSync(
        join(providerDirectory, 'held.query.ts'),
        `import { contract } from '@vista/blocks/query'
import { Schema } from 'effect'
import { Rpc, RpcGroup } from 'effect/rpc'
export const held = contract({
  id: 'held-capture',
  group: RpcGroup.make(Rpc.make('read', { payload: {}, success: Schema.String })),
})
`,
      )
      writeFileSync(
        join(providerDirectory, 'held.provider.ts'),
        `import { implement, mountProvider } from '@vista/data/provider'
import { Effect, Layer } from 'effect'
import { held } from './held.query.ts'
export default mountProvider(implement(held, {
  purity: 'pure',
  handlers: { read: () => Effect.never },
}), Layer.empty)
`,
      )
      writeFileSync(
        join(source, 'app.tsx'),
        `import { AppRoot, Decision } from '@vista/blocks'
import { bind, useBinding } from '@vista/blocks/query'
import { held } from './providers/held.query.ts'
const binding = bind(held.ops.read, {}, { mode: 'frozen' })
const Held = () => { useBinding(binding); return <p>Held</p> }
export default function PublishedApp() {
  return <AppRoot title="Interrupted publish" template="architecture-review" scope="scope">
    <Decision id="decision" status="locked" provenance="test/Decision"><Held /></Decision>
  </AppRoot>
}
`,
      )
      const { publishInWorker } = await import('./publish-worker-client.ts')
      const { versionDir } = await import('./registry.ts')
      const identity = { owner: OWNER, slug: SLUG, version: PUBLICATIONS + 1 }
      const claimed = versionDir(OWNER, SLUG, identity.version)
      const publishing = Effect.runFork(
        publishInWorker(
          {
            owner: OWNER,
            slug: SLUG,
            author: 'publish-memory-regression',
            changeSummary: 'Interrupted capture',
          },
          started.state.providers,
        ).pipe(Effect.withSpan('test.publish.interrupted')),
      )
      try {
        await vi.waitFor(() => expect(existsSync(join(claimed, '.publishing'))).toBe(true), {
          timeout: 60_000,
        })
        await started.state.providers.ensureVersion(identity, join(claimed, 'providers'))
        expect(started.state.providers.getVersion(identity)).toBeDefined()
      } finally {
        await Effect.runPromise(Fiber.interrupt(publishing))
      }
      expect(existsSync(claimed)).toBe(false)
      expect(started.state.providers.getVersion(identity)).toBeUndefined()
      expect(workerChildren()).toEqual([])
    } finally {
      try {
        await close?.()
      } finally {
        restoreChangelog?.()
        vi.unstubAllEnvs()
        rmSync(directory, { recursive: true, force: true })
      }
    }
  },
  600_000,
)
