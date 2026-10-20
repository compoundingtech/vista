/**
 * Progress component built on React Aria
 *
 * @see https://vercel.com/geist/progress
 */

import * as stylex from '@stylexjs/stylex'
import {
  ProgressBar as AriaProgressBar,
  Label as AriaLabel,
  type ProgressBarProps as AriaProgressBarProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    width: '100%',
  },

  labelContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  label: {
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    // The line-height `text-sm` pairs with its font size. Spelled as the
    // resolved length rather than Tailwind's `calc(1.25 / 0.875)` ratio: the
    // CSS minifier folds that division to five decimals and the product floors
    // onto the 1/64px grid. An absolute length has nothing left to fold.
    lineHeight: '1.25rem',
    fontWeight: 500,
  },

  valueLabel: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },

  track: {
    position: 'relative',
    width: '100%',
    backgroundColor: tokens['--ds-gray-200'],
    borderRadius: '6px',
    overflow: 'hidden',
  },

  // The track's height came from the `md` size variant as well as the base
  // slot, at the same value. Only the variant sets it here.
  trackSm: { height: '0.375rem' },
  trackMd: { height: '0.625rem' },
  trackLg: { height: '1rem' },

  fill: {
    position: 'absolute',
    height: '100%',
    borderRadius: '6px',
    transitionProperty: 'all',
    transitionDuration: '100ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 1, 1)',
  },

  // As with the track, the base slot's fill colour and the `default` colour
  // variant were the same token, so only the variant sets it.
  fillDefault: { backgroundColor: tokens['--ds-gray-1000'] },
  fillBlue: { backgroundColor: tokens['--ds-blue-700'] },
  fillRed: { backgroundColor: tokens['--ds-red-700'] },
  fillOrange: { backgroundColor: tokens['--ds-amber-700'] },
  fillGreen: { backgroundColor: tokens['--ds-green-700'] },
})

const trackSizeStyles = {
  sm: styles.trackSm,
  md: styles.trackMd,
  lg: styles.trackLg,
} as const

const fillColorStyles = {
  default: styles.fillDefault,
  blue: styles.fillBlue,
  red: styles.fillRed,
  orange: styles.fillOrange,
  green: styles.fillGreen,
} as const

/** Fill colour variants. */
export type ProgressColor = 'default' | 'blue' | 'red' | 'orange' | 'green'

/** Track size variants. */
export type ProgressSize = 'sm' | 'md' | 'lg'

export interface ProgressProps extends Omit<AriaProgressBarProps, 'children'> {
  color?: ProgressColor | undefined
  size?: ProgressSize | undefined
  /** Label text */
  label?: string
  /** Whether to show the value percentage */
  showValue?: boolean
  /** Format the value label */
  formatOptions?: Intl.NumberFormatOptions
  /** Optional class name override */
  className?: string
}

/** Display progress relative to a limit or related to a task */
export const Progress = ({
  label,
  showValue = false,
  color = 'default',
  size = 'md',
  className,
  ...props
}: ProgressProps) => (
  <AriaProgressBar {...styled(className, styles.root)} {...props}>
    {({ percentage, valueText }) => (
      <>
        {(label || showValue) && (
          <div {...styled(undefined, styles.labelContainer)}>
            {label && <AriaLabel {...styled(undefined, styles.label)}>{label}</AriaLabel>}
            {showValue && <span {...styled(undefined, styles.valueLabel)}>{valueText}</span>}
          </div>
        )}
        <div {...styled(undefined, styles.track, trackSizeStyles[size])}>
          <div
            {...styled(undefined, styles.fill, fillColorStyles[color])}
            style={{ width: `${percentage ?? 0}%` }}
          />
        </div>
      </>
    )}
  </AriaProgressBar>
)
