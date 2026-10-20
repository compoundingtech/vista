import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import type { ReactNode } from 'react'

import { SnapshotBadge } from './SnapshotBadge.tsx'

const styles = stylex.create({
  frame: {
    margin: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.75rem 0.875rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  meta: {
    margin: '0.2rem 0 0',
    color: tokens['--ds-gray-800'],
    fontSize: '0.78rem',
  },
  metaCode: {
    fontFamily: scale.fontMono,
    fontSize: '0.72rem',
  },
})

/** Thin kit wrapper over the shared snapshot status component. */
export const TelemetryBadge = ({
  mode,
  asOf,
}: {
  readonly mode: 'live' | 'degraded' | 'frozen'
  readonly asOf?: string
}) => <SnapshotBadge mode={mode} {...(asOf === undefined ? {} : { asOf })} />

/**
 * Lays out a titled telemetry panel with id-scoped chrome, optional meta line, badge, and caption,
 * wrapping arbitrary children in a styled frame.
 */
export const TelemetryFrame = ({
  id,
  title,
  meta,
  caption,
  badge,
  children,
  style,
}: {
  id: string
  title: string
  meta?: string
  caption?: string
  badge?: ReactNode
  children: ReactNode
  style?: StyleXStylesWithout<{ overflow: 'hidden' }>
}) => (
  <figure {...stylex.props(styles.frame, style)} id={id} aria-labelledby={`${id}-title`}>
    <header {...stylex.props(styles.header)}>
      <div>
        <figcaption id={`${id}-title`} {...stylex.props(styles.title)}>
          {caption ?? title}
        </figcaption>
        {meta === undefined ? null : (
          <p {...stylex.props(styles.meta)}>
            <code {...stylex.props(styles.metaCode)}>{meta}</code>
          </p>
        )}
      </div>
      {badge}
    </header>
    {children}
  </figure>
)
