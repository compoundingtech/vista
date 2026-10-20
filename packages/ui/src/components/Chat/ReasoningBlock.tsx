/**
 * @see https://v0.app/chat - Design reference for AI chat components
 *
 * ReasoningBlock displays collapsible AI thinking/reasoning content.
 * Uses React Aria Disclosure pattern for accessibility.
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  Disclosure as AriaDisclosure,
  DisclosurePanel as AriaDisclosurePanel,
  Button as AriaButton,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale } from '../../foundations/tokens.stylex.ts'
import { SparkleIcon, ChevronDownIcon } from './icons.tsx'

const spin = stylex.keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
})

const styles = stylex.create({
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    height: scale.space6,
    color: 'oklch(0.706 0 0)',
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: 'transparent',
        '@media (hover: hover)': 'oklch(0.2 0 0)',
      },
    },
    borderRadius: '0.375rem',
    boxShadow: {
      default: null,
      ':focus-visible': '0 0 0 2px oklch(0.4 0 0)',
    },
    outlineStyle: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  icon: {
    width: scale.space4,
    height: scale.space4,
    color: 'oklch(0.65 0 0)',
    flexShrink: 0,
  },
  iconAnimated: {
    animationName: spin,
    animationDuration: '2s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
  chevron: {
    width: scale.space4,
    height: scale.space4,
    color: 'oklch(0.65 0 0)',
    flexShrink: 0,
    rotate: '-90deg',
    transitionProperty: 'transform, translate, scale, rotate',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
  },
  chevronExpanded: {
    rotate: '0deg',
  },
  title: {
    color: 'oklch(0.706 0 0)',
  },
  panel: {
    overflow: 'hidden',
    color: 'oklch(0.706 0 0)',
    fontSize: '0.875rem',
    lineHeight: 1.625,
  },
  panelContent: {
    minWidth: 0,
    marginLeft: scale.space2,
    paddingTop: scale.space2,
    paddingBottom: scale.space3,
    paddingLeft: scale.space6,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'oklch(0.301 0 0)',
    overflowWrap: 'anywhere',
  },
})

export type ReasoningBlockProps = {
  /** Whether the block is expanded by default */
  defaultExpanded?: boolean
  /** Whether to show animated spinner (for in-progress thinking) */
  animated?: boolean
  /** Reasoning content */
  children: ReactNode
  /** Optional class name override */
  className?: string
  /** Caller-last root StyleX adaptation. The root owns no visual properties. */
  stylexStyle?: stylex.StyleXStyles
} & (
  | { /** Title text (e.g., "Thought for 5s") */ title: string; duration?: never }
  | { title?: never; /** Duration in seconds - formats as "Thought for Xs" */ duration: number }
)

/** ReasoningBlock displays collapsible AI thinking/reasoning content */
export const ReasoningBlock = ({
  title,
  duration,
  defaultExpanded = false,
  animated = false,
  children,
  className,
  stylexStyle,
}: ReasoningBlockProps) => {
  const displayTitle = duration !== undefined ? `Thought for ${duration}s` : title

  return (
    <AriaDisclosure {...styled(className, stylexStyle)} defaultExpanded={defaultExpanded}>
      {({ isExpanded }) => (
        <>
          <AriaButton slot="trigger" {...styled(undefined, styles.trigger)}>
            <SparkleIcon {...styled(undefined, styles.icon, animated && styles.iconAnimated)} />
            <span {...styled(undefined, styles.title)}>{displayTitle}</span>
            <ChevronDownIcon
              {...styled(undefined, styles.chevron, isExpanded && styles.chevronExpanded)}
            />
          </AriaButton>
          <AriaDisclosurePanel {...styled(undefined, styles.panel)}>
            <div {...styled(undefined, styles.panelContent)}>{children}</div>
          </AriaDisclosurePanel>
        </>
      )}
    </AriaDisclosure>
  )
}
