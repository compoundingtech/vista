/**
 * Mermaid-in-React with the failure-mode fixes proven in the kit spike plus the
 * OQ-MERMAID-THEME hardening:
 *
 *  1. Unique render id per call (`mmd-${id}-${seq++}`) so React 19 StrictMode's
 *     double-invoke doesn't collide on the DOM render target.
 *  2. try/catch → raw-source `<pre>` fallback, so invalid Mermaid source shows
 *     the author their broken source instead of crashing the page.
 *  3. Theme via React context (`useTheme`), NOT a DOM `data-theme` read. The old
 *     MutationObserver-on-documentElement approach was fragile: `data-theme` is a
 *     single global attribute, so a diagram could read a stale/foreign value when
 *     another owner (a Storybook decorator, the host app) also wrote it.
 *  4. Per-render theming via an inline `%%{init}%%` directive prepended to the
 *     source, so each diagram carries its own theme independent of the global
 *     `mermaid.initialize` singleton. This is what actually fixes the concurrent-
 *     diagram race the OQ names: two diagrams flipping theme no longer clobber
 *     each other through shared global init state.
 *
 * Interactive zoom/pan via `svg-pan-zoom` when `zoomPan` is set.
 */
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { useEffect, useRef, useState } from 'react'

import type { Theme } from '../model.ts'
import { useTheme } from '../theme.ts'
// oxlint-disable-next-line import/no-unassigned-import -- CSS side-effect import
import '../foreign-dom.css'
// `mermaid` and `svg-pan-zoom` both touch `window` at module load, so they are
// imported lazily inside the effect to keep the kit importable in non-DOM
// environments (server render, publish-time projection, tests) — MED.DATA-R52.

let seq = 0

const themeVars = (theme: Theme) =>
  theme === 'dark'
    ? {
        primaryColor: '#1e293b',
        primaryTextColor: '#e2e8f0',
        lineColor: '#64748b',
        primaryBorderColor: '#475569',
      }
    : {
        primaryColor: '#eef2ff',
        primaryTextColor: '#1e293b',
        lineColor: '#94a3b8',
        primaryBorderColor: '#c7d2fe',
      }

/**
 * Prepend a per-diagram init directive so this render's theme travels with the
 * source instead of depending on the last global `mermaid.initialize` call.
 */
const withThemeDirective = ({ source, theme }: { source: string; theme: Theme }): string => {
  const init = { theme: 'base', themeVariables: themeVars(theme) }
  return `%%{init: ${JSON.stringify(init)}}%%\n${source}`
}

/**
 * Configures a mermaid diagram block with its block identifier and source text, an optional
 * caption, optional zoom/pan interaction, and styles that may not override `overflow: 'hidden'`.
 */
export interface MermaidDiagramProps {
  readonly id: string
  readonly source: string
  readonly caption?: string | undefined
  readonly zoomPan?: boolean | undefined
  readonly style?: StyleXStylesWithout<{ overflow: 'hidden' }> | undefined
}

/** A `mermaid-diagram` block: per-render themed Mermaid with a raw-source fallback. */
export const MermaidDiagram = ({ id, source, caption, zoomPan, style }: MermaidDiagramProps) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const theme = useTheme()
  const isEmpty = source.trim().length === 0

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host) return
    if (isEmpty) {
      host.innerHTML = ''
      // oxlint-disable-next-line react/set-state-in-effect -- clear a stale render error when the diagram empties; no fetch follows this branch.
      setError(null)
      return
    }
    // Fix 1: unique id per render call avoids StrictMode double-invoke collisions.
    const renderId = `mmd-${id}-${seq++}`
    void (async () => {
      try {
        // `mermaid` touches `window` at module load, so import it lazily here
        // (not at module scope) to keep the kit importable under node.
        const { default: mermaid } = await import('mermaid')
        if (cancelled || !host) return
        // Global init stays minimal; the per-render theme rides on the source
        // directive (fix 4), so concurrent diagrams don't race on global state.
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
        const { svg } = await mermaid.render(renderId, withThemeDirective({ source, theme }))
        if (cancelled || !host) return
        host.innerHTML = svg
        setError(null)
        if (zoomPan) {
          const svgEl = host.querySelector('svg')
          if (svgEl) {
            // Fixed-height pan/zoom viewport: fit into the box so the whole
            // graph is visible, then pannable. The attributes prime the
            // generated SVG before the scoped foreign-DOM rule applies.
            svgEl.setAttribute('width', '100%')
            svgEl.setAttribute('height', '100%')
            const { default: svgPanZoom } = await import('svg-pan-zoom')
            if (cancelled) return
            svgPanZoom(svgEl, {
              controlIconsEnabled: true,
              fit: true,
              center: true,
              minZoom: 0.4,
              maxZoom: 8,
            })
          }
        }
      } catch (e: unknown) {
        // Fix 2: raw-source fallback rather than a crash.
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isEmpty, source, theme, zoomPan])

  if (error) {
    return (
      <figure {...stylex.props(styles.root, styles.errorRoot, style)}>
        <pre {...stylex.props(styles.raw)}>{source}</pre>
        <figcaption {...stylex.props(styles.errorMessage)}>
          mermaid render failed: {error}
        </figcaption>
      </figure>
    )
  }

  return (
    <figure {...stylex.props(styles.root, style)}>
      <div
        ref={hostRef}
        data-vista-mermaid-host=""
        data-zoom-pan={zoomPan ? '' : undefined}
        {...stylex.props(styles.host, zoomPan && styles.zoomPanHost)}
      >
        {isEmpty ? <p {...stylex.props(styles.empty)}>No diagram source.</p> : null}
      </div>
      {caption ? <figcaption {...stylex.props(styles.caption)}>{caption}</figcaption> : null}
    </figure>
  )
}

const styles = stylex.create({
  root: {
    margin: 0,
    textAlign: 'center',
    backgroundColor: tokens['--ds-background-200'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    padding: '0.75rem',
    overflow: 'hidden',
  },
  errorRoot: {
    borderColor: tokens['--ds-red-900'],
  },
  host: {
    maxWidth: '100%',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  zoomPanHost: {
    height: '26rem',
    overflow: 'hidden',
  },
  caption: {
    marginTop: '0.5rem',
    fontSize: '0.82rem',
    color: tokens['--ds-gray-800'],
  },
  raw: {
    maxHeight: '18rem',
    textAlign: 'left',
    backgroundColor: tokens['--ds-gray-alpha-100'],
    padding: '0.6rem',
    borderRadius: scale.radiusDefault,
    fontSize: '0.8rem',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  errorMessage: {
    color: tokens['--ds-red-900'],
    fontSize: '0.8rem',
  },
  empty: {
    margin: 0,
    color: tokens['--ds-gray-800'],
    fontSize: '0.8rem',
  },
})
