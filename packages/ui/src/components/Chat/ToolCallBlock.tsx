/**
 * @see https://v0.app/chat - Design reference for AI chat components
 *
 * ToolCallBlock displays a tool/action call with status indicator.
 * Smart icon defaults based on name patterns.
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  Disclosure as AriaDisclosure,
  DisclosurePanel as AriaDisclosurePanel,
  Button as AriaButton,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale } from '../../foundations/tokens.stylex.ts'
import {
  EyeIcon,
  PencilIcon,
  SearchIcon,
  PlayIcon,
  SparkleIcon,
  CheckIcon,
  XCircleIcon,
  WrenchIcon,
  ChevronDownIcon,
  LoaderIcon,
} from './icons.tsx'

const spin = stylex.keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
})

const styles = stylex.create({
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    height: scale.space6,
    color: 'oklch(0.706 0 0)',
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: 'transparent',
        '@media (hover: hover)': 'oklch(0.2 0 0)',
      },
    },
    borderRadius: '0.375rem',
    boxShadow: {
      default: null,
      ':focus-visible': '0 0 0 2px oklch(0.4 0 0)',
    },
    outlineStyle: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: scale.space4,
    height: scale.space4,
    flexShrink: 0,
  },
  icon: {
    width: scale.space4,
    height: scale.space4,
    color: 'oklch(0.65 0 0)',
  },
  iconError: {
    color: 'oklch(0.628 0.258 29.234)',
  },
  iconRunning: {
    animationName: spin,
    animationDuration: '1s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
  name: {
    color: 'oklch(0.706 0 0)',
  },
  chevron: {
    width: scale.space4,
    height: scale.space4,
    color: 'oklch(0.65 0 0)',
    flexShrink: 0,
    rotate: '-90deg',
    transitionProperty: 'transform, translate, scale, rotate',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
  },
  chevronExpanded: {
    rotate: '0deg',
  },
  panel: {
    overflow: 'hidden',
    color: 'oklch(0.706 0 0)',
    fontSize: '0.875rem',
    lineHeight: 1.625,
  },
  panelContent: {
    marginLeft: scale.space2,
    paddingTop: scale.space2,
    paddingBottom: scale.space3,
    paddingLeft: scale.space6,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'oklch(0.301 0 0)',
  },
})

/** Get default icon based on tool name pattern */
const getDefaultIcon = (name: string): typeof EyeIcon => {
  const lowerName = name.toLowerCase()

  if (/^(read_|get_|fetch_)/.test(lowerName)) return EyeIcon
  if (/^(write_|create_|edit_)/.test(lowerName)) return PencilIcon
  if (/^(search_|find_|grep_)/.test(lowerName)) return SearchIcon
  if (/^(run_|execute_|bash_)/.test(lowerName)) return PlayIcon
  if (/^(think|thought)/.test(lowerName)) return SparkleIcon
  if (/^(complete|done)/.test(lowerName)) return CheckIcon
  if (/^(error|fail)/.test(lowerName)) return XCircleIcon

  return WrenchIcon
}

export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error'

export interface ToolCallBlockProps {
  /** Tool/action name */
  name: string
  /** Current status of the tool call */
  status?: ToolCallStatus
  /** Override the default icon */
  icon?: ReactNode
  /** Whether the block is expanded by default */
  defaultExpanded?: boolean
  /** Tool call details/output */
  children?: ReactNode
  /** Optional class name override */
  className?: string
  /** Caller-last root StyleX adaptation. The root owns no visual properties. */
  stylexStyle?: stylex.StyleXStyles
}

/** ToolCallBlock displays a tool/action call with status indicator */
export const ToolCallBlock = ({
  name,
  status = 'success',
  icon,
  defaultExpanded = false,
  children,
  className,
  stylexStyle,
}: ToolCallBlockProps) => {
  const DefaultIcon = getDefaultIcon(name)
  const isRunning = status === 'running'
  const isError = status === 'error'

  const renderIcon = () => {
    if (icon) return icon
    if (isRunning) {
      return <LoaderIcon {...styled(undefined, styles.icon, styles.iconRunning)} />
    }
    return <DefaultIcon {...styled(undefined, styles.icon, isError && styles.iconError)} />
  }

  return (
    <AriaDisclosure {...styled(className, stylexStyle)} defaultExpanded={defaultExpanded}>
      {({ isExpanded }) => (
        <>
          <AriaButton slot="trigger" {...styled(undefined, styles.trigger)}>
            <span {...styled(undefined, styles.iconContainer)}>{renderIcon()}</span>
            <span {...styled(undefined, styles.name)}>{name}</span>
            {children && (
              <ChevronDownIcon
                {...styled(undefined, styles.chevron, isExpanded && styles.chevronExpanded)}
              />
            )}
          </AriaButton>
          {children && (
            <AriaDisclosurePanel {...styled(undefined, styles.panel)}>
              <div {...styled(undefined, styles.panelContent)}>{children}</div>
            </AriaDisclosurePanel>
          )}
        </>
      )}
    </AriaDisclosure>
  )
}
