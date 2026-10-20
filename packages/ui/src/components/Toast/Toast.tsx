/**
 * Toast component built on React Aria
 *
 * @see https://vercel.com/geist/toast
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    maxWidth: '420px',
    // `rounded-xl` reads `--radius-xl`, which the package does not override, so
    // it resolves to the framework theme's 0.75rem. There is no scale member
    // for it, and `scale.radiusLg` is a different property at a different size.
    borderRadius: '0.75rem',
    fontSize: '1rem',
    lineHeight: '1.5rem',
    /* Default inverted colors for visibility */
    backgroundColor: tokens['--ds-gray-1000'],
    color: tokens['--ds-background-100'],
    // `shadow-lg` and `ring-1` both wrote this one element's `box-shadow`, and
    // the framework already composed them into a single value with the ring
    // layer painted over the drop shadow. StyleX has one `boxShadow` property,
    // so the layers are concatenated here in that same order. Both were
    // unconditional, so no state can drop either and the correctness rests on
    // layer order within one value, not on rule order between two.
    //
    // Measured pre-migration, the framework also emitted three placeholder
    // layers — `rgba(0, 0, 0, 0) 0px 0px 0px 0px` for the unset inset-shadow,
    // inset-ring and ring-offset slots. They have no colour and no geometry and
    // paint nothing, so they are not reproduced.
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`,
  },

  content: { flexGrow: 1, flexShrink: 1, flexBasis: '0%' },

  action: {
    flexShrink: 0,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
    color: tokens['--ds-blue-700'],
    // `hover:` compiles inside `@media (hover: hover)`, so the underline never
    // applies on pointer-less devices where `:hover` can latch. Dropping that
    // guard would be a real behaviour change on touch, so it is kept. The
    // unhovered state declares nothing, exactly as the utility did.
    textDecorationLine: {
      default: null,
      ':hover': { default: null, '@media (hover: hover)': 'underline' },
    },
    cursor: 'pointer',
  },

  dismissButton: {
    flexShrink: 0,
    padding: '0.25rem',
    margin: '-0.25rem',
    // Bare `rounded` names no custom property; it emits a literal 0.25rem.
    borderRadius: '0.25rem',
    opacity: { default: 0.6, ':hover': { default: 0.6, '@media (hover: hover)': 1 } },
    transitionProperty: 'opacity',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    cursor: 'pointer',
  },

  icon: { flexShrink: 0, width: '1.25rem', height: '1.25rem' },
  iconSuccess: { color: tokens['--ds-green-700'] },
  iconWarning: { color: tokens['--ds-amber-700'] },
  iconError: { color: tokens['--ds-red-700'] },
})

/** Semantic variants. */
export type ToastType = 'default' | 'success' | 'warning' | 'error'

export interface ToastProps {
  /** Toast message content */
  children: ReactNode
  /** Semantic variant */
  type?: ToastType | undefined
  /** Optional action element or text */
  action?: ReactNode
  /** Called when toast is dismissed */
  onDismiss?: () => void
  /** Whether to show dismiss button */
  dismissible?: boolean
  /** Optional class name */
  className?: string
}

/** Icon components for different toast types */
const SuccessIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    {...styled(undefined, styles.icon, styles.iconSuccess)}
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
)

const WarningIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    {...styled(undefined, styles.icon, styles.iconWarning)}
  >
    <path
      fillRule="evenodd"
      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
)

const ErrorIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    {...styled(undefined, styles.icon, styles.iconError)}
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
      clipRule="evenodd"
    />
  </svg>
)

const DismissIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M12.78 4.28a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72Z" />
  </svg>
)

/** A succinct message that is displayed temporarily */
export const Toast = ({
  children,
  type,
  action,
  onDismiss,
  dismissible = true,
  className,
}: ToastProps) => {
  return (
    <div role="status" aria-live="polite" {...styled(className, styles.root)}>
      {type === 'success' && <SuccessIcon />}
      {type === 'warning' && <WarningIcon />}
      {type === 'error' && <ErrorIcon />}
      <div {...styled(undefined, styles.content)}>{children}</div>
      {action && <div {...styled(undefined, styles.action)}>{action}</div>}
      {dismissible && onDismiss && (
        <AriaButton
          onPress={onDismiss}
          {...styled(undefined, styles.dismissButton)}
          aria-label="Dismiss toast"
        >
          <DismissIcon />
        </AriaButton>
      )}
    </div>
  )
}
