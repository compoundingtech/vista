import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT_MARKERS = ['flake.nix', 'pnpm-workspace.yaml']

/** Memoize a zero-arg thunk so its (filesystem) work runs at most once, lazily. */
const once = <T>(f: () => T): (() => T) => {
  let value: T
  let done = false
  return () => {
    if (!done) {
      value = f()
      done = true
    }
    return value
  }
}

const findWorkspaceRoot = (start: string): string | undefined => {
  let dir = start
  for (;;) {
    if (ROOT_MARKERS.some((marker) => existsSync(resolve(dir, marker)))) return dir
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * Lazily resolves the workspace root, honoring the VISTA_ROOT environment override, otherwise
 * searching upward from this module for workspace marker files and throwing an instructive error
 * (suggesting VISTA_ROOT) when none is found.
 */
export const root = once((): string => {
  if (process.env.VISTA_ROOT) return resolve(process.env.VISTA_ROOT)
  const found = findWorkspaceRoot(here)
  if (found === undefined) {
    throw new Error(
      `vista runtime policy: could not locate workspace root above ${here}; set VISTA_ROOT`,
    )
  }
  return found
})

/**
 * Lazily resolves the Vista blocks package directory, honoring the VISTA_BLOCKS environment
 * override and otherwise defaulting to flakes/vista/blocks beneath the workspace root.
 */
export const blocksDir = once((): string =>
  process.env.VISTA_BLOCKS
    ? resolve(process.env.VISTA_BLOCKS)
    : resolve(root(), 'flakes', 'vista', 'blocks'),
)

/**
 * The pre-built telemetry island chunk package (decision 0046). Standalone (not a
 * workspace member); the service serves its built `dist/island.js` via a
 * runtime-policy alias.
 */
export const islandDir = once((): string =>
  process.env.VISTA_ISLAND
    ? resolve(process.env.VISTA_ISLAND)
    : resolve(root(), 'flakes', 'vista', 'island'),
)
