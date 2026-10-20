/**
 * RelativeTimeCard component built on React Aria
 *
 * @see https://vercel.com/geist/relative-time-card
 */

import * as stylex from '@stylexjs/stylex'
import { useMemo } from 'react'

import { type StyledProps, styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    // `text-sm` on the base. Always overridden by the size style below, since
    // `size` defaults to `default` and is therefore always applied — the same
    // as under `tv()`, where tailwind-merge dropped it. Kept so the base slot
    // still reads as it did.
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    color: tokens['--ds-gray-1000'],
  },
  icon: {
    width: '1rem',
    height: '1rem',
    flexShrink: 0,
  },

  // Tailwind's `text-*` utilities set a font-size AND its paired line-height,
  // so both are restated per size rather than leaving line-height inherited.
  //
  // The line-heights are absolute, NOT Tailwind's `calc(1.25 / 0.875)` ratio
  // form, and that is load-bearing rather than cosmetic. Tailwind keeps the
  // ratio inside an unregistered custom property, which the CSS minifier will
  // not evaluate; written as a plain declaration the minifier folds the
  // division to five decimals (`1.33333`) and the product lands off-grid —
  // 15.984375px where 16px is intended. The ratio encodes rem-over-rem, so the
  // absolute value is the same number exactly and cannot be folded. This root
  // is free-height, so that error would have moved real geometry.
  rootSmall: { fontSize: '0.75rem', lineHeight: '1rem' },
  rootDefault: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  rootLarge: { fontSize: '1rem', lineHeight: '1.5rem' },

  iconSmall: { width: '0.875rem', height: '0.875rem' },
  iconDefault: { width: '1rem', height: '1rem' },
  iconLarge: { width: '1.25rem', height: '1.25rem' },
})

/** Size variants. */
export type RelativeTimeCardSize = 'small' | 'default' | 'large'

const rootSizeStyles = {
  small: styles.rootSmall,
  default: styles.rootDefault,
  large: styles.rootLarge,
} as const

const iconSizeStyles = {
  small: styles.iconSmall,
  default: styles.iconDefault,
  large: styles.iconLarge,
} as const

export interface RelativeTimeCardProps {
  size?: RelativeTimeCardSize | undefined
  /** Date to display relative to `now` */
  date: Date | string | number
  /** Reference time the date is measured against. Defaults to the time of render. */
  now?: Date | string | number | undefined
  /** Show clock icon */
  showIcon?: boolean
  /** Optional class name */
  className?: string
}

const ClockIcon = (props: StyledProps) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Format a date as a relative time string, measured from `now` */
const formatRelativeTime = (date: Date, now: Date): string => {
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSeconds < 5) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 4) return `${diffWeeks}w ago`
  if (diffMonths < 12) return `${diffMonths}mo ago`
  return `${diffYears}y ago`
}

/** Format full date for tooltip */
const formatFullDate = (date: Date): string => {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** RelativeTimeCard displays a date relative to now (e.g., "5m ago") */
export const RelativeTimeCard = ({
  date,
  now,
  showIcon = true,
  size = 'default',
  className,
}: RelativeTimeCardProps) => {
  const dateObj = useMemo(() => {
    if (date instanceof Date) return date
    return new Date(date)
  }, [date])

  const relativeText = useMemo(
    () => formatRelativeTime(dateObj, now === undefined ? new Date() : new Date(now)),
    [dateObj, now],
  )
  const fullText = useMemo(() => formatFullDate(dateObj), [dateObj])

  return (
    <time
      {...styled(className, styles.root, rootSizeStyles[size])}
      dateTime={dateObj.toISOString()}
      title={fullText}
    >
      {showIcon && <ClockIcon {...styled(undefined, styles.icon, iconSizeStyles[size])} />}
      {/* The `time` slot carried no styles under `tv()`, so this span stays bare. */}
      <span>{relativeText}</span>
    </time>
  )
}
