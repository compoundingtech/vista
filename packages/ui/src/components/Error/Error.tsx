/**
 * Error component built on React Aria
 *
 * @see https://vercel.com/geist/error
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'flex',
    alignItems: 'flex-start',
    color: tokens['--ds-red-900'],
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: '0.5rem',
    marginTop: '0.125rem',
  },
  icon: {
    width: '1rem',
    height: '1rem',
  },
  label: {
    fontWeight: 500,
    marginRight: '0.5rem',
  },

  // Every size pairs a `text-*` with an explicit `leading-*`, and the explicit
  // value won: `text-sm` emits `line-height: var(--tw-leading, …)` and
  // `leading-5` is what set `--tw-leading`. So only the `leading-*` value is
  // carried over, and the size's own default line-height never applied.
  rootSmall: { fontSize: '13px', lineHeight: '1.25rem' },
  rootDefault: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  rootLarge: { fontSize: '1rem', lineHeight: '1.5rem' },

  // `small` and `default` restate the base `mt-0.5`; only `large` differs.
  iconWrapperSmall: { marginTop: '0.125rem' },
  iconWrapperDefault: { marginTop: '0.125rem' },
  iconWrapperLarge: { marginTop: '0.25rem' },
})

const rootSize = {
  small: styles.rootSmall,
  default: styles.rootDefault,
  large: styles.rootLarge,
} as const

const iconWrapperSize = {
  small: styles.iconWrapperSmall,
  default: styles.iconWrapperDefault,
  large: styles.iconWrapperLarge,
} as const

/** Size variants. */
export type ErrorSize = 'small' | 'default' | 'large'

export interface ErrorProps {
  /** Size variant */
  size?: ErrorSize | undefined
  /** Error message content */
  children: ReactNode
  /** Optional label prefix (e.g., "Email Error:") */
  label?: string
  /** Hide the error icon */
  hideIcon?: boolean
  /** Optional class name */
  className?: string
}

/** Error displays an error message with an icon */
export const Error = ({
  children,
  label,
  hideIcon = false,
  size = 'default',
  className,
}: ErrorProps) => (
  <div role="alert" {...styled(className, styles.root, rootSize[size])}>
    {!hideIcon && (
      <div {...styled(undefined, styles.iconWrapper, iconWrapperSize[size])}>
        <svg viewBox="0 0 16 16" fill="currentColor" {...styled(undefined, styles.icon)}>
          <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.146.146 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 0 1-.054.06.116.116 0 0 1-.066.017H1.146a.115.115 0 0 1-.066-.017.163.163 0 0 1-.054-.06.176.176 0 0 1 .002-.183L7.884 2.073a.147.147 0 0 1 .054-.057zm1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z" />
          <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995z" />
        </svg>
      </div>
    )}
    {/* The `content` slot declared no utilities and rendered `class=""`. */}
    <div>
      {label && <span {...styled(undefined, styles.label)}>{label}</span>}
      {children}
    </div>
  </div>
)
