/**
 * Shared test helpers for the vista service + CLI suites.
 *
 * `freePort` allocates an OS-assigned ephemeral port and releases it, so a test
 * can bind a service to a known-free port instead of racing a hard-coded one.
 * Bind-then-close is a best-effort reservation (the port could be re-taken before
 * the test re-binds), which is acceptable for the short-lived local services here.
 */
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'

/**
 * Binds an ephemeral TCP server on 127.0.0.1 with an OS-assigned port, records the assigned
 * number, closes the socket, and returns that port for tests to listen on.
 */
export const freePort = async (): Promise<number> => {
  const srv = createServer()
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', () => resolve()))
  const port = (srv.address() as { port: number }).port
  await new Promise<void>((resolve) => srv.close(() => resolve()))
  return port
}

/** Supply the packaged companion explicitly when publication runs from source. */
export const installTestChangelog = async (directory: string): Promise<() => void> => {
  // paths.ts captures test roots at module load; callers install their isolated
  // environment before loading the companion/build-info boundary.
  const { VISTA_CHANGELOG_FILE, VISTA_CHANGELOG_PATH_ENV } =
    await import('./changelog-companion.ts')
  const { resolveVistaBuildInfo } = await import('./build-info.ts')
  const original = process.env[VISTA_CHANGELOG_PATH_ENV]
  const path = join(directory, VISTA_CHANGELOG_FILE)
  writeFileSync(
    path,
    JSON.stringify({
      schemaVersion: 1,
      product: 'vista',
      build: { machineVersion: resolveVistaBuildInfo().machineVersion },
      entries: [],
    }),
  )
  process.env[VISTA_CHANGELOG_PATH_ENV] = path
  return () => {
    if (original === undefined) delete process.env[VISTA_CHANGELOG_PATH_ENV]
    else process.env[VISTA_CHANGELOG_PATH_ENV] = original
  }
}
