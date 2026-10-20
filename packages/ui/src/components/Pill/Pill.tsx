/**
 * Pill component built on React Aria
 *
 * @see https://vercel.com/geist/badge#pill
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingInline: '0.5rem',
    paddingBlock: '0.25rem',
    fontSize: '0.75rem',
    // `text-xs` carries a line-height as well as a size, and no `leading-*`
    // overrode it here. The pill's height is content-driven, so dropping it
    // would inherit the document's 1.5 and make the pill taller. Spelled as
    // the resolved length rather than Tailwind's `calc(1 / 0.75)` ratio: the
    // CSS minifier folds that calc to `1.33333` and the pill comes out
    // 1/64px short.
    lineHeight: '1rem',
    fontWeight: 500,
    borderRadius: scale.radiusFull,
    whiteSpace: 'nowrap',
  },

  gray: { backgroundColor: tokens['--ds-gray-200'], color: tokens['--ds-gray-1000'] },
  blue: { backgroundColor: tokens['--ds-blue-200'], color: tokens['--ds-blue-1000'] },
  purple: { backgroundColor: tokens['--ds-purple-200'], color: tokens['--ds-purple-1000'] },
  amber: { backgroundColor: tokens['--ds-amber-200'], color: tokens['--ds-amber-1000'] },
  red: { backgroundColor: tokens['--ds-red-200'], color: tokens['--ds-red-1000'] },
  pink: { backgroundColor: tokens['--ds-pink-200'], color: tokens['--ds-pink-1000'] },
  green: { backgroundColor: tokens['--ds-green-200'], color: tokens['--ds-green-1000'] },
  teal: { backgroundColor: tokens['--ds-teal-200'], color: tokens['--ds-teal-1000'] },
})

/** Colour variants. */
export type PillVariant = 'gray' | 'blue' | 'purple' | 'amber' | 'red' | 'pink' | 'green' | 'teal'

export interface PillProps {
  /** Colour variant */
  variant?: PillVariant | undefined
  /** Pill content */
  children: ReactNode
  /** Optional class name */
  className?: string
}

/** Pill is a compact, rounded badge for labels and tags */
export const Pill = ({ children, variant = 'gray', className }: PillProps) => (
  <span {...styled(className, styles.base, styles[variant])}>{children}</span>
)
