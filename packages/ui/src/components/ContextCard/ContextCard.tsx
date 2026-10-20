/**
 * ContextCard component built on React Aria
 *
 * @see https://vercel.com/geist/context-card
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  TooltipTrigger as AriaTooltipTrigger,
  Tooltip as AriaTooltip,
  OverlayArrow,
  type TooltipTriggerComponentProps,
  type TooltipProps as AriaTooltipProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

/**
 * ## Two groups of utilities were dropped because they emitted no CSS
 *
 * Measured by compiling each candidate in its own compiler instance against
 * this package's own stylesheet — `build()` accumulates, so a shared instance
 * reports contaminated results. Both control counts are stated so the isolation
 * is witnessed rather than assumed: empty 5331 bytes, `flex` 5367 (live),
 * `zz-not-a-real-utility-zz` 5331 (inert). 56 of the 76 strings in this
 * component emitted; the 20 below did not.
 *
 * **Placement variants — 7 candidates, all inert.** `placement-bottom:mt-2`,
 * `placement-top:mb-2`, `placement-left:mr-2`, `placement-right:ml-2` on the
 * card, and `group-placement-bottom:rotate-180`, `group-placement-left:-rotate-90`,
 * `group-placement-right:rotate-90` on the arrow. `placement-*` is not a
 * framework variant, is not registered as a custom variant, and the plugin that
 * would supply it is not a dependency. An unknown variant invalidates the whole
 * candidate, so each emitted nothing. Consequence: **the card has never had a
 * placement offset and the arrow has never rotated** — it has always pointed one
 * direction on all four sides.
 *
 * **Enter/exit animation — 6 prefixed candidates plus 6 bare, all inert.**
 * `animate-in`, `animate-out`, `fade-in`, `fade-out`, `zoom-in-95` and
 * `zoom-out-95` emit nothing even unprefixed, so the `data-[entering]` and
 * `data-[exiting]` forms could not have worked either: the animation plugin
 * supplying them is not installed. **This card has never animated.**
 *
 * `group` is also inert on its own — it is a marker class the framework emits no
 * CSS for, and its only consumers were the dead `group-placement-*` variants.
 *
 * Neither group is repaired here. Making them work changes what the component
 * paints, which belongs in its own commit with its own before/after rather than
 * riding along in a styling migration.
 *
 * ## The ring and the shadow are combined into one `boxShadow`
 *
 * `ring-1 ring-[var(--ds-gray-alpha-400)]` and `shadow-lg` both composed into a
 * single `box-shadow` through separate custom properties, and BOTH rendered:
 * `box-shadow: …, var(--tw-ring-shadow), var(--tw-shadow)` with the ring ahead
 * of the shadow. `--tw-ring-offset-width` is registered with an initial `0px`,
 * so the ring resolved to `0 0 0 1px var(--ds-gray-alpha-400)`.
 *
 * Translating each to its own `boxShadow` declaration would drop one, since
 * StyleX's `boxShadow` is a single property. Concatenating them in the emitted
 * order is lossless and keeps `outline` free for focus — which matters because
 * `outline` is reserved package-wide for the focus ring. This component has no
 * focus ring at all (only `outline-none`), so unlike Button there is no need to
 * split the two across `outline` and `boxShadow`.
 */
