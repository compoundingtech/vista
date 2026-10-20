/**
 * @see https://v0.app/chat - Design reference for AI chat components
 *
 * FeedbackButtons provides upvote/downvote functionality for messages.
 */

import * as stylex from '@stylexjs/stylex'

import { styled } from '../../foundations/props.ts'
import { scale } from '../../foundations/tokens.stylex.ts'
import { ThumbsUpIcon, ThumbsDownIcon } from './icons.tsx'

const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space1,
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: scale.space6,
    height: scale.space6,
    borderRadius: '0.375rem',
    color: 'oklch(0.706 0 0)',
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: 'transparent',
        '@media (hover: hover)': 'oklch(0.2 0 0)',
      },
    },
    boxShadow: {
      default: null,
      ':focus-visible': '0 0 0 2px oklch(0.4 0 0)',
    },
    outlineStyle: 'none',
    cursor: {
      default: 'pointer',
      ':disabled': 'not-allowed',
    },
    opacity: {
      default: 1,
      ':disabled': 0.5,
    },
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  buttonSelected: {
    color: 'oklch(0.946 0 0)',
    backgroundColor: 'oklch(0.2 0 0)',
  },
  icon: {
    width: scale.space4,
    height: scale.space4,
  },
})

type FeedbackButtonsOwnedStyle = Record<
  'display' | 'alignItems' | 'gap' | 'columnGap' | 'rowGap',
  string
>

export type FeedbackValue = 'up' | 'down' | null

export interface FeedbackButtonsProps {
  /** Called when upvote is clicked */
  onUpvote: () => void
  /** Called when downvote is clicked */
  onDownvote: () => void
  /** Current feedback value */
  value?: FeedbackValue
  /** Whether buttons are disabled */
  disabled?: boolean
  /** Optional class name override */
  className?: string
  /** Caller-last root StyleX adaptation. Component-owned layout is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<FeedbackButtonsOwnedStyle>
}

/** FeedbackButtons provides upvote/downvote functionality for messages */
export const FeedbackButtons = ({
  onUpvote,
  onDownvote,
  value,
  disabled = false,
  className,
  stylexStyle,
}: FeedbackButtonsProps) => {
  const isUpvoted = value === 'up'
  const isDownvoted = value === 'down'

  return (
    <div {...styled(className, styles.root, stylexStyle)}>
      <button
        type="button"
        {...styled(undefined, styles.button, isUpvoted && styles.buttonSelected)}
        onClick={onUpvote}
        disabled={disabled}
        aria-label="Upvote"
        aria-pressed={isUpvoted}
      >
        <ThumbsUpIcon {...styled(undefined, styles.icon)} />
      </button>
      <button
        type="button"
        {...styled(undefined, styles.button, isDownvoted && styles.buttonSelected)}
        onClick={onDownvote}
        disabled={disabled}
        aria-label="Downvote"
        aria-pressed={isDownvoted}
      >
        <ThumbsDownIcon {...styled(undefined, styles.icon)} />
      </button>
    </div>
  )
}
