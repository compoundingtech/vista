/**
 * Button component built on React Aria
 *
 * @see https://vercel.com/geist/button
 */

import * as stylex from '@stylexjs/stylex'
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontWeight: 500,
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    // `outline` is reserved package-wide for the focus-visible ring and is set
    // by no other state. That is what makes the ring impossible to lose: the
    // `secondary` variant below paints an inset hairline with `boxShadow`, and
    // under Tailwind both rendered because `ring` and `shadow` composed into
    // one `box-shadow` through separate custom properties. StyleX's
    // `boxShadow` is a single property, so translating the ring to `boxShadow`
    // too would silently drop one of them on a focused secondary button.
    //
    // Measured before the change: a focused secondary button painted the
    // offset band `rgb(10,10,10)`, the ring `rgb(82,168,255)` and the inset
    // hairline simultaneously. This split reproduces that.
    outlineWidth: 0,
    outlineStyle: 'none',
    ':focus-visible': {
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: tokens['--ds-focus-color'],
      // Button DOES declare `ring-offset-[var(--ds-background-100)]`, and the
      // measured band was `rgb(10,10,10)` on a `rgb(10,10,10)` backdrop — the
      // offset was invisible, so a transparent outline offset reproduces it.
      // This is the behaviour-preserving case; the components that omitted a
      // ring-offset colour are not, and are corrected in their own commit.
      outlineOffset: '2px',
    },
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },

  primary: {
    backgroundColor: {
      default: tokens['--ds-gray-1000'],
      ':hover': tokens['--ds-gray-900'],
      ':active': tokens['--ds-gray-800'],
    },
    color: tokens['--ds-background-100'],
  },
  secondary: {
    backgroundColor: {
      default: tokens['--ds-gray-100'],
      ':hover': tokens['--ds-gray-200'],
      ':active': tokens['--ds-gray-300'],
    },
    color: tokens['--ds-gray-1000'],
    boxShadow: `inset 0 0 0 1px ${tokens['--ds-gray-400']}`,
  },
  tertiary: {
    backgroundColor: {
      default: tokens['--ds-gray-200'],
      ':hover': tokens['--ds-gray-300'],
      ':active': tokens['--ds-gray-400'],
    },
    color: tokens['--ds-gray-1000'],
  },
  error: {
    backgroundColor: {
      default: tokens['--ds-red-700'],
      ':hover': tokens['--ds-red-900'],
      ':active': tokens['--ds-red-800'],
    },
    color: '#ffffff',
  },
  warning: {
    backgroundColor: {
      default: tokens['--ds-amber-700'],
      ':hover': tokens['--ds-amber-900'],
      ':active': tokens['--ds-amber-800'],
    },
    color: tokens['--ds-gray-1000'],
  },

  // `text-sm` and `text-base` each carry a paired line-height; see Badge for
  // why these are absolute lengths rather than Tailwind's ratio form.
  sm: {
    height: '2rem',
    paddingInline: '0.375rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    borderRadius: scale.radiusDefault,
  },
  md: {
    height: '2.5rem',
    paddingInline: '0.625rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    borderRadius: scale.radiusDefault,
  },
  lg: {
    height: '3rem',
    paddingInline: '0.875rem',
    fontSize: '1rem',
    lineHeight: '1.5rem',
    borderRadius: scale.radiusLg,
  },

  shapeDefault: {},
  shapeRounded: { borderRadius: scale.radiusFull },
  shapeSquare: { aspectRatio: '1 / 1', paddingInline: 0 },

  squareSm: { width: '2rem' },
  squareMd: { width: '2.5rem' },
  squareLg: { width: '3rem' },
})

/** Visual variants. */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'error' | 'warning'
/** Size variants. */
export type ButtonSize = 'sm' | 'md' | 'lg'
/** Shape variants. */
export type ButtonShape = 'default' | 'rounded' | 'square'

const shapeStyles = {
  default: styles.shapeDefault,
  rounded: styles.shapeRounded,
  square: styles.shapeSquare,
} as const

const squareSizeStyles = {
  sm: styles.squareSm,
  md: styles.squareMd,
  lg: styles.squareLg,
} as const

export interface ButtonProps extends AriaButtonProps {
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  shape?: ButtonShape | undefined
  /** Optional class name override */
  className?: string
}

/** Button component for triggering actions */
export const Button = ({
  variant = 'primary',
  size = 'md',
  shape = 'default',
  className,
  ...props
}: ButtonProps) => (
  <AriaButton
    {...styled(
      className,
      styles.base,
      styles[variant],
      styles[size],
      shapeStyles[shape],
      shape === 'square' ? squareSizeStyles[size] : undefined,
    )}
    {...props}
  />
)
