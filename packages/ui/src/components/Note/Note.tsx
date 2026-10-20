/**
 * Note component built on React Aria
 *
 * @see https://vercel.com/geist/note
 */

import * as stylex from '@stylexjs/stylex'

import { styled, type StyledProps } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    borderRadius: '6px',
    // Every `variant` carried `border` alongside its colour, and `variant` is
    // always one of the seven below, so the width and style are unconditional.
    // Tailwind's preflight supplied `solid`; StyleX has to say it.
    borderWidth: '1px',
    borderStyle: 'solid',
    color: tokens['--ds-gray-900'],
  },

  default: { borderColor: tokens['--ds-gray-400'] },
  success: { borderColor: tokens['--ds-blue-700'] },
  error: { borderColor: tokens['--ds-red-700'] },
  warning: { borderColor: tokens['--ds-amber-700'] },
  secondary: { borderColor: tokens['--ds-gray-400'] },
  violet: { borderColor: tokens['--ds-purple-700'] },
  cyan: { borderColor: tokens['--ds-teal-700'] },

  sm: {
    paddingInline: '0.5rem',
    paddingBlock: '0.375rem',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  md: {
    paddingInline: '0.75rem',
    paddingBlock: '0.5rem',
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  lg: {
    paddingInline: '0.75rem',
    paddingBlock: '11px',
    fontSize: '1rem',
    lineHeight: 1.5,
  },

  // `fill: false`. The filled styles below are the former compound variants;
  // they are passed after the colour variant so their `borderColor` wins, the
  // same last-wins that `tv()` gave `compoundVariants`. Both sides are plain
  // unconditioned declarations, so this is StyleX's documented argument order
  // and not the conditional-priority ordering.
  unfilled: { backgroundColor: 'transparent' },

  filledDefault: { backgroundColor: tokens['--ds-gray-100'], borderColor: 'transparent' },
  filledSuccess: { backgroundColor: tokens['--ds-blue-100'], borderColor: tokens['--ds-blue-200'] },
  filledError: { backgroundColor: tokens['--ds-red-100'], borderColor: tokens['--ds-red-200'] },
  filledWarning: {
    backgroundColor: tokens['--ds-amber-100'],
    borderColor: tokens['--ds-amber-200'],
  },
  filledSecondary: { backgroundColor: tokens['--ds-gray-alpha-100'], borderColor: 'transparent' },
  filledViolet: {
    backgroundColor: tokens['--ds-purple-100'],
    borderColor: tokens['--ds-purple-200'],
  },
  filledCyan: { backgroundColor: tokens['--ds-teal-100'], borderColor: tokens['--ds-teal-200'] },

  content: { flexGrow: 1, flexShrink: 1, flexBasis: '0%' },

  icon: { flexShrink: 0, height: '1rem', width: '1rem' },

  iconDefault: { color: tokens['--ds-gray-900'] },
  iconSuccess: { color: tokens['--ds-blue-900'] },
  iconError: { color: tokens['--ds-red-900'] },
  iconWarning: { color: tokens['--ds-amber-900'] },
  iconSecondary: { color: tokens['--ds-gray-900'] },
  iconViolet: { color: tokens['--ds-purple-900'] },
  iconCyan: { color: tokens['--ds-teal-900'] },

  iconSm: { marginTop: '1px' },
  iconMd: { marginTop: '0.125rem' },
  iconLg: { marginTop: '0.25rem' },
})

/** Semantic variants. */
export type NoteVariant =
  | 'default'
  | 'success'
  | 'error'
  | 'warning'
  | 'secondary'
  | 'violet'
  | 'cyan'

/** Size variants. */
export type NoteSize = 'sm' | 'md' | 'lg'

const filled: Record<NoteVariant, stylex.StyleXStyles> = {
  default: styles.filledDefault,
  success: styles.filledSuccess,
  error: styles.filledError,
  warning: styles.filledWarning,
  secondary: styles.filledSecondary,
  violet: styles.filledViolet,
  cyan: styles.filledCyan,
}

const iconColor: Record<NoteVariant, stylex.StyleXStyles> = {
  default: styles.iconDefault,
  success: styles.iconSuccess,
  error: styles.iconError,
  warning: styles.iconWarning,
  secondary: styles.iconSecondary,
  violet: styles.iconViolet,
  cyan: styles.iconCyan,
}

const iconOffset: Record<NoteSize, stylex.StyleXStyles> = {
  sm: styles.iconSm,
  md: styles.iconMd,
  lg: styles.iconLg,
}

export interface NoteProps {
  variant?: NoteVariant | undefined
  size?: NoteSize | undefined
  /** Paint a tinted background instead of a transparent one */
  fill?: boolean | undefined
  children: React.ReactNode
  /** Optional class name override */
  className?: string
  /** Custom icon element */
  icon?: React.ReactNode
  /** Hide the default icon */
  hideIcon?: boolean
}

/** Default info icon */
const InfoIcon = (props: StyledProps) => (
  <svg {...props} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1ZM7.25 11V7H8.75V11H7.25ZM7.25 5V6.5H8.75V5H7.25Z"
    />
  </svg>
)

/** Success/check icon */
const SuccessIcon = (props: StyledProps) => (
  <svg {...props} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1ZM11.7071 6.70711L7.70711 10.7071C7.31658 11.0976 6.68342 11.0976 6.29289 10.7071L4.29289 8.70711L5.70711 7.29289L7 8.58579L10.2929 5.29289L11.7071 6.70711Z"
    />
  </svg>
)

/** Error/X icon */
const ErrorIcon = (props: StyledProps) => (
  <svg {...props} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1ZM5.70711 5.29289L8 7.58579L10.2929 5.29289L11.7071 6.70711L9.41421 9L11.7071 11.2929L10.2929 12.7071L8 10.4142L5.70711 12.7071L4.29289 11.2929L6.58579 9L4.29289 6.70711L5.70711 5.29289Z"
    />
  </svg>
)

/** Warning/triangle icon */
const WarningIcon = (props: StyledProps) => (
  <svg {...props} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.89643 1.44722C8.52518 0.705112 7.47483 0.705117 7.10358 1.44722L0.103577 15.4472C-0.228669 16.1114 0.247056 16.9 1.00001 16.9H15C15.753 16.9 16.2287 16.1114 15.8964 15.4472L8.89643 1.44722ZM7.25 11V7H8.75V11H7.25ZM7.25 13V14.5H8.75V13H7.25Z"
    />
  </svg>
)

const getDefaultIcon = (variant: NoteVariant, iconProps: StyledProps) => {
  switch (variant) {
    case 'success':
      return <SuccessIcon {...iconProps} />
    case 'error':
      return <ErrorIcon {...iconProps} />
    case 'warning':
      return <WarningIcon {...iconProps} />
    default:
      return <InfoIcon {...iconProps} />
  }
}

/** Note for displaying informational messages with semantic variants */
export const Note = ({
  children,
  variant = 'default',
  size = 'md',
  fill = false,
  icon,
  hideIcon,
  className,
}: NoteProps) => {
  const iconProps = styled(undefined, styles.icon, iconColor[variant], iconOffset[size])

  return (
    <div
      {...styled(
        className,
        styles.base,
        styles[variant],
        styles[size],
        fill ? filled[variant] : styles.unfilled,
      )}
      role="note"
    >
      {!hideIcon && (icon ?? getDefaultIcon(variant, iconProps))}
      <div {...styled(undefined, styles.content)}>{children}</div>
    </div>
  )
}
