/**
 * Collapse component built on React Aria
 *
 * @see https://vercel.com/geist/collapse
 */

import * as stylex from '@stylexjs/stylex'
import { createContext, useContext, type ReactNode } from 'react'
import {
  Disclosure as AriaDisclosure,
  DisclosureGroup as AriaDisclosureGroup,
  DisclosurePanel as AriaDisclosurePanel,
  Button as AriaButton,
  Heading as AriaHeading,
  type DisclosureProps as AriaDisclosureProps,
  type DisclosureGroupProps as AriaDisclosureGroupProps,
  type DisclosurePanelProps as AriaDisclosurePanelProps,
  type ButtonProps as AriaButtonProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  group: {
    width: '100%',
  },
  item: {
    borderBottomWidth: {
      default: '1px',
      ':last-child': 0,
    },
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: '5rem',
    paddingBlock: scale.space6,
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-1000'],
    fontSize: '1.5rem',
    lineHeight: '2rem',
    fontWeight: 600,
    outlineStyle: 'none',
    boxShadow: {
      default: null,
      ':is([data-focus-visible])': `inset 0 0 0 2px ${tokens['--ds-blue-700']}`,
    },
    cursor: 'pointer',
  },
  triggerDisabled: {
    color: tokens['--ds-gray-700'],
    cursor: 'not-allowed',
  },
  triggerContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    textAlign: 'left',
  },
  icon: {
    flexShrink: 0,
    width: scale.space6,
    height: scale.space6,
    color: tokens['--ds-gray-900'],
    rotate: '-90deg',
    transitionProperty: 'transform, translate, scale, rotate',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
  },
  iconExpanded: {
    rotate: '0deg',
  },
  panel: {
    overflow: 'hidden',
    color: tokens['--ds-gray-1000'],
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
  panelContent: {
    paddingBottom: scale.space6,
  },
})

type CollapseSize = 'default' | 'small'

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type CollapseGroupOwnedStyle = OwnedStyle<'width' | 'minWidth' | 'maxWidth'>

type CollapseOwnedStyle = OwnedStyle<
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderBottom'
  | 'borderBottomWidth'
  | 'borderBottomStyle'
  | 'borderBottomColor'
>

type CollapseTriggerOwnedStyle = OwnedStyle<
  | 'display'
  | 'alignItems'
  | 'justifyContent'
  | 'width'
  | 'height'
  | 'padding'
  | 'paddingBlock'
  | 'background'
  | 'backgroundColor'
  | 'color'
  | 'fontSize'
  | 'lineHeight'
  | 'fontWeight'
  | 'outline'
  | 'outlineStyle'
  | 'boxShadow'
  | 'cursor'
>

type CollapsePanelContentOwnedStyle = OwnedStyle<
  'padding' | 'paddingBottom' | 'paddingBlock' | 'paddingBlockEnd'
>

const CollapseStateContext = createContext({
  isExpanded: false,
  isDisabled: false,
})

export interface CollapseGroupProps extends Omit<
  AriaDisclosureGroupProps,
  'className' | 'children'
> {
  /** Collapse items */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last root adaptation. Component-owned width is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<CollapseGroupOwnedStyle>
}

export interface CollapseProps extends Omit<AriaDisclosureProps, 'className' | 'children'> {
  /** Collapse content (trigger and panel) */
  children: ReactNode
  /** Visual size. Retained for API compatibility with the Tailwind implementation. */
  size?: CollapseSize | undefined
  /** Optional class name */
  className?: string
  /** Caller-last root adaptation. Component-owned divider styling is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<CollapseOwnedStyle>
}

export interface CollapseTriggerProps extends Omit<AriaButtonProps, 'children' | 'className'> {
  /** Trigger content */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last trigger adaptation. Component-owned interaction styling is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<CollapseTriggerOwnedStyle>
}

export interface CollapsePanelProps extends Omit<
  AriaDisclosurePanelProps,
  'className' | 'children'
> {
  /** Panel content */
  children: ReactNode
  /** Optional class name applied to the content wrapper */
  className?: string
  /** Caller-last content adaptation. Component-owned bottom spacing is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<CollapsePanelContentOwnedStyle>
}

/** Group container for multiple collapse items */
export const CollapseGroup = ({
  children,
  className,
  style,
  stylexStyle,
  ...props
}: CollapseGroupProps) => (
  <AriaDisclosureGroup {...styled({ className, style }, styles.group, stylexStyle)} {...props}>
    {children}
  </AriaDisclosureGroup>
)

/** Individual collapse item */
export const Collapse = ({
  children,
  size: _size,
  className,
  style,
  stylexStyle,
  ...props
}: CollapseProps) => {
  // `size` was accepted before this migration but only selected variant styles
  // for other slots, so applying it to the item never changed rendered CSS.
  void _size

  return (
    <AriaDisclosure {...styled({ className, style }, styles.item, stylexStyle)} {...props}>
      {({ isExpanded, isDisabled }) => (
        <CollapseStateContext.Provider value={{ isExpanded, isDisabled }}>
          {children}
        </CollapseStateContext.Provider>
      )}
    </AriaDisclosure>
  )
}

/** Collapse trigger button */
export const CollapseTrigger = ({
  children,
  className,
  style,
  stylexStyle,
  ...props
}: CollapseTriggerProps) => {
  const { isExpanded, isDisabled } = useContext(CollapseStateContext)

  return (
    <AriaHeading>
      <AriaButton
        slot="trigger"
        {...styled(
          { className, style },
          styles.trigger,
          isDisabled && styles.triggerDisabled,
          stylexStyle,
        )}
        {...props}
      >
        <span {...styled(undefined, styles.triggerContent)}>{children}</span>
        <svg
          {...styled(undefined, styles.icon, isExpanded && styles.iconExpanded)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </AriaButton>
    </AriaHeading>
  )
}

/** Collapse panel content */
export const CollapsePanel = ({
  children,
  className,
  style,
  stylexStyle,
  ...props
}: CollapsePanelProps) => (
  <AriaDisclosurePanel {...styled({ style }, styles.panel)} {...props}>
    <div {...styled({ className }, styles.panelContent, stylexStyle)}>{children}</div>
  </AriaDisclosurePanel>
)
