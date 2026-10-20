/**
 * Tooltip component built on React Aria
 *
 * @see https://vercel.com/geist/tooltip
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
  OverlayArrow,
  type TooltipProps as AriaTooltipProps,
  type TooltipTriggerComponentProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

/**
 * The `placement-*` and `group-placement-*` utilities that used to sit here are
 * gone, and nothing replaces them, because they never produced any CSS.
 *
 * `placement-bottom`, `placement-top`, `placement-left`, `placement-right` and
 * their `group-` forms are not Tailwind variants and are not declared as custom
 * variants anywhere in this package — the only plausible source,
 * `tailwindcss-react-aria-components`, is not a dependency. Verified by
 * compiling the candidates against this package's own Tailwind config: an
 * unknown variant makes the whole candidate invalid, so `placement-bottom:mt-2.5`
 * and `group-placement-bottom:rotate-180` emitted nothing at all. The `group`
 * marker class they were paired with emits nothing either.
 *
 * So the tooltip has never had a placement offset and the arrow has never
 * rotated: it points down on every side. That is the current rendered
 * behaviour, and this migration reproduces it rather than fixing it. React Aria
 * does supply the placement — `AriaTooltip` carries `data-placement` and
 * `OverlayArrow` exposes it as a render prop — so making these real is a small
 * follow-up, but it is a behaviour change and belongs in its own commit.
 *
 * `ContextCard` carries the same four dead utilities on the same two slots.
 */
const styles = stylex.create({
  tooltip: {
    paddingInline: '0.75rem',
    paddingBlock: '0.5rem',
    maxWidth: '250px',
    fontSize: '13px',
    textAlign: 'center',
    lineHeight: 1.4,
    backgroundColor: tokens['--ds-gray-1000'],
    color: tokens['--ds-background-100'],
    borderRadius: '6px',
  },

  arrow: { fill: tokens['--ds-gray-1000'] },
})

export interface TooltipProps extends Omit<AriaTooltipProps, 'children'> {
  /** The tooltip content */
  children: ReactNode
  /** Optional class name override */
  className?: string
}

export interface TooltipTriggerProps extends TooltipTriggerComponentProps {
  /** The trigger element and tooltip */
  children: ReactNode
}

/** Container that manages the trigger and tooltip relationship */
export const TooltipTrigger = ({ children, ...props }: TooltipTriggerProps) => (
  <AriaTooltipTrigger {...props}>{children}</AriaTooltipTrigger>
)

/** The tooltip popup that displays on hover */
export const Tooltip = ({ children, className, ...props }: TooltipProps) => (
  <AriaTooltip {...styled(className, styles.tooltip)} {...props}>
    <OverlayArrow>
      <svg width={14} height={6} viewBox="0 0 14 6" {...styled(undefined, styles.arrow)}>
        <path d="M13.8284 0H0.17157C0.702003 0 1.21071 0.210714 1.58578 0.585787L5.58578 4.58579C6.36683 5.36684 7.63316 5.36683 8.41421 4.58579L12.4142 0.585786C12.7893 0.210714 13.298 0 13.8284 0Z" />
      </svg>
    </OverlayArrow>
    {children}
  </AriaTooltip>
)
