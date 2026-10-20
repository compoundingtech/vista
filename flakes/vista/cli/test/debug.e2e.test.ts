import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resolveVistaBuildInfo } from '../../service/src/build-info.ts'
import { VISTA_CHANGELOG_FILE, VISTA_CHANGELOG_PATH_ENV } from '../../service/src/changelog-companion.ts'
import type { InterviewStore } from '../../service/src/interview/store.ts'
import { appSourcePath } from '../../service/src/paths.ts'
import { freePort } from '../../service/src/test-support.ts'

const execFileAsync = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const CLI = join(HERE, '..', 'src', 'cli.ts')
const OWNER = 'agent/vista/cli-e2e'
const ENCODED_OWNER = 'o-6167656e742f76697374612f636c692d653265'
const ORIGINAL_CHANGELOG_PATH = process.env[VISTA_CHANGELOG_PATH_ENV]

let dir: string
let close: (() => Promise<void>) | undefined
let interview: InterviewStore
let port: number

// The canonical tailnet base VISTA_PUBLIC_URL is plumbed with at deploy time.
const CANONICAL_BASE = 'https://vista-test.test-tailnet.ts.net'

const baseEnv = (extra: Record<string, string> = {}): Record<string, string> => ({
  ...process.env,
  VISTA_URL: `http://127.0.0.1:${port}`,
  VISTA_APPS: join(dir, 'apps'),
  VISTA_CACHE: join(dir, '.vista-cache'),
  VISTA_SOURCES: join(dir, 'sources'),
  ST_AGENT: OWNER,
  VISTA_PUBLIC_URL: CANONICAL_BASE,
  NO_COLOR: '1',
  ...extra,
})

// Spawn the CLI under its production runtime, bun (the packaged `vista` is a
// `bun --compile` binary). Since Track E (decision 0063) the CLI renders via
// `@overeng/tui-react` JSX (`.tsx`), which node's `--experimental-strip-types`
// cannot load; bun runs `.ts`/`.tsx` natively.
const runVista = async (...args: readonly string[]): Promise<string> => {
  const { stdout } = await execFileAsync('bun', [CLI, ...args], { env: baseEnv() })
  return stdout.trim()
}

const runVistaRaw = (
  args: readonly string[],
  options: { readonly servicePort?: number; readonly env?: Record<string, string> } = {},
) =>
  execFileAsync('bun', [CLI, ...args], {
    env: baseEnv({
      ...(options.servicePort !== undefined
        ? { VISTA_URL: `http://127.0.0.1:${options.servicePort}` }
        : {}),
      ...(options.env ?? {}),
    }),
  })

beforeAll(async () => {
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-debug-cli-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  const sources = join(dir, 'sources')
  process.env.VISTA_SOURCES = sources
  const changelogPath = join(dir, VISTA_CHANGELOG_FILE)
  writeFileSync(changelogPath, JSON.stringify({
    schemaVersion: 1,
    product: 'vista',
    build: { machineVersion: resolveVistaBuildInfo().machineVersion },
    entries: [],
  }))
  process.env[VISTA_CHANGELOG_PATH_ENV] = changelogPath

  const appDir = join(dir, 'apps', '_owned', encodeURIComponent(OWNER), 'cli-probe')
  const versionDir = join(appDir, 'v1')
  const probeSource = appSourcePath(sources, OWNER, 'cli-probe')
  const publishSource = appSourcePath(sources, OWNER, 'cli-publish')
  mkdirSync(versionDir, { recursive: true })
  mkdirSync(probeSource, { recursive: true })
  mkdirSync(publishSource, { recursive: true })
  writeFileSync(join(versionDir, 'index.html'), '<div id="root"></div>')
  writeFileSync(
    join(probeSource, 'app.tsx'),
    `import { AppRoot, MetricQuery, Section } from '@vista/blocks'
export default function CliProbe() {
  return (
    <AppRoot title="CLI Probe" template="telemetry-exploration" scope="CLI debug plan fixture">
      <Section><MetricQuery query="up" /></Section>
    </AppRoot>
  )
}
`,
  )
  writeFileSync(
    join(publishSource, 'app.tsx'),
    `import { AppRoot, Section } from '@vista/blocks'
export default function CliPublish() {
  return (
    <AppRoot title="CLI Publish" template="architecture-review" scope="CLI publication fixture">
      <Section><p>Published through the CLI.</p></Section>
    </AppRoot>
  )
}
`,
  )
  writeFileSync(
    join(versionDir, 'meta.json'),
    JSON.stringify({
      owner: OWNER,
      slug: 'cli-probe',
      version: 1,
      author: 'tester',
      timestamp: '2026-06-26T00:00:00.000Z',
      changeSummary: 'debug e2e fixture',
      parent: null,
      title: 'CLI Probe',
      template: 'infra',
      status: { locked: 1, open: 0, awaiting: 0 },
    }),
  )
  symlinkSync('v1', join(appDir, 'latest'))

  // Load after configuring isolated paths: the service memoizes its runtime roots.
  const { startService } = await import('../../service/src/server.ts')
  port = await freePort()
  const started = await startService(port)
  // This fixture intentionally lacks shipped providers, exercising blocked preflight.
  await started.state.providers.base.close()
  interview = started.state.interview
  close = started.close
}, 60_000)

