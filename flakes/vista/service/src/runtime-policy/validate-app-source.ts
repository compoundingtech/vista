import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { parse } from '@babel/parser'

import { isVistaProviderModuleSpecifier } from './import-classifier.ts'
import {
  importPolicyProblem,
  runtimePolicyImportError,
  runtimePolicySourceRootError,
} from './import-diagnostics.ts'

const SOURCE_EXTENSIONS = new Set(['.css', '.js', '.jsx', '.mjs', '.ts', '.tsx'])
const SKIP_DIRS = new Set(['.vite', 'node_modules'])

const sourceExtension = (path: string): string | undefined => {
  for (const extension of SOURCE_EXTENSIONS) {
    if (path.endsWith(extension)) return extension
  }
  return undefined
}

const walkSourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) return []
      return walkSourceFiles(join(dir, entry.name))
    }
    const path = join(dir, entry.name)
    return entry.isFile() && sourceExtension(path) !== undefined ? [path] : []
  })

const CSS_IMPORT_PATTERN = /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?/g

const stringLiteralValue = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  if (Reflect.get(value, 'type') !== 'StringLiteral') return undefined
  const literal = Reflect.get(value, 'value')
  return typeof literal === 'string' ? literal : undefined
}

const importSpecifiers = (source: string, extension: string): string[] => {
  if (extension === '.css') {
    return [...source.matchAll(CSS_IMPORT_PATTERN)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1]],
    )
  }
  const specifiers = new Set<string>()
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child)
      return
    }
    if (typeof value !== 'object' || value === null) return

    const type = Reflect.get(value, 'type')
    const specifier =
      type === 'ImportDeclaration' ||
      type === 'ExportNamedDeclaration' ||
      type === 'ExportAllDeclaration'
        ? stringLiteralValue(Reflect.get(value, 'source'))
        : type === 'CallExpression' &&
            Reflect.get(Reflect.get(value, 'callee') ?? {}, 'type') === 'Import'
          ? stringLiteralValue(
              (Reflect.get(value, 'arguments') as readonly unknown[] | undefined)?.[0],
            )
          : type === 'ImportExpression'
            ? stringLiteralValue(Reflect.get(value, 'source'))
            : undefined
    if (specifier !== undefined) specifiers.add(specifier)

    for (const child of Object.values(value)) visit(child)
  }
  visit(
    parse(source, {
      sourceType: 'unambiguous',
      plugins:
        extension === '.tsx'
          ? ['typescript', 'jsx']
          : extension === '.ts'
            ? ['typescript']
            : extension === '.jsx'
              ? ['jsx']
              : [],
    }),
  )
  return [...specifiers]
}

/**
 * Throws a source-root error when the given path is not a directory, then walks every source file
 * beneath it—skipping provider implementation modules whose Node/service-only imports are
 * legitimate—and throws a runtime policy error if any scanned module violates the import policy.
 */
export const validateVistaAppSource = (root: string): void => {
  if (!statSync(root).isDirectory()) {
    throw runtimePolicySourceRootError(root)
  }

  // Implementations execute only through server-side discovery. Their imports
  // may legitimately include Node and service-only packages; client/query
  // modules are still scanned transitively and cannot re-export them.
  const problems = walkSourceFiles(root)
    .filter((file) => !isVistaProviderModuleSpecifier(file))
    .flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return importSpecifiers(source, sourceExtension(file)!)
        .map((specifier) => importPolicyProblem({ root, importer: file, source: specifier }))
        .filter((problem) => !problem.diagnostic.allowed)
    })

  if (problems.length > 0) {
    throw runtimePolicyImportError({ root, problems })
  }
}
