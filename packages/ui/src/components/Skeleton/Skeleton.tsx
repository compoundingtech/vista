/**
 * Skeleton component built on React Aria
 *
 * @see https://vercel.com/geist/skeleton
 */

import * as stylex from '@stylexjs/stylex'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

/**
 * Replaces the hand-written `<style>{'@keyframes skeletonShimmer …'}</style>`
 * the component used to render on every instance. StyleX hashes the name, so
 * the identically-named block still emitted by `Table.tsx` can no longer
 * collide with this one.
 */
const shimmerKeyframes = stylex.keyframes({
  '0%': { transform: 'translateX(-100%)' },
  '100%': { transform: 'translateX(100%)' },
})

const styles = stylex.create({
  base: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: tokens['--ds-gray-200'],
  },

  // `rounded` is a LITERAL `0.25rem` in Tailwind 4.3.1 — it does not read the
  // radius theme namespace, so the token that happens to equal it today
  // (`--radius-sm`) is a different custom property and not used here.
  // `rectangular` is the opposite case: it named `--radius` explicitly, so the
  // scale member is the faithful translation rather than a coincidence.
  text: { height: '1rem', borderRadius: '0.25rem' },
  circular: { borderRadius: scale.radiusFull },
  rectangular: { borderRadius: scale.radiusDefault },

  shimmer: {
    position: 'absolute',
    inset: 0,
    // Was the `background` shorthand, which also reset the colour to its
    // initial `transparent` — the value this element already had.
    backgroundImage: `linear-gradient(90deg, transparent, ${tokens['--ds-gray-300']}, transparent)`,
    // Longhands, never the `animation` shorthand: StyleX compiles the
    // shorthand to an empty style object without reporting an error.
    animationName: shimmerKeyframes,
    animationDuration: '1.5s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },

  /**
   * Stands in for an absent `width`/`height`. A dynamic style called with
   * `null` does not mean "leave it alone" — it removes the property from the
   * merge, which would drop the `text` variant's own height.
   */
  none: {},
})

const dynamic = stylex.create({
  width: (value: string) => ({ width: value }),
  height: (value: string) => ({ height: value }),
})

/** Shape variants. */
export type SkeletonVariant = 'text' | 'circular' | 'rectangular'

export interface SkeletonProps {
  /** Shape variant */
  variant?: SkeletonVariant | undefined
  className?: string
  /** Width of the skeleton (for text variant) */
  width?: string | number
  /** Height of the skeleton */
  height?: string | number
}

/** Skeleton placeholder for loading content */
export const Skeleton = ({ variant = 'text', className, width, height }: SkeletonProps) => {
  const widthValue = width ? (typeof width === 'number' ? `${width}px` : width) : undefined
  const heightValue = height ? (typeof height === 'number' ? `${height}px` : height) : undefined

  return (
    <div
      {...styled(
        className,
        styles.base,
        styles[variant],
        widthValue === undefined ? styles.none : dynamic.width(widthValue),
        heightValue === undefined ? styles.none : dynamic.height(heightValue),
      )}
    >
      <div {...styled(undefined, styles.shimmer)} />
    </div>
  )
}
