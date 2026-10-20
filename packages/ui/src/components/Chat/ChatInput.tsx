/**
 * @see https://v0.app/chat - Design reference for AI chat components
 *
 * ChatInput is a multi-line text input for chat messages.
 * Supports Cmd/Ctrl+Enter to submit.
 */

import * as stylex from '@stylexjs/stylex'
import { useCallback, type KeyboardEvent, type ChangeEvent } from 'react'

import { styled } from '../../foundations/props.ts'
import { scale } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    position: 'relative',
  },
  textarea: {
    width: '100%',
    minHeight: '48px',
    padding: scale.space3,
    backgroundColor: 'oklch(0.145 0 0)',
    color: 'oklch(0.946 0 0)',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'oklch(0.301 0 0)',
    borderRadius: scale.radiusLg,
    resize: 'none',
    outlineStyle: 'none',
    boxShadow: {
      default: null,
      ':focus': '0 0 0 1px oklch(0.4 0 0)',
    },
    opacity: {
      default: 1,
      ':disabled': 0.5,
    },
    cursor: {
      default: null,
      ':disabled': 'not-allowed',
    },
    transitionProperty: 'box-shadow',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    '::placeholder': {
      color: 'oklch(0.5 0 0)',
    },
  },
})

type ChatInputOwnedStyle = Record<'position', string>

export interface ChatInputProps {
  /** Current input value */
  value: string
  /** Called when input value changes */
  onChange: (value: string) => void
  /** Called when user submits (Cmd/Ctrl+Enter or Enter without Shift) */
  onSubmit: () => void
  /** Placeholder text */
  placeholder?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /** Number of visible rows */
  rows?: number
  /** Optional class name override */
  className?: string
  /** Caller-last root StyleX adaptation. Component-owned positioning is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ChatInputOwnedStyle>
}

/** ChatInput is a multi-line text input for chat messages */
export const ChatInput = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  rows = 1,
  className,
  stylexStyle,
}: ChatInputProps) => {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
    },
    [onChange],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const isSubmitShortcut = (e.metaKey || e.ctrlKey) && e.key === 'Enter'
      const isEnterWithoutShift = e.key === 'Enter' && !e.shiftKey

      if (isSubmitShortcut || isEnterWithoutShift) {
        e.preventDefault()
        if (!disabled && value.trim()) {
          onSubmit()
        }
      }
    },
    [disabled, value, onSubmit],
  )

  return (
    <div {...styled(className, styles.root, stylexStyle)}>
      <textarea
        {...styled(undefined, styles.textarea)}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        aria-label={placeholder}
      />
    </div>
  )
}
