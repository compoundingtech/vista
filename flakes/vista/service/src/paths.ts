import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
/**
 * Runtime path resolution. Everything resolves relative to a single project
 * root so the tree is relocatable. Packaged Vista ships the imported Buck
 * runtime closure in a read-only workspace and keeps apps/cache mutable via
 * environment variables (decision 0017); local dev needs no configuration.
 *
 * Layout:
 *   <sources>/_owned.v1/<encoded-owner>/<slug>               (canonical AppSource)
 *   <apps>/_owned/<owner>/<slug>/{v1, v2, …, latest→vN, RETIRED?}
 *   <root>/node_modules                                     (shared dep closure)
 *
 * `VISTA_ROOT`    — project root (defaults to the workspace containing a root
 *                   marker and its shared `node_modules` dependency closure).
 * `VISTA_APPS`    — mutable app state (local: <root>/tmp/vista; packaged: required).
 * `VISTA_SOURCES` — required authored AppSource root (packaged: XDG state/vista/sources).
 * `VISTA_CACHE`   — Vite cache outside immutable version source (decision 0029;
 *                   local: <root>/tmp/vista-cache; packaged: XDG cache).
 * `VISTA_DEPS`    — the shared `node_modules` dir Vite resolves bare specifiers
 *                   from (defaults to <root>/node_modules).
 */
import { fileURLToPath } from 'node:url'

import { Schema } from 'effect'

import { encodeOwner, Slug } from './read-contract.ts'

const here = dirname(fileURLToPath(import.meta.url))

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

/**
 * Files that mark the workspace root (the dir owning the shared `node_modules`
 * the dep walk-up resolves against). Either marks it on its own.
 */
const ROOT_MARKERS = ['flake.nix', 'pnpm-workspace.yaml']

const isNixStorePath = (path: string): boolean => {
  const store = process.env.NIX_STORE ?? '/nix/store'
  return path === store || path.startsWith(`${store}/`)
}

const xdgPath = (
  envName: 'XDG_STATE_HOME' | 'XDG_CACHE_HOME',
  homeSuffix: string,
): string | undefined => {
  const explicit = process.env[envName]
  if (explicit) return resolve(explicit)
  const home = process.env.HOME
  if (!home) return undefined
  return resolve(home, homeSuffix)
}

const defaultMutablePath = (kind: 'apps' | 'cache'): string => {
  if (!isNixStorePath(root())) {
    return kind === 'apps' ? resolve(root(), 'tmp', 'vista') : resolve(root(), 'tmp', 'vista-cache')
  }
  // A packaged apps root has no safe default: an XDG fallback silently grew a
  // second, unmanaged apps tree beside the deployment's configured one.
  if (kind === 'apps') {
    throw new Error(
      `vista: VISTA_ROOT is inside the Nix store (${root()}), so VISTA_APPS must be set ` +
        `to the deployment's apps root (the Home Manager vista module sets <stateDir>/apps).`,
    )
  }
  const base = xdgPath('XDG_CACHE_HOME', '.cache')
  if (!base) {
    throw new Error(
      `vista: VISTA_ROOT is inside the Nix store (${root()}), so VISTA_CACHE ` +
        `must be set when HOME/XDG_CACHE_HOME is unavailable.`,
    )
  }
  return resolve(base, 'vista')
}

/**
 * Find the nearest ancestor of `start` (inclusive) that contains a root marker.
 * Walking up — rather than a fixed `../../..` hop count — keeps ROOT correct in a
 * plain checkout, in a nested megarepo store worktree, and if the package ever
 * moves depth in the tree. Returns `undefined` if no marker is found up to `/`.
 */
const findWorkspaceRoot = (start: string): string | undefined => {
  let dir = start
  for (;;) {
    if (ROOT_MARKERS.some((m) => existsSync(resolve(dir, m)))) return dir
    const parent = dirname(dir)
    if (parent === dir) return undefined // reached filesystem root
    dir = parent
  }
}

/**
 * Project root: the workspace root whose `node_modules` is the shared dep
 * closure. Derived by walking up from this file to the nearest {@link
 * ROOT_MARKERS} ancestor (NOT a fixed hop count — the old `../../../../..`
 * overshot ABOVE the repo root inside a nested megarepo worktree, forcing a
 * `VISTA_ROOT` override). `VISTA_ROOT` remains the explicit override for deploys
 * (decision 0017), where the deployed shape has no in-tree markers.
 */
