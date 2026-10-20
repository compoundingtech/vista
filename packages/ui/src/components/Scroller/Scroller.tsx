/**
 * Scroller component built on React Aria
 *
 * @see https://vercel.com/geist/scroller
 */

import * as stylex from '@stylexjs/stylex'
import { useState, useRef, useCallback, useEffect, type ReactNode, type UIEvent } from 'react'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

/**
 * The scroll shadows were `bg-gradient-to-<dir> from-[var(--ds-background-100)]
 * to-transparent`, which composed a stop list through custom properties and
 * resolved to a plain `linear-gradient`. Two details are load-bearing:
 *
 * - `in oklab` is part of it. The legacy `bg-gradient-to-*` spelling emits the
 *   oklab interpolation hint unconditionally, where the modern `bg-linear-to-*`
 *   guards it behind `@supports`. Since the source used the legacy spelling, the
 *   hint is unconditional here too — dropping it would change the midpoint
 *   colour of every shadow.
 * - The `0%`/`100%` stop positions are the defaults of
 *   `--tw-gradient-from-position`/`--tw-gradient-to-position`, stated explicitly
 *   because nothing carries them any more.
 */
const gradientFrom = tokens['--ds-background-100']

const styles = stylex.create({
  root: {
    position: 'relative',
    overflow: 'hidden',
  },

  /**
   * `overflow` is written as the two longhands throughout, never the shorthand.
   * The base was `overflow-auto` and each direction variant then layered
   * `overflow-x-*`/`overflow-y-*` on top; under Tailwind the longhands won by
   * stylesheet order. Keeping everything longhand makes that precedence a plain
   * consequence of argument order instead of a shorthand-expansion question.
   */
  container: {
    overflowX: 'auto',
    overflowY: 'auto',
    // `scrollbar-thin` is a real Tailwind 4.3 utility: `scrollbar-width: thin`.
    scrollbarWidth: 'thin',
  },

  containerHorizontal: {
    overflowX: 'auto',
    overflowY: 'hidden',
    display: 'flex',
  },
  containerVertical: {
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  containerBoth: {
    overflowX: 'auto',
    overflowY: 'auto',
  },

  /**
   * NO `containerScrollbarHidden` STYLE EXISTS, DELIBERATELY.
   *
   * `hideScrollbar` has never done anything, and this preserves that. The
   * `hideScrollbar: true` variant added `scrollbar-none` on top of the base
   * `scrollbar-thin`. Both classes survived `tailwind-merge` (it has no conflict
   * group for these Tailwind 4.3 utilities), so both reached the DOM — and in
   * the emitted stylesheet `.scrollbar-none` is at offset 21 while
   * `.scrollbar-thin` is at offset 72. Equal specificity, so the LATER rule
   * wins and `scrollbar-width` computed to `thin` whether or not the prop was
   * set. Measured, not inferred: `tv()` output run through the real
   * tailwind-variants, then compiled and resolved by source order.
   *
   * Applying `scrollbarWidth: 'none'` here as a later StyleX argument WOULD
   * work, which is exactly why it is absent — it would make a dead prop start
   * hiding scrollbars inside a styling migration. The prop stays in the public
   * API because it is public and stories pass it. Fixing it is its own commit
   * with its own before/after.
   */

  /** `snap-x snap-mandatory` → `scroll-snap-type: x var(--tw-scroll-snap-strictness)`. */
  containerSnap: { scrollSnapType: 'x mandatory' },

  shadow: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 10,
    transitionProperty: 'opacity',
    transitionDuration: '200ms',
    // `transition-opacity` with no `ease-*` utility falls back to
    // `--default-transition-timing-function`.
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  shadowStartHorizontal: {
    left: 0,
    top: 0,
    bottom: 0,
    width: '2rem',
    backgroundImage: `linear-gradient(to right in oklab, ${gradientFrom} 0%, transparent 100%)`,
  },
  shadowEndHorizontal: {
    right: 0,
    top: 0,
    bottom: 0,
    width: '2rem',
    backgroundImage: `linear-gradient(to left in oklab, ${gradientFrom} 0%, transparent 100%)`,
  },
  shadowStartVertical: {
    top: 0,
    left: 0,
    right: 0,
    height: '2rem',
    backgroundImage: `linear-gradient(to bottom in oklab, ${gradientFrom} 0%, transparent 100%)`,
  },
  shadowEndVertical: {
    bottom: 0,
    left: 0,
    right: 0,
    height: '2rem',
    backgroundImage: `linear-gradient(to top in oklab, ${gradientFrom} 0%, transparent 100%)`,
  },

  // `opacity-*` emits percentages, not unit-less fractions.
  shadowSubtle: { opacity: '50%' },
  shadowNormal: { opacity: '80%' },
  shadowStrong: { opacity: '100%' },

  contentHorizontal: { display: 'flex' },

  gapNone: { gap: 0 },
  gapSm: { gap: '0.5rem' },
  gapMd: { gap: '1rem' },
  gapLg: { gap: '1.5rem' },
})

/** Scroll axis variants. */
export type ScrollerDirection = 'horizontal' | 'vertical' | 'both'
/** Shadow strength variants. */
export type ScrollerShadowIntensity = 'subtle' | 'normal' | 'strong'
/** Scroll-snap alignment variants. */
export type ScrollerSnap = 'none' | 'start' | 'center'
/** Gap between items. */
export type ScrollerGap = 'none' | 'sm' | 'md' | 'lg'

const containerDirectionStyles = {
  horizontal: styles.containerHorizontal,
  vertical: styles.containerVertical,
  both: styles.containerBoth,
} as const

const shadowStartDirectionStyles = {
  horizontal: styles.shadowStartHorizontal,
  vertical: styles.shadowStartVertical,
  both: undefined,
} as const

const shadowEndDirectionStyles = {
  horizontal: styles.shadowEndHorizontal,
  vertical: styles.shadowEndVertical,
  both: undefined,
} as const

const shadowIntensityStyles = {
  subtle: styles.shadowSubtle,
  normal: styles.shadowNormal,
  strong: styles.shadowStrong,
} as const

const gapStyles = {
  none: styles.gapNone,
  sm: styles.gapSm,
  md: styles.gapMd,
  lg: styles.gapLg,
} as const

/**
 * The one rule in this file that is not StyleX, and cannot be.
 *
 * `snap` put `scroll-snap-align` on the *caller's* children via
 * `[&>*]:snap-start`. The children come in as `children`, so there is no element
 * here to attach a style to, and StyleX has no child combinator by design.
 * Dropping the rule would leave `scroll-snap-type: x mandatory` on the container
 * with no snap targets at all, which silently disables snapping rather than
 * degrading it — so the utility class stays and is reported instead of being
 * approximated away.
 */
const snapChildClasses = {
  none: undefined,
  start: '[&>*]:snap-start',
  center: '[&>*]:snap-center',
} as const

export interface ScrollerProps {
  direction?: ScrollerDirection | undefined
  shadowIntensity?: ScrollerShadowIntensity | undefined
  /**
   * Accepted and inert, preserving pre-migration behaviour — the base
   * `scrollbar-thin` rule outranked this variant's `scrollbar-none` by
   * stylesheet order. See the note on the container styles above.
   */
  hideScrollbar?: boolean | undefined
  snap?: ScrollerSnap | undefined
  /** Content to scroll */
  children: ReactNode
  /** Optional class name for the root element */
  className?: string
  /** Optional class name for the scrollable container */
  containerClassName?: string
  /** Optional class name for the content wrapper */
  contentClassName?: string
  /** Gap between items (for horizontal direction) */
  gap?: ScrollerGap
  /** Height for vertical scroller */
  height?: string | number
  /** Width for horizontal scroller */
  width?: string | number
  /** Whether to show scroll shadows */
  showShadows?: boolean
}

/** Scroll container with scroll position indicators */
export const Scroller = ({
  children,
  direction,
  shadowIntensity,
  snap,
  className,
  containerClassName,
  contentClassName,
  gap = 'md',
  height,
  width,
  showShadows = true,
}: ScrollerProps) => {
  const [showStartShadow, setShowStartShadow] = useState(false)
  const [showEndShadow, setShowEndShadow] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  /**
   * Styling resolves the variant defaults; the logic below deliberately does
   * not.
   *
   * `tv()`'s `defaultVariants` only ever applied to the generated classes, so an
   * omitted `direction` styled as `horizontal` while `updateShadows` and the
   * shadow gate both compared the raw `undefined`. That means a `<Scroller>` with
   * no `direction` lays out horizontally but measures `scrollTop`/`scrollHeight`.
   * It looks like a bug and it is preserved exactly: `resolved*` feeds styles
   * only, and every conditional below still reads the raw prop.
   */
  const resolvedDirection = direction ?? 'horizontal'
  const resolvedIntensity = shadowIntensity ?? 'normal'
  const resolvedSnap = snap ?? 'none'

  const updateShadows = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const isHorizontal = direction === 'horizontal'
    const scrollPos = isHorizontal ? container.scrollLeft : container.scrollTop
    const scrollSize = isHorizontal ? container.scrollWidth : container.scrollHeight
    const clientSize = isHorizontal ? container.clientWidth : container.clientHeight

    setShowStartShadow(scrollPos > 0)
    setShowEndShadow(scrollPos < scrollSize - clientSize - 1)
  }, [direction])

  const handleScroll = useCallback(
    (_e: UIEvent<HTMLDivElement>) => {
      updateShadows()
    },
    [updateShadows],
  )

  useEffect(() => {
    updateShadows()
    const container = containerRef.current
    if (!container) return
    const resizeObserver = new ResizeObserver(updateShadows)
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [updateShadows])

  const containerStyle: React.CSSProperties = {}
  if (height) containerStyle.height = typeof height === 'number' ? `${height}px` : height
  if (width) containerStyle.width = typeof width === 'number' ? `${width}px` : width

  const snapChildClass = snapChildClasses[resolvedSnap]
  const contentClass = [snapChildClass, contentClassName].filter(Boolean).join(' ')

  return (
    <div {...styled(className, styles.root)}>
      {showShadows && direction !== 'both' && (
        <>
          <div
            {...styled(
              undefined,
              styles.shadow,
              shadowStartDirectionStyles[resolvedDirection],
              shadowIntensityStyles[resolvedIntensity],
            )}
            style={{ opacity: showStartShadow ? undefined : 0 }}
            aria-hidden="true"
          />
          <div
            {...styled(
              undefined,
              styles.shadow,
              shadowEndDirectionStyles[resolvedDirection],
              shadowIntensityStyles[resolvedIntensity],
            )}
            style={{ opacity: showEndShadow ? undefined : 0 }}
            aria-hidden="true"
          />
        </>
      )}
      <div
        ref={containerRef}
        {...styled(
          containerClassName,
          styles.container,
          containerDirectionStyles[resolvedDirection],
          resolvedSnap === 'none' ? undefined : styles.containerSnap,
        )}
        onScroll={handleScroll}
        style={containerStyle}
      >
        <div
          {...styled(
            contentClass === '' ? undefined : contentClass,
            resolvedDirection === 'horizontal' ? styles.contentHorizontal : undefined,
            gapStyles[gap],
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
