/**
 * EmptyState component built on React Aria
 *
 * @see https://vercel.com/geist/empty-state
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
    textAlign: 'center',
  },

  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },

  title: {
    fontSize: '1rem',
    fontWeight: 500,
    color: tokens['--ds-gray-1000'],
    // `leading-6` was explicit alongside `text-base`, so it also replaced the
    // line-height `text-base` pairs with its font size.
    lineHeight: '1.5rem',
    letterSpacing: '-0.02em',
  },

  description: {
    fontSize: '0.875rem',
    color: tokens['--ds-gray-900'],
    lineHeight: '1.25rem',
    maxWidth: '340px',
  },

  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },

  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.125rem',
    fontSize: '0.875rem',
    // The line-height `text-sm` pairs with its font size; no explicit
    // `leading-*` overrode it on this slot. Spelled as the resolved length
    // rather than Tailwind's `calc(1.25 / 0.875)` ratio: the CSS minifier folds
    // that division to five decimals and the product floors onto the 1/64px
    // grid. An absolute length has nothing left to fold.
    lineHeight: '1.25rem',
    color: {
      default: tokens['--ds-gray-900'],
      ':hover': tokens['--ds-gray-1000'],
    },
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },

  linkIcon: {
    width: '1rem',
    height: '1rem',
  },
})

export interface EmptyStateProps {
  /** Icon or image to display at the top */
  icon?: ReactNode
  /** Title text */
  title: string
  /** Description text */
  description?: string
  /** Primary action button */
  action?: ReactNode
  /** Secondary link (typically "Learn more") */
  secondaryAction?: ReactNode
  /** Optional class name */
  className?: string
}

/** EmptyState displays a placeholder for empty content with optional actions */
export const EmptyState = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) => (
  <div {...styled(className, styles.root)}>
    {icon && <div {...styled(undefined, styles.iconWrapper)}>{icon}</div>}

    <div {...styled(undefined, styles.content)}>
      <div {...styled(undefined, styles.title)}>{title}</div>
      {description && <div {...styled(undefined, styles.description)}>{description}</div>}
    </div>

    {(action || secondaryAction) && (
      <div {...styled(undefined, styles.actions)}>
        {action}
        {secondaryAction}
      </div>
    )}
  </div>
)

export interface EmptyStateLinkProps {
  /** Link URL */
  href: string
  /** Link text */
  children: ReactNode
  /** Optional class name */
  className?: string
}

/** EmptyStateLink renders a styled secondary link for empty states */
export const EmptyStateLink = ({ href, children, className }: EmptyStateLinkProps) => (
  <a href={href} {...styled(className, styles.link)}>
    {children}
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...styled(undefined, styles.linkIcon)}
    >
      <path
        d="M6.5 3.5L11 8L6.5 12.5"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </a>
)