afterAll(async () => {
  await close?.()
  if (ORIGINAL_CHANGELOG_PATH === undefined) delete process.env[VISTA_CHANGELOG_PATH_ENV]
  else process.env[VISTA_CHANGELOG_PATH_ENV] = ORIGINAL_CHANGELOG_PATH
  if (dir) rmSync(dir, { recursive: true, force: true })
}, 30_000)

describe('vista debug CLI', () => {
  it.each([undefined, 'bogus'])('runs help with ST_AGENT=%s (#4402)', async (owner) => {
    const help = await execFileAsync('bun', [CLI, '--help'], {
      env: { ...baseEnv(), ST_AGENT: owner, OTEL_EXPORTER_OTLP_ENDPOINT: undefined },
      timeout: 100_000,
    })
    expect(help.stdout).toContain('vista')
  }, 120_000)

  it.each([undefined, 'bogus'])('runs local check with ST_AGENT=%s (#4402)', async (owner) => {
    const checked = await execFileAsync(
      'bun',
      [CLI, 'check', appSourcePath(join(dir, 'sources'), OWNER, 'cli-publish'), '--output', 'json'],
      {
        // Local diagnostics do not depend on the invoking host's telemetry exporter.
        env: { ...baseEnv(), ST_AGENT: owner, OTEL_EXPORTER_OTLP_ENDPOINT: undefined },
        timeout: 100_000,
      },
    )
    expect(checked.stdout).toMatch(/"_tag"\s*:\s*"ready"/)
  }, 120_000)

  it('prints the service seat-only refusal clearly for a dotted publishing owner', async () => {
    await expect(runVistaRaw(
      ['publish', 'cli-publish', '--message', 'must be refused'],
      { env: { ST_AGENT: 'dev3.direct.omp.pnfr87q8', OTEL_EXPORTER_OTLP_ENDPOINT: '' } },
    )).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'Vista owner "dev3.direct.omp.pnfr87q8" is a legacy dotted identity; publish from a managed seat',
      ),
    })
  }, 20_000)

  it('reports service health as schema-owned JSON', async () => {
    const info = JSON.parse(await runVista('debug', 'service', '--output', 'json')) as {
      readonly urlPath: string
      readonly apps: number
      readonly paths: { readonly apps: string; readonly cache: string }
    }

    expect(info.urlPath).toBe('/_rpc/control')
    // Only `cli-probe` is a durable app; `cli-publish` is authored in a tmp
    // app-dir and not published yet (decision 0053: drafts live outside the store).
    expect(info.apps).toBe(1)
    expect(info.paths.apps).toBe(join(dir, 'apps'))
    expect(info.paths.cache).toBe(join(dir, '.vista-cache'))
  }, 20_000)

  it('projects path diagnostics from service info', async () => {
    const paths = JSON.parse(await runVista('debug', 'paths', '--output', 'json')) as {
      readonly root: string
      readonly apps: string
      readonly cache: string
      readonly deps: string
    }

    expect(paths.root.length).toBeGreaterThan(0)
    expect(paths.apps).toBe(join(dir, 'apps'))
    expect(paths.cache).toBe(join(dir, '.vista-cache'))
    expect(paths.deps.length).toBeGreaterThan(0)

    // The default (piped) text render is tui-react `log` mode, whose
    // `renderToString` truncates lines at 80 cols — so assert render STRUCTURE
    // (section headers + field labels), not the long absolute paths. Exact path
    // values are owned by the `--output json` check above (full fidelity, no
    // truncation).
    const text = await runVista('debug', 'paths')
    expect(text).toContain('paths')
    expect(text).toContain('apps:')
    expect(text).toContain('diagnostics')
    expect(text).toContain('deps exists: yes')
  }, 20_000)

  it('renders service diagnostics with URLs and mutable roots', async () => {
    // See the paths test: piped `log` mode truncates at 80 cols; assert structure
    // here, exact paths are the json check's job.
    const text = await runVista('debug', 'service')

    expect(text).toContain('service')
    expect(text).toContain(`url: http://127.0.0.1:${port}`)
    expect(text).toContain(`rpc: http://127.0.0.1:${port}/_rpc/control`)
    expect(text).toContain('roots')
    expect(text).toContain('apps:')
    expect(text).toContain('cache:')
    expect(text).toContain('diagnostics')
    expect(text).toContain('apps writable: yes')
  }, 20_000)

  it('renders import diagnostics problems-first', async () => {
    const blocked = await runVista('debug', 'import', 'https://esm.sh/zod')
    expect(blocked).toContain('CRITICAL')
    expect(blocked).toContain('blocked import: https://esm.sh/zod')
    expect(blocked).toContain('fix: Pin the esm.sh package URL')
    expect(blocked).toContain('classification: remote-unpinned')

    const allowed = await runVista('debug', 'import', 'react')
    expect(allowed).not.toContain('CRITICAL')
    expect(allowed).toContain('status: allowed')
    expect(allowed).toContain('classification: provided')
  }, 20_000)

  it('lists, inspects, and preflights apps through the debug namespace', async () => {
    const listText = await runVista('list')
    expect(listText).toContain('APP')
    expect(listText).toContain('cli-probe')
    expect(listText).toContain('v1')
    // `cli-publish` is not published yet, so it is not in the durable index.
    expect(listText).toContain('1 app · 1 active · 0 retired')

    const rows = JSON.parse(await runVista('list', '--output', 'json')) as ReadonlyArray<{
      readonly owner: string
      readonly slug: string
      readonly latest: number | null
      readonly title?: string
    }>
    expect(rows).toContainEqual(
      expect.objectContaining({ owner: OWNER, slug: 'cli-probe', latest: 1, title: 'CLI Probe' }),
    )

    const row = JSON.parse(await runVista('debug', 'app', 'cli-probe', '--output', 'json')) as {
      readonly slug: string
      readonly latest: number | null
      readonly title?: string
      readonly template?: string
    }
    expect(row).toMatchObject({
      slug: 'cli-probe',
      latest: 1,
      title: 'CLI Probe',
      template: 'infra',
    })

    const appText = await runVista('debug', 'app', 'cli-probe')
    expect(appText).toContain('app')
    expect(appText).toContain('app: cli-probe')
    expect(appText).toContain('latest: v1')
    expect(appText).toContain('retired: no')

    const plan = JSON.parse(
      await runVista('debug', 'publish-plan', 'cli-probe', '--output', 'json'),
    ) as {
      readonly slug: string
      readonly publishable: boolean
      readonly providers: { readonly missing: ReadonlyArray<string> }
    }
    expect(plan.slug).toBe('cli-probe')
    expect(plan.publishable).toBe(false)
    expect(plan.providers.missing).toEqual(['otel'])

    const planText = await runVista('debug', 'publish-plan', 'cli-probe')
    expect(planText).toContain('CRITICAL')
    expect(planText).toContain('missing provider: otel')
    expect(planText).toContain('fix: mount the provider in the Vista service')
    expect(planText).toContain('publish plan')
    expect(planText).toContain('status: blocked')
  }, 60_000)

  it('renders runtime policy as a scannable debug summary', async () => {
    const runtimePolicy = JSON.parse(
      await runVista('debug', 'runtime-policy', '--output', 'json'),
    ) as {
      readonly publicImportRoots: readonly string[]
      readonly optimizeInclude: readonly string[]
      readonly aliases: readonly { readonly specifier: string; readonly target: string }[]
      readonly installed: { readonly workspaceClosureDirs: readonly string[] }
    }
    expect(runtimePolicy.publicImportRoots).toContain('@vista/blocks')
    expect(runtimePolicy.optimizeInclude).toContain('react')

    const text = await runVista('debug', 'runtime-policy')
    expect(text).toContain('runtime policy')
    expect(text).toContain('schema: v2')
    expect(text).toContain('public:')
    expect(text).toContain('optimize:')
    expect(text).toContain('aliases')
    expect(text).toContain('@vista/blocks ->')
    expect(text).toContain('remote')
    expect(text).toContain('esm.sh pinned package URL')
  }, 20_000)

  it('renders service-unreachable as a single agent-readable failure line', async () => {
    const unreachablePort = await freePort()
    await expect(runVistaRaw(['list'], { servicePort: unreachablePort })).rejects.toMatchObject({
      stderr: expect.stringContaining('vista: the Vista service is not reachable'),
    })
    await expect(runVistaRaw(['list'], { servicePort: unreachablePort })).rejects.toMatchObject({
      stderr: expect.stringContaining(`http://127.0.0.1:${unreachablePort}`),
    })
  }, 20_000)

  it('renders non-debug lifecycle commands through stable fixtures', async () => {
    const preview = await runVista('new', 'fresh-review', '--dry-run')
    expect(preview).toContain('new app preview')
    expect(preview).toContain('app: fresh-review')
    expect(preview).toContain(`service: http://127.0.0.1:${port}`)
    expect(preview).toContain('writes')

    const published = await runVista('publish', 'cli-publish', '-m', 'fixture publish')
    expect(published).toContain('publish')
    expect(published).toContain('app: cli-publish')
    expect(published).toContain('version: v1')
    expect(published).toContain('data: 0 frozen · 0 live')
    // The emitted URL is the canonical tailnet URL, not the loopback transport.
    expect(published).toContain(`url: ${CANONICAL_BASE}/r/${ENCODED_OWNER}/cli-publish/v1/`)
    expect(published).not.toContain('non-canonical')

    const publishedJson = JSON.parse(
      await runVista('publish', 'cli-publish', '-m', 'fixture publish 2', '--json'),
    ) as {
      readonly owner: string
      readonly slug: string
      readonly version: number
      readonly url: string
      readonly canonical: boolean
    }
    expect(publishedJson).toMatchObject({
      owner: OWNER,
      slug: 'cli-publish',
      version: 2,
      url: `${CANONICAL_BASE}/r/${ENCODED_OWNER}/cli-publish/v2/`,
      canonical: true,
    })

    const openText = await runVista('open', 'cli-publish', 'v2')
    expect(openText).toContain('open')
    expect(openText).toContain('app: cli-publish')
    expect(openText).toContain('version: v2')
    // Piped log rendering truncates at 80 columns; JSON retains the exact URL.
    expect(openText).toContain(`url: ${CANONICAL_BASE}/r/${ENCODED_OWNER}/`)
    expect(JSON.parse(await runVista('open', 'cli-publish', 'v2', '--output', 'json'))).toMatchObject({
      version: 'v2',
      url: `${CANONICAL_BASE}/r/${ENCODED_OWNER}/cli-publish/v2/`,
      canonical: true,
    })

    const openJson = JSON.parse(await runVista('open', 'cli-publish', '--output', 'json')) as {
      readonly slug: string
      readonly version: string
      readonly url: string
      readonly canonical: boolean
    }
    expect(openJson).toMatchObject({
      slug: 'cli-publish',
      version: 'latest',
      url: `${CANONICAL_BASE}/r/${ENCODED_OWNER}/cli-publish/latest`,
      canonical: true,
    })

    const retired = await runVista('retire', 'cli-publish')
    expect(retired).toContain('retire')
    expect(retired).toContain('app: cli-publish')
    expect(retired).toContain('status: retired')
    expect(retired).toContain('surfaces: 410')

    const retiredJson = JSON.parse(await runVista('retire', 'cli-publish', '--output', 'json')) as {
      readonly slug: string
    }
    expect(retiredJson).toMatchObject({ slug: 'cli-publish' })
  }, 120_000)

  it('fails loud without a canonical URL, and marks the --local loopback fallback (SVC-R55)', async () => {
    const noCanonicalEnv = {
      VISTA_PUBLIC_URL: '',
      XDG_CONFIG_HOME: join(dir, 'missing-config'),
    }
    // Fail-loud: no resolvable canonical URL and no opt-in → a clean error line,
    // and crucially NO emitted URL (never a silent dead loopback link).
    await expect(runVistaRaw(['open', 'cli-probe'], { env: noCanonicalEnv })).rejects.toMatchObject(
      {
        stderr: expect.stringContaining('no canonical tailnet URL is configured'),
      },
    )

    // --local opt-in: emit the loopback URL, clearly marked non-canonical.
    const localText = (
      await runVistaRaw(['open', 'cli-probe', '--local'], { env: noCanonicalEnv })
    ).stdout.trim()
    expect(localText).toContain(`url: http://127.0.0.1:${port}/r/${ENCODED_OWNER}/cli-probe/latest`)
    expect(localText).toContain('non-canonical')

    const localJson = JSON.parse(
      (
        await runVistaRaw(['open', 'cli-probe', '--local', '--output', 'json'], {
          env: noCanonicalEnv,
        })
      ).stdout.trim(),
    ) as { readonly url: string; readonly canonical: boolean }
    expect(localJson).toMatchObject({
      url: `http://127.0.0.1:${port}/r/${ENCODED_OWNER}/cli-probe/latest`,
      canonical: false,
    })

    // SVC-R55: `VISTA_LOCAL` env alone (NO `--local` flag) must also opt into the
    // marked loopback — flag-OR-env equivalence. Regression guard for the
    // `??`-vs-`||` bug where the absent flag's concrete `false` short-circuited
    // and the env opt-in was silently ignored through the command layer.
    const envLocalText = (
      await runVistaRaw(['open', 'cli-probe'], {
        env: { ...noCanonicalEnv, VISTA_LOCAL: 'true' },
      })
    ).stdout.trim()
    expect(envLocalText).toContain(
      `url: http://127.0.0.1:${port}/r/${ENCODED_OWNER}/cli-probe/latest`,
    )
    expect(envLocalText).toContain('non-canonical')

    // `debug service` surfaces the resolved canonical base next to the transport.
    const service = await runVista('debug', 'service')
    expect(service).toContain(`public: ${CANONICAL_BASE} (canonical)`)
    expect(service).toContain(`url: http://127.0.0.1:${port}`)
  }, 20_000)

  it('renders ask and await as fixture-backed operator output', async () => {
    const asked = await runVista(
      'ask',
      'cli-probe',
      'Ship the runtime policy slice?',
      '--option',
      'A:Ship:blocks drift locally',
      '--option',
      'B:Wait:keeps scope smaller',
      '--recommended',
      'A',
    )

    expect(asked).toContain('ask')
    expect(asked).toContain('app: cli-probe')
    expect(asked).toContain('question:')
    expect(asked).toContain('next')
    expect(asked).toContain('vista await cli-probe')

    const questionId = asked.match(/question: (?<id>[^\n]+)/)?.groups?.id
    expect(questionId).toBeDefined()

    const timedOut = await runVista('await', 'cli-probe', questionId!, '--timeout-ms', '1')
    expect(timedOut).toContain('WARNING')
    expect(timedOut).toContain('no answer yet')
    expect(timedOut).toContain('await')
    expect(timedOut).toContain('status: timeout')

    interview.submitAnswer(`${OWNER}/cli-probe`, questionId!, {
      chosenOptionIds: ['A'],
    })

    const answered = await runVista('await', 'cli-probe', questionId!, '--timeout-ms', '1')
    expect(answered).not.toContain('WARNING')
    expect(answered).toContain('await')
    expect(answered).toContain('status: answered')
    expect(answered).toContain('chosen: A')

    const json = JSON.parse(
      await runVista('await', 'cli-probe', questionId!, '--timeout-ms', '1', '--json'),
    ) as {
      readonly _tag: string
      readonly answer?: { readonly chosenOptionIds: readonly string[] }
    }
    expect(json).toMatchObject({ _tag: 'answered', answer: { chosenOptionIds: ['A'] } })
  }, 20_000)
})
