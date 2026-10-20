/**
 * ThemeSwitcher component built on React Aria
 *
 * @see https://vercel.com/geist/theme-switcher
 */

import * as stylex from '@stylexjs/stylex'
import {
  RadioGroup as AriaRadioGroup,
  Radio as AriaRadio,
  type RadioRenderProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import type { Theme } from '../../foundations/theme.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'inline-flex',
    padding: scale.space1,
    backgroundColor: tokens['--ds-background-100'],
    borderRadius: scale.radiusFull,
    boxShadow: `inset 0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
  },
  item: {
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scale.radiusFull,
    color: {
      default: tokens['--ds-gray-700'],
      ':hover': {
        default: tokens['--ds-gray-700'],
        '@media (hover: hover)': tokens['--ds-gray-900'],
      },
    },
    cursor: 'pointer',
    outlineWidth: 0,
    outlineStyle: 'none',
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
  },
  itemSelected: {
    color: {
      default: tokens['--ds-gray-1000'],
      ':hover': {
        default: tokens['--ds-gray-1000'],
        '@media (hover: hover)': tokens['--ds-gray-1000'],
      },
    },
    backgroundColor: tokens['--ds-gray-200'],
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
  },
  itemSmall: {
    width: '1.75rem',
    height: '1.75rem',
  },
  itemDefault: {
    width: '2rem',
    height: '2rem',
  },
  itemLarge: {
    width: '2.5rem',
    height: '2.5rem',
  },
  icon: {
    display: 'block',
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
export type ThemeSwitcherSize = 'small' | 'default' | 'large'

const itemSizeStyles: Record<ThemeSwitcherSize, stylex.StyleXStyles> = {
  small: styles.itemSmall,
  default: styles.itemDefault,
  large: styles.itemLarge,
}

const iconSizeStyles: Record<ThemeSwitcherSize, stylex.StyleXStyles> = {
  small: styles.iconSmall,
  default: styles.iconDefault,
  large: styles.iconLarge,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type ThemeSwitcherOwnedStyle = OwnedStyle<
  | 'display'
  | 'padding'
  | 'paddingBlock'
  | 'paddingInline'
  | 'background'
  | 'backgroundColor'
  | 'borderRadius'
  | 'boxShadow'
>

export interface ThemeSwitcherProps {
  /** Current theme */
  value?: Theme
  /** Default theme */
  defaultValue?: Theme
  /** Callback when theme changes */
  onChange?: (theme: Theme) => void
  /** Visual size */
  size?: ThemeSwitcherSize | undefined
  /** Optional class name */
  className?: string
  /** Caller-last root adaptation. Component-owned control styling is constrained. */
  style?: stylex.StyleXStylesWithout<ThemeSwitcherOwnedStyle>
}

const SunIcon = ({ size }: { size: ThemeSwitcherSize }) => (
  <svg
    {...styled(undefined, styles.icon, iconSizeStyles[size])}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8 1a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 1zm0 10a3 3 0 100-6 3 3 0 000 6zm0 1a4 4 0 110-8 4 4 0 010 8zm6.5-3.5a.5.5 0 010 1h-1a.5.5 0 010-1h1zM8 13a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 13zM2.5 8.5a.5.5 0 010-1h1a.5.5 0 010 1h-1zm.646-5.354a.5.5 0 01.708 0l.707.707a.5.5 0 11-.707.708l-.708-.708a.5.5 0 010-.707zm.707 9.708a.5.5 0 01-.707-.707l.707-.708a.5.5 0 11.707.708l-.707.707zm9.708-9.001a.5.5 0 010 .707l-.707.708a.5.5 0 01-.708-.708l.708-.707a.5.5 0 01.707 0zm-.707 9.708a.5.5 0 00.707-.707l-.707-.708a.5.5 0 00-.708.708l.708.707z" />
  </svg>
)

const MoonIcon = ({ size }: { size: ThemeSwitcherSize }) => (
  <svg
    {...styled(undefined, styles.icon, iconSizeStyles[size])}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M6 0a6 6 0 000 12 6 6 0 006-6 6 6 0 00-6-6zm0 11A5 5 0 116 1a5 5 0 010 10z" />
    <path d="M10.5 5a5.5 5.5 0 01-5.5 5.5A5.5 5.5 0 0110.5 5z" />
  </svg>
)

const SystemIcon = ({ size }: { size: ThemeSwitcherSize }) => (
  <svg
    {...styled(undefined, styles.icon, iconSizeStyles[size])}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v7a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 10.5v-7zM3.5 3a.5.5 0 00-.5.5v7a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-7a.5.5 0 00-.5-.5h-9z" />
    <path d="M5 14.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5z" />
  </svg>
)

const getItemClassName =
  (size: ThemeSwitcherSize) =>
  ({ isSelected }: RadioRenderProps): string =>
    styled(undefined, styles.item, itemSizeStyles[size], isSelected && styles.itemSelected)
      .className ?? ''

/** ThemeSwitcher allows toggling between light, dark, and system themes */
export const ThemeSwitcher = ({
  value,
  defaultValue = 'system',
  onChange,
  size = 'default',
  className,
  style,
}: ThemeSwitcherProps) => (
  <AriaRadioGroup
    value={value ?? null}
    defaultValue={defaultValue}
    onChange={(val) => onChange?.(val as Theme)}
    {...styled(className, styles.root, style)}
    orientation="horizontal"
    aria-label="Theme"
  >
    <AriaRadio value="light" className={getItemClassName(size)} aria-label="Light theme">
      <SunIcon size={size} />
    </AriaRadio>
    <AriaRadio value="system" className={getItemClassName(size)} aria-label="System theme">
      <SystemIcon size={size} />
    </AriaRadio>
    <AriaRadio value="dark" className={getItemClassName(size)} aria-label="Dark theme">
      <MoonIcon size={size} />
    </AriaRadio>
  </AriaRadioGroup>
)
