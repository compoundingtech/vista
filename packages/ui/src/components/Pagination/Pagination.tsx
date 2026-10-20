/**
 * Pagination component built on React Aria
 *
 * @see https://vercel.com/geist/pagination
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { Link as AriaLink } from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

/**
 * The icon's hover offset, published by the link and read by the icon.
 *
 * This indirection replaces `group`/`group-hover:`, and it is the one thing in
 * this file that is not a mechanical substitution. The icon has to move when the
 * *link* is hovered, including when the pointer is over the link's padding
 * rather than the icon, so the condition belongs to an ancestor. StyleX has no
 * ancestor-state selector — conditions compile to pseudo-classes on the element
 * that owns the style — so the state is relayed through an inherited custom
 * property instead: the link sets it under `:hover`, the icon interpolates it.
 *
 * Deliberately NOT registered with `@property`, so it inherits (the default for
 * an unregistered custom property) and reaches the icon. Registering it would
 * default `inherits` to false and break the relay.
 *
 * Only the variable changes discontinuously; the transition still runs on the
 * icon's `translate`, which is exactly how Tailwind drove it through
 * `--tw-translate-x`. So the animation is unchanged, not re-implemented.
 */
const ICON_SHIFT = '--pagination-icon-shift'

const styles = stylex.create({
  root: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  link: {
    position: 'relative',
    display: 'block',
    color: tokens['--ds-gray-1000'],
    textDecorationLine: 'none',
  },
  label: {
    fontSize: '13px',
    lineHeight: '1.25rem',
    color: tokens['--ds-gray-900'],
  },
  title: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
    fontWeight: 500,
    color: tokens['--ds-gray-1000'],
  },
  icon: {
    position: 'absolute',
    top: '50%',
    width: '1.25rem',
    height: '1.25rem',
    color: tokens['--ds-gray-900'],
    // `top-1/2` + `-translate-y-1/2`, with the x component supplied by the
    // ancestor. Tailwind emitted `translate: var(--tw-translate-x) -50%` here
    // for the same reason, so this is the same mechanism under a local name.
    translate: `var(${ICON_SHIFT}, 0) -50%`,
    // `transition-transform duration-200`. Longhands only: the `transition`
    // shorthand compiles to an empty StyleX rule. The property list and the
    // timing function are Tailwind's own defaults for this utility.
    transitionProperty: 'transform, translate, scale, rotate',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
  },

  linkPrevious: {
    paddingLeft: '1.75rem',
    // `group-hover:` compiles inside `@media (hover: hover)`, so the offset
    // never applies on pointer-less devices where `:hover` can latch. Dropping
    // that guard would be a real behaviour change on touch, so it is kept.
    // The unhovered value sits on `default`, which carries the lowest priority
    // by construction and so cannot outrank the conditioned value.
    [ICON_SHIFT]: {
      default: '0px',
      ':hover': { default: '0px', '@media (hover: hover)': '-0.125rem' },
    },
  },
  linkNext: {
    paddingRight: '1.75rem',
    textAlign: 'right',
    [ICON_SHIFT]: {
      default: '0px',
      ':hover': { default: '0px', '@media (hover: hover)': '0.125rem' },
    },
  },

  iconPrevious: { left: 0 },
  iconNext: { right: 0 },
})

const linkDirectionStyles = {
  previous: styles.linkPrevious,
  next: styles.linkNext,
} as const

const iconDirectionStyles = {
  previous: styles.iconPrevious,
  next: styles.iconNext,
} as const

export interface PaginationLinkProps {
  /** URL to navigate to */
  href: string
  /** Page title/name */
  title: string
  /** Direction of the link */
  direction: 'previous' | 'next'
  /** Optional class name */
  className?: string
}

/** PaginationLink renders a single pagination link */
export const PaginationLink = ({ href, title, direction, className }: PaginationLinkProps) => {
  const iconProps = styled(undefined, styles.icon, iconDirectionStyles[direction])

  return (
    <AriaLink
      href={href}
      {...styled(className, styles.link, linkDirectionStyles[direction])}
      aria-label={`Go to ${direction} page: ${title}`}
    >
      <span {...styled(undefined, styles.label)}>
        {direction === 'previous' ? 'Previous' : 'Next'}
      </span>
      <span {...styled(undefined, styles.title)}>{title}</span>
      {direction === 'previous' ? (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" {...iconProps}>
          <path
            d="M12.5 5L7.5 10L12.5 15"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" {...iconProps}>
          <path
            d="M7.5 5L12.5 10L7.5 15"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </AriaLink>
  )
}

export interface PaginationProps {
  /** Previous page link */
  previous?: {
    href: string
    title: string
  }
  /** Next page link */
  next?: {
    href: string
    title: string
  }
  /** Optional class name */
  className?: string
  /** Custom children (overrides previous/next props) */
  children?: ReactNode
}

/** Pagination displays navigation links to previous and next pages */
export const Pagination = ({ previous, next, className, children }: PaginationProps) => {
  if (children) {
    return (
      <nav aria-label="pagination" {...styled(className, styles.root)}>
        {children}
      </nav>
    )
  }

  return (
    <nav aria-label="pagination" {...styled(className, styles.root)}>
      {previous ? (
        <PaginationLink href={previous.href} title={previous.title} direction="previous" />
      ) : (
        <div />
      )}
      {next ? <PaginationLink href={next.href} title={next.title} direction="next" /> : <div />}
    </nav>
  )
}
