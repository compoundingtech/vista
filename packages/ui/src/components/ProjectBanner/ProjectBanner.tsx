/**
 * ProjectBanner component built on React Aria
 *
 * @see https://vercel.com/geist/project-banner
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled, type StyledProps } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInline: '1rem',
    paddingBlock: '0.75rem',
    // `rounded-lg` reads `--radius-lg`, which the package overrides, so the
    // scale member is the same custom property rather than an equal value.
    borderRadius: scale.radiusLg,
    borderWidth: '1px',
    borderStyle: 'solid',
  },
  content: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  icon: { flexShrink: 0, width: '1.25rem', height: '1.25rem' },
  text: { display: 'flex', flexDirection: 'column' },
  title: { fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: 500 },
  description: { fontSize: '0.75rem', lineHeight: '1rem', color: tokens['--ds-gray-1000'] },
  actions: { display: 'flex', alignItems: 'center', gap: '0.5rem' },

  rootDefault: {
    backgroundColor: tokens['--ds-background-100'],
    borderColor: tokens['--ds-gray-alpha-400'],
  },
  iconDefault: { color: tokens['--ds-gray-900'] },
  titleDefault: { color: tokens['--ds-gray-1000'] },

  rootSuccess: {
    backgroundColor: tokens['--ds-green-100'],
    borderColor: tokens['--ds-green-400'],
  },
  iconSuccess: { color: tokens['--ds-green-700'] },
  titleSuccess: { color: tokens['--ds-green-900'] },

  rootWarning: {
    backgroundColor: tokens['--ds-amber-100'],
    borderColor: tokens['--ds-amber-400'],
  },
  iconWarning: { color: tokens['--ds-amber-700'] },
  titleWarning: { color: tokens['--ds-amber-900'] },

  rootError: {
    backgroundColor: tokens['--ds-red-100'],
    borderColor: tokens['--ds-red-400'],
  },
  iconError: { color: tokens['--ds-red-700'] },
  titleError: { color: tokens['--ds-red-900'] },

  rootBuilding: {
    backgroundColor: tokens['--ds-blue-100'],
    borderColor: tokens['--ds-blue-400'],
  },
  iconBuilding: { color: tokens['--ds-blue-700'] },
  titleBuilding: { color: tokens['--ds-blue-900'] },
})

/** Status variants. */
export type ProjectBannerVariant = 'default' | 'success' | 'warning' | 'error' | 'building'

const rootVariantStyles = {
  default: styles.rootDefault,
  success: styles.rootSuccess,
  warning: styles.rootWarning,
  error: styles.rootError,
  building: styles.rootBuilding,
} as const

const iconVariantStyles = {
  default: styles.iconDefault,
  success: styles.iconSuccess,
  warning: styles.iconWarning,
  error: styles.iconError,
  building: styles.iconBuilding,
} as const

const titleVariantStyles = {
  default: styles.titleDefault,
  success: styles.titleSuccess,
  warning: styles.titleWarning,
  error: styles.titleError,
  building: styles.titleBuilding,
} as const

export interface ProjectBannerProps {
  /** Banner title */
  title: string
  /** Banner description */
  description?: string
  /** Custom icon element */
  icon?: ReactNode
  /** Status variant */
  variant?: ProjectBannerVariant | undefined
  /** Action buttons */
  actions?: ReactNode
  /** Optional class name */
  className?: string
}

const DefaultIcon = (props: StyledProps) => (
  <svg {...props} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
      clipRule="evenodd"
    />
  </svg>
)

const SuccessIcon = (props: StyledProps) => (
  <svg {...props} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
)

const WarningIcon = (props: StyledProps) => (
  <svg {...props} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
)

const ErrorIcon = (props: StyledProps) => (
  <svg {...props} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
      clipRule="evenodd"
    />
  </svg>
)

/** ProjectBanner displays deployment/project status information */
export const ProjectBanner = ({
  title,
  description,
  icon,
  variant = 'default',
  actions,
  className,
}: ProjectBannerProps) => {
  const iconProps = styled(undefined, styles.icon, iconVariantStyles[variant])

  const defaultIcons: Record<ProjectBannerVariant, ReactNode> = {
    default: <DefaultIcon {...iconProps} />,
    success: <SuccessIcon {...iconProps} />,
    warning: <WarningIcon {...iconProps} />,
    error: <ErrorIcon {...iconProps} />,
    building: <DefaultIcon {...iconProps} />,
  }

  const iconElement = icon ?? defaultIcons[variant]

  return (
    <div {...styled(className, styles.root, rootVariantStyles[variant])}>
      <div {...styled(undefined, styles.content)}>
        {iconElement}
        <div {...styled(undefined, styles.text)}>
          <span {...styled(undefined, styles.title, titleVariantStyles[variant])}>{title}</span>
          {description && <span {...styled(undefined, styles.description)}>{description}</span>}
        </div>
      </div>
      {actions && <div {...styled(undefined, styles.actions)}>{actions}</div>}
    </div>
  )
}
