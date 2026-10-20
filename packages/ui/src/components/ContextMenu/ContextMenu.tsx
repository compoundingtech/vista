/**
 * ContextMenu component built on React Aria
 *
 * @see https://vercel.com/geist/context-menu
 */

import * as stylex from '@stylexjs/stylex'
import * as React from 'react'
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  Popover as AriaPopover,
  Separator as AriaSeparator,
  type MenuProps as AriaMenuProps,
  type MenuItemProps as AriaMenuItemProps,
  type MenuItemRenderProps,
} from 'react-aria-components'

import {
  styled,
  type StyledRenderOverrides,
  type StyledRenderProps,
} from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  trigger: {
    display: 'contents',
  },
  // The Tailwind baseline listed entering/exiting animation utilities, but the
  // package has no animation plugin and its production CSS emitted no matching
  // rules or keyframes. Preserve that inert behavior during the migration.
  popover: {
    position: 'fixed',
    zIndex: 50,
    boxSizing: 'border-box',
    padding: scale.space2,
    backgroundColor: tokens['--ds-background-100'],
    borderRadius: '0.75rem',
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`,
    outlineWidth: 0,
    outlineStyle: 'none',
  },
  menu: {
    boxSizing: 'border-box',
    minWidth: '180px',
    outlineWidth: 0,
    outlineStyle: 'none',
  },
  item: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    height: scale.space8,
    paddingInline: scale.space3,
    color: tokens['--ds-gray-1000'],
    borderRadius: '0.375rem',
    outlineWidth: 0,
    outlineStyle: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  itemFocused: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  itemHovered: {
    backgroundColor: {
      default: null,
      '@media (hover: hover)': tokens['--ds-gray-alpha-100'],
    },
  },
  itemDanger: {
    color: tokens['--ds-red-700'],
  },
  itemDangerFocused: {
    backgroundColor: tokens['--ds-red-100'],
  },
  itemDangerHovered: {
    backgroundColor: {
      default: null,
      '@media (hover: hover)': tokens['--ds-red-100'],
    },
  },
  itemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  itemPrefix: {
    width: scale.space4,
    height: scale.space4,
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
    boxSizing: 'border-box',
    height: '1px',
    marginBlock: scale.space1,
    backgroundColor: tokens['--ds-gray-alpha-400'],
  },
})

type ContextMenuVariant = 'default' | 'danger'
type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type ContextMenuTriggerOwnedStyle = OwnedStyle<'display'>

type ContextMenuOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'minWidth'
  | 'minInlineSize'
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
>

type ContextMenuItemOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'display'
  | 'alignItems'
  | 'placeItems'
  | 'gap'
  | 'columnGap'
  | 'rowGap'
  | 'height'
  | 'blockSize'
  | 'minHeight'
  | 'minBlockSize'
  | 'maxHeight'
  | 'maxBlockSize'
  | 'padding'
  | 'paddingBlock'
  | 'paddingBlockStart'
  | 'paddingBlockEnd'
  | 'paddingInline'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingStart'
  | 'paddingEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
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
  | 'font'
  | 'fontSize'
  | 'lineHeight'
  | 'background'
  | 'backgroundColor'
  | 'opacity'
>

export interface ContextMenuTriggerProps {
  /** Content that triggers the context menu on right-click */
  children: React.ReactNode
  /** Menu items to display */
  menu: React.ReactNode
  /** Whether the context menu is disabled */
  isDisabled?: boolean
  /** Optional class name */
  className?: string
  /** Caller-last trigger adaptation. Component-owned display behavior is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ContextMenuTriggerOwnedStyle>
}

export interface ContextMenuProps<T extends object> extends AriaMenuProps<T> {
  /** Caller-last menu adaptation. Component-owned geometry and focus presentation are constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ContextMenuOwnedStyle>
}

export interface ContextMenuItemProps extends Omit<AriaMenuItemProps, 'children'> {
  /** Menu item content */
  children: React.ReactNode
  /** Prefix element (icon) */
  prefix?: React.ReactNode
  /** Suffix element (shortcut, etc.) */
  suffix?: React.ReactNode
  /** Visual treatment */
  variant?: ContextMenuVariant | undefined
  /** Caller-last item adaptation. Component-owned visual and state styling is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ContextMenuItemOwnedStyle>
}

/** Context menu trigger that opens on right-click */
export const ContextMenuTrigger = ({
  children,
  menu,
  isDisabled,
  className,
  stylexStyle,
}: ContextMenuTriggerProps) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const triggerRef = React.useRef<HTMLDivElement>(null)

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent) => {
      if (isDisabled) return
      event.preventDefault()
      setPosition({ x: event.clientX, y: event.clientY })
      setIsOpen(true)
    },
    [isDisabled],
  )

  const handleClose = React.useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <>
      <div
        ref={triggerRef}
        {...styled(className, styles.trigger, stylexStyle)}
        onContextMenu={handleContextMenu}
      >
        {children}
      </div>
      {isOpen && (
        <AriaPopover
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          {...styled(
            {
              // React Aria positions popovers inline. Keep the pointer-anchored
              // fixed mode in that same inline layer so its default cannot win.
              style: {
                position: 'fixed',
                left: position.x,
                top: position.y,
                zIndex: 50,
              },
            },
            styles.popover,
          )}
        >
          <AriaMenu {...styled(undefined, styles.menu)} onAction={handleClose}>
            {menu}
          </AriaMenu>
        </AriaPopover>
      )}
    </>
  )
}

/** Context menu list container */
export const ContextMenu = <T extends object>({
  children,
  className,
  style,
  stylexStyle,
  ...props
}: ContextMenuProps<T>) => {
  return (
    <AriaMenu {...styled({ className, style }, styles.menu, stylexStyle)} {...props}>
      {children}
    </AriaMenu>
  )
}

const makeContextMenuItemStyleProps = ({
  variant,
  className,
  style,
  stylexStyle,
}: StyledRenderOverrides<MenuItemRenderProps> & {
  variant: ContextMenuVariant
  stylexStyle?: stylex.StyleXStylesWithout<ContextMenuItemOwnedStyle> | undefined
}): StyledRenderProps<MenuItemRenderProps> => {
  const merged = styled<MenuItemRenderProps>(
    { className, style },
    styles.item,
    variant === 'danger' && styles.itemDanger,
    stylexStyle,
  )

  return {
    className: (values) => {
      const callerClassName = typeof className === 'function' ? className(values) : className

      return (
        styled(
          callerClassName,
          styles.item,
          variant === 'danger' && styles.itemDanger,
          values.isFocused && styles.itemFocused,
          values.isHovered && styles.itemHovered,
          variant === 'danger' && values.isFocused && styles.itemDangerFocused,
          variant === 'danger' && values.isHovered && styles.itemDangerHovered,
          values.isDisabled && styles.itemDisabled,
          stylexStyle,
        ).className ?? ''
      )
    },
    ...(merged.style === undefined ? {} : { style: merged.style }),
  }
}

/** Individual context menu item */
export const ContextMenuItem = ({
  children,
  variant = 'default',
  prefix,
  suffix,
  className,
  style,
  stylexStyle,
  ...props
}: ContextMenuItemProps) => {
  return (
    <AriaMenuItem
      {...makeContextMenuItemStyleProps({ variant, className, style, stylexStyle })}
      {...props}
    >
      {prefix && <span {...styled(undefined, styles.itemPrefix)}>{prefix}</span>}
      <span {...styled(undefined, styles.itemContent)}>{children}</span>
      {suffix && <span {...styled(undefined, styles.itemSuffix)}>{suffix}</span>}
    </AriaMenuItem>
  )
}

/**
 * Context menu separator.
 *
 * Uses `Separator` from react-aria-components so it registers as a non-item
 * collection child. A plain `<div>` here breaks AriaMenu's collection: items
 * declared after it are silently dropped from the rendered DOM.
 */
export const ContextMenuSeparator = () => {
  return <AriaSeparator {...styled(undefined, styles.separator)} />
}
