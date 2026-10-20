/**
 * Browser component built on React Aria
 *
 * @see https://vercel.com/geist/browser
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    overflow: 'hidden',
    // Tailwind's `rounded-xl`, i.e. `--radius-xl`. That name sits in Tailwind's
    // own theme namespace and — unlike `--radius-sm`/`--radius-lg`/`--radius-full`
    // — is NOT one of the four `styles.css` overrides, so it resolves to the
    // framework default 0.75rem. There is no `scale` member for it, and adding
    // one would mean editing `foundations`, so the resolved value is inlined.
    borderRadius: '0.75rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-100'],
  },
  chrome: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    // `border-b` alone: Tailwind's preflight zeroes every border width, so only
    // the bottom edge ever painted. Setting just the bottom longhands
    // reproduces that without relying on a reset.
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-100'],
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  controlDot: {
    borderRadius: scale.radiusFull,
  },
  // Previously passed in as `className: 'bg-[var(--ds-red-700)]'` etc. from the
  // render body — a utility string, so it becomes a real style here.
  controlDotRed: { backgroundColor: tokens['--ds-red-700'] },
  controlDotAmber: { backgroundColor: tokens['--ds-amber-700'] },
  controlDotGreen: { backgroundColor: tokens['--ds-green-700'] },
  urlBar: {
    // `flex-1` compiles to `flex: 1`, which is grow 1 / shrink 1 / basis 0%.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    // Tailwind's `rounded-md` (`--radius-md`, framework default, not overridden
    // by `styles.css`). Numerically equal to `--radius: 6px` but a different
    // variable, so it is not folded into `scale.radiusDefault`.
    borderRadius: '0.375rem',
    backgroundColor: tokens['--ds-background-100'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    color: tokens['--ds-gray-900'],
    fontFamily: scale.fontMono,
    // `truncate`
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  content: {
    overflow: 'auto',
  },

  chromeSm: { height: '2rem', paddingInline: '0.5rem' },
  chromeMd: { height: '2.5rem', paddingInline: '0.75rem' },
  chromeLg: { height: '3rem', paddingInline: '1rem' },

  controlDotSm: { width: '0.5rem', height: '0.5rem' },
  controlDotMd: { width: '0.625rem', height: '0.625rem' },
  controlDotLg: { width: '0.75rem', height: '0.75rem' },

  // `text-[10px]` is a bare font-size, while `text-xs`/`text-sm` each also
  // carry Tailwind's paired line-height. The `sm` bar therefore inherits its
  // line-height and the other two do not; that asymmetry is preserved.
  urlBarSm: { height: '1.25rem', paddingInline: '0.5rem', fontSize: '10px' },
  // Absolute line-heights rather than Tailwind's `calc()` ratio form: the
  // framework hides the ratio in an unregistered custom property that the CSS
  // minifier will not evaluate, whereas a plain declaration gets folded to
  // `1.33333` and lands off-grid. The ratio is rem-over-rem, so these are the
  // same numbers exactly. Harmless on this element because its height is
  // pinned, but wrong is wrong and the next size added might not be.
  urlBarMd: {
    height: '1.5rem',
    paddingInline: '0.75rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  urlBarLg: {
    height: '1.75rem',
    paddingInline: '0.75rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },

  contentSm: { minHeight: '100px' },
  contentMd: { minHeight: '200px' },
  contentLg: { minHeight: '300px' },

  // Tailwind's generic `shadow-sm`/`shadow-lg`, whose values live in the
  // framework theme rather than the `--ds-*` set. The `--ds-shadow-*` tokens
  // hold different values, so using them here would change the rendering.
  // `rgb(0 0 0 / 0.1)` has no token equivalent.
  rootDefault: { boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
  rootElevated: { boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' },
  rootFlat: { boxShadow: 'none' },
})

/** Size variants. */
export type BrowserSize = 'sm' | 'md' | 'lg'
/** Elevation variants. */
export type BrowserVariant = 'default' | 'elevated' | 'flat'

const chromeSizeStyles = {
  sm: styles.chromeSm,
  md: styles.chromeMd,
  lg: styles.chromeLg,
} as const

const controlDotSizeStyles = {
  sm: styles.controlDotSm,
  md: styles.controlDotMd,
  lg: styles.controlDotLg,
} as const

const urlBarSizeStyles = {
  sm: styles.urlBarSm,
  md: styles.urlBarMd,
  lg: styles.urlBarLg,
} as const

const contentSizeStyles = {
  sm: styles.contentSm,
  md: styles.contentMd,
  lg: styles.contentLg,
} as const

const rootVariantStyles = {
  default: styles.rootDefault,
  elevated: styles.rootElevated,
  flat: styles.rootFlat,
} as const

export interface BrowserProps {
  size?: BrowserSize | undefined
  variant?: BrowserVariant | undefined
  /** Content to display in the browser viewport */
  children: ReactNode
  /** URL to display in the address bar */
  url?: string
  /** Optional class name for the root element */
  className?: string
  /** Optional class name for the content area */
  contentClassName?: string
  /** Whether to show window controls (close, minimize, maximize) */
  showControls?: boolean
  /** Whether to show the URL bar */
  showUrlBar?: boolean
}

/** Browser chrome mockup for showcasing web content */
export const Browser = ({
  children,
  url = 'https://example.com',
  size = 'md',
  variant = 'default',
  className,
  contentClassName,
  showControls = true,
  showUrlBar = true,
}: BrowserProps) => (
  <div {...styled(className, styles.root, rootVariantStyles[variant])}>
    <div {...styled(undefined, styles.chrome, chromeSizeStyles[size])}>
      {showControls && (
        <div {...styled(undefined, styles.controls)}>
          <span
            {...styled(
              undefined,
              styles.controlDot,
              controlDotSizeStyles[size],
              styles.controlDotRed,
            )}
            aria-hidden="true"
          />
          <span
            {...styled(
              undefined,
              styles.controlDot,
              controlDotSizeStyles[size],
              styles.controlDotAmber,
            )}
            aria-hidden="true"
          />
          <span
            {...styled(
              undefined,
              styles.controlDot,
              controlDotSizeStyles[size],
              styles.controlDotGreen,
            )}
            aria-hidden="true"
          />
        </div>
      )}
      {showUrlBar && (
        <div {...styled(undefined, styles.urlBar, urlBarSizeStyles[size])} aria-label="URL bar">
          {url}
        </div>
      )}
    </div>
    <div {...styled(contentClassName, styles.content, contentSizeStyles[size])}>{children}</div>
  </div>
)
