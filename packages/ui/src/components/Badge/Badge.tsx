/**
 * Badge component built on React Aria
 *
 * @see https://vercel.com/geist/badge
 */

import * as stylex from '@stylexjs/stylex'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    borderRadius: scale.radiusFull,
  },

  gray: { backgroundColor: tokens['--ds-gray-700'], color: '#ffffff' },
  'gray-subtle': { backgroundColor: tokens['--ds-gray-200'], color: tokens['--ds-gray-1000'] },
  blue: { backgroundColor: tokens['--ds-blue-700'], color: '#ffffff' },
  'blue-subtle': { backgroundColor: tokens['--ds-blue-200'], color: tokens['--ds-blue-900'] },
  purple: { backgroundColor: tokens['--ds-purple-700'], color: '#ffffff' },
  'purple-subtle': { backgroundColor: tokens['--ds-purple-200'], color: tokens['--ds-purple-900'] },
  amber: { backgroundColor: tokens['--ds-amber-700'], color: '#000000' },
  'amber-subtle': { backgroundColor: tokens['--ds-amber-200'], color: tokens['--ds-amber-900'] },
  red: { backgroundColor: tokens['--ds-red-700'], color: '#ffffff' },
  'red-subtle': { backgroundColor: tokens['--ds-red-200'], color: tokens['--ds-red-900'] },
  pink: { backgroundColor: tokens['--ds-pink-700'], color: '#ffffff' },
  'pink-subtle': { backgroundColor: tokens['--ds-pink-200'], color: tokens['--ds-pink-900'] },
  green: { backgroundColor: tokens['--ds-green-700'], color: '#ffffff' },
  'green-subtle': { backgroundColor: tokens['--ds-green-200'], color: tokens['--ds-green-900'] },
  teal: { backgroundColor: tokens['--ds-teal-700'], color: '#ffffff' },
  'teal-subtle': { backgroundColor: tokens['--ds-teal-200'], color: tokens['--ds-teal-900'] },
  inverted: {
    backgroundColor: tokens['--ds-gray-1000'],
    color: tokens['--ds-background-100'],
  },

  // Tailwind's `text-<step>` utilities set a paired line-height as well as a
  // font-size, so a conversion that carries only the font-size changes the
  // rendered text box. `sm` uses the arbitrary `text-[11px]`, which emits a
  // font-size alone and correctly has none. Written as absolute lengths rather
  // than Tailwind's own `calc(1 / 0.75)` ratios: Chrome quantises a unitless
  // ratio to 1/256, which lands a box a fraction of a pixel short.
  sm: { height: '1.25rem', paddingInline: '0.375rem', fontSize: '11px' },
  md: { height: '1.5rem', paddingInline: '0.625rem', fontSize: '0.75rem', lineHeight: '1rem' },
  lg: { height: '2rem', paddingInline: '0.75rem', fontSize: '0.875rem', lineHeight: '1.25rem' },
})

/** Colour variants. */
export type BadgeVariant =
  | 'gray'
  | 'gray-subtle'
  | 'blue'
  | 'blue-subtle'
  | 'purple'
  | 'purple-subtle'
  | 'amber'
  | 'amber-subtle'
  | 'red'
  | 'red-subtle'
  | 'pink'
  | 'pink-subtle'
  | 'green'
  | 'green-subtle'
  | 'teal'
  | 'teal-subtle'
  | 'inverted'

/** Size variants. */
export type BadgeSize = 'sm' | 'md' | 'lg'

/**
 * Every variant prop admits an explicit `undefined`, and that is load-bearing
 * rather than decorative.
 *
 * These props used to come from `VariantProps<typeof badgeStyles>`, which
 * includes `undefined` in each member. Hand-writing them as `variant?: X`
 * looks equivalent but is not: the repo runs `exactOptionalPropertyTypes`, so
 * `?: X` means "absent or X" and rejects `variant={maybeUndefined}` — which is
 * what callers commonly write when indexing lookup tables under
 * `noUncheckedIndexedAccess`.
 *
 * The default-parameter form on the component below already handles an
 * explicit `undefined` at runtime, so the type was the only thing narrower
 * than the behaviour. This convention applies to all 25 converted components
 * whose props were previously variant-derived; `className` is deliberately
 * NOT widened, because it never admitted `undefined` before the migration
 * either.
 */
export interface BadgeProps {
  variant?: BadgeVariant | undefined
  size?: BadgeSize | undefined
  children: React.ReactNode
  /** Optional class name override */
  className?: string
}

/** Badge for displaying status, labels, or counts */
export const Badge = ({ variant = 'gray', size = 'md', className, children }: BadgeProps) => (
  <span {...styled(className, styles.base, styles[variant], styles[size])}>{children}</span>
)
