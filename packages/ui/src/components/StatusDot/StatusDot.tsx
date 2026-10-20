/**
 * StatusDot component built on React Aria
 *
 * @see https://vercel.com/geist/status-dot
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
  },

  dot: {
    flexShrink: 0,
    borderRadius: scale.radiusFull,
  },

  // Deployment-status hues, kept as the literal hex values the source used.
  // None of them has a `--ds-*` token: the closest neutral is
  // `--ds-gray-1000` at hsl(0 0% 93%) against `#eaeaea`'s hsl(0 0% 92%), and
  // that token also varies by colour scheme while these deliberately do not.
  // Remapping would change the rendered colour, so they stay verbatim.
  dotQueued: { backgroundColor: '#eaeaea' },
  dotBuilding: { backgroundColor: '#f5a623' },
  dotError: { backgroundColor: '#ee0000' },
  dotReady: { backgroundColor: '#50e3c2' },
  dotCanceled: { backgroundColor: '#eaeaea' },

  dotDefault: { width: '0.625rem', height: '0.625rem' },
  dotSmall: { width: '0.5rem', height: '0.5rem' },
  dotLarge: { width: '0.75rem', height: '0.75rem' },

  label: {
    fontSize: '0.875rem',
    // Tailwind's `text-sm` sets a paired line-height as well as a font size;
    // this is that pair's value, kept so wrapping labels are unchanged.
    // Spelled as the resolved length rather than Tailwind's own
    // `calc(1.25 / 0.875)` ratio: the CSS minifier folds that division to five
    // decimals and the product floors onto the 1/64px grid, landing the box a
    // fraction short. An absolute length has nothing left to fold.
    lineHeight: '1.25rem',
    color: tokens['--ds-gray-1000'],
  },

  labelDefault: { marginLeft: '0.5rem' },
  // `small` overrode `text-sm` with `text-xs`, so it restates both halves.
  labelSmall: {
    marginLeft: '0.375rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  labelLarge: { marginLeft: '0.625rem' },
})

const dotStatusStyles = {
  queued: styles.dotQueued,
  building: styles.dotBuilding,
  error: styles.dotError,
  ready: styles.dotReady,
  canceled: styles.dotCanceled,
} as const

const dotSizeStyles = {
  default: styles.dotDefault,
  small: styles.dotSmall,
  large: styles.dotLarge,
} as const

const labelSizeStyles = {
  default: styles.labelDefault,
  small: styles.labelSmall,
  large: styles.labelLarge,
} as const

/** Deployment/process status. */
export type StatusDotStatus = 'queued' | 'building' | 'error' | 'ready' | 'canceled'

/** Size variants. */
export type StatusDotSize = 'default' | 'small' | 'large'

export interface StatusDotProps {
  /** Status type */
  status?: StatusDotStatus | undefined
  /** Size variant */
  size?: StatusDotSize | undefined
  /** Optional label text */
  label?: ReactNode
  /** Accessible label for screen readers */
  'aria-label'?: string
  /** Optional class name */
  className?: string
}

const statusLabels: Record<StatusDotStatus, string> = {
  queued: 'Queued',
  building: 'Building',
  error: 'Error',
  ready: 'Ready',
  canceled: 'Canceled',
}

/** StatusDot displays a colored indicator for deployment/process status */
export const StatusDot = ({
  status = 'queued',
  size = 'default',
  label,
  'aria-label': ariaLabel,
  className,
}: StatusDotProps) => {
  const defaultAriaLabel = `Status: ${statusLabels[status]}`

  return (
    <span
      {...styled(className, styles.root)}
      role="status"
      aria-label={ariaLabel ?? defaultAriaLabel}
    >
      <span
        {...styled(undefined, styles.dot, dotStatusStyles[status], dotSizeStyles[size])}
        aria-hidden="true"
      />
      {label && <span {...styled(undefined, styles.label, labelSizeStyles[size])}>{label}</span>}
    </span>
  )
}
