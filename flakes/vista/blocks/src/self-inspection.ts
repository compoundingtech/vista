import { useEffect, useState } from 'react'

import type { AppSourceData } from './blocks/app-source.ts'

/**
 * Shell-side self-inspection (q6 prepend reveal): derive the frozen payload
 * URL from the owner route, fetch it fail-soft, and hand ready data to the
 * header toggle. No publish or bootstrap change is needed — the artifact
 * lives at a fixed name under every version dir, and versions predating it
 * simply resolve to no toggle.
 *
 * The guard is structural on purpose: visibility needs "this looks like a
 * capture", not a full schema verdict. The block renders what it is given.
 */

/** Version-dir file carrying the frozen self-capture. */
export const SELF_CAPTURE_FILENAME = 'vista-self.json'

/** Owner-route shape the shell already parses for navigation. */
const OWNER_ROUTE = /^\/r\/([^/]+)\/([^/]+)\/([^/]+)\/?$/

/**
 * Resolve the self-capture URL for an owner route, or `undefined` off-route.
 * Resolved relative to the document so stamped base paths, `latest` aliases,
 * and dev servers all work without special cases.
 */
export const selfSourceUrl = (pathname: string, base: string): string | undefined => {
  if (!OWNER_ROUTE.test(pathname)) return undefined
  // Owner routes are slash-terminated, but an alias without one would
  // otherwise resolve the file against the parent segment.
  const directory = base.endsWith('/') ? base : `${base}/`
  try {
    return new URL(SELF_CAPTURE_FILENAME, directory).toString()
  } catch {
    return undefined
  }
}

/** Structural guard: files are required, publish sections are optional. */
export const isSelfSourcePayload = (value: unknown): value is AppSourceData => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record['owner'] !== 'string' || typeof record['slug'] !== 'string') return false
  const version = record['version']
  // Published versions are positive ints; hand-authored drafts use 'draft'.
  if (version !== 'draft' && !(typeof version === 'number' && Number.isInteger(version) && version >= 1)) return false
  if (!Array.isArray(record['files'])) return false
  return record['files'].every(
    (file) =>
      typeof file === 'object' &&
      file !== null &&
      typeof (file as Record<string, unknown>)['path'] === 'string' &&
      typeof (file as Record<string, unknown>)['contents'] === 'string',
  )
}

/**
 * Discriminated state for the shell's self-inspection lifecycle: 'idle' while resolving, 'ready'
 * once source data is available, and 'absent' when it cannot be loaded.
 */
export type SelfSourceState =
  | { readonly _tag: 'idle' }
  | { readonly _tag: 'ready'; readonly source: AppSourceData }
  | { readonly _tag: 'absent' }

/**
 * Resolve the shell's self-inspection payload. An explicit `override` (stories,
 * previews, tests) wins and skips the network; otherwise the hook fetches the
 * route-derived URL once and settles `absent` on any failure — the toggle
 * renders only in `ready`.
 */
export const useSelfSource = (override: AppSourceData | undefined): SelfSourceState => {
  const [state, setState] = useState<SelfSourceState>(() =>
    override === undefined ? { _tag: 'idle' } : { _tag: 'ready', source: override },
  )
  useEffect(() => {
    if (override !== undefined) {
      setState({ _tag: 'ready', source: override })
      return
    }
    if (typeof window === 'undefined') return
    const url = selfSourceUrl(window.location.pathname, window.location.href)
    if (url === undefined) return
    let cancelled = false
    void fetch(url)
      .then(async (response) => {
        if (cancelled) return
        if (!response.ok) {
          setState({ _tag: 'absent' })
          return
        }
        const value: unknown = await response.json().catch(() => undefined)
        if (cancelled) return
        setState(isSelfSourcePayload(value) ? { _tag: 'ready', source: value } : { _tag: 'absent' })
      })
      .catch(() => {
        if (!cancelled) setState({ _tag: 'absent' })
      })
    return () => {
      cancelled = true
    }
  }, [override])
  return state
}
