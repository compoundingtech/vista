/**
 * ShowMore component built on React Aria's Disclosure
 *
 * @see https://vercel.com/geist/show-more
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  Disclosure as AriaDisclosure,
  DisclosurePanel as AriaDisclosurePanel,
  Button as AriaButton,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    position: 'relative',
  },
  panel: {
    overflow: 'hidden',
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '300ms',
  },
  content: {
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: scale.space12,
    backgroundImage: `linear-gradient(to top in oklab, ${tokens['--ds-background-100']} 0%, transparent 100%)`,
    pointerEvents: 'none',
    opacity: 1,
  },
  button: {
    position: 'relative',
    zIndex: 10,
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space1,
    marginTop: scale.space3,
    color: {
      default: tokens['--ds-blue-700'],
      ':hover': {
        default: tokens['--ds-blue-700'],
        '@media (hover: hover)': tokens['--ds-blue-800'],
      },
    },
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
    cursor: 'pointer',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  icon: {
    width: scale.space4,
    height: scale.space4,
    transitionProperty: 'transform, translate, scale, rotate',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
  },
  iconExpanded: {
    rotate: '180deg',
  },
})

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type ShowMoreOwnedStyle = OwnedStyle<'position'>

export interface ShowMoreProps {
  /** Content to show/hide */
  children: ReactNode
  /** Maximum height when collapsed (in pixels) */
  maxHeight?: number
  /** Text for expand button */
  moreText?: string
  /** Text for collapse button */
  lessText?: string
  /** Whether content is initially expanded */
  defaultExpanded?: boolean
  /** Controlled expanded state */
  expanded?: boolean
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void
  /** Optional class name */
  className?: string
  /** Caller-last root adaptation. Component-owned positioning is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ShowMoreOwnedStyle>
}

/** ShowMore reveals additional content on demand using React Aria Disclosure */
export const ShowMore = ({
  children,
  maxHeight = 100,
  moreText = 'Show more',
  lessText = 'Show less',
  defaultExpanded = false,
  expanded,
  onExpandedChange,
  className,
  stylexStyle,
}: ShowMoreProps) => {
  return (
    <AriaDisclosure
      {...styled(className, styles.root, stylexStyle)}
      defaultExpanded={defaultExpanded}
      {...(expanded !== undefined ? { isExpanded: expanded } : {})}
      {...(onExpandedChange !== undefined ? { onExpandedChange } : {})}
    >
      {({ isExpanded }) => (
        <>
          <AriaDisclosurePanel {...styled(undefined, styles.panel)}>
            <div
              {...styled(undefined, styles.content)}
              style={isExpanded ? undefined : { maxHeight: `${maxHeight}px` }}
            >
              {children}
            </div>
          </AriaDisclosurePanel>
          {!isExpanded && <div {...styled(undefined, styles.gradient)} />}
          <AriaButton slot="trigger" {...styled(undefined, styles.button)}>
            {isExpanded ? lessText : moreText}
            <svg
              {...styled(undefined, styles.icon, isExpanded && styles.iconExpanded)}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </AriaButton>
        </>
      )}
    </AriaDisclosure>
  )
}
