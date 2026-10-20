/**
 * Toggle component built on React Aria
 *
 * @see https://vercel.com/geist/toggle
 */

import * as stylex from '@stylexjs/stylex'
import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: {
      default: 'pointer',
      ':is([data-disabled])': 'not-allowed',
    },
  },
  track: {
    position: 'relative',
    flexShrink: 0,
    borderRadius: '14px',
    backgroundColor: tokens['--ds-gray-100'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
  },
  trackSelected: {
    backgroundColor: tokens['--ds-blue-700'],
    borderColor: tokens['--ds-blue-700'],
  },
  trackDisabled: {
    backgroundColor: tokens['--ds-gray-200'],
  },
  trackFocused: {
    /** Matches Tailwind's 2px ring with a 2px background-colored offset. */
    boxShadow: tokens['--ds-focus-ring'],
  },
  trackSm: {
    width: '28px',
    height: '14px',
  },
  trackMd: {
    width: '2.5rem',
    height: '1.5rem',
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    left: '1px',
    transform: 'translateY(-50%)',
    borderRadius: '9999px',
    backgroundColor: tokens['--ds-gray-1000'],
    boxShadow: '0 0 4px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.16)',
    transitionProperty: 'all',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
  },
  thumbDisabled: {
    backgroundColor: tokens['--ds-gray-400'],
  },
  thumbSm: {
    width: '0.75rem',
    height: '0.75rem',
  },
  thumbMd: {
    width: '22px',
    height: '22px',
  },
  thumbSelectedSm: {
    left: '14px',
  },
  thumbSelectedMd: {
    left: '17px',
  },
  label: {
    color: tokens['--ds-gray-1000'],
    userSelect: 'none',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  labelDisabled: {
    color: tokens['--ds-gray-700'],
  },
})

type ToggleSize = 'sm' | 'md'

const trackSizeStyles: Record<ToggleSize, stylex.StyleXStyles> = {
  sm: styles.trackSm,
  md: styles.trackMd,
}

const thumbSizeStyles: Record<ToggleSize, stylex.StyleXStyles> = {
  sm: styles.thumbSm,
  md: styles.thumbMd,
}

const selectedThumbSizeStyles: Record<ToggleSize, stylex.StyleXStyles> = {
  sm: styles.thumbSelectedSm,
  md: styles.thumbSelectedMd,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type ToggleOwnedStyle = OwnedStyle<
  'display' | 'alignItems' | 'gap' | 'columnGap' | 'rowGap' | 'cursor'
>

export interface ToggleProps extends Omit<AriaSwitchProps, 'children' | 'style'> {
  /** Label text for the toggle */
  label?: string
  /** Visual size */
  size?: ToggleSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned layout and interaction styling are constrained. */
  style?: stylex.StyleXStylesWithout<ToggleOwnedStyle>
}

/** Toggle switch for boolean values */
export const Toggle = ({ label, size = 'md', className, style, ...props }: ToggleProps) => (
  <AriaSwitch {...styled(className, styles.root, style)} {...props}>
    {({ isSelected, isDisabled, isFocusVisible }) => (
      <>
        <span
          {...styled(
            undefined,
            styles.track,
            trackSizeStyles[size],
            isSelected && styles.trackSelected,
            isDisabled && !isSelected && styles.trackDisabled,
            isFocusVisible && styles.trackFocused,
          )}
        >
          <span
            {...styled(
              undefined,
              styles.thumb,
              thumbSizeStyles[size],
              isSelected && selectedThumbSizeStyles[size],
              isDisabled && styles.thumbDisabled,
            )}
          />
        </span>
        {label && (
          <span {...styled(undefined, styles.label, isDisabled && styles.labelDisabled)}>
            {label}
          </span>
        )}
      </>
    )}
  </AriaSwitch>
)
