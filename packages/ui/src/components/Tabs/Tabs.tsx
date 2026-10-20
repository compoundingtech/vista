/**
 * Tabs component built on React Aria
 *
 * @see https://vercel.com/geist/tabs
 */

import * as stylex from '@stylexjs/stylex'
import {
  Tabs as AriaTabs,
  TabList as AriaTabList,
  Tab as AriaTab,
  TabPanel as AriaTabPanel,
  type TabsProps as AriaTabsProps,
  type TabListProps as AriaTabListProps,
  type TabProps as AriaTabProps,
  type TabRenderProps,
  type TabPanelProps as AriaTabPanelProps,
} from 'react-aria-components'

import { styled, type StyledProps } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  tabList: {
    display: 'flex',
    columnGap: scale.space6,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  tabListSecondary: {
    borderBottomStyle: 'none',
  },
  tab: {
    position: 'relative',
    height: '3rem',
    paddingInline: '0.125rem',
    paddingBlock: '0.875rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    color: {
      default: tokens['--ds-gray-900'],
      ':hover': tokens['--ds-gray-1000'],
    },
    cursor: 'pointer',
    outlineWidth: 0,
    outlineStyle: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    marginBlockEnd: '-1px',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    ':focus-visible': {
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: tokens['--ds-blue-700'],
      // Tailwind's omitted ring-offset colour painted a white 2px band in
      // dark mode. An outline offset exposes the actual backdrop instead.
      outlineOffset: '2px',
    },
  },
  tabSelected: {
    color: {
      default: tokens['--ds-gray-1000'],
      ':hover': tokens['--ds-gray-1000'],
    },
    borderBottomColor: tokens['--ds-gray-1000'],
  },
  tabDisabled: {
    color: {
      default: tokens['--ds-gray-700'],
      // Disabled is applied after selected and restates hover so the disabled
      // colour wins for every overlap, independent of selector ordering.
      ':hover': tokens['--ds-gray-700'],
    },
    cursor: 'not-allowed',
  },
  tabSecondary: {
    paddingInline: scale.space3,
    paddingBlock: scale.space2,
    borderBottomStyle: 'none',
    borderRadius: scale.radiusDefault,
  },
  tabSelectedSecondary: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  panel: {
    outlineStyle: 'none',
    paddingTop: scale.space4,
  },
})

/** Visual variants. */
export type TabsVariant = 'primary' | 'secondary'

const tabListVariantStyles: Record<TabsVariant, stylex.StyleXStyles> = {
  primary: undefined,
  secondary: styles.tabListSecondary,
}

const tabVariantStyles: Record<TabsVariant, stylex.StyleXStyles> = {
  primary: undefined,
  secondary: styles.tabSecondary,
}

