/**
 * SplitButton component built on React Aria
 *
 * @see https://vercel.com/geist/split-button
 */

import * as stylex from '@stylexjs/stylex'
import * as React from 'react'
import {
  Button as AriaButton,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger as AriaMenuTrigger,
  Popover as AriaPopover,
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
  root: {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'stretch',
  },
  controlReset: {
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
    appearance: 'button',
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    fontFeatureSettings: 'inherit',
    fontVariationSettings: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'none',
    opacity: 1,
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    outlineWidth: 0,
    outlineStyle: 'none',
    opacity: {
      default: 1,
      ':disabled': 0.5,
      ':is([data-disabled])': 0.5,
    },
    cursor: {
      default: 'pointer',
      ':disabled': 'not-allowed',
      ':is([data-disabled])': 'not-allowed',
    },
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  primaryButton: {
    gap: scale.space2,
  },
  primary: {
    backgroundColor: {
      default: tokens['--ds-gray-1000'],
      ':hover': {
        default: tokens['--ds-gray-1000'],
        '@media (hover: hover)': tokens['--ds-gray-900'],
      },
      ':active': tokens['--ds-gray-800'],
    },
    color: tokens['--ds-background-100'],
    boxShadow: {
      default: null,
      ':focus-visible': tokens['--ds-focus-ring'],
    },
  },
  secondary: {
    backgroundColor: {
      default: tokens['--ds-gray-100'],
      ':hover': {
        default: tokens['--ds-gray-100'],
        '@media (hover: hover)': tokens['--ds-gray-200'],
      },
      ':active': tokens['--ds-gray-300'],
    },
    color: tokens['--ds-gray-1000'],
    boxShadow: {
      default: `inset 0 0 0 1px ${tokens['--ds-gray-400']}`,
      ':focus-visible': `${tokens['--ds-focus-ring']}, inset 0 0 0 1px ${tokens['--ds-gray-400']}`,
    },
  },
  tertiary: {
    backgroundColor: {
      default: tokens['--ds-gray-200'],
      ':hover': {
        default: tokens['--ds-gray-200'],
        '@media (hover: hover)': tokens['--ds-gray-300'],
      },
      ':active': tokens['--ds-gray-400'],
    },
    color: tokens['--ds-gray-1000'],
    boxShadow: {
      default: null,
      ':focus-visible': tokens['--ds-focus-ring'],
    },
  },
  error: {
    backgroundColor: {
      default: tokens['--ds-red-700'],
      ':hover': {
        default: tokens['--ds-red-700'],
        '@media (hover: hover)': tokens['--ds-red-900'],
      },
      ':active': tokens['--ds-red-800'],
    },
    color: '#ffffff',
    boxShadow: {
      default: null,
      ':focus-visible': tokens['--ds-focus-ring'],
    },
  },
  divider: {
    boxSizing: 'border-box',
    width: '1px',
    flexShrink: 0,
  },
  dividerPrimary: {
    backgroundColor: tokens['--ds-gray-800'],
  },
  dividerSecondary: {
    backgroundColor: tokens['--ds-gray-400'],
  },
  dividerTertiary: {
    backgroundColor: tokens['--ds-gray-400'],
  },
  dividerError: {
    backgroundColor: tokens['--ds-red-900'],
  },
  primaryButtonSm: {
    height: scale.space8,
    paddingInline: '0.625rem',
    borderTopLeftRadius: scale.radiusDefault,
    borderBottomLeftRadius: scale.radiusDefault,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  primaryButtonMd: {
    height: scale.space10,
    paddingInline: '0.75rem',
    borderTopLeftRadius: scale.radiusDefault,
    borderBottomLeftRadius: scale.radiusDefault,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  primaryButtonLg: {
    height: scale.space12,
    paddingInline: scale.space4,
    borderTopLeftRadius: scale.radiusLg,
    borderBottomLeftRadius: scale.radiusLg,
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
  dropdownTriggerSm: {
    width: '1.75rem',
    height: scale.space8,
    borderTopRightRadius: scale.radiusDefault,
    borderBottomRightRadius: scale.radiusDefault,
  },
  dropdownTriggerMd: {
    width: '2.25rem',
    height: scale.space10,
    borderTopRightRadius: scale.radiusDefault,
    borderBottomRightRadius: scale.radiusDefault,
  },
  dropdownTriggerLg: {
    width: scale.space10,
    height: scale.space12,
    borderTopRightRadius: scale.radiusLg,
    borderBottomRightRadius: scale.radiusLg,
  },
  // The Tailwind baseline listed entering/exiting animation utilities, but the
  // package has no animation plugin and its production CSS emitted no matching
  // rules or keyframes. Preserve that inert behavior during the migration.
  popover: {
    boxSizing: 'border-box',
    padding: scale.space2,
    backgroundColor: tokens['--ds-background-100'],
    borderRadius: scale.radiusLg,
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`,
    outlineWidth: 0,
    outlineStyle: 'none',
  },
  menu: {
    boxSizing: 'border-box',
    minWidth: '160px',
    outlineWidth: 0,
    outlineStyle: 'none',
  },
  menuItem: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    height: scale.space8,
    paddingInline: scale.space2,
    color: tokens['--ds-gray-1000'],
    borderRadius: '0.375rem',
    outlineWidth: 0,
    outlineStyle: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  menuItemFocused: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  menuItemHovered: {
    backgroundColor: {
      default: null,
      '@media (hover: hover)': tokens['--ds-gray-alpha-100'],
    },
  },
  menuItemDanger: {
    color: tokens['--ds-red-700'],
  },
  menuItemDangerFocused: {
    backgroundColor: tokens['--ds-red-100'],
  },
  menuItemDangerHovered: {
    backgroundColor: {
      default: null,
      '@media (hover: hover)': tokens['--ds-red-100'],
    },
  },
  menuItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  menuItemPrefix: {
    width: scale.space4,
    height: scale.space4,
    flexShrink: 0,
    color: tokens['--ds-gray-900'],
  },
  menuItemContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
  },
  menuItemSuffix: {
    marginLeft: 'auto',
    flexShrink: 0,
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  chevron: {
    display: 'block',
    width: scale.space4,
    height: scale.space4,
  },
})

type SplitButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'error'
type SplitButtonSize = 'sm' | 'md' | 'lg'
type SplitButtonMenuItemVariant = 'default' | 'danger'

const buttonVariantStyles: Record<SplitButtonVariant, stylex.StyleXStyles> = {
  primary: styles.primary,
  secondary: styles.secondary,
  tertiary: styles.tertiary,
  error: styles.error,
}

const dividerVariantStyles: Record<SplitButtonVariant, stylex.StyleXStyles> = {
  primary: styles.dividerPrimary,
  secondary: styles.dividerSecondary,
  tertiary: styles.dividerTertiary,
  error: styles.dividerError,
}

const primaryButtonSizeStyles: Record<SplitButtonSize, stylex.StyleXStyles> = {
  sm: styles.primaryButtonSm,
  md: styles.primaryButtonMd,
  lg: styles.primaryButtonLg,
}

const dropdownTriggerSizeStyles: Record<SplitButtonSize, stylex.StyleXStyles> = {
  sm: styles.dropdownTriggerSm,
  md: styles.dropdownTriggerMd,
  lg: styles.dropdownTriggerLg,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type SplitButtonOwnedStyle = OwnedStyle<'boxSizing' | 'display' | 'alignItems' | 'placeItems'>

type SplitButtonMenuItemOwnedStyle = OwnedStyle<
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

/** Chevron down icon for dropdown trigger */
const chevronDownIcon = (
  <svg
    {...styled(undefined, styles.chevron)}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M4 6L8 10L12 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export interface SplitButtonProps {
  /** Primary button content */
  children: React.ReactNode
  /** Menu items */
  menuItems: React.ReactNode
  /** Callback when primary button is pressed */
  onPrimaryPress?: () => void
  /** Whether primary button is disabled */
  isPrimaryDisabled?: boolean
  /** Whether dropdown is disabled */
  isDropdownDisabled?: boolean
  /** Visual treatment */
  variant?: SplitButtonVariant | undefined
  /** Visual size */
  size?: SplitButtonSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned layout is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SplitButtonOwnedStyle>
}

/** Button with a primary action and dropdown for additional options */
export const SplitButton = ({
  children,
  menuItems,
  onPrimaryPress,
  isPrimaryDisabled,
  isDropdownDisabled,
  variant = 'primary',
  size = 'md',
  className,
  stylexStyle,
}: SplitButtonProps) => {
  return (
    <div {...styled(className, styles.root, stylexStyle)}>
      <AriaButton
        {...styled(
          undefined,
          styles.controlReset,
          styles.button,
          styles.primaryButton,
          buttonVariantStyles[variant],
          primaryButtonSizeStyles[size],
        )}
        {...(onPrimaryPress !== undefined && { onPress: onPrimaryPress })}
        {...(isPrimaryDisabled !== undefined && { isDisabled: isPrimaryDisabled })}
      >
        {children}
      </AriaButton>

      <span
        {...styled(undefined, styles.divider, dividerVariantStyles[variant])}
        aria-hidden="true"
      />

      <AriaMenuTrigger>
        <AriaButton
          {...styled(
            undefined,
            styles.controlReset,
            styles.button,
            buttonVariantStyles[variant],
            dropdownTriggerSizeStyles[size],
          )}
          {...(isDropdownDisabled !== undefined && { isDisabled: isDropdownDisabled })}
          aria-label="More options"
        >
          {chevronDownIcon}
        </AriaButton>

        <AriaPopover {...styled(undefined, styles.popover)} offset={8}>
          <AriaMenu {...styled(undefined, styles.menu)}>{menuItems}</AriaMenu>
        </AriaPopover>
      </AriaMenuTrigger>
    </div>
  )
}

export interface SplitButtonMenuItemProps extends Omit<AriaMenuItemProps, 'children'> {
  /** Menu item content */
  children: React.ReactNode
  /** Prefix element (icon) */
  prefix?: React.ReactNode
  /** Suffix element (shortcut, etc.) */
  suffix?: React.ReactNode
  /** Variant for styling */
  variant?: SplitButtonMenuItemVariant | undefined
  /** Caller-last item adaptation. Component-owned visual and state styling is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SplitButtonMenuItemOwnedStyle>
}

const makeSplitButtonMenuItemStyleProps = ({
  variant,
  className,
  style,
  stylexStyle,
}: StyledRenderOverrides<MenuItemRenderProps> & {
  variant: SplitButtonMenuItemVariant
  stylexStyle?: stylex.StyleXStylesWithout<SplitButtonMenuItemOwnedStyle> | undefined
}): StyledRenderProps<MenuItemRenderProps> => {
  const merged = styled<MenuItemRenderProps>(
    { className, style },
    styles.menuItem,
    variant === 'danger' && styles.menuItemDanger,
    stylexStyle,
  )

  return {
    className: (values) => {
      const callerClassName = typeof className === 'function' ? className(values) : className

      return (
        styled(
          callerClassName,
          styles.menuItem,
          variant === 'danger' && styles.menuItemDanger,
          values.isFocused && styles.menuItemFocused,
          values.isHovered && styles.menuItemHovered,
          variant === 'danger' && values.isFocused && styles.menuItemDangerFocused,
          variant === 'danger' && values.isHovered && styles.menuItemDangerHovered,
          values.isDisabled && styles.menuItemDisabled,
          stylexStyle,
        ).className ?? ''
      )
    },
    ...(merged.style === undefined ? {} : { style: merged.style }),
  }
}

/** Individual menu item for split button dropdown */
export const SplitButtonMenuItem = ({
  children,
  prefix,
  suffix,
  variant = 'default',
  className,
  style,
  stylexStyle,
  ...props
}: SplitButtonMenuItemProps) => {
  return (
    <AriaMenuItem
      {...makeSplitButtonMenuItemStyleProps({ variant, className, style, stylexStyle })}
      {...props}
    >
      {prefix && <span {...styled(undefined, styles.menuItemPrefix)}>{prefix}</span>}
      <span {...styled(undefined, styles.menuItemContent)}>{children}</span>
      {suffix && <span {...styled(undefined, styles.menuItemSuffix)}>{suffix}</span>}
    </AriaMenuItem>
  )
}
