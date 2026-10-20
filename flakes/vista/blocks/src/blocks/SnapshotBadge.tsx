/**
 * SnapshotBadge — the single source-of-truth badge for a review's snapshot mode
 * (live / frozen / unsupported; decisions 0007/0029/0061/0068). Both worlds that
 * surface the mode share this one component: bespoke custom-block apps and the
 * publish-time node projection reach it through `SnapshotModeView`, and kit-block
 * apps reach it through `TelemetryBadge` (`./telemetry-frame`) — so the marker,
 * label, and wording can never drift between them.
 *
 * Node-safe by construction: its colocated StyleX recipes depend only on the
 * node-safe Geist token module and render without Geist components, AppShell, or
 * browser globals at module load, so it is safe on the single
 * `@vista/blocks` authoring surface.
 *
 * Themed directly through Geist's semantic StyleX tokens, including their
 * light/dark overrides, while retaining the same translucent status-tone pill.
 *
 * Carries a stable `data-vista-badge="<mode>"` attribute — a wording/style-independent
 * locator for render proofs and tooling, so a marker or CSS change never breaks them.
 */

import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'

/** Format a snapshot's ISO `asOf` as a local `HH:MM:SS` wall-clock time. */
const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const fmtAge = (iso: string): string =>
  `${String(Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1_000)))} s ago`

/**
 * Per-mode presentation metadata. Frozen's optional `· as of …` detail is
 * appended by the component when a valid `asOf` is supplied.
 */
const MODE = {
  live: {
    title: 'fetched from the live provider',
    label: '● LIVE',
  },
  degraded: {
    title: 'showing the last successful provider response',
    label: '● DEGRADED',
  },
  frozen: {
    title: 'point-in-time copy captured at publish',
    label: '❄ FROZEN',
  },
  unsupported: {
    title: 'this published snapshot was captured under an older Vista contract version',
    label: '⚠ UNSUPPORTED',
  },
} as const

/**
 * Props for the single canonical snapshot-mode badge, where asOf only affects the frozen mode
 * (rendered as an as-of timestamp when parseable) and the style cannot override the absolute
 * positioning the badge reserves.
 */
export interface SnapshotBadgeProps {
  readonly mode: 'live' | 'degraded' | 'frozen' | 'unsupported'
  readonly asOf?: string | null
  readonly style?: StyleXStylesWithout<{ position: 'absolute' }>
}

/**
 * The one canonical badge for a resolved snapshot mode. `asOf` is honoured only for
 * `frozen`, and only when it is a valid ISO timestamp — it appends `· as of HH:MM:SS`;
 * an absent or unparseable `asOf` renders the bare `❄ FROZEN`.
 */
export const SnapshotBadge = ({ mode, asOf, style }: SnapshotBadgeProps) => {
  const tone = MODE[mode]
  const validAsOf = asOf != null && !Number.isNaN(new Date(asOf).getTime())
  const detail = validAsOf
    ? mode === 'frozen'
      ? ` · as of ${fmtTime(asOf)}`
      : mode === 'live' || mode === 'degraded'
        ? ` · ${fmtAge(asOf)}`
        : ''
    : ''
  return (
    <span
      {...stylex.props(styles.base, toneStyles[mode], style)}
      data-vista-badge={mode}
      title={tone.title}
    >
      {`${tone.label}${detail}`}
    </span>
  )
}

const toneStyles = stylex.create({
  live: {
    backgroundColor: 'color-mix(in srgb, var(--ds-green-900) 15%, transparent)',
    color: tokens['--ds-green-900'],
  },
  degraded: {
    backgroundColor: 'color-mix(in srgb, var(--ds-amber-900) 15%, transparent)',
    color: tokens['--ds-amber-900'],
  },
  frozen: {
    backgroundColor: 'color-mix(in srgb, var(--ds-blue-700) 15%, transparent)',
    color: tokens['--ds-blue-700'],
  },
  unsupported: {
    backgroundColor: 'color-mix(in srgb, var(--ds-amber-900) 15%, transparent)',
    color: tokens['--ds-amber-900'],
  },
})

const styles = stylex.create({
  base: {
    fontSize: 12,
    fontWeight: 600,
    paddingBlock: 2,
    paddingInline: 8,
    borderRadius: 8,
  },
})
