/**
 * Switch component built on React Aria
 *
 * @see https://vercel.com/geist/switch
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  RadioGroup as AriaRadioGroup,
  Radio as AriaRadio,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioRenderProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    boxSizing: 'border-box',
    display: 'inline-flex',
    padding: '0.125rem',
    backgroundColor: tokens['--ds-background-100'],
    borderRadius: scale.radiusDefault,
    boxShadow: `inset 0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
  },
  rootSmall: {
    height: scale.formHeightSm,
  },
  rootDefault: {
    height: scale.formHeightMd,
  },
  rootLarge: {
    height: scale.formHeightLg,
    borderRadius: scale.radiusLg,
  },
  rootFullWidth: {
    width: '100%',
  },
  item: {
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    cursor: 'pointer',
    color: tokens['--ds-gray-900'],
    borderRadius: scale.radiusSm,
    fontWeight: 500,
    outlineWidth: 0,
    outlineStyle: 'none',
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
  },
  itemSelected: {
    color: tokens['--ds-gray-1000'],
    backgroundColor: tokens['--ds-gray-100'],
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
  },
  itemDisabled: {
    color: tokens['--ds-gray-700'],
    cursor: 'not-allowed',
  },
  itemSmall: {
    height: '1.75rem',
    paddingInline: '0.625rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  itemDefault: {
    height: '2.25rem',
    paddingInline: scale.space3,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  itemLarge: {
    height: '2.75rem',
    paddingInline: scale.space4,
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
  label: {
    userSelect: 'none',
  },
  iconSmall: {
    width: '0.875rem',
    height: '0.875rem',
  },
  iconDefault: {
    width: '1rem',
    height: '1rem',
  },
  iconLarge: {
    width: '1.25rem',
    height: '1.25rem',
  },
})

/** Visual size. */
export type SwitchSize = 'small' | 'default' | 'large'

const rootSizeStyles: Record<SwitchSize, stylex.StyleXStyles> = {
  small: styles.rootSmall,
  default: styles.rootDefault,
  large: styles.rootLarge,
}

const itemSizeStyles: Record<SwitchSize, stylex.StyleXStyles> = {
  small: styles.itemSmall,
  default: styles.itemDefault,
  large: styles.itemLarge,
}

const iconSizeStyles: Record<SwitchSize, stylex.StyleXStyles> = {
  small: styles.iconSmall,
  default: styles.iconDefault,
  large: styles.iconLarge,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type SwitchOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'display'
  | 'padding'
  | 'paddingBlock'
  | 'paddingInline'
  | 'background'
  | 'backgroundColor'
  | 'borderRadius'
  | 'boxShadow'
  | 'height'
  | 'width'
>

export interface SwitchOption {
  /** Value for the option */
  value: string
  /** Label text or icon */
  label?: ReactNode
  /** Icon to display (alternative to label) */
  icon?: ReactNode
  /** Tooltip content */
  tooltip?: string
}

export interface SwitchProps extends Omit<
  AriaRadioGroupProps,
  'children' | 'orientation' | 'style'
> {
  /** Options to display */
  options: SwitchOption[]
  /** Visual size */
  size?: SwitchSize | undefined
  /** Stretch the control to the width of its container. */
  fullWidth?: boolean | undefined
  /** Optional class name */
  className?: string
  /** Caller-last root adaptation. Component-owned control styling is constrained. */
  style?: stylex.StyleXStylesWithout<SwitchOwnedStyle>
}

const getItemClassName =
  (size: SwitchSize) =>
  ({ isSelected, isDisabled }: RadioRenderProps): string =>
    styled(
      undefined,
      styles.item,
      itemSizeStyles[size],
      isDisabled && styles.itemDisabled,
      isSelected && styles.itemSelected,
    ).className ?? ''

/** Switch allows choosing between a set of options */
export const Switch = ({
  options,
  size = 'default',
  fullWidth = false,
  className,
  style,
  ...props
}: SwitchProps) => (
  <AriaRadioGroup
    {...styled(
      className,
      styles.root,
      rootSizeStyles[size],
      fullWidth && styles.rootFullWidth,
      style,
    )}
    {...props}
    orientation="horizontal"
  >
    {options.map((option) => {
      const ariaLabel =
        option.tooltip ?? (typeof option.label === 'string' ? option.label : undefined)

      return (
        <AriaRadio
          key={option.value}
          value={option.value}
          className={getItemClassName(size)}
          {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        >
          {option.icon ? (
            <span {...styled(undefined, iconSizeStyles[size])}>{option.icon}</span>
          ) : (
            <span {...styled(undefined, styles.label)}>{option.label}</span>
          )}
        </AriaRadio>
      )
    })}
  </AriaRadioGroup>
)