const styles = stylex.create({
  card: {
    backgroundColor: tokens['--ds-background-100'],
    borderRadius: scale.radiusLg,
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`,
    outlineStyle: 'none',
    // `duration-150` and `duration-100` were both declared; tailwind-merge keeps
    // only the last, so 100ms is what applied. With no `transition-property`
    // the CSS initial `all` stands, so this does transition the card.
    transitionDuration: '100ms',
  },

  cardSm: { padding: '0.75rem', maxWidth: '240px' },
  cardMd: { padding: '1rem', maxWidth: '320px' },
  cardLg: { padding: '1.25rem', maxWidth: '400px' },

  arrow: {
    fill: tokens['--ds-background-100'],
    stroke: tokens['--ds-gray-alpha-400'],
    // `stroke-1` emitted a UNITLESS `stroke-width: 1`; StyleX emits
    // `stroke-width: 1px` here and there is no authored form that avoids it —
    // measured, both `1` and `'1'` come out as `1px`.
    //
    // Equivalent for this element and only for this element: the svg is
    // rendered at 14x6 with `viewBox="0 0 14 6"`, so one user unit is exactly
    // one CSS pixel. SVG `stroke-width` is in user units, so if that 1:1
    // mapping ever changes — a CSS width override, a different viewBox — the
    // unitless original would scale and this will not.
    strokeWidth: 1,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },

  headerText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },

  avatar: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scale.radiusFull,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: tokens['--ds-gray-200'],
    color: tokens['--ds-gray-900'],
    fontWeight: 500,
  },

  // Line heights are the absolute lengths the framework's scale steps resolve
  // to, not its `calc(a / b)` ratios: the CSS minifier folds such a division to
  // five decimals and the product floors onto the 1/64px grid. Absolute lengths
  // have nothing left to fold.
  avatarSm: { height: '2rem', width: '2rem', fontSize: '0.75rem', lineHeight: '1rem' },
  avatarMd: { height: '2.5rem', width: '2.5rem', fontSize: '0.875rem', lineHeight: '1.25rem' },
  avatarLg: { height: '3rem', width: '3rem', fontSize: '1rem', lineHeight: '1.5rem' },

  avatarImage: {
    height: '100%',
    width: '100%',
    objectFit: 'cover',
  },

  avatarFallback: {
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },

  // `h-1/2 w-1/2` compiled to `calc(1 / 2 * 100%)`; written as the exact
  // percentage for the same minifier reason as the line heights above.
  placeholderIcon: {
    height: '50%',
    width: '50%',
    color: tokens['--ds-gray-700'],
  },

  title: {
    fontWeight: 500,
    color: tokens['--ds-gray-1000'],
  },

  titleSm: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  titleMd: { fontSize: '1rem', lineHeight: '1.5rem' },
  titleLg: { fontSize: '1.125rem', lineHeight: '1.75rem' },

  subtitle: { color: tokens['--ds-gray-900'] },

  subtitleSm: { fontSize: '0.75rem', lineHeight: '1rem' },
  subtitleMd: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  subtitleLg: { fontSize: '1rem', lineHeight: '1.5rem' },

  // The base slot declared `text-sm`, but tailwind-merge stripped it at both
  // `sm` and `lg` because each of those sizes declares its own font size. Only
  // `md` kept it. So the size carries the type and the base carries only colour
  // — measured from the merged class list, not inferred from the source.
  content: { color: tokens['--ds-gray-900'] },

  // `text-[13px]` is an arbitrary value: it emits a font size and NO paired
  // line-height, so this size deliberately sets none and inherits.
  contentSm: { fontSize: '13px' },
  contentMd: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  contentLg: { fontSize: '1rem', lineHeight: '1.5rem' },

  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    // `border-t` set only the top width and style; `border-[…]` set the colour
    // on all four sides, which is invisible where the width is zero.
    borderTopStyle: 'solid',
    borderTopWidth: '1px',
    borderTopColor: tokens['--ds-gray-alpha-400'],
  },

  meta: {
    fontSize: '0.75rem',
    lineHeight: '1rem',
    color: tokens['--ds-gray-700'],
  },
})

const cardSizeStyles = { sm: styles.cardSm, md: styles.cardMd, lg: styles.cardLg } as const
const avatarSizeStyles = { sm: styles.avatarSm, md: styles.avatarMd, lg: styles.avatarLg } as const
const titleSizeStyles = { sm: styles.titleSm, md: styles.titleMd, lg: styles.titleLg } as const
const subtitleSizeStyles = {
  sm: styles.subtitleSm,
  md: styles.subtitleMd,
  lg: styles.subtitleLg,
} as const
const contentSizeStyles = {
  sm: styles.contentSm,
  md: styles.contentMd,
  lg: styles.contentLg,
} as const

/** Size variants. */
export type ContextCardSize = 'sm' | 'md' | 'lg'

/** Default placeholder icon for avatar */
const PlaceholderIcon = () => (
  <svg
    {...styled(undefined, styles.placeholderIcon)}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
)

export interface ContextCardTriggerProps extends TooltipTriggerComponentProps {
  /** The trigger element and context card */
  children: ReactNode
  /** Delay in ms before showing (default: 300) */
  delay?: number
  /** Delay in ms before hiding (default: 0) */
  closeDelay?: number
}

/** Container that manages the trigger and context card relationship */
export const ContextCardTrigger = ({
  children,
  delay = 300,
  closeDelay = 0,
  ...props
}: ContextCardTriggerProps) => (
  <AriaTooltipTrigger delay={delay} closeDelay={closeDelay} {...props}>
    {children}
  </AriaTooltipTrigger>
)

export interface ContextCardProps extends Omit<AriaTooltipProps, 'children'> {
  size?: ContextCardSize | undefined
  /** Title text */
  title?: string
  /** Subtitle text */
  subtitle?: string
  /** Avatar image URL */
  avatarSrc?: string
  /** Avatar fallback text (e.g., initials) */
  avatarFallback?: string
  /** Main content */
  children?: ReactNode
  /** Footer content */
  footer?: ReactNode
  /** Meta information */
  meta?: string
  /** Whether to show arrow */
  showArrow?: boolean
  /** Optional class name override */
  className?: string
}

/** Hover-triggered rich card tooltip for displaying contextual information */
export const ContextCard = ({
  title,
  subtitle,
  avatarSrc,
  avatarFallback,
  children,
  footer,
  meta,
  size = 'md',
  showArrow = true,
  className,
  ...props
}: ContextCardProps) => {
  const hasAvatar = !!avatarSrc || !!avatarFallback
  const hasHeader = !!title || hasAvatar

  return (
    // `styled()`'s overrides object is deliberately NOT used here. React Aria
    // types this `style` as `StyleOrFunction<TooltipRenderProps>` — it may be a
    // render-prop function, which `styled()` cannot merge because resolving it
    // needs render values the helper does not have. Passing it in is a type
    // error; narrowing the prop to a plain object would remove a capability the
    // component currently exposes.
    //
    // So `style` stays in `props` and is spread AFTER, which is safe here and
    // matches the already-merged Button: every style in this file is static, so
    // `stylex.props` returns a class only and there is no injected `style` for
    // the caller's to clobber. That safety is a property of these styles being
    // static, and it would need revisiting alongside any dynamic style.
    <AriaTooltip {...styled(className, styles.card, cardSizeStyles[size])} {...props}>
      {showArrow && (
        <OverlayArrow>
          <svg width={14} height={6} viewBox="0 0 14 6" {...styled(undefined, styles.arrow)}>
            <path d="M13.8284 0H0.17157C0.702003 0 1.21071 0.210714 1.58578 0.585787L5.58578 4.58579C6.36683 5.36684 7.63316 5.36683 8.41421 4.58579L12.4142 0.585786C12.7893 0.210714 13.298 0 13.8284 0Z" />
          </svg>
        </OverlayArrow>
      )}

      {hasHeader && (
        <div {...styled(undefined, styles.header)}>
          {hasAvatar && (
            <span {...styled(undefined, styles.avatar, avatarSizeStyles[size])}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="" {...styled(undefined, styles.avatarImage)} />
              ) : avatarFallback ? (
                <span {...styled(undefined, styles.avatarFallback)}>{avatarFallback}</span>
              ) : (
                <PlaceholderIcon />
              )}
            </span>
          )}
          <div {...styled(undefined, styles.headerText)}>
            {title && (
              <span {...styled(undefined, styles.title, titleSizeStyles[size])}>{title}</span>
            )}
            {subtitle && (
              <span {...styled(undefined, styles.subtitle, subtitleSizeStyles[size])}>
                {subtitle}
              </span>
            )}
          </div>
        </div>
      )}

      {children && (
        <div {...styled(undefined, styles.content, contentSizeStyles[size])}>{children}</div>
      )}

      {(footer ?? meta) && (
        <div {...styled(undefined, styles.footer)}>
          {footer}
          {meta && !footer && <span {...styled(undefined, styles.meta)}>{meta}</span>}
        </div>
      )}
    </AriaTooltip>
  )
}

export interface ContextCardContentProps {
  /** Content elements */
  children: ReactNode
  /** Optional class name override */
  className?: string
}

/**
 * Custom content area for context cards
 *
 * Takes no size prop, so it rendered through the `md` default — hence the `md`
 * content style rather than the bare base slot.
 */
export const ContextCardContent = ({ children, className }: ContextCardContentProps) => (
  <div {...styled(className, styles.content, styles.contentMd)}>{children}</div>
)
