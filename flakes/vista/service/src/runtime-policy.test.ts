import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Effect } from 'effect'
import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'

import {
  classifyVistaClientImport,
  diagnoseVistaClientImport,
  importRoot,
  projectVistaRuntimePolicy,
  projectVistaRuntimePolicySource,
  RuntimePolicyError,
  runtimePolicyPackageJsons,
  servicePackageJson,
  vistaRuntimePolicy,
  validateVistaAppSource,
} from './runtime-policy/index.ts'
import { vistaRuntimePolicySource } from './runtime-policy/policy.ts'
import { blocksDir } from './runtime-policy/roots.ts'

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })

const unquoteModuleSpecifier = (source: string, start: number, end: number): string | undefined => {
  const raw = source.slice(start, end)
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1)
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1)
  return undefined
}

const kitRuntimeImportSpecifiers = (): string[] => {
  const files = walk(join(blocksDir(), 'src')).filter(
    (file) =>
      /\.(css|ts|tsx)$/.test(file) &&
      !file.includes('/stories/') &&
      !file.endsWith('.test.ts') &&
      !file.endsWith('.test.tsx'),
  )
  const imports = new Set<string>()
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    if (file.endsWith('.css')) {
      for (const match of source.matchAll(/@import\s+["']([^"']+)["']/g)) {
        if (match[1] !== undefined) imports.add(match[1])
      }
      continue
    }

    const parsed = parseSync(file, source, {
      lang: file.endsWith('.tsx') ? 'tsx' : 'ts',
      sourceType: 'module',
    })
    if (parsed.errors.length > 0) {
      throw new Error(
        `Failed to parse ${file}: ${parsed.errors[0]?.message ?? 'unknown parse error'}`,
      )
    }
    const candidates = [
      ...parsed.module.staticImports.map((entry) => entry.moduleRequest.value),
      ...parsed.module.staticExports.flatMap((entry) =>
        entry.entries.flatMap((item) =>
          item.moduleRequest === null ? [] : [item.moduleRequest.value],
        ),
      ),
      ...parsed.module.dynamicImports.flatMap((entry) => {
        const specifier = unquoteModuleSpecifier(
          source,
          entry.moduleRequest.start,
          entry.moduleRequest.end,
        )
        return specifier === undefined ? [] : [specifier]
      }),
    ]
    for (const moduleSpecifier of candidates) {
      if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('node:')) {
        imports.add(moduleSpecifier)
      }
    }
  }
  return [...imports].toSorted()
}

