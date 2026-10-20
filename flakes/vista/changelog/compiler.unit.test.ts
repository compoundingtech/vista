import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { compileChangelog } from './compiler.ts'
import { decodeChangelogManifestV1, type ChangelogSourceRegistration } from './contract.ts'

const alpha = {
  file: '2026-09-19-alpha.ts',
  source: { title: 'Alpha', summary: 'The first cumulative entry.' },
} satisfies ChangelogSourceRegistration
const beta = {
  file: '2026-09-20-beta.ts',
  source: { title: 'Beta', summary: 'The newest cumulative entry.' },
} satisfies ChangelogSourceRegistration

const compile = ({
  registry = [alpha, beta],
}: {
  readonly registry?: readonly ChangelogSourceRegistration[]
} = {}) =>
  compileChangelog({
    registry,
    product: 'vista',
    machineVersion: '0.1.0+opaque-build',
  })

describe('Vista changelog compiler', () => {
  it('decodes real authored output with the canonical service build identity', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vista-changelog-compiler-'))
    try {
      const serviceDirectory = fileURLToPath(new URL('../service', import.meta.url))
      const output = join(directory, 'changelog.v1.json')
      const env = { ...process.env }
      delete env.VISTA_ROOT
      const machineVersion = execFileSync(
        'bun',
        [
          '-e',
          "import { resolveVistaBuildInfo } from './src/build-info.ts'; process.stdout.write(resolveVistaBuildInfo().machineVersion)",
        ],
        { cwd: serviceDirectory, env, encoding: 'utf8' },
      )
      execFileSync(
        'bun',
        ['../changelog/compiler.ts', '--machine-version', machineVersion, '--output', output],
        { cwd: serviceDirectory, env },
      )
      const manifest = decodeChangelogManifestV1(JSON.parse(readFileSync(output, 'utf8')))
      expect(manifest.product).toBe('vista')
      expect(manifest.build.machineVersion).toBe(machineVersion)
      expect(manifest.entries.length).toBeGreaterThan(0)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('emits cumulative newest-first entries as deterministic canonical bytes', () => {
    const forward = compile()
    const reversed = compile({ registry: [beta, alpha] })

    expect(forward.manifest.entries.map(({ id }) => id)).toEqual([
      '2026-09-20-beta',
      '2026-09-19-alpha',
    ])
    expect(forward.bytes).toBe(reversed.bytes)
    expect(forward.bytes).toBe(
      '{"schemaVersion":1,"product":"vista","build":{"machineVersion":"0.1.0+opaque-build"},"entries":[{"id":"2026-09-20-beta","date":"2026-09-20","title":"Beta","summary":"The newest cumulative entry."},{"id":"2026-09-19-alpha","date":"2026-09-19","title":"Alpha","summary":"The first cumulative entry."}]}\n',
    )
  })

  it('preserves valid multi-contributor provenance in canonical bytes', () => {
    const traced = {
      file: '2026-09-23-agent-trace.ts',
      source: {
        title: 'Agent Trace',
        summary: 'A server-backed trace.',
        contributors: [
          {
            agentId: 'dev3.direct.omp.publisher',
            worktree: 'Dotfiles/2026-09-20-Vista-agent-graph',
          },
          {
            agentId: 'dev3.dotfiles.agent-trace.worker',
            name: 'Verified Agent',
          },
        ],
      },
    } satisfies ChangelogSourceRegistration

    const result = compile({ registry: [traced] })

    expect(result.manifest.entries[0]?.contributors).toEqual(traced.source.contributors)
    expect(result.bytes).toBe(
      '{"schemaVersion":1,"product":"vista","build":{"machineVersion":"0.1.0+opaque-build"},"entries":[{"id":"2026-09-23-agent-trace","date":"2026-09-23","title":"Agent Trace","summary":"A server-backed trace.","contributors":[{"agentId":"dev3.direct.omp.publisher","worktree":"Dotfiles/2026-09-20-Vista-agent-graph"},{"agentId":"dev3.dotfiles.agent-trace.worker","name":"Verified Agent"}]}]}\n',
    )
  })

  it('preserves exact native subjects alongside historical dotted contributors', () => {
    for (const agentId of ['agent/vista/author', 'agent/author', 'agent/vista/team/author']) {
      const contributors = [{ agentId }, { agentId: 'dev3.direct.omp.publisher' }]
      const result = compile({
        registry: [
          {
            file: '2026-10-06-native-subject.ts',
            source: { title: 'Native subject', summary: 'Exact owner attribution.', contributors },
          },
        ],
      })
      expect(result.manifest.entries[0]?.contributors).toEqual(contributors)
      expect(result.bytes).toContain(`"agentId":"${agentId}"`)
    }
  })

  it('rejects malformed contributor provenance and raw paths', () => {
    const invalidContributors = [
      [],
      [{ agentId: 'unqualified' }],
      [{ agentId: 'dev3.bad--agent' }],
      [{ agentId: 'agent/a/../b' }],
      [{ agentId: 'agent/a//b' }],
      [{ agentId: 'agent/A/b' }],
      [{ agentId: 'agent%2Fvista%2Fauthor' }],
      [{ agentId: 'dev3.direct.omp.valid', worktree: '/private/source/branch' }],
      [{ agentId: 'dev3.direct.omp.valid', worktree: 'dotfiles/nested/branch' }],
      [{ agentId: 'dev3.direct.omp.valid', unverified: 'extra field' }],
    ]

    for (const contributors of invalidContributors) {
      expect(() =>
        compile({
          registry: [
            {
              file: '2026-09-23-invalid-provenance.ts',
              source: {
                title: 'Invalid provenance',
                summary: 'This entry must not compile.',
                contributors,
              },
            },
          ],
        }),
      ).toThrow()
    }

    expect(() =>
      decodeChangelogManifestV1({
        schemaVersion: 1,
        product: 'vista',
        build: { machineVersion: 'opaque' },
        entries: [
          {
            id: '2026-09-23-invalid-provenance',
            date: '2026-09-23',
            title: 'Invalid provenance',
            summary: 'The browser boundary must reject raw paths too.',
            contributors: [
              {
                agentId: 'dev3.direct.omp.valid',
                worktree: '/private/source/branch',
              },
            ],
          },
        ],
      }),
    ).toThrow()
  })

  it('discovers a new entry from the selected directory without a shared index', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vista-changelog-discovery-'))
    try {
      const sourceDirectory = join(directory, 'entries')
      mkdirSync(sourceDirectory)
      const output = join(directory, 'changelog.v1.json')
      const compiler = fileURLToPath(new URL('./compiler.ts', import.meta.url))
      const run = () =>
        execFileSync(
          'bun',
          [
            compiler,
            '--source-directory',
            sourceDirectory,
            '--machine-version',
            'discovery-test',
            '--output',
            output,
          ],
          { stdio: 'pipe' },
        )
      writeFileSync(
        join(sourceDirectory, alpha.file),
        `export const entry = ${JSON.stringify(alpha.source)}`,
      )
      run()
      expect(
        decodeChangelogManifestV1(JSON.parse(readFileSync(output, 'utf8'))).entries.map(
          ({ id }) => id,
        ),
      ).toEqual(['2026-09-19-alpha'])
      writeFileSync(
        join(sourceDirectory, beta.file),
        `export const entry = ${JSON.stringify(beta.source)}`,
      )
      run()
      expect(
        decodeChangelogManifestV1(JSON.parse(readFileSync(output, 'utf8'))).entries.map(
          ({ id }) => id,
        ),
      ).toEqual(['2026-09-20-beta', '2026-09-19-alpha'])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it.each([
    ['2026-02-30-impossible.ts', 'export const entry = { title: "Invalid", summary: "Bad date" }'],
    ['not-a-date.ts', 'export const entry = { title: "Invalid", summary: "Bad name" }'],
    ['2026-09-20-invalid.ts', 'export const entry = { title: 42 }'],
    ['2026-09-20-missing.ts', 'export const title = "Missing entry"'],
  ])('rejects invalid discovered entry %s', (file, source) => {
    const directory = mkdtempSync(join(tmpdir(), 'vista-changelog-invalid-'))
    try {
      const sourceDirectory = join(directory, 'entries')
      mkdirSync(sourceDirectory)
      writeFileSync(join(sourceDirectory, file), source)
      expect(() =>
        execFileSync(
          'bun',
          [
            fileURLToPath(new URL('./compiler.ts', import.meta.url)),
            '--source-directory',
            sourceDirectory,
            '--machine-version',
            'discovery-test',
            '--output',
            join(directory, 'changelog.v1.json'),
          ],
          { stdio: 'pipe' },
        ),
      ).toThrow()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects duplicate registrations and invalid filename-derived dates', () => {
    expect(() => compile({ registry: [alpha, alpha] })).toThrow(/duplicate changelog entry ids/u)
    expect(() =>
      compile({
        registry: [
          {
            file: '2026-02-30-impossible.ts',
            source: { title: 'Impossible', summary: 'This date cannot exist.' },
          },
        ],
      }),
    ).toThrow(/invalid calendar date/u)
  })

  it('strictly rejects fields outside the source and browser manifest contracts', () => {
    expect(() =>
      compile({
        registry: [
          {
            file: '2026-09-20-extra.ts',
            source: { title: 'Extra', summary: 'Strict source.', author: 'not allowed' },
          },
        ],
      }),
    ).toThrow()

    expect(() =>
      decodeChangelogManifestV1({
        schemaVersion: 1,
        product: 'vista',
        build: { machineVersion: 'opaque' },
        entries: [],
        displayVersion: 'not part of v1',
      }),
    ).toThrow()
  })
})
