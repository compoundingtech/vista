import { readFileSync, realpathSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from '@babel/parser'
import { resolveConfig } from 'vite'
import { describe, expect, it } from 'vitest'

const serviceSrc = dirname(fileURLToPath(import.meta.url))
const vistaRoot = resolve(serviceSrc, '../..')

/** Follow source modules actually loaded by the process, not Vite's separately transformed client graph. */
const serverImportGraph = async () => {
  const config = await resolveConfig(
    {
      configFile: false,
      root: resolve(serviceSrc, '..'),
      resolve: { conditions: ['node', 'import'] },
      ssr: { resolve: { conditions: ['node', 'import'] } },
    },
    'serve',
  )
  const resolveImport = config.createResolver()
  const visited = new Set<string>()
  const violations: string[] = []
  const visit = async (file: string, chain: readonly string[]): Promise<void> => {
    if (visited.has(file)) return
    visited.add(file)
    const source = readFileSync(file, 'utf8')
    const ast = parse(source, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx'],
      createImportExpressions: true,
    })
    const specifiers = new Set<string>()
    for (const statement of ast.program.body) {
      if (statement.type === 'ImportDeclaration') {
        if (statement.importKind === 'type') continue
        if (
          statement.specifiers.length > 0 &&
          statement.specifiers.every(
            (specifier) => specifier.type === 'ImportSpecifier' && specifier.importKind === 'type',
          )
        )
          continue
        specifiers.add(statement.source.value)
      } else if (statement.type === 'ExportAllDeclaration') {
        if (statement.exportKind !== 'type') specifiers.add(statement.source.value)
      } else if (statement.type === 'ExportNamedDeclaration' && statement.source != null) {
        if (statement.exportKind === 'type') continue
        if (
          statement.specifiers.length > 0 &&
          statement.specifiers.every(
            (specifier) => specifier.type === 'ExportSpecifier' && specifier.exportKind === 'type',
          )
        )
          continue
        specifiers.add(statement.source.value)
      }
    }
    // Dynamic imports and CommonJS require are runtime edges too. TypeScript import types are not.
    const walk = (value: unknown): void => {
      if (value === null || typeof value !== 'object') return
      if ('type' in value && value.type === 'TSImportType') return
      if ('type' in value && value.type === 'ImportExpression' && 'source' in value) {
        const target = value.source
        if (
          target !== null &&
          typeof target === 'object' &&
          'type' in target &&
          target.type === 'StringLiteral' &&
          'value' in target &&
          typeof target.value === 'string'
        ) {
          specifiers.add(target.value)
        }
      }
      if (
        'type' in value &&
        value.type === 'CallExpression' &&
        'callee' in value &&
        'arguments' in value
      ) {
        const callee = value.callee
        const args = value.arguments
        if (
          callee !== null &&
          typeof callee === 'object' &&
          'type' in callee &&
          callee.type === 'Identifier' &&
          'name' in callee &&
          callee.name === 'require' &&
          Array.isArray(args)
        ) {
          const target: unknown = args[0]
          if (
            target !== null &&
            typeof target === 'object' &&
            'type' in target &&
            target.type === 'StringLiteral' &&
            'value' in target &&
            typeof target.value === 'string'
          ) {
            specifiers.add(target.value)
          }
        }
      }
      for (const child of Object.values(value)) {
        if (Array.isArray(child)) child.forEach(walk)
        else walk(child)
      }
    }
    walk(ast.program)
    for (const specifier of specifiers) {
      if (isBuiltin(specifier)) continue
      const edge = [...chain, `${relative(vistaRoot, file)} -> ${specifier}`]
      // Disallow the runtime itself, not just defineVars: create/props also need compilation.
      if (specifier === '@stylexjs/stylex' || specifier.startsWith('@stylexjs/stylex/')) {
        violations.push(edge.join('\n  '))
        continue
      }
      const resolved = await resolveImport(specifier, file, false, true)
      expect(resolved, `Cannot resolve server import:\n  ${edge.join('\n  ')}`).toBeDefined()
      if (resolved === undefined) continue
      const target = realpathSync(resolved.split('?')[0]!)
      if (/\.stylex\.[^/]+$/.test(target)) {
        violations.push(edge.join('\n  '))
        continue
      }
      // Published third-party JS is not authored by Vista. Workspace package exports resolve
      // through their real paths, so transitive source imports across packages remain covered.
      if (!target.includes('/node_modules/') && /\.[cm]?[jt]sx?$/.test(target))
        await visit(target, edge)
    }
  }
  for (const entry of ['main.ts', 'server.ts', 'publish.ts'])
    await visit(resolve(serviceSrc, entry), [])
  // The generated publish-time semantic extractor loads authoring through Vite. Keep its
  // node-safe core covered explicitly without treating its transformed client barrel as process code.
  await visit(resolve(vistaRoot, 'blocks/src/authoring.tsx'), [])
  return { visited, violations }
}

describe('Vista server import graph', () => {
  it('never evaluates uncompiled StyleX sources in the service process', async () => {
    const { visited, violations } = await serverImportGraph()
    expect(visited.has(resolve(vistaRoot, 'blocks/src/authoring.tsx'))).toBe(true)
    // This component is loaded by the client RuntimeIsland host, not the service process.
    expect(visited.has(resolve(serviceSrc, 'interview/InterviewQuestion.tsx'))).toBe(false)
    expect(violations, violations.join('\n\n')).toEqual([])
  })
})
