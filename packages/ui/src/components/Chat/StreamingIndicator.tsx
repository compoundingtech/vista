/**
 * @see https://v0.app/chat - Design reference for AI chat components
 *
 * StreamingIndicator shows that content is being streamed.
 * Supports cursor (blinking line) or dots (animated dots) variants.
 */

import * as stylex from '@stylexjs/stylex'

import { styled } from '../../foundations/props.ts'
import { scale } from '../../foundations/tokens.stylex.ts'

/*
 * Literal `oklch()` values from the v0 chat reference, not design tokens — every
 * `--ds-*` token in this package is `hsl()` and none matches these. See the same
 * note in `./ChatMessage.tsx`.
 */
const chatForeground = 'oklch(0.946 0 0)'
const chatForegroundMuted = 'oklch(0.706 0 0)'

/*
 * Previously hand-written `@keyframes` injected through a `<style>` element on
 * every render. StyleX hoists these into the stylesheet and hands back a
 * generated name, so the elements go away and the rules are emitted once.
 */
const cursorBlink = stylex.keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0 },
})

const dotsBlink = stylex.keyframes({
  '0%, 100%': { opacity: 0.2 },
  '20%': { opacity: 1 },
})

const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
  },

  cursor: {
    display: 'inline-block',
    width: '2px',
    height: '1em',
    backgroundColor: chatForeground,
    borderRadius: scale.radiusSm,
    // Longhands only: the `animation` shorthand compiles to an empty style
    // object under StyleX, silently dropping the animation.
    animationName: cursorBlink,
    animationDuration: '1s',
    animationTimingFunction: 'step-end',
    animationIterationCount: 'infinite',
  },

  dotsContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
  },

  dot: {
    width: '4px',
    height: '4px',
    borderRadius: scale.radiusFull,
    backgroundColor: chatForegroundMuted,
    animationName: dotsBlink,
    animationDuration: '1.4s',
    animationTimingFunction: 'ease',
    animationIterationCount: 'infinite',
  },
  // The three dots share one animation and differ only in phase.
  dotDelay0: { animationDelay: '0s' },
  dotDelay1: { animationDelay: '0.2s' },
  dotDelay2: { animationDelay: '0.4s' },
})

export interface StreamingIndicatorProps {
  /** Visual variant */
  variant?: 'cursor' | 'dots'
  /** Accessible label */
  'aria-label'?: string
  /** Optional class name override */
  className?: string
}

/** StreamingIndicator shows that content is being streamed */
export const StreamingIndicator = ({
  variant = 'cursor',
  'aria-label': ariaLabel = 'Loading',
  className,
}: StreamingIndicatorProps) => {
  if (variant === 'dots') {
    return (
      <span {...styled(className, styles.root)} role="status" aria-label={ariaLabel}>
        <span {...styled(undefined, styles.dotsContainer)} aria-hidden="true">
          <span {...styled(undefined, styles.dot, styles.dotDelay0)} />
          <span {...styled(undefined, styles.dot, styles.dotDelay1)} />
          <span {...styled(undefined, styles.dot, styles.dotDelay2)} />
        </span>
      </span>
    )
  }

  return (
    <span {...styled(className, styles.root)} role="status" aria-label={ariaLabel}>
      <span {...styled(undefined, styles.cursor)} aria-hidden="true" />
    </span>
  )
}
