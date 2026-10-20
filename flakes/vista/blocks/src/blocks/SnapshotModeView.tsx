/**
 * SnapshotModeView — the fail-closed presentation of a resolved snapshot mode for
 * bespoke custom-block apps (decisions 0007/0029/0061/0068). A review resolves to
 * one of four render outcomes in the browser (`resolveSnapshotMode` in
 * `@vista/data/client/frozen`); this component composes the honest surface for
 * whichever it is, so a custom-block app author does not copy-paste it.
 *
 * The badge itself is the shared {@link SnapshotBadge} (`./SnapshotBadge`) — the
 * single source of truth also used by kit-block apps via `TelemetryBadge`
 * (`./telemetry-frame`), so the marker/label/wording never drift between worlds.
 * This component's own job is composition: it renders the badge for `live`/`frozen`,
 * and for `unsupported` or `unavailable` stacks the badge over its fail-closed
 * notice so an unreadable snapshot is always VISIBLE and never silently rendered
 * live.
 *
 * Node-safe by construction: it imports only StyleX, Geist's node-safe token
 * module, and `SnapshotBadge`; it has no Geist components, AppShell, or browser
 * globals at module load, so it is safe on the single `@vista/blocks`
 * authoring surface.
 */
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'

import { snapshotUnavailableMessage, snapshotUnsupportedMessage } from '../model.ts'
import { SnapshotBadge } from './SnapshotBadge.tsx'

export { snapshotUnavailableMessage, snapshotUnsupportedMessage } from '../model.ts'

/**
 * The presentation-only view of a resolved snapshot mode — the SnapshotMode of
 * `@vista/data/client/frozen` narrowed to exactly what the badge/notice needs (no
 * decoded `Snapshot` payload, just the `asOf` timestamp / `found` apiVersion):
 *  - `live`        — a draft rendered against the live provider.
 *  - `frozen`      — an immutable point-in-time copy, badged with its `asOf`.
 *  - `unsupported` — a PRESENT snapshot that cannot be read under this build's
 *                    contract (`skew`: an older apiVersion; `malformed`: not a
 *                    well-formed snapshot). Surfaced visibly, NEVER live.
 *  - `unavailable` — the snapshot request failed without proving absence.
 *                    Surfaced visibly, NEVER live.
 */
export type SnapshotPresentation =
  | { readonly _tag: 'live' }
  | { readonly _tag: 'frozen'; readonly asOf: string | null }
  | { readonly _tag: 'unsupported'; readonly reason: 'skew' | 'malformed'; readonly found?: number }
  | { readonly _tag: 'unavailable' }

/**
 * Props for composing the badge and notice of a resolved snapshot presentation over the shared
 * wrapper, allowing styles that may not override the flex-column layout and absolute positioning
 * the view itself controls.
 */
export interface SnapshotModeViewProps {
  readonly mode: SnapshotPresentation
  readonly style?: StyleXStylesWithout<{
    display: 'flex'
    flexDirection: 'column'
    alignItems: 'flex-start'
    position: 'absolute'
  }>
}

/**
 * Compose the badge/notice for a resolved snapshot mode over the shared
 * {@link SnapshotBadge}. `live` and `frozen` are the badge alone (fits a header row
 * next to a title); `unsupported` and `unavailable` stack the badge over their
 * fail-closed notice, so an unreadable snapshot is always VISIBLE and never silently
 * rendered live (decision 0068).
 */
export const SnapshotModeView = ({ mode, style }: SnapshotModeViewProps) => {
  switch (mode._tag) {
    case 'live':
      return <SnapshotBadge mode="live" style={style} />
    case 'frozen':
      return <SnapshotBadge mode="frozen" asOf={mode.asOf} style={style} />
    case 'unsupported':
      return (
        <div {...stylex.props(styles.stack, style)}>
          <SnapshotBadge mode="unsupported" />
          <div {...stylex.props(styles.notice)}>{snapshotUnsupportedMessage(mode.found)}</div>
        </div>
      )
    case 'unavailable':
      return (
        <div {...stylex.props(styles.stack, style)}>
          <SnapshotBadge mode="unsupported" />
          <div {...stylex.props(styles.notice)}>{snapshotUnavailableMessage()}</div>
        </div>
      )
  }
}

const styles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  notice: {
    color: tokens['--ds-amber-900'],
  },
})