const selectedTabVariantStyles: Record<TabsVariant, stylex.StyleXStyles> = {
  primary: undefined,
  secondary: styles.tabSelectedSecondary,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type TabsOwnedStyle = OwnedStyle<'display' | 'flexDirection' | 'flexFlow'>

type TabListOwnedStyle = OwnedStyle<
  | 'display'
  | 'gap'
  | 'columnGap'
  | 'rowGap'
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderBlock'
  | 'borderBlockWidth'
  | 'borderBlockStyle'
  | 'borderBlockColor'
  | 'borderBlockEnd'
  | 'borderBlockEndWidth'
  | 'borderBlockEndStyle'
  | 'borderBlockEndColor'
  | 'borderBottom'
  | 'borderBottomWidth'
  | 'borderBottomStyle'
  | 'borderBottomColor'
>

type TabOwnedStyle = OwnedStyle<
  | 'position'
  | 'height'
  | 'minHeight'
  | 'maxHeight'
  | 'padding'
  | 'paddingBlock'
  | 'paddingBlockStart'
  | 'paddingBlockEnd'
  | 'paddingInline'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'margin'
  | 'marginBlock'
  | 'marginBlockEnd'
  | 'marginBottom'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
  | 'color'
  | 'cursor'
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderBlock'
  | 'borderBlockWidth'
  | 'borderBlockStyle'
  | 'borderBlockColor'
  | 'borderBlockEnd'
  | 'borderBlockEndWidth'
  | 'borderBlockEndStyle'
  | 'borderBlockEndColor'
  | 'borderBottom'
  | 'borderBottomWidth'
  | 'borderBottomStyle'
  | 'borderBottomColor'
  | 'borderRadius'
  | 'borderStartStartRadius'
  | 'borderStartEndRadius'
  | 'borderEndStartRadius'
  | 'borderEndEndRadius'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderBottomLeftRadius'
  | 'borderBottomRightRadius'
  | 'background'
  | 'backgroundColor'
  | 'transition'
  | 'transitionProperty'
  | 'transitionTimingFunction'
  | 'transitionDuration'
  | 'transitionDelay'
>

type TabPanelOwnedStyle = OwnedStyle<
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
  | 'padding'
  | 'paddingBlock'
  | 'paddingBlockStart'
  | 'paddingTop'
>

export interface TabsProps extends Omit<AriaTabsProps, 'style'> {
  variant?: TabsVariant | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root layout adaptation. Component-owned layout is constrained. */
  style?: stylex.StyleXStylesWithout<TabsOwnedStyle>
}

/** Display tab content */
export const Tabs = ({ variant: _variant = 'primary', className, style, ...props }: TabsProps) => (
  <AriaTabs {...styled(className, styles.root, style)} {...props} />
)

export interface TabListProps<T extends object> extends Omit<AriaTabListProps<T>, 'style'> {
  variant?: TabsVariant | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root layout adaptation. Component-owned list styling is constrained. */
  style?: stylex.StyleXStylesWithout<TabListOwnedStyle>
}

/** Container for Tab items */
export const TabList = <T extends object>({
  variant = 'primary',
  className,
  style,
  ...props
}: TabListProps<T>) => (
  <AriaTabList
    {...styled(className, styles.tabList, tabListVariantStyles[variant], style)}
    {...props}
  />
)

export interface TabProps extends Omit<AriaTabProps, 'style'> {
  variant?: TabsVariant | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last layout adaptation. Component-owned visual and state properties are constrained. */
  style?: stylex.StyleXStylesWithout<TabOwnedStyle>
}

const makeTabStyleProps = ({
  variant,
  className,
  style,
}: {
  variant: TabsVariant
  className: string | undefined
  style: TabProps['style']
}) => {
  let cached:
    | {
        key: number
        props: StyledProps
      }
    | undefined

  const resolve = ({ isSelected, isDisabled }: TabRenderProps): StyledProps => {
    const key = (isSelected ? 1 : 0) | (isDisabled ? 2 : 0)
    if (cached?.key === key) return cached.props

    const props = styled(
      className,
      styles.tab,
      tabVariantStyles[variant],
      isSelected && styles.tabSelected,
      isSelected && selectedTabVariantStyles[variant],
      isDisabled && styles.tabDisabled,
      style,
    )
    cached = { key, props }
    return props
  }

  return {
    className: (values: TabRenderProps) => resolve(values).className ?? '',
    style: (values: TabRenderProps) => resolve(values).style ?? {},
  }
}

/** A single tab trigger */
export const Tab = ({ variant = 'primary', className, style, ...props }: TabProps) => (
  <AriaTab {...makeTabStyleProps({ variant, className, style })} {...props} />
)

export interface TabPanelProps extends Omit<AriaTabPanelProps, 'style'> {
  variant?: TabsVariant | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root layout adaptation. Component-owned panel styling is constrained. */
  style?: stylex.StyleXStylesWithout<TabPanelOwnedStyle>
}

/** Content panel for a tab */
export const TabPanel = ({
  variant: _variant = 'primary',
  className,
  style,
  ...props
}: TabPanelProps) => <AriaTabPanel {...styled(className, styles.panel, style)} {...props} />
