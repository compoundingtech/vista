/**
 * Gauge component built on React Aria
 *
 * @see https://vercel.com/geist/gauge
 */

import * as stylex from '@stylexjs/stylex'
import { useMemo } from 'react'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootTiny: { width: '1.25rem', height: '1.25rem' },
  rootSmall: { width: '2rem', height: '2rem' },
  rootMedium: { width: '4rem', height: '4rem' },
  rootLarge: { width: '8rem', height: '8rem' },

  // `transform -rotate-90`. Tailwind v4 spells this as the standalone `rotate`
  // property and leaves `transform` resolving to nothing, but no other
  // transform or translate is set on this element, so a single `transform` is
  // the same rendered result.
  svg: { transform: 'rotate(-90deg)' },
  svgTiny: { width: '1.25rem', height: '1.25rem' },
  svgSmall: { width: '2rem', height: '2rem' },
  svgMedium: { width: '4rem', height: '4rem' },
  svgLarge: { width: '8rem', height: '8rem' },

  // The arc's `stroke-dasharray`/`stroke-dashoffset` stay SVG presentation
  // attributes on the element — they are derived from `value`, so they cannot
  // live in `stylex.create`, and as attributes they sit below any author rule
  // rather than above one like an inline style would.
  progressCircle: {
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '300ms',
  },

  label: {
    position: 'absolute',
    fontWeight: 500,
    color: tokens['--ds-gray-1000'],
  },
  // `text-[8px]`, `text-[11px]` and `text-[32px]` are arbitrary values, which
  // set font-size alone and leave line-height at `normal`. `text-lg` is a
  // scale step, so it also carries a paired line-height; dropping it measured
  // as a 1px shorter label. Restated absolutely rather than as Tailwind's
  // `calc(1.75 / 1.125)` ratio: a unitless ratio is quantised to 1/256 and
  // measured 28.0001px against Tailwind's 28px, while `1.75rem` is exact.
  labelTiny: { fontSize: '8px' },
  labelSmall: { fontSize: '11px' },
  labelMedium: { fontSize: '1.125rem', lineHeight: '1.75rem' },
  labelLarge: { fontSize: '32px', fontWeight: 600 },
})

/** Size variants. */
export type GaugeSize = 'tiny' | 'small' | 'medium' | 'large'

const rootSize: Record<GaugeSize, stylex.StyleXStyles> = {
  tiny: styles.rootTiny,
  small: styles.rootSmall,
  medium: styles.rootMedium,
  large: styles.rootLarge,
}

const svgSize: Record<GaugeSize, stylex.StyleXStyles> = {
  tiny: styles.svgTiny,
  small: styles.svgSmall,
  medium: styles.svgMedium,
  large: styles.svgLarge,
}

const labelSize: Record<GaugeSize, stylex.StyleXStyles> = {
  tiny: styles.labelTiny,
  small: styles.labelSmall,
  medium: styles.labelMedium,
  large: styles.labelLarge,
}

/** Color scale configuration for automatic coloring based on value */
export type GaugeColorScale = Array<{
  /** Threshold value (0-100) */
  limit: number
  /** Color to use below this threshold */
  color: string
}>

/** Default color scale: red < 33, amber < 66, green >= 66 */
export const defaultGaugeColorScale: GaugeColorScale = [
  { limit: 33, color: tokens['--ds-red-800'] },
  { limit: 66, color: tokens['--ds-amber-700'] },
  { limit: 100, color: tokens['--ds-green-700'] },
]

export interface GaugeProps {
  /** Current value (0-100) */
  value: number
  /** Maximum value */
  max?: number
  /** Show value label in center */
  showLabel?: boolean
  /** Custom label text (defaults to value) */
  label?: string
  /** Primary color for the progress arc */
  color?: string
  /** Color scale for automatic coloring based on value */
  colorScale?: GaugeColorScale
  /** Secondary/track color */
  trackColor?: string
  /** Arc priority mode - 'primary' shows progress arc on top, 'equal' for ratio display */
  arcPriority?: 'primary' | 'equal'
  /** Size variant */
  size?: GaugeSize | undefined
  /** Optional class name */
  className?: string
}

/** Get stroke configuration based on size */
const getStrokeConfig = (size: GaugeProps['size']) => {
  if (size === 'tiny') {
    return { strokeWidth: 15, radius: 42.5 }
  }
  return { strokeWidth: 10, radius: 45 }
}

/** Get color based on value and color scale */
const getColorFromScale = (value: number, scale: GaugeColorScale): string => {
  for (const { limit, color } of scale) {
    if (value <= limit) {
      return color
    }
  }
  return scale[scale.length - 1]?.color ?? tokens['--ds-gray-900']
}

/** Gauge displays a circular progress indicator */
export const Gauge = ({
  value,
  max = 100,
  showLabel = false,
  label,
  color,
  colorScale,
  trackColor = tokens['--ds-gray-alpha-400'],
  size = 'medium',
  className,
}: GaugeProps) => {
  const { strokeWidth, radius } = getStrokeConfig(size)

  const normalizedValue = Math.min(Math.max(0, value), max)
  const percentage = (normalizedValue / max) * 100

  const circumference = 2 * Math.PI * radius

  const progressArc = useMemo(() => {
    const offset = circumference - (percentage / 100) * circumference
    return {
      strokeDasharray: circumference,
      strokeDashoffset: offset,
    }
  }, [circumference, percentage])

  const effectiveColor = useMemo(() => {
    if (color) return color
    if (colorScale) return getColorFromScale(percentage, colorScale)
    return tokens['--ds-amber-700']
  }, [color, colorScale, percentage])

  const displayLabel = label ?? Math.round(normalizedValue).toString()

  return (
    <div
      {...styled(className, styles.root, rootSize[size])}
      role="progressbar"
      aria-valuenow={normalizedValue}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <svg {...styled(undefined, styles.svg, svgSize[size])} viewBox="0 0 100 100">
        {/* Track circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Progress circle */}
        <circle
          {...styled(undefined, styles.progressCircle)}
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={effectiveColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={progressArc.strokeDasharray}
          strokeDashoffset={progressArc.strokeDashoffset}
        />
      </svg>
      {showLabel && size !== 'tiny' && (
        <span {...styled(undefined, styles.label, labelSize[size])}>{displayLabel}</span>
      )}
    </div>
  )
}
