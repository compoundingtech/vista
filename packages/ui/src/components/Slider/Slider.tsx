/**
 * Slider component built on React Aria
 *
 * @see https://vercel.com/geist/slider
 */

import * as stylex from '@stylexjs/stylex'
import {
  Slider as AriaSlider,
  SliderTrack as AriaSliderTrack,
  SliderThumb as AriaSliderThumb,
  SliderOutput as AriaSliderOutput,
  Label as AriaLabel,
  type SliderProps as AriaSliderProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space2,
    width: '100%',
  },
  labelContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
  },
  output: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  track: {
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    height: scale.space2,
    borderRadius: '5px',
    backgroundColor: tokens['--ds-gray-200'],
    cursor: 'pointer',
  },
  trackDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  range: {
    position: 'absolute',
    boxSizing: 'border-box',
    height: '100%',
    borderTopLeftRadius: scale.radiusFull,
    borderBottomLeftRadius: scale.radiusFull,
    backgroundColor: tokens['--ds-blue-700'],
  },
  thumb: {
    boxSizing: 'border-box',
    top: '50%',
    width: '0.375rem',
    height: '0.875rem',
    borderRadius: '1px',
    backgroundColor: '#ffffff',
    boxShadow: '0 0 0 1px rgb(0, 0, 0), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
    cursor: 'grab',
    outlineWidth: 0,
    outlineStyle: 'none',
  },
  thumbDragging: {
    cursor: 'grabbing',
  },
  thumbFocused: {
    // Tailwind composed the focus ring with the permanent thumb shadow.
    boxShadow: `0 0 0 2px ${tokens['--ds-blue-700']}, 0 0 0 1px rgb(0, 0, 0), 0 1px 2px 0 rgba(0, 0, 0, 0.04)`,
  },
  thumbDisabled: {
    cursor: 'not-allowed',
  },
})

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type SliderOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'display'
  | 'flexDirection'
  | 'flexFlow'
  | 'gap'
  | 'columnGap'
  | 'rowGap'
  | 'width'
  | 'minWidth'
  | 'maxWidth'
>

export interface SliderProps extends Omit<AriaSliderProps, 'children' | 'style'> {
  /** Label text */
  label?: string
  /** Whether to show the current value */
  showOutput?: boolean
  /** Format the output value */
  formatOptions?: Intl.NumberFormatOptions
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned layout is constrained. */
  style?: stylex.StyleXStylesWithout<SliderOwnedStyle>
}

/** Input to select a value from a given range */
export const Slider = ({ label, showOutput = false, className, style, ...props }: SliderProps) => (
  <AriaSlider {...styled(className, styles.root, style)} {...props}>
    {(label || showOutput) && (
      <div {...styled(undefined, styles.labelContainer)}>
        {label && <AriaLabel {...styled(undefined, styles.label)}>{label}</AriaLabel>}
        {showOutput && (
          <AriaSliderOutput {...styled(undefined, styles.output)}>
            {({ state }) =>
              state.values.map((_, index) => state.getThumbValueLabel(index)).join(' – ')
            }
          </AriaSliderOutput>
        )}
      </div>
    )}
    <AriaSliderTrack
      className={({ isDisabled }) =>
        stylex.props(styles.track, isDisabled && styles.trackDisabled).className ?? ''
      }
    >
      {({ state }) => (
        <>
          <div
            {...styled(undefined, styles.range)}
            style={{
              width: `${state.getThumbPercent(0) * 100}%`,
            }}
          />
          <AriaSliderThumb
            className={({ isDragging, isFocusVisible, isDisabled }) =>
              stylex.props(
                styles.thumb,
                isDragging && styles.thumbDragging,
                isDisabled && styles.thumbDisabled,
                isFocusVisible && styles.thumbFocused,
              ).className ?? ''
            }
          />
        </>
      )}
    </AriaSliderTrack>
  </AriaSlider>
)
