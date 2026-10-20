/**
 * Book component built on React Aria
 *
 * @see https://vercel.com/geist/book
 */

import * as stylex from '@stylexjs/stylex'
import { useState, type ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

/**
 * `0.375rem` is Tailwind's `--radius-md`, which is what `rounded-r-md` and
 * `rounded-l-md` resolved to here. It is deliberately *not* `scale.radiusDefault`:
 * that is the package's own `--radius`, which happens to be 6px too, so the two
 * are indistinguishable today and would silently diverge if either moved. The
 * literal records the value this component actually rendered with.
 *
 * `rounded-r-*`/`rounded-l-*` compile to physical corners, not logical ones, so
 * these stay physical and keep the component's existing (non-flipping) RTL
 * behaviour.
 */
const radiusMd = '0.375rem'

/**
 * Tailwind's `shadow-lg`/`shadow-sm` composed five custom properties into one
 * `box-shadow`: four ring/inset slots plus `--tw-shadow`. With no ring or inset
 * utility anywhere on this component the four slots hold their `0 0 #0000`
 * initial values, so the rendered shadow is exactly the `--tw-shadow` layers
 * below and the transparent slots are dropped. `--tw-shadow-color` is unset, so
 * its `rgb(0 0 0 / 0.1)` fallback is the colour.
 */
const shadowLg = '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
const shadowSm = '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'

const styles = stylex.create({
  root: {
    position: 'relative',
    // `perspective-[1500px]`. StyleX types `perspective` as `'none' | number`
    // and appends `px` to the number, so this emits `perspective: 1500px`.
    perspective: 1500,
  },

  /**
   * The cover's and pages' shared transform setup.
   *
   * Two properties a reader will expect here are absent, and their absence is
   * the pre-migration behaviour rather than an omission:
   *
   * - `transformStyle: 'preserve-3d'` — no `transform-3d`/`preserve-3d` utility
   *   was ever present on any slot, so no `transform-style` was ever emitted.
   * - `backfaceVisibility: 'hidden'` — the source asked for this with
   *   `backface-visibility-hidden`, which is not a Tailwind utility. The real
   *   name is `backface-hidden`. Compiled against this project's own Tailwind
   *   4.3.1, `backface-visibility-hidden` produces **no CSS at all**, so the
   *   cover and pages have always rendered with `backface-visibility: visible`.
   *
   * Adding either would change what this component paints, so neither is
   * emitted. Both are reported instead.
   */
  cover: {
    position: 'absolute',
    inset: 0,
    borderTopRightRadius: radiusMd,
    borderBottomRightRadius: radiusMd,
    boxShadow: shadowLg,
    // `origin-left` compiles to `transform-origin: 0` (x only; y stays 50%).
    transformOrigin: '0',
    // `transition-transform` — Tailwind's property list, verbatim.
    transitionProperty: 'transform, translate, scale, rotate',
    transitionDuration: '500ms',
    // `ease-in-out` → `--ease-in-out`.
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    backgroundColor: tokens['--ds-gray-1000'],
  },

  /**
   * `rotate-y-*` set `--tw-rotate-y` and then composed it into
   * `transform: var(--tw-rotate-x,) var(--tw-rotate-y,) …`. No rotate-x,
   * rotate-z, skew-x or skew-y utility appears on the cover, so those four vars
   * resolve to nothing and the rendered transform is the single `rotateY()`
   * below. `0deg` is kept rather than `none` because that is what `rotate-y-0`
   * emitted, and it keeps the closed state a transform-bearing (composited)
   * element exactly as before.
   */
  coverClosed: { transform: 'rotateY(0deg)' },
  coverOpen: { transform: 'rotateY(-160deg)' },

  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: tokens['--ds-gray-900'],
    borderTopLeftRadius: radiusMd,
    borderBottomLeftRadius: radiusMd,
  },

  page: {
    position: 'absolute',
    inset: 0,
    borderTopRightRadius: radiusMd,
    borderBottomRightRadius: radiusMd,
    backgroundColor: tokens['--ds-background-100'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-200'],
    boxShadow: shadowSm,
    transformOrigin: '0',
    transitionProperty: 'transform, translate, scale, rotate',
    transitionDuration: '500ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  pageContent: {
    position: 'absolute',
    inset: 0,
    padding: '1rem',
    overflow: 'hidden',
  },

  /**
   * `space-y-2` on the wrapper compiled to
   * `:where(& > :not(:last-child)) { margin-block-end: 0.5rem }` — a child
   * combinator, which StyleX has no equivalent for by design. Because this
   * component renders the lines itself, the identical rule is expressed from the
   * child side instead: every line but the last carries the bottom margin. The
   * wrapper consequently needs no styles at all.
   */
  pageLine: {
    height: '0.5rem',
    // `rounded` is a literal `0.25rem`, not one of the `--radius-*` steps.
    borderRadius: '0.25rem',
    backgroundColor: tokens['--ds-gray-200'],
    marginBlockEnd: { default: '0.5rem', ':last-child': '0px' },
  },

  coverContent: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // `text-white` → `--color-white`, which has no design-system token.
    color: '#ffffff',
    // `font-semibold` → `--font-weight-semibold`.
    fontWeight: 600,
    padding: '1rem',
    textAlign: 'center',
  },

  rootSm: { width: '120px', height: '160px' },
  rootMd: { width: '180px', height: '240px' },
  rootLg: { width: '240px', height: '320px' },

  spineSm: { width: '0.5rem' },
  spineMd: { width: '0.75rem' },
  spineLg: { width: '1rem' },

  /** `ml-2`/`ml-3`/`ml-4`, applied to both the cover and the pages. */
  offsetSm: { marginLeft: '0.5rem' },
  offsetMd: { marginLeft: '0.75rem' },
  offsetLg: { marginLeft: '1rem' },

  coverDark: { backgroundColor: tokens['--ds-gray-1000'] },
  coverBlue: { backgroundColor: tokens['--ds-blue-700'] },
  coverPurple: { backgroundColor: tokens['--ds-purple-700'] },
  coverGreen: { backgroundColor: tokens['--ds-green-700'] },
  coverRed: { backgroundColor: tokens['--ds-red-700'] },

  spineDark: { backgroundColor: tokens['--ds-gray-900'] },
  spineBlue: { backgroundColor: tokens['--ds-blue-900'] },
  spinePurple: { backgroundColor: tokens['--ds-purple-900'] },
  spineGreen: { backgroundColor: tokens['--ds-green-900'] },
  spineRed: { backgroundColor: tokens['--ds-red-900'] },
})

