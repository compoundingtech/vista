/**
 * LoadingDots component built on React Aria
 *
 * @see https://vercel.com/geist/loading-dots
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

/**
 * Replaces the `@keyframes loadingDotsBlink` block that this component used to
 * inject as a `<style>` element on every render. StyleX hoists it into the
 * compiled stylesheet once, under a hashed name, so the element is gone.
 */
const blink = stylex.keyframes({
  '0%': { opacity: 0.2 },
  '20%': { opacity: 1 },
  '100%': { opacity: 0.2 },
})

const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
  },

  label: { color: tokens['--ds-gray-1000'] },
  // `text-*` set a line-height as well as a font-size, and here it is
  // load-bearing: the label is a flex item, so its line box sets the root's
  // height.
  //
  // These are Tailwind's paired line-heights stated as absolute rem, NOT as
  // its `calc(1.25 / 0.875)` ratios. The ratios are exact when a browser
  // receives them, but the CSS minifier rounds a bare `calc()` to five
  // decimals and layout then floors onto the 1/64 grid: `text-sm` measured
  // 19.984375px instead of 20px here before this change. Tailwind escapes that
  // because its ratio lives inside an unregistered custom property the
  // minifier will not evaluate; written directly it has no such protection.
  // Each value below is the ratio multiplied by its own font-size, so it is
  // what Tailwind resolves to, exactly.
  labelDefault: { fontSize: '1rem', lineHeight: '1.5rem' },
  labelSmall: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  labelLarge: { fontSize: '1.125rem', lineHeight: '1.75rem' },

  dotsContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    // All three sizes set the same colour; hoisted out of the size variants.
    color: tokens['--ds-gray-900'],
  },
  dotsContainerDefault: { marginLeft: '0.25rem' },
  dotsContainerSmall: { marginLeft: '0.125rem' },
  dotsContainerLarge: { marginLeft: '0.375rem' },

  dot: {
    borderRadius: scale.radiusFull,
    // `bg-current` — the dots inherit the container's `--ds-gray-900`.
    backgroundColor: 'currentColor',
    // Longhands only: the `animation` shorthand compiles to an empty style
    // object with no error.
    animationName: blink,
    animationDuration: '1.4s',
    animationTimingFunction: 'ease',
    animationIterationCount: 'infinite',
  },
  dotDefault: { width: '0.125rem', height: '0.125rem', marginInline: '1px' },
  dotSmall: { width: '3px', height: '3px', marginInline: '0.5px' },
  dotLarge: { width: '0.25rem', height: '0.25rem', marginInline: '0.125rem' },

  delay0: { animationDelay: '0s' },
  delay200: { animationDelay: '0.2s' },
  delay400: { animationDelay: '0.4s' },
})

/** Size variants. */
export type LoadingDotsSize = 'default' | 'small' | 'large'

const labelStyles = {
  default: styles.labelDefault,
  small: styles.labelSmall,
  large: styles.labelLarge,
} as const

const dotsContainerStyles = {
  default: styles.dotsContainerDefault,
  small: styles.dotsContainerSmall,
  large: styles.dotsContainerLarge,
} as const

const dotStyles = {
  default: styles.dotDefault,
  small: styles.dotSmall,
  large: styles.dotLarge,
} as const

export interface LoadingDotsProps {
  size?: LoadingDotsSize | undefined
  /** Optional label text */
  children?: ReactNode
  /** Accessible label for screen readers */
  'aria-label'?: string
  /** Optional class name */
  className?: string
}

/** LoadingDots indicates an action running in the background */
export const LoadingDots = ({
  children,
  size = 'default',
  'aria-label': ariaLabel = 'Loading',
  className,
}: LoadingDotsProps) => (
  <span {...styled(className, styles.root)} role="status" aria-label={ariaLabel}>
    {children && <span {...styled(undefined, styles.label, labelStyles[size])}>{children}</span>}
    <span
      {...styled(undefined, styles.dotsContainer, dotsContainerStyles[size])}
      aria-hidden="true"
    >
      <span {...styled(undefined, styles.dot, dotStyles[size], styles.delay0)} />
      <span {...styled(undefined, styles.dot, dotStyles[size], styles.delay200)} />
      <span {...styled(undefined, styles.dot, dotStyles[size], styles.delay400)} />
    </span>
  </span>
)
