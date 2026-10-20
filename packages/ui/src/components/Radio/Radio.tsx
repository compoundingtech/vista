/**
 * Radio component built on React Aria
 *
 * @see https://vercel.com/geist/radio
 */

import * as stylex from '@stylexjs/stylex'
import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  Label as AriaLabel,
  type RadioProps as AriaRadioProps,
  type RadioGroupProps as AriaRadioGroupProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  groupRoot: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space2,
  },
  groupLabel: {
    marginBottom: scale.space1,
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
  },
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space2,
    cursor: {
      default: 'pointer',
      ':is([data-disabled])': 'not-allowed',
    },
  },
  circle: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: '1rem',
    height: '1rem',
    borderRadius: scale.radiusFull,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-600'],
    backgroundColor: tokens['--ds-background-100'],
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  circleSelected: {
    borderColor: tokens['--ds-gray-1000'],
  },
  circleDisabled: {
    borderColor: tokens['--ds-gray-400'],
  },
  circleFocused: {
    // Tailwind's ring-offset utility defaults its two-pixel offset band to
    // white when no explicit offset colour is supplied.
    boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${tokens['--ds-gray-1000']}`,
  },
  dot: {
    width: '0.5rem',
    height: '0.5rem',
    borderRadius: scale.radiusFull,
    backgroundColor: tokens['--ds-gray-1000'],
    transform: 'scale(0)',
    transitionProperty: 'transform, translate, scale, rotate',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  dotSelected: {
    transform: 'scale(1)',
  },
  dotDisabled: {
    backgroundColor: tokens['--ds-gray-400'],
  },
  label: {
    color: tokens['--ds-gray-1000'],
    fontSize: '13px',
    lineHeight: 1.5,
    userSelect: 'none',
  },
  labelDisabled: {
    color: tokens['--ds-gray-400'],
  },
})

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type RadioGroupOwnedStyle = OwnedStyle<
  'display' | 'flexDirection' | 'flexFlow' | 'gap' | 'columnGap' | 'rowGap'
>

type RadioOwnedStyle = OwnedStyle<
  'display' | 'alignItems' | 'gap' | 'columnGap' | 'rowGap' | 'cursor'
>

export interface RadioGroupProps extends Omit<AriaRadioGroupProps, 'children' | 'style'> {
  /** Label for the radio group */
  label?: string
  /** Radio items */
  children: React.ReactNode
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned group layout is constrained. */
  style?: stylex.StyleXStylesWithout<RadioGroupOwnedStyle>
}

/** A group of radio buttons for selecting a single option */
export const RadioGroup = ({ label, children, className, style, ...props }: RadioGroupProps) => (
  <AriaRadioGroup {...styled(className, styles.groupRoot, style)} {...props}>
    {label && <AriaLabel {...styled(undefined, styles.groupLabel)}>{label}</AriaLabel>}
    {children}
  </AriaRadioGroup>
)

export interface RadioProps extends Omit<AriaRadioProps, 'children' | 'style'> {
  /** Label text for the radio */
  children?: React.ReactNode
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned layout and interaction styling are constrained. */
  style?: stylex.StyleXStylesWithout<RadioOwnedStyle>
}

/** A single radio button option */
export const Radio = ({ children, className, style, ...props }: RadioProps) => (
  <AriaRadio {...styled(className, styles.root, style)} {...props}>
    {({ isSelected, isDisabled, isFocusVisible }) => (
      <>
        <span
          {...styled(
            undefined,
            styles.circle,
            isDisabled && styles.circleDisabled,
            isSelected && styles.circleSelected,
            isFocusVisible && styles.circleFocused,
          )}
        >
          <span
            {...styled(
              undefined,
              styles.dot,
              isSelected && styles.dotSelected,
              isDisabled && styles.dotDisabled,
            )}
          />
        </span>
        {children && (
          <span {...styled(undefined, styles.label, isDisabled && styles.labelDisabled)}>
            {children}
          </span>
        )}
      </>
    )}
  </AriaRadio>
)
