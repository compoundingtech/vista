import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, relative, resolve } from 'node:path'

const [packageDirectory, parserModule] = process.argv.slice(2)
if (packageDirectory === undefined || parserModule === undefined) {
  throw new Error('Usage: check-archive-imports.mjs <package-directory> <babel-parser-module>')
}
const { parse } = createRequire(import.meta.url)(parserModule)
const root = resolve(packageDirectory)
const failures = []
let imports = 0
let modules = 0
const isFile = (path) => existsSync(path) && statSync(path).isFile()
const insidePackage = (path) => {
  const name = relative(root, path)
  return name !== '..' && !name.startsWith('../')
}

const check = (file, specifier, declaration) => {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return
  imports += 1
  // Bundler queries select a loader, not a different packed file.
  const path = specifier.split(/[?#]/, 1)[0]
  const target = resolve(dirname(file), path)
  const candidates = [target]
  if (declaration) {
    // Declaration imports use TypeScript's extension substitution, not runtime loading.
    const extension = extname(target)
    const stem = target.slice(0, -extension.length)
    if (['.js', '.jsx', '.ts', '.tsx'].includes(extension)) candidates.push(stem + '.d.ts')
    else if (['.mjs', '.mts'].includes(extension)) candidates.push(stem + '.d.mts')
    else if (['.cjs', '.cts'].includes(extension)) candidates.push(stem + '.d.cts')
  }
  if (extname(target) === '') {
    const extensions = declaration
      ? ['.d.ts', '.d.mts', '.d.cts', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json']
      : ['.js', '.mjs', '.cjs', '.json']
    candidates.push(
      ...extensions.map((extension) => target + extension),
      ...extensions.map((extension) => resolve(target, 'index' + extension)),
    )
  }
  const resolved = candidates.find(isFile)
  if (resolved === undefined || !insidePackage(resolved)) {
    failures.push(`${relative(root, file)}: ${specifier}`)
  }
}

const inspect = (file) => {
  modules += 1
  const declaration = /\.d\.[cm]?ts$/.test(file)
  const source = parse(readFileSync(file, 'utf8'), {
    sourceType: 'unambiguous',
    createImportExpressions: true,
    plugins: [['typescript', { dts: declaration }]],
  })
  const literal = (node) => {
    if (node?.type === 'StringLiteral') return node.value
    if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
      return node.quasis[0].value.cooked
    }
    return undefined
  }
  const visit = (node) => {
    if (node === null || typeof node !== 'object') return
    let specifier
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) {
      specifier = literal(node.source)
    } else if (node.type === 'TSImportType') {
      specifier = literal(node.argument)
    } else if (node.type === 'TSExternalModuleReference') {
      specifier = literal(node.expression)
    } else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') {
      specifier = literal(node.arguments[0])
    }
    if (specifier !== undefined) check(file, specifier, declaration)
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value !== null && typeof value === 'object' && 'type' in value) visit(value)
    }
  }
  visit(source.program)
  for (const comment of source.comments) {
    const reference = comment.type === 'CommentLine'
      ? /^\/\s*<reference\s+path=["']([^"']+)["']/.exec(comment.value)
      : null
    if (reference !== null) check(file, './' + reference[1], true)
  }
}

const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (/\.(?:[cm]?js|d\.[cm]?ts)$/.test(entry.name)) inspect(path)
  }
}
walk(resolve(root, 'dist'))
if (failures.length > 0) {
  throw new Error(`Unresolved packed relative imports:\n${failures.join('\n')}`)
}
console.log(`Packed import resolution: ${modules} modules, ${imports} relative imports; all targets present`)
