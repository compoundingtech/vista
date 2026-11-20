import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Effect } from 'effect'
import { expect, it, vi } from 'vitest'

import { publishViaControl } from './control-test-client.ts'
import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'
import { freePort } from './test-support.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER = 'agent/compoundingtech/publish-memory-test'
const SLUG = 'publish-worker-memory'
const PUBLICATIONS = 10
const WARMUP_PUBLICATIONS = 3
const MIB = 1024 * 1024
// Compare each peak after publication 3 against publication 3, including swap.
// The isolated f413 worker run grew 3.38 MiB footprint / 1.11 MiB external;
// these ceilings leave >75x / >57x measured headroom for host/JIT variation.
// Main b96 grew 915.73 MiB footprint over the same window (>3.5x the cap).
// Final-head packaged measurements and observed margins accompany the PR.
const MAX_FOOTPRINT_GROWTH = 256 * MIB
const MAX_EXTERNAL_GROWTH = 64 * MIB

type WorkerChild = { pid: number; argv: string[] }
type MemorySample = {
  publication: number
  pid: number
  latencyMs: number | null
  rssBytes: number
  swapBytes: number
  externalBytes: number
  workerChildren: WorkerChild[]
}

// Children can be attached to any native thread, not just the process leader.
const workerChildren = (parent: number): WorkerChild[] => {
  const children = new Set<number>()
  for (const task of readdirSync(`/proc/${parent}/task`)) {
    try {
      const text = readFileSync(`/proc/${parent}/task/${task}/children`, 'utf8').trim()
      if (text !== '') for (const pid of text.split(/\s+/)) children.add(Number(pid))
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
  }
  return [...children]
    .sort((left, right) => left - right)
    .flatMap((pid) => {
      let argv: string[]
      try {
        argv = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean)
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
        throw error
      }
      // Empty cmdline includes zombies: exiting without reaping is a failure too.
      // Ignore persistent helpers such as the standing draft runtime's esbuild.
      return argv.length === 0 ||
        argv.some(
          (argument) =>
            argument === 'publish-worker' ||
            /(?:^|\/)publish-worker\.(?:mjs|js|ts)$/.test(argument),
        )
        ? [{ pid, argv }]
        : []
    })
}

const stop = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return
  const { promise: exited, resolve: done } = Promise.withResolvers<void>()
  child.once('exit', () => done())
  // A private process group also contains a worker if an assertion interrupts a
  // publication. Never leave that child holding the test's mutable directories.
  process.kill(-child.pid, 'SIGTERM')
  // This is a real OS process: fake timers cannot enforce its shutdown deadline.
  const timer = setTimeout(() => {
    try {
      process.kill(-child.pid!, 'SIGKILL')
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error
    }
  }, 15_000)
  try {
    await exited
  } finally {
    clearTimeout(timer)
  }
}

