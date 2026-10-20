/**
 * LazyBlock — generic React-19 host primitive for large, optional-loading blocks
 * (decisions 0026/0046). The telemetry island is its first consumer, not its only
 * one: any block whose payload is a separately-loaded chunk uses it.
 *
 * IMPERATIVE, not `React.lazy`/`Suspense`: the loaded chunk may run its own React
 * (the telemetry island is a self-contained chunk with its own bundled React), and two React
 * reconcilers cannot share a Suspense boundary. So the host renders a measured
 * skeleton, and an effect drives the chunk lifecycle by hand:
 *
 *   1. host renders a measured placeholder + a `useState` loading flag;
 *   2. an effect `await load()`s the chunk, then calls `mount(mod, el)` which
 *      builds the chunk's own root and returns an unmount disposer;
 *   3. cleanup calls that disposer.
 *
 * Two-layer error ownership: the host `await load()` is try/caught here, so a
 * chunk-LOAD failure (network / resolve) shows a "couldn't load visualization"
 * fallback; a chunk-internal RENDER throw is owned by the chunk's own error
 * boundary, which reports out through whatever `mount` closes over. A React-19
 * host boundary deliberately does NOT try to catch a foreign-React-root throw.
 *
 * This file imports no chunk implementation on purpose: the chunk specifier (the
 * dynamic import passed as `load`) lives in the consumer app, never in the kit,
 * so the kit runtime-import graph stays first-party.
 */
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { useEffect, useRef, useState, version as hostReactVersion } from 'react'

import { scale, tokens } from '@vista/ui/tokens.stylex'

/**
 * Contract for lazy islands: how to load the chunk, how to mount it into a host element with an
 * unmount disposer, plus reserved height, label, and outer styling.
 */
export interface LazyBlockProps<Mod> {
  /** Load the chunk, e.g. a dynamic import of the island specifier. */
  readonly load: () => Promise<Mod>
  /** Mount the loaded chunk into `el`; return an unmount disposer. */
  readonly mount: (mod: Mod, el: HTMLElement) => () => void
  /** Reserved skeleton height (px) so layout does not jump while loading. */
  readonly height?: number
  /** Optional label shown above the mount point. */
  readonly label?: string
  /** Caller styling for the outer block; the component recipe is applied first. */
  readonly style?: StyleXStylesWithout<{ position: 'absolute' }>
}

type Status = 'loading' | 'ready' | 'error'

/**
 * Generic wrapper that loads an async chunk, mounts it into a host div once resolved, and tracks
 * loading, ready, or error status while reserving height to prevent layout shift.
 */
export const LazyBlock = <Mod,>({
  load,
  mount,
  height = 220,
  label,
  style,
}: LazyBlockProps<Mod>) => {
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false
    let dispose: (() => void) | undefined
    // Record the HOST React version so an integration test can assert the
    // host and a chunk running its own React coexist on one page.
    ;(globalThis as Record<string, unknown>).__VISTA_HOST_REACT__ = hostReactVersion
    void (async () => {
      try {
        const mod = await load()
        if (cancelled || ref.current === null) return
        dispose = mount(mod, ref.current)
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [load, mount])

  return (
    <div {...stylex.props(styles.root, style)}>
      {label !== undefined && (
        <div {...stylex.props(styles.header)}>
          <code {...stylex.props(styles.label)}>{label}</code>
          <span data-testid="lazyblock-status" {...stylex.props(styles.status)}>
            {status}
          </span>
        </div>
      )}
      {status === 'error' && (
        <div role="alert" {...stylex.props(styles.error)}>
          couldn&apos;t load visualization
        </div>
      )}
      {/* The chunk mounts its own (possibly foreign-React) root into this element. */}
      <div ref={ref} {...stylex.props(styles.mount(height))} />
    </div>
  )
}

const styles = stylex.create({
  root: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    padding: '0.875rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginBottom: '0.5rem',
  },
  label: {
    minWidth: 0,
    overflowWrap: 'anywhere',
    fontFamily: scale.fontMono,
    fontSize: '0.8rem',
    color: tokens['--ds-gray-900'],
  },
  status: {
    flex: 'none',
    fontSize: '0.72rem',
    color: tokens['--ds-gray-800'],
  },
  error: {
    marginBottom: '0.5rem',
    color: tokens['--ds-red-900'],
    fontSize: '0.85rem',
  },
  mount: (height: number) => ({
    minHeight: height,
  }),
})