/** Size variants. */
export type BookSize = 'sm' | 'md' | 'lg'
/** Cover colour variants. */
export type BookCoverColor = 'dark' | 'blue' | 'purple' | 'green' | 'red'

const rootSizeStyles = {
  sm: styles.rootSm,
  md: styles.rootMd,
  lg: styles.rootLg,
} as const

const spineSizeStyles = {
  sm: styles.spineSm,
  md: styles.spineMd,
  lg: styles.spineLg,
} as const

const offsetStyles = {
  sm: styles.offsetSm,
  md: styles.offsetMd,
  lg: styles.offsetLg,
} as const

const coverColorStyles = {
  dark: styles.coverDark,
  blue: styles.coverBlue,
  purple: styles.coverPurple,
  green: styles.coverGreen,
  red: styles.coverRed,
} as const

const spineColorStyles = {
  dark: styles.spineDark,
  blue: styles.spineBlue,
  purple: styles.spinePurple,
  green: styles.spineGreen,
  red: styles.spineRed,
} as const

export interface BookPage {
  /** Content to render on the page */
  content?: ReactNode
}

export interface BookProps {
  size?: BookSize | undefined
  coverColor?: BookCoverColor | undefined
  /** Pages in the book */
  pages?: BookPage[]
  /** Number of decorative line placeholders per page (if no content) */
  linesPerPage?: number
  /** Optional class name */
  className?: string
  /** Cover title or content */
  coverContent?: ReactNode
  /** Whether the book is open */
  open?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  /** Whether the book can be interacted with */
  interactive?: boolean
}

/**
 * Width of a decorative placeholder line, as a percentage between 60 and 95.
 *
 * Derived from the line's position instead of `Math.random()`, so rendering
 * stays a pure function of props: lines keep their widths when the book
 * re-renders (opening it, a parent update), and every capture of a story is
 * identical.
 */
const pageLineWidth = (pageIndex: number, lineIndex: number): number =>
  60 + ((pageIndex * 7 + lineIndex * 11) % 8) * 5

/** Decorative flip book with pages */
export const Book = ({
  size = 'md',
  coverColor = 'dark',
  pages = [],
  linesPerPage = 6,
  className,
  coverContent,
  open,
  onOpenChange,
  interactive = true,
}: BookProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen

  const handleClick = () => {
    if (!interactive) return
    const newOpen = !isOpen
    setInternalOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  const renderPageLines = (pageIndex: number) => (
    <div>
      {Array.from({ length: linesPerPage }).map((_, i) => (
        <div
          key={i}
          {...styled(undefined, styles.pageLine)}
          style={{ width: `${pageLineWidth(pageIndex, i)}%` }}
        />
      ))}
    </div>
  )

  return (
    <div
      {...styled(className, styles.root, rootSizeStyles[size])}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-expanded={interactive ? isOpen : undefined}
      aria-label={interactive ? (isOpen ? 'Close book' : 'Open book') : undefined}
    >
      {/* Spine */}
      <div
        {...styled(undefined, styles.spine, spineSizeStyles[size], spineColorStyles[coverColor])}
        aria-hidden="true"
      />

      {/* Pages */}
      {pages.length > 0
        ? pages.map((page, index) => (
            <div
              key={index}
              {...styled(undefined, styles.page, offsetStyles[size])}
              style={{
                zIndex: pages.length - index,
                transform: isOpen ? `rotateY(${-5 - index * 3}deg)` : `rotateY(${-index * 0.5}deg)`,
              }}
              aria-hidden={!isOpen}
            >
              <div {...styled(undefined, styles.pageContent)}>
                {page.content ?? renderPageLines(index)}
              </div>
            </div>
          ))
        : /* Default decorative pages */
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              {...styled(undefined, styles.page, offsetStyles[size])}
              style={{
                zIndex: 3 - index,
                transform: isOpen ? `rotateY(${-5 - index * 3}deg)` : `rotateY(${-index * 0.5}deg)`,
              }}
              aria-hidden={!isOpen}
            >
              <div {...styled(undefined, styles.pageContent)}>{renderPageLines(index)}</div>
            </div>
          ))}

      {/* Cover */}
      <div
        {...styled(
          undefined,
          styles.cover,
          offsetStyles[size],
          coverColorStyles[coverColor],
          isOpen ? styles.coverOpen : styles.coverClosed,
        )}
      >
        {coverContent && <div {...styled(undefined, styles.coverContent)}>{coverContent}</div>}
      </div>
    </div>
  )
}