it.skipIf(process.platform !== 'linux')(
  'bounds real packaged-service memory over ten publications and reaps every worker',
  async () => {
    const packagePath = process.env.VISTA_TEST_PACKAGE
    if (!packagePath) {
      throw new Error(
        'Packaged regression requires VISTA_TEST_PACKAGE pointing to the built Vista package',
      )
    }
    const wrapper = join(resolve(packagePath), 'bin', 'vista-service')
    // Deliberately execute the actual wrapper, never a source service or a
    // Vitest-transformed worker. Missing/unbuilt packages must fail, not skip.
    const wrapperContents = readFileSync(wrapper, 'utf8')
    const scratchRoot = join(HERE, '..', 'tmp')
    mkdirSync(scratchRoot, { recursive: true })
    const directory = mkdtempSync(join(scratchRoot, 'vista-packaged-publish-memory-'))
    const environment: NodeJS.ProcessEnv = { ...process.env }
    for (const key of Object.keys(environment)) {
      if (key.startsWith('VISTA_') || key === 'BUN_OPTIONS' || key === 'NODE_OPTIONS')
        delete environment[key]
    }
    for (const [key, tail] of Object.entries({
      VISTA_APPS: 'apps',
      VISTA_SOURCES: 'sources',
      VISTA_CACHE: 'cache',
      VISTA_LIVE_STATE: 'live-state',
      TMPDIR: 'tmp',
      HOME: 'home',
      XDG_STATE_HOME: 'state',
      XDG_CACHE_HOME: 'xdg-cache',
      XDG_CONFIG_HOME: 'config',
    })) {
      environment[key] = join(directory, tail)
      mkdirSync(environment[key]!, { recursive: true })
    }
    let child: ChildProcess | undefined
    let output = ''
    let spawnError: Error | undefined
    const samples: MemorySample[] = []
    try {
      const port = await freePort()
      let probePort = await freePort()
      while (probePort === port) probePort = await freePort()
      const token = randomUUID()
      const origin = `http://127.0.0.1:${port}`
      Object.assign(environment, {
        VISTA_PORT: String(port),
        VISTA_PUBLIC_URL: origin,
        ROLLDOWN_WORKER_THREADS: '4',
        BUN_OPTIONS: `--preload ${join(HERE, 'publish-worker-memory-probe.mjs')}`,
        VISTA_TEST_PROBE_PORT: String(probePort),
        VISTA_TEST_PROBE_TOKEN: token,
      })
      const startedAt = performance.now()
      child = spawn(wrapper, [], {
        env: environment,
        cwd: directory,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      child.once('error', (error) => {
        spawnError = error
      })
      const capture = (chunk: Buffer) => {
        output = (output + chunk.toString()).slice(-64 * 1024)
      }
      child.stdout!.on('data', capture)
      child.stderr!.on('data', capture)
      const service = child
      const assertRunning = () => {
        if (spawnError) throw spawnError
        expect(service.exitCode, output).toBeNull()
        expect(service.signalCode, output).toBeNull()
      }
      let healthStatus: number | undefined
      await vi.waitFor(
        async () => {
          assertRunning()
          const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) })
          healthStatus = response.status
          await response.text()
          expect(healthStatus).toBe(200)
        },
        { timeout: 60_000, interval: 200 },
      )
      const startupReceipt = {
        package: resolve(packagePath),
        wrapper,
        pid: service.pid,
        url: `${origin}/health`,
        status: healthStatus,
        elapsedMs: performance.now() - startedAt,
        rollDownWorkerThreads: environment.ROLLDOWN_WORKER_THREADS,
        wrapperContents,
      }
      console.info('Packaged startup health receipt:', JSON.stringify(startupReceipt))
      expect(service.pid).toBeTypeOf('number')
      const pid = service.pid!
      const sampleMemory = async (publication: number, latencyMs: number | null) => {
        assertRunning()
        const response = await fetch(`http://127.0.0.1:${probePort}/memory`, {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        })
        expect(response.status).toBe(200)
        const probe = (await response.json()) as {
          pid: number
          externalBytes: number
          smaps: string
        }
        // Detect accidental binding by any inherited worker preload immediately.
        expect(probe.pid).toBe(pid)
        expect(Number.isFinite(probe.externalBytes)).toBe(true)
        const bytes = (field: string) => {
          const match = new RegExp(`^${field}:\\s+(\\d+)\\s+kB$`, 'm').exec(probe.smaps)
          if (match === null) throw new Error(`Missing ${field} in packaged parent smaps_rollup`)
          return Number(match[1]) * 1024
        }
        const sample: MemorySample = {
          publication,
          pid,
          latencyMs,
          rssBytes: bytes('Rss'),
          swapBytes: bytes('Swap'),
          externalBytes: probe.externalBytes,
          workerChildren: workerChildren(pid),
        }
        console.info('Packaged publication memory:', JSON.stringify(sample))
        expect(
          sample.workerChildren,
          `publication ${publication} replied before worker reaping`,
        ).toEqual([])
        return sample
      }
      // The health endpoint and test-only probe both belong to the same real
      // packaged parent. Wait explicitly for probe readiness before baseline GC.
      await vi.waitFor(
        async () => {
          assertRunning()
          const response = await fetch(`http://127.0.0.1:${probePort}/memory`, {
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(1000),
          })
          expect(response.status).toBe(200)
          expect(((await response.json()) as { pid: number }).pid).toBe(pid)
        },
        { timeout: 10_000, interval: 100 },
      )
      samples.push(await sampleMemory(0, null))
      const source = appSourcePath(environment.VISTA_SOURCES!, OWNER, SLUG)
      mkdirSync(source, { recursive: true })
      for (let publication = 1; publication <= PUBLICATIONS; publication++) {
        writeFileSync(
          join(source, 'app.tsx'),
          `import { AppRoot, Decision } from '@vista/blocks'
export default function PublishedApp() {
  return <AppRoot title="Publish worker memory" template="architecture-review" scope="scope">
    <Decision id="decision" status="locked" provenance="test/Decision">
      <main>Publication ${publication}</main>
    </Decision>
  </AppRoot>
}
`,
        )
        const started = performance.now()
        const result = await Effect.runPromise(
          publishViaControl(port, {
            owner: OWNER,
            slug: SLUG,
            author: 'publish-memory-regression',
            changeSummary: `Publication ${publication}`,
          }),
        )
        const latencyMs = performance.now() - started
        expect(result.version).toBe(publication)
        samples.push(await sampleMemory(publication, latencyMs))
        const response = await fetch(
          `${origin}/r/${encodeRouteOwner(OWNER)}/${SLUG}/v${publication}/`,
          {
            signal: AbortSignal.timeout(10_000),
          },
        )
        expect(response.status).toBe(200)
        expect(await response.text()).toContain('<html')
      }
      const warmup = samples[WARMUP_PUBLICATIONS]!
      const steady = samples.slice(WARMUP_PUBLICATIONS + 1)
      const peakFootprintGrowth =
        Math.max(...steady.map((sample) => sample.rssBytes + sample.swapBytes)) -
        (warmup.rssBytes + warmup.swapBytes)
      const peakExternalGrowth =
        Math.max(...steady.map((sample) => sample.externalBytes)) - warmup.externalBytes
      const diagnostics = JSON.stringify({
        startupReceipt,
        samples,
        peakFootprintGrowth,
        peakExternalGrowth,
      })
      expect(peakFootprintGrowth, diagnostics).toBeLessThan(MAX_FOOTPRINT_GROWTH)
      expect(peakExternalGrowth, diagnostics).toBeLessThan(MAX_EXTERNAL_GROWTH)
      assertRunning()
      expect(workerChildren(pid)).toEqual([])
    } catch (error) {
      console.error('Packaged service output:', output)
      throw error
    } finally {
      try {
        if (child) await stop(child)
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    }
  },
  600_000,
)
