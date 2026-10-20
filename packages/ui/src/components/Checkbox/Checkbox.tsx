/**
 * Checkbox component built on React Aria
 *
 * @see https://vercel.com/geist/checkbox
 */

import * as stylex from '@stylexjs/stylex'
import {
  Checkbox as AriaCheckbox,
  type CheckboxProps as AriaCheckboxProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'flex-start',
    gap: scale.space2,
    cursor: {
      default: 'pointer',
      ':is([data-disabled])': 'not-allowed',
    },
    opacity: {
      default: 1,
      ':is([data-disabled])': 0.5,
    },
  },
  box: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: '1rem',
    height: '1rem',
    borderRadius: scale.radiusSm,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-600'],
    backgroundColor: tokens['--ds-background-100'],
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  boxSelected: {
    borderColor: tokens['--ds-gray-1000'],
    backgroundColor: tokens['--ds-gray-1000'],
  },
  boxFocused: {
    // Tailwind's ring-offset utility defaults its two-pixel offset band to
    // white when no explicit offset colour is supplied.
    boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${tokens['--ds-gray-1000']}`,
  },
  icon: {
    width: '0.75rem',
    height: '0.75rem',
    color: tokens['--ds-background-100'],
    opacity: 0,
  },
  iconVisible: {
    opacity: 1,
  },
  iconGraphic: {
    display: 'block',
    width: '0.75rem',
    height: '0.75rem',
  },
  label: {
    color: tokens['--ds-gray-1000'],
    fontSize: '13px',
    lineHeight: '1rem',
    userSelect: 'none',
  },
})

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type CheckboxOwnedStyle = OwnedStyle<
  'display' | 'alignItems' | 'gap' | 'columnGap' | 'rowGap' | 'cursor' | 'opacity'
>

/** Checkmark icon for checked state */
const CheckIcon = () => (
  <svg
    {...styled(undefined, styles.iconGraphic)}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Minus icon for indeterminate state */
const MinusIcon = () => (
  <svg
    {...styled(undefined, styles.iconGraphic)}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M2 6H10" strokeLinecap="round" />
  </svg>
)

export interface CheckboxProps extends Omit<AriaCheckboxProps, 'children' | 'style'> {
  /** Label text for the checkbox */
  children?: React.ReactNode
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned layout and interaction styling are constrained. */
  style?: stylex.StyleXStylesWithout<CheckboxOwnedStyle>
}

/** A control that toggles between two options, checked or unchecked */
export const Checkbox = ({ children, className, style, ...props }: CheckboxProps) => (
  <AriaCheckbox {...styled(className, styles.root, style)} {...props}>
    {({ isIndeterminate, isSelected, isFocusVisible }) => {
      const isMarked = isSelected || isIndeterminate

      return (
        <>
          <span
            {...styled(
              undefined,
              styles.box,
              isMarked && styles.boxSelected,
              isFocusVisible && styles.boxFocused,
            )}
          >
            <span {...styled(undefined, styles.icon, isMarked && styles.iconVisible)}>
              {isIndeterminate ? <MinusIcon /> : <CheckIcon />}
            </span>
          </span>
          {children && <span {...styled(undefined, styles.label)}>{children}</span>}
        </>
      )
    }}
  </AriaCheckbox>
)
