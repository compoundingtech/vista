/**
 * @see https://v0.app/chat - Design reference for AI chat components
 *
 * ToolCallGroup wraps multiple tool calls into a collapsible container.
 * Shows a summary like "5 tool calls" when collapsed.
 */

import * as stylex from '@stylexjs/stylex'
import { Children, type ReactNode } from 'react'
import {
  Disclosure as AriaDisclosure,
  DisclosurePanel as AriaDisclosurePanel,
  Button as AriaButton,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale } from '../../foundations/tokens.stylex.ts'
import { ChevronDownIcon, WrenchIcon } from './icons.tsx'

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
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: scale.space4,
    height: scale.space4,
    flexShrink: 0,
  },
  icon: {
    width: scale.space4,
    height: scale.space4,
    color: 'oklch(0.65 0 0)',
  },
  label: {
    color: 'oklch(0.706 0 0)',
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
  panel: {
    overflow: 'hidden',
  },
  panelContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    minWidth: 0,
    marginLeft: scale.space2,
    paddingTop: scale.space2,
    paddingLeft: scale.space6,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'oklch(0.301 0 0)',
    overflowWrap: 'anywhere',
  },
})

export interface ToolCallGroupProps {
  /** Label for the group (e.g., "5 tool calls", "Explored codebase") */
  label?: string
  /** Whether the group is expanded by default */
  defaultExpanded?: boolean
  /** Tool call children */
  children: ReactNode
  /** Optional class name override */
  className?: string
  /** Caller-last root StyleX adaptation. The root owns no visual properties. */
  stylexStyle?: stylex.StyleXStyles
}

/** ToolCallGroup wraps multiple tool calls into a collapsible container */
export const ToolCallGroup = ({
  label,
  defaultExpanded = false,
  children,
  className,
  stylexStyle,
}: ToolCallGroupProps) => {
  const childCount = Children.count(children)
  const displayLabel = label ?? `${childCount} tool call${childCount !== 1 ? 's' : ''}`

  return (
    <AriaDisclosure {...styled(className, stylexStyle)} defaultExpanded={defaultExpanded}>
      {({ isExpanded }) => (
        <>
          <AriaButton slot="trigger" {...styled(undefined, styles.trigger)}>
            <span {...styled(undefined, styles.iconContainer)}>
              <WrenchIcon {...styled(undefined, styles.icon)} />
            </span>
            <span {...styled(undefined, styles.label)}>{displayLabel}</span>
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
