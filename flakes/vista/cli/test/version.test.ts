import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { afterEach, describe, expect, it } from 'vitest'

import { resolveCliBuildIdentity } from '@overeng/utils/node/cli-version'

import { freePort } from '../../service/src/test-support.ts'

/**
 * Track A + G (decisions 0064 / 0062): the CLI derives its `--version` and its
 * error-line diagnostic suffix from the one shared `resolveCliBuildIdentity`
 * stamp, and boots the OTel telemetry layer (zero exporter overhead when
 * `OTEL_EXPORTER_OTLP_ENDPOINT` is unset; a `vista.cli` span + `vista_cli_invocations`
 * metric under `service.name=vista-cli` when it is). These run the real binary
 * entrypoint from source under the CLI's production runtime — **bun**. The
 * packaged CLI keeps this metadata entry separate from its operational runtime
 * bundle. Views use JSX (`.tsx`), so source execution also requires Bun rather
 * than node's type-stripping loader.
 */

const execFileAsync = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const CLI = join(HERE, '..', 'src', 'cli.ts')

const runCli = (args: readonly string[], env: Record<string, string> = {}) =>
  execFileAsync('bun', [CLI, ...args], {
    env: {
      ...process.env,
      NO_COLOR: '1',
      ST_AGENT: 'dev3.cli-test',
      ...env,
    },
  })

/** A throwaway OTLP/HTTP sink that records every posted body (traces + metrics). */
const otlpSink = async (): Promise<{
  readonly endpoint: string
  readonly close: () => Promise<{ readonly bodies: readonly string[] }>
}> => {
  const port = await freePort()
  const bodies: string[] = []
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      bodies.push(Buffer.concat(chunks).toString('utf8'))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', () => resolve()))
  return {
    endpoint: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve({ bodies }))),
  }
}

describe('vista CLI build identity + otel bootstrap', () => {
  it('`--version` prints displayVersion and exits 0 (metadata fast-path)', async () => {
    const { stdout } = await runCli(['--version'])
    // Unstamped source resolves to the base version; a Nix build stamps a richer
    // displayVersion. Both are non-empty and start with the semver base.
    expect(stdout.trim()).toMatch(/^0\.1\.0/)
  })

  it.each(['--version', '-v'])(
    '%s preserves the canonical stamp and exact output bytes',
    async (flag) => {
      const stamp = JSON.stringify({
        type: 'nix',
        version: '7.8.9',
        rev: 'abcdef012345',
        commitTs: 0,
        dirty: true,
      })
      const expected = resolveCliBuildIdentity({
        baseVersion: '0.1.0',
        buildStamp: '__CLI_BUILD_STAMP__',
        env: { CLI_BUILD_STAMP: stamp },
      })
      const { stdout, stderr } = await runCli([flag], {
        CLI_BUILD_STAMP: stamp,
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:1',
      })
      expect(stdout).toBe(`${expected.displayVersion}\n`)
      expect(stderr).toBe('')
    },
  )

  it('the OTel layer adds zero overhead when no endpoint is configured', async () => {
    // With OTEL_EXPORTER_OTLP_ENDPOINT unset, the telemetry layer is config-only,
    // so the command runs and exits cleanly.
    const { stdout } = await runCli(['--version'], { OTEL_EXPORTER_OTLP_ENDPOINT: '' })
    expect(stdout.trim()).toMatch(/^0\.1\.0/)
  })

  it('known error lines carry the ` (vista <version>)` diagnostic suffix', async () => {
    // Point at a closed port so the control RPC fails with a known tagged error;
    // the first stderr line ends with the identity, followed by the retained cause.
    await expect(runCli(['list'], { VISTA_URL: 'http://127.0.0.1:1' })).rejects.toMatchObject({
      stderr: expect.stringMatching(/^vista: .+ \(vista 0\.1\.0.*\)\n {2}cause: .+\n$/),
    })
  })

  it('reports an uppercase slug as invalid, not as an unavailable service', async () => {
    await expect(
      runCli(['new', 'Bad-Slug', '--dry-run', '--json'], {
        VISTA_URL: 'http://127.0.0.1:1',
      }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/^vista: invalid slug "Bad-Slug".+\(vista 0\.1\.0.*\)\n$/),
    })
  })

  it.each([
    { name: 'missing', args: ['publish', 'my-review'] },
    { name: 'blank', args: ['publish', 'my-review', '--message', '   '] },
  ])('rejects a $name publish change summary before the RPC call', async ({ args }) => {
    await expect(runCli(args)).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining('--message'),
    })
  })

  describe('OTel export (OBS-R69/R70/R72)', () => {
    let sink: Awaited<ReturnType<typeof otlpSink>> | undefined
    afterEach(async () => {
      if (sink !== undefined) await sink.close()
      sink = undefined
    })

    it('exports a vista.cli span + invocation metric under service.name=vista-cli, even on a failed command', async () => {
      sink = await otlpSink()
      // A failed command is the important case: a hard `process.exit` would skip
      // the exporter flush finalizer. The run must still fail (non-zero exit) AND
      // ship the span + metric before the process ends.
      await expect(
        runCli(['list'], {
          VISTA_URL: 'http://127.0.0.1:1',
          OTEL_EXPORTER_OTLP_ENDPOINT: sink.endpoint,
        }),
      ).rejects.toMatchObject({ code: 1 })

      const { bodies } = await sink.close()
      sink = undefined
      const all = bodies.join('\n')
      expect(all).toContain('vista.cli') // the invocation span name
      expect(all).toContain('vista_cli_invocations') // the invocation counter
      expect(all).toContain('vista-cli') // service.name on the OTLP resource
    })
  })
})
