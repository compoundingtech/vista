import { copyFileSync, cpSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

const [dist, output, ...assets] = process.argv.slice(2)
if (dist === undefined || output === undefined || assets.length % 2 !== 0) {
  throw new Error('Usage: dist-assets.mjs <dist> <output> [<relative-path> <source>]...')
}
cpSync(dist, output, { recursive: true, dereference: true })
const root = resolve(output)
for (let index = 0; index < assets.length; index += 2) {
  const destination = resolve(root, assets[index])
  const path = relative(root, destination)
  if (path === '' || path === '..' || path.startsWith('../') || isAbsolute(path)) {
    throw new Error(`Dist asset escapes output: ${assets[index]}`)
  }
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(assets[index + 1], destination)
}