export const root = once((): string => {
  if (process.env.VISTA_ROOT) return resolve(process.env.VISTA_ROOT)
  const found = findWorkspaceRoot(here)
  if (found === undefined) {
    throw new Error(
      `vista: could not locate the workspace root (no ${ROOT_MARKERS.join(' / ')} found ` +
        `above ${here}). Set VISTA_ROOT to the dir owning the shared node_modules.`,
    )
  }
  return found
})

/** Canonical authored AppSource for one owner-scoped Vista app. */
export const appSourcePath = (sources: string, owner: string, slug: string): string => {
  const validSlug = Schema.decodeSync(Slug)(slug)
  return join(resolve(sources), '_owned.v1', encodeOwner(owner), validSlug)
}

/** Resolve the sole owner-scoped AppSource accepted by authoring and publication. */
export const resolveAppSource = (owner: string, slug: string): string => {
  const sources = process.env.VISTA_SOURCES
  if (sources === undefined || sources.trim() === '') {
    throw new Error('VISTA_SOURCES is required for owner-scoped Vista AppSource resolution')
  }
  return appSourcePath(sources, owner, slug)
}

/**
 * Mutable AppVersion state containing immutable `vN` directories plus `latest`
 * and retirement markers. Authored AppSources live in the sources root outside this
 * service-owned tree. Local dev defaults to the repo's gitignored `tmp/vista`;
 * packaged/Nix-store roots default to `$XDG_STATE_HOME/vista/apps` (or
 * `~/.local/state/vista/apps`) so a wrapped CLI never writes under `/nix/store`.
 * A deploy can point `VISTA_APPS` at `/var/lib/vista`.
 */
export const appsDir = once((): string =>
  process.env.VISTA_APPS ? resolve(process.env.VISTA_APPS) : defaultMutablePath('apps'),
)

/**
 * The pre-built telemetry island package used by normal draft and static-build
 * module resolution. Published AppVersions copy its output into their
 * receipt-covered self-contained `site/` tree.
 */
export const islandDir = once((): string =>
  process.env.VISTA_ISLAND
    ? resolve(process.env.VISTA_ISLAND)
    : resolve(root(), 'flakes', 'vista', 'island'),
)

/** The shared dependency closure Vite resolves app imports from (SVC-R16, 0006). */
export const depsNodeModules = once((): string =>
  process.env.VISTA_DEPS ? resolve(process.env.VISTA_DEPS) : resolve(root(), 'node_modules'),
)

/** The `node_modules` symlink the apps tree walks up to (decision 0006). */
export const appsNodeModules = once((): string => resolve(appsDir(), 'node_modules'))

/**
 * The component kit (`@vista/blocks`) directory. In the packaged workspace,
 * its authored sources and importer dependencies are shipped alongside the
 * service. Local pnpm's linker may not hoist the kit into the service's shared
 * `node_modules`, so resolve this one source member explicitly (not an alias
 * map for arbitrary app dependencies, which decision 0006 rejects).
 * `VISTA_BLOCKS` overrides the workspace-member default.
 */
export const blocksDir = once((): string =>
  process.env.VISTA_BLOCKS
    ? resolve(process.env.VISTA_BLOCKS)
    : resolve(root(), 'flakes', 'vista', 'blocks'),
)

/**
 * Vite cache. Two invariants (decision 0029 #2): it must live OUTSIDE the Vite
 * `root` (the apps tree) so prebundled deps are served as `@fs/<abs>/...deps/`
 * rather than as a `/r/...`-relative path the optimizer URL wouldn't match; and
 * it is disposable. Local dev defaults to `<root>/tmp/vista-cache`, a sibling of
 * the apps root. Packaged/Nix-store roots default to `$XDG_CACHE_HOME/vista`
 * (or `~/.cache/vista`) so service and CLI cache writes stay mutable. One shared
 * cache for the whole published fleet (one `root` → one configHash → one
 * prebundle); each draft gets its own subdir. `VISTA_CACHE` overrides it.
 */
export const cacheDir = once((): string =>
  process.env.VISTA_CACHE ? resolve(process.env.VISTA_CACHE) : defaultMutablePath('cache'),
)

/** Mutable folded subscription state, kept outside immutable AppVersions. */
export const liveStateDir = once((): string =>
  process.env.VISTA_LIVE_STATE
    ? resolve(process.env.VISTA_LIVE_STATE)
    : resolve(cacheDir(), 'live-state'),
)