describe('Vista runtime policy', () => {
  it('projects generated package metadata without optimizing service-owned aliases', () => {
    expect(runtimePolicyPackageJsons().map((pkg) => pkg.name)).toEqual(
      expect.arrayContaining(['@vista/service', '@vista/blocks']),
    )
    const projected = projectVistaRuntimePolicySource(
      runtimePolicyPackageJsons().flatMap((pkg) =>
        pkg.$vista?.runtimePolicy === undefined ? [] : [pkg.$vista.runtimePolicy],
      ),
    )
    expect(projected.publicImportRoots).not.toContain('@vista/telemetry-island')
    expect(projected.serviceOwnedImportRoots).toEqual(
      expect.arrayContaining(['@vista/data', '@vista/interview', '@vista/telemetry-island']),
    )
    expect(projected.optimizeInclude).not.toContain('@vista/data')
    expect(projected.optimizeInclude).not.toContain('@vista/interview')
    expect(projected.optimizeInclude).not.toContain('@vista/telemetry-island')
    expect(projected.optimizeInclude).toContain('@pierre/diffs/react')
    expect(projected.optimizeInclude).toContain('lru_map')
    expect(projected.publicImportRoots).toContain('@overeng/agent-timeline')
    expect(projected.serviceOwnedImportRoots).not.toContain('@overeng/agent-timeline')
    expect(projected.optimizeInclude).toEqual(
      expect.arrayContaining([
        '@overeng/meters',
        '@overeng/meters/canvas',
        '@overeng/meters/platform/browser',
        '@overeng/meters/react',
        '@overeng/meters/sources/frame',
        '@overeng/agent-timeline/encodings',
        '@overeng/agent-timeline/labels',
        '@overeng/agent-timeline/model',
        '@overeng/agent-timeline/projection',
        '@overeng/agent-timeline/types',
      ]),
    )
    // These host imports are reached after the virtual bootstrap. Leaving a
    // subpath unseeded rebuilds the whole closure and invalidates in-flight URLs.
    expect(projected.optimizeInclude).toEqual(
      expect.arrayContaining([
        '@overeng/utils',
        '@stylexjs/stylex',
        'react-dom/server',
        'effect/reactivity',
        'effect/reactivity/Reactivity',
        'effect/rpc/RpcSchema',
      ]),
    )
    // Component barrels require StyleX even when their entry extension is .ts.
    expect(projected.optimizeInclude).not.toContain('@overeng/agent-timeline/compact')
    expect(projected.optimizeInclude).not.toContain('@overeng/agent-timeline/detail')
    expect(projected.optimizeInclude).not.toContain('@overeng/agent-timeline/icons')
    expect(projected.optimizeInclude).not.toContain('@overeng/agent-timeline/span')
    expect(projected.cssImports).toContain('@vista/ui/document.css')
    expect(projected.cssImports).not.toContain('@vista/ui/styles.css')
  })

  it('covers the current first-party kit runtime import graph', () => {
    const manifestRoots = new Set([
      ...vistaRuntimePolicy().optimizeInclude.map(importRoot),
      ...vistaRuntimePolicy().cssImports.map(importRoot),
      // Internal service bridges are resolved for the implementation graph but
      // rejected when they appear in AppSource.
      ...vistaRuntimePolicy().serviceOwnedImportRoots,
    ])
    const uncovered = kitRuntimeImportSpecifiers().filter(
      (specifier) => !manifestRoots.has(importRoot(specifier)),
    )

    expect(uncovered).toEqual([])
  })

  it('keeps public and optimized imports inside the service dependency closure', () => {
    const packageDeps = new Set([
      ...Object.keys(servicePackageJson().dependencies ?? {}),
      ...Object.keys(servicePackageJson().peerDependencies ?? {}),
    ])
    const serviceOwnedRoots = new Set([
      '@vista/data',
      '@vista/interview',
      '@vista/telemetry-island',
    ])
    const roots = [
      ...vistaRuntimePolicy().publicImportRoots,
      ...vistaRuntimePolicy().optimizeInclude.map(importRoot),
      ...vistaRuntimePolicy().cssImports.map(importRoot),
    ]
    const missing = [...new Set(roots)]
      .filter((root) => !serviceOwnedRoots.has(root))
      .filter((root) => !packageDeps.has(root))
      .toSorted()

    expect(missing).toEqual([])
  })

  it('allows the single public Vista import and rejects internal Vista bridges', () => {
    expect(classifyVistaClientImport('@vista/blocks')._tag).toBe('provided')
    expect(classifyVistaClientImport('@vista/blocks/styles.css')._tag).toBe('reject')
    expect(classifyVistaClientImport('@vista/blocks/internal/authoring')._tag).toBe('reject')
    expect(classifyVistaClientImport('@vista/data/client/provider')._tag).toBe('reject')
    expect(classifyVistaClientImport('@vista/interview/component')._tag).toBe('reject')
    expect(classifyVistaClientImport('@vista/telemetry-island')._tag).toBe('reject')
    expect(classifyVistaClientImport('react-aria-components')._tag).toBe('provided')
    expect(classifyVistaClientImport('@xyflow/react')._tag).toBe('provided')
    expect(classifyVistaClientImport('./local.tsx')._tag).toBe('local')
    expect(classifyVistaClientImport('./providers/note.provider.ts')._tag).toBe('server-module')
    expect(classifyVistaClientImport('https://esm.sh/zod@3.25.76')._tag).toBe('remote-esm')
    expect(classifyVistaClientImport('https://esm.sh/@effect/schema@0.75.5')._tag).toBe(
      'remote-esm',
    )
    expect(classifyVistaClientImport('https://esm.sh/zod')._tag).toBe('remote-unpinned')
    expect(classifyVistaClientImport('lodash')._tag).toBe('reject')
  })

  it('ignores import-like text inside captured source payloads', () => {
    const root = mkdtempSync(join(tmpdir(), 'vista-import-policy-'))
    try {
      writeFileSync(
        join(root, 'app.tsx'),
        `import { AppRoot } from '@vista/blocks'
const patch = ${JSON.stringify(`-import stale from ' left-pad '\n+export { next } from "also-blocked"`)}
export default () => <AppRoot title="Review" template="code-recap" scope={patch} />`,
      )
      expect(() => validateVistaAppSource(root)).not.toThrow()

      writeFileSync(join(root, 'blocked.ts'), `import blocked from 'left-pad'`)
      expect(() => validateVistaAppSource(root)).toThrow(/left-pad/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    ['.ts', 'type Config = { enabled: boolean }; const value = <Config>{ enabled: true }'],
    ['.tsx', 'const value: JSX.Element = <div />'],
    ['.jsx', 'const value = <div />'],
    ['.js', 'const value = { enabled: true }'],
    ['.mjs', 'const value = { enabled: true }'],
  ])('validates %s syntax while enforcing its import policy', (extension, source) => {
    const root = mkdtempSync(join(tmpdir(), 'vista-source-syntax-'))
    try {
      const file = join(root, `app${extension}`)
      writeFileSync(file, source)
      expect(() => validateVistaAppSource(root)).not.toThrow()

      writeFileSync(file, `${source}\nimport blocked from 'left-pad'`)
      expect(() => validateVistaAppSource(root)).toThrow(/left-pad/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('explains rejected imports with operator guidance', () => {
    const diagnostic = diagnoseVistaClientImport('lodash')

    expect(diagnostic.allowed).toBe(false)
    expect(diagnostic.classification._tag).toBe('reject')
    expect(diagnostic.message).toContain('blocked')
    expect(diagnostic.guidance).toContain('pinned esm.sh URL')
  })

  it('allows provider bodies server-side and rejects client imports with query guidance', () => {
    const root = mkdtempSync(join(tmpdir(), 'vista-provider-policy-'))
    try {
      mkdirSync(join(root, 'providers'))
      writeFileSync(
        join(root, 'providers', 'note.provider.ts'),
        `import { readFile } from 'node:fs/promises'\nexport const load = readFile`,
      )
      writeFileSync(join(root, 'providers', 'note.query.ts'), `export const note = 'client-safe'`)
      writeFileSync(
        join(root, 'app.tsx'),
        `import { note } from './providers/note.query.ts'\nexport default note`,
      )
      expect(() => validateVistaAppSource(root)).not.toThrow()

      writeFileSync(
        join(root, 'app.tsx'),
        `import provider from './providers/note.provider.ts'\nexport default provider`,
      )
      expect(() => validateVistaAppSource(root)).toThrow(/adjacent \*\.query\.ts/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('explains unpinned esm.sh imports with pinning guidance', () => {
    const diagnostic = diagnoseVistaClientImport('https://esm.sh/zod')

    expect(diagnostic.allowed).toBe(false)
    expect(diagnostic.classification._tag).toBe('remote-unpinned')
    expect(diagnostic.guidance).toContain('Pin the esm.sh package URL')
  })

  it('redirects lucide-react, bare or via esm.sh, to the Icon shipped by @vista/blocks', () => {
    for (const specifier of [
      'lucide-react',
      'lucide-react/dynamic',
      'https://esm.sh/lucide-react@0.511.0',
    ]) {
      const diagnostic = diagnoseVistaClientImport(specifier)
      expect(diagnostic.allowed).toBe(false)
      expect(diagnostic.classification._tag).toBe('reject')
      expect(diagnostic.guidance).toContain("import { Icon } from '@vista/blocks'")
    }
  })

  it('orders provided aliases most-specific-first so subpath aliases win over prefixes', () => {
    // Vite's `@rollup/plugin-alias` greedily matches the FIRST alias whose key is
    // a path-prefix of the import, with no fallback. So a bare prefix alias
    // (`@vista/blocks`) listed before its subpath (`@vista/blocks/styles.css`) would
    // shadow it — the exact alias-ordering regression that shipped a broken
    // `provided` resolution to canonical. The projection sorts longest-first;
    // assert no earlier alias path-shadows a later one.
    const aliases = vistaRuntimePolicy().aliases
    const violations: string[] = []
    for (let i = 0; i < aliases.length; i += 1) {
      for (let j = i + 1; j < aliases.length; j += 1) {
        const earlier = aliases[i]!.specifier
        const later = aliases[j]!.specifier
        if (later.startsWith(`${earlier}/`)) {
          violations.push(`"${earlier}" (idx ${i}) shadows "${later}" (idx ${j})`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('fails fast when policy exposes a package that is not installed by the service', () => {
    const result = Effect.runSyncExit(
      projectVistaRuntimePolicy({
        ...vistaRuntimePolicySource(),
        publicImportRoots: [...vistaRuntimePolicySource().publicImportRoots, 'lodash'],
      }),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.cause.toString()).toContain('Vista.RuntimePolicyError')
      expect(RuntimePolicyError).toBeDefined()
    }
  })
})
