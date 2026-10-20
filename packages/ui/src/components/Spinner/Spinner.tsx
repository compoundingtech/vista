/**
 * Spinner component built on React Aria
 *
 * @see https://vercel.com/geist/spinner
 */

import * as stylex from '@stylexjs/stylex'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

/**
 * Replaces the `@keyframes geistSpin` block that this component used to inject
 * as a `<style>` element on every render. StyleX hoists it into the compiled
 * stylesheet once, under a hashed name, so the element is gone.
 */
const spin = stylex.keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
})

const styles = stylex.create({
  root: { position: 'relative' },

  sm: { height: '1rem', width: '1rem' },
  md: { height: '1.25rem', width: '1.25rem' },
  lg: { height: '1.5rem', width: '1.5rem' },
  xl: { height: '2rem', width: '2rem' },

  circle: {
    position: 'absolute',
    inset: 0,
    borderRadius: scale.radiusFull,
    // `border-2` plus `border-[…]` plus `border-t-[…]`. Written as longhands so
    // the top edge's colour cannot depend on how a shorthand is expanded or
    // ordered against it.
    borderTopWidth: '2px',
    borderRightWidth: '2px',
    borderBottomWidth: '2px',
    borderLeftWidth: '2px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: tokens['--ds-gray-1000'],
    borderRightColor: tokens['--ds-gray-alpha-400'],
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderLeftColor: tokens['--ds-gray-alpha-400'],
    // Longhands only: the `animation` shorthand compiles to an empty style
    // object with no error.
    animationName: spin,
    animationDuration: '0.6s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
})

/** Size variants. */
export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

export interface SpinnerProps {
  size?: SpinnerSize | undefined
  className?: string
  /** Accessible label for screen readers */
  label?: string
}

/** Spinner for indicating loading state */
export const Spinner = ({ size = 'md', className, label = 'Loading' }: SpinnerProps) => (
  <div role="status" aria-label={label} {...styled(className, styles.root, styles[size])}>
    <div {...styled(undefined, styles.circle)} />
  </div>
)
