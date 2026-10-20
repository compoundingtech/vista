/**
 * Menu component built on React Aria
 *
 * @see https://vercel.com/geist/menu
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger as AriaMenuTrigger,
  Popover as AriaPopover,
  type MenuProps as AriaMenuProps,
  type MenuItemProps as AriaMenuItemProps,
  type MenuItemRenderProps,
  type MenuTriggerProps as AriaMenuTriggerProps,
} from 'react-aria-components'

import { styled, type StyledProps } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  // The Tailwind baseline listed entering/exiting animation utilities, but the
  // animation plugin is not installed and its production CSS emitted no rules.
  popover: {
    padding: scale.space2,
    backgroundColor: tokens['--ds-background-100'],
    borderRadius: '0.75rem',
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`,
    outlineStyle: 'none',
  },
  menu: {
    minWidth: '200px',
    outlineStyle: 'none',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    height: scale.space10,
    paddingInline: scale.space2,
    color: tokens['--ds-gray-1000'],
    borderRadius: '0.375rem',
    outlineStyle: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  itemActive: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  itemDanger: {
    color: tokens['--ds-red-700'],
  },
  itemDangerActive: {
    backgroundColor: tokens['--ds-red-100'],
  },
  itemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  itemPrefix: {
    width: '1rem',
    height: '1rem',
    flexShrink: 0,
    color: tokens['--ds-gray-900'],
  },
  itemContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
  },
  itemSuffix: {
    marginLeft: 'auto',
    flexShrink: 0,
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  separator: {
    height: '1px',
    marginBlock: scale.space1,
    backgroundColor: tokens['--ds-gray-alpha-400'],
  },
})

type MenuVariant = 'default' | 'danger'
type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type MenuOwnedStyle = OwnedStyle<
  | 'minWidth'
  | 'minInlineSize'
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
>

type MenuItemOwnedStyle = OwnedStyle<
  | 'display'
  | 'alignItems'
  | 'gap'
  | 'columnGap'
  | 'rowGap'
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
  | 'font'
  | 'fontSize'
  | 'lineHeight'
  | 'color'
  | 'borderRadius'
  | 'borderStartStartRadius'
  | 'borderStartEndRadius'
  | 'borderEndStartRadius'
  | 'borderEndEndRadius'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderBottomLeftRadius'
  | 'borderBottomRightRadius'
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
  | 'cursor'
  | 'background'
  | 'backgroundColor'
  | 'opacity'
>

export interface MenuTriggerProps extends AriaMenuTriggerProps {
  /** Trigger element and menu */
  children: ReactNode
}

export interface MenuProps<T extends object> extends Omit<AriaMenuProps<T>, 'className' | 'style'> {
  /** Optional class name */
  className?: string
  /** Caller-last root layout adaptation. Component-owned menu geometry is constrained. */
  style?: stylex.StyleXStylesWithout<MenuOwnedStyle>
}

export interface MenuItemProps extends Omit<AriaMenuItemProps, 'className' | 'children' | 'style'> {
  /** Visual treatment */
  variant?: MenuVariant | undefined
  /** Menu item content */
  children: ReactNode
  /** Prefix element (icon) */
  prefix?: ReactNode
  /** Suffix element (shortcut, etc.) */
  suffix?: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last layout adaptation. Component-owned item styling is constrained. */
  style?: stylex.StyleXStylesWithout<MenuItemOwnedStyle>
}

/** Trigger container for opening the menu */
export const MenuTrigger = ({ children, ...props }: MenuTriggerProps) => {
  return <AriaMenuTrigger {...props}>{children}</AriaMenuTrigger>
}

/** Menu popover container */
export const MenuPopover = ({ children }: { children: ReactNode }) => {
  return (
    <AriaPopover {...styled(undefined, styles.popover)} offset={8}>
      {children}
    </AriaPopover>
  )
}

/** Menu list container */
export const Menu = <T extends object>({ children, className, style, ...props }: MenuProps<T>) => {
  return (
    <AriaMenu {...styled(className, styles.menu, style)} {...props}>
      {children}
    </AriaMenu>
  )
}

const makeMenuItemStyleProps = ({
  variant,
  className,
  style,
}: {
  variant: MenuVariant
  className: string | undefined
  style: MenuItemProps['style']
}) => {
  let cached:
    | {
        key: number
        props: StyledProps
      }
    | undefined

  const resolve = ({ isFocused, isHovered, isDisabled }: MenuItemRenderProps): StyledProps => {
    const isActive = isFocused || isHovered
    const key = (isActive ? 1 : 0) | (isDisabled ? 2 : 0)
    if (cached?.key === key) return cached.props

    const props = styled(
      className,
      styles.item,
      variant === 'danger' && styles.itemDanger,
      isActive && styles.itemActive,
      variant === 'danger' && isActive && styles.itemDangerActive,
      isDisabled && styles.itemDisabled,
      style,
    )
    cached = { key, props }
    return props
  }

  return {
    className: (values: MenuItemRenderProps) => resolve(values).className ?? '',
    style: (values: MenuItemRenderProps) => resolve(values).style ?? {},
  }
}

/** Individual menu item */
export const MenuItem = ({
  children,
  variant = 'default',
  prefix,
  suffix,
  className,
  style,
  ...props
}: MenuItemProps) => {
  return (
    <AriaMenuItem {...makeMenuItemStyleProps({ variant, className, style })} {...props}>
      {prefix && <span {...styled(undefined, styles.itemPrefix)}>{prefix}</span>}
      <span {...styled(undefined, styles.itemContent)}>{children}</span>
      {suffix && <span {...styled(undefined, styles.itemSuffix)}>{suffix}</span>}
    </AriaMenuItem>
  )
}

/** Menu separator */
export const MenuSeparator = () => {
  return <div {...styled(undefined, styles.separator)} role="separator" />
}
