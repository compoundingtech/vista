import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, normalize, resolve, sep } from 'node:path'

const [portArgument] = process.argv.slice(2)
const referenceRoot = process.env['REFERENCE_STORYBOOK_DIR']
const candidateRoot = process.env['CANDIDATE_STORYBOOK_DIR']
if (portArgument === undefined || referenceRoot === undefined || candidateRoot === undefined) {
  throw new Error(
    'Usage: REFERENCE_STORYBOOK_DIR=... CANDIDATE_STORYBOOK_DIR=... static-server.mjs <port>',
  )
}

let selectedRoot = resolve(referenceRoot)
const roots = {
  candidate: resolve(candidateRoot),
  reference: resolve(referenceRoot),
}
const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  if (pathname === '/__select/reference' || pathname === '/__select/candidate') {
    selectedRoot = pathname.endsWith('/candidate') ? roots.candidate : roots.reference
    response.writeHead(204, { 'Cache-Control': 'no-store' })
    response.end()
    return
  }

  const relativePath = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '')
  let filePath = resolve(selectedRoot, relativePath === '' ? 'index.html' : relativePath)
  if (filePath !== selectedRoot && filePath.startsWith(`${selectedRoot}${sep}`) === false) {
    response.writeHead(403, { 'Cache-Control': 'no-store' })
    response.end('Forbidden')
    return
  }

  try {
    if (statSync(filePath).isDirectory()) filePath = resolve(filePath, 'index.html')
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    })
    createReadStream(filePath).pipe(response)
  } catch {
    response.writeHead(404, { 'Cache-Control': 'no-store' })
    response.end('Not found')
  }
}).listen(Number(portArgument), '127.0.0.1')
