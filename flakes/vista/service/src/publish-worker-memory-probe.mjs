import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

// BUN_OPTIONS is inherited by publish workers. The first packaged service marks
// its environment before spawning any children; only that process binds a probe.
if (
  process.env.VISTA_TEST_PROBE_OWNER_PID === undefined &&
  process.argv.some((argument) => argument.endsWith('/vista-service.mjs')) &&
  !process.argv.includes('publish-worker')
) {
  process.env.VISTA_TEST_PROBE_OWNER_PID = String(process.pid)
  createServer(async (request, response) => {
    if (
      request.url !== '/memory' ||
      request.headers.authorization !== `Bearer ${process.env.VISTA_TEST_PROBE_TOKEN}`
    ) {
      response.writeHead(404).end()
      return
    }
    // Compare retained memory after equivalent full collections, not transient
    // garbage left by whichever publication happened to trigger a collection.
    for (let iteration = 0; iteration < 4; iteration++) {
      Bun.gc(true)
      const { promise, resolve } = Promise.withResolvers()
      setTimeout(resolve, 30)
      await promise
    }
    response.setHeader('content-type', 'application/json')
    response.end(
      JSON.stringify({
        pid: process.pid,
        externalBytes: process.memoryUsage().external,
        smaps: readFileSync('/proc/self/smaps_rollup', 'utf8'),
      }),
    )
  }).listen(Number(process.env.VISTA_TEST_PROBE_PORT), '127.0.0.1')
}
