import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, relative, resolve } from 'node:path'

const [packageDirectory, compilerModule] = process.argv.slice(2)
if (packageDirectory === undefined || compilerModule === undefined) {
  throw new Error('Usage: check-archive-imports.mjs <package-directory> <typescript-module>')
}
const ts = createRequire(import.meta.url)(compilerModule)
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
  let resolved
  if (declaration) {
    resolved = ts.resolveModuleName(
      path,
      file,
      {
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
      },
      ts.sys,
    ).resolvedModule?.resolvedFileName
  }
  if (resolved === undefined && isFile(target)) resolved = target
  if (resolved === undefined && extname(target) === '') {
    resolved = [target + '.js', target + '.mjs', target + '.cjs', target + '.json', resolve(target, 'index.js')].find(isFile)
  }
  if (resolved === undefined || !insidePackage(resolved)) {
    failures.push(`${relative(root, file)}: ${specifier}`)
  }
}

const inspect = (file) => {
  modules += 1
  const declaration = /\.d\.[cm]?ts$/.test(file)
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const literal = (node) => node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && literal(node.moduleSpecifier)) {
      check(file, node.moduleSpecifier.text, declaration)
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && literal(node.moduleReference.expression)) {
      check(file, node.moduleReference.expression.text, declaration)
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && literal(node.argument.literal)) {
      check(file, node.argument.literal.text, true)
    } else if (ts.isCallExpression(node) && literal(node.arguments[0])) {
      const callee = node.expression
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require')) {
        check(file, node.arguments[0].text, declaration)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  for (const reference of source.referencedFiles) check(file, './' + reference.fileName, true)
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
