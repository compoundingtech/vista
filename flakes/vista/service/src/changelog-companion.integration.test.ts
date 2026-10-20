import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let directory: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'vista-changelog-companion-'))
  vi.stubEnv('VISTA_ROOT', directory)
  vi.stubEnv('VISTA_CHANGELOG_MANIFEST', '')
  // paths.root() is memoized; every test owns an isolated workspace.
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  rmSync(directory, { recursive: true, force: true })
})

describe('Vista changelog companion', () => {
  it.each([undefined, '', ' \t '])(
    'uses the package path for a blank override (%j)',
    async (override) => {
      vi.stubEnv('VISTA_CHANGELOG_MANIFEST', override)
      const { vistaChangelogCompanionPath } = await import('./changelog-companion.ts')
      expect(vistaChangelogCompanionPath()).toBe(join(directory, 'share/vista/changelog.v1.json'))
    },
  )

  it('resolves a trimmed relative override from the working directory', async () => {
    vi.stubEnv('VISTA_CHANGELOG_MANIFEST', ' ./generated/changelog.v1.json \t')
    const { vistaChangelogCompanionPath } = await import('./changelog-companion.ts')
    expect(vistaChangelogCompanionPath()).toBe(resolve('generated/changelog.v1.json'))
  })

  it('reads exact package-owned bytes without parsing or reserializing', async () => {
    const { readVistaChangelogCompanion, vistaChangelogCompanionPath } =
      await import('./changelog-companion.ts')
    const path = vistaChangelogCompanionPath()
    mkdirSync(dirname(path), { recursive: true })
    const bytes = Buffer.from('{ "entries": [] }\n\n')
    writeFileSync(path, bytes)
    expect(readVistaChangelogCompanion()).toEqual(bytes)
  })

  it('prefers the override and observes replacements without caching bytes or paths', async () => {
    const { readVistaChangelogCompanion, vistaChangelogCompanionPath } =
      await import('./changelog-companion.ts')
    const packaged = vistaChangelogCompanionPath()
    mkdirSync(dirname(packaged), { recursive: true })
    writeFileSync(packaged, 'package-owned')
    const override = join(directory, 'generated.json')
    writeFileSync(override, 'first build')
    vi.stubEnv('VISTA_CHANGELOG_MANIFEST', ` ${override} `)
    expect(readVistaChangelogCompanion().toString()).toBe('first build')
    writeFileSync(override, 'second build')
    expect(readVistaChangelogCompanion().toString()).toBe('second build')
    vi.stubEnv('VISTA_CHANGELOG_MANIFEST', '')
    expect(readVistaChangelogCompanion().toString()).toBe('package-owned')
  })

  it.each([false, true])(
    'fails explicitly for a missing companion (override: %j)',
    async (overridden) => {
      const path = join(directory, overridden ? 'missing.json' : 'share/vista/changelog.v1.json')
      if (overridden) vi.stubEnv('VISTA_CHANGELOG_MANIFEST', path)
      const { readVistaChangelogCompanion } = await import('./changelog-companion.ts')
      expect(readVistaChangelogCompanion).toThrowError(
        expect.objectContaining({
          message: `Vista changelog companion is unavailable at ${path}`,
          cause: expect.objectContaining({ code: 'ENOENT', path }),
        }),
      )
    },
  )

  it('supplies real authored compiler output with the canonical service build identity', async () => {
    const serviceDirectory = fileURLToPath(new URL('..', import.meta.url))
    const output = join(directory, 'generated', 'changelog.v1.json')
    mkdirSync(dirname(output), { recursive: true })
    // Match the source-worktree task: resolve identity in the actual checkout,
    // not the isolated package-root fixture used by the path tests above.
    const env = { ...process.env }
    delete env.VISTA_ROOT
    const machineVersion = execFileSync(
      'bun',
      [
        '-e',
        "const { resolveVistaBuildInfo } = await import('./src/build-info.ts'); process.stdout.write(resolveVistaBuildInfo().machineVersion)",
      ],
      { cwd: serviceDirectory, env, encoding: 'utf8' },
    )
    execFileSync(
      'bun',
      ['../changelog/compiler.ts', '--machine-version', machineVersion, '--output', output],
      {
        cwd: serviceDirectory,
        env,
      },
    )
    vi.stubEnv('VISTA_CHANGELOG_MANIFEST', output)
    const { readVistaChangelogCompanion } = await import('./changelog-companion.ts')
    const bytes = readVistaChangelogCompanion()
    expect(bytes).toEqual(readFileSync(output))
  })
})
