/**
 * Feedback component built on React Aria
 *
 * @see https://vercel.com/geist/feedback
 */

import * as stylex from '@stylexjs/stylex'
import { useState, type ReactNode } from 'react'
import {
  TextField as AriaTextField,
  TextArea as AriaTextArea,
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space3,
    padding: scale.space4,
    backgroundColor: tokens['--ds-background-100'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusLg,
  },
  rootCompact: {
    gap: scale.space2,
    padding: scale.space3,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: 1.25 / 0.875,
    fontWeight: 500,
  },
  emojiGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space1,
  },
  emojiButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: scale.space10,
    height: scale.space10,
    borderRadius: scale.radiusLg,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: {
      default: 'transparent',
      ':hover': {
        default: 'transparent',
        '@media (hover: hover)': tokens['--ds-gray-alpha-400'],
      },
    },
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: 'transparent',
        '@media (hover: hover)': tokens['--ds-gray-100'],
      },
    },
    fontSize: '1.5rem',
    lineHeight: '2rem',
    outlineStyle: 'none',
    // The Tailwind ring omitted an offset color, whose preflight default is white.
    boxShadow: {
      default: null,
      ':is([data-focus-visible])': `0 0 0 2px #fff, 0 0 0 4px ${tokens['--ds-focus-color']}`,
    },
    scale: {
      default: null,
      ':is([data-pressed])': '95%',
    },
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  emojiButtonSelected: {
    borderColor: {
      default: tokens['--ds-gray-600'],
      ':hover': {
        default: tokens['--ds-gray-600'],
        '@media (hover: hover)': tokens['--ds-gray-600'],
      },
    },
    backgroundColor: {
      default: tokens['--ds-gray-200'],
      ':hover': {
        default: tokens['--ds-gray-200'],
        '@media (hover: hover)': tokens['--ds-gray-200'],
      },
    },
  },
  emojiButtonCompact: {
    width: scale.space8,
    height: scale.space8,
    fontSize: '1.25rem',
    lineHeight: '1.75rem',
  },
  textField: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    paddingInline: scale.space3,
    paddingBlock: scale.space2,
    backgroundColor: tokens['--ds-background-100'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: {
      default: tokens['--ds-gray-alpha-400'],
      ':focus': tokens['--ds-gray-1000'],
    },
    borderRadius: scale.radiusLg,
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    outlineStyle: 'none',
    resize: 'none',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    '::placeholder': {
      color: tokens['--ds-gray-700'],
    },
  },
  textareaCompact: {
    minHeight: '60px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale.space2,
  },
  hint: {
    color: tokens['--ds-gray-700'],
    fontSize: '13px',
  },
  submitButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale.space8,
    paddingInline: scale.space3,
    borderRadius: scale.radiusDefault,
    backgroundColor: {
      default: tokens['--ds-gray-1000'],
      ':hover': {
        default: tokens['--ds-gray-1000'],
        '@media (hover: hover)': tokens['--ds-gray-900'],
      },
      ':active': tokens['--ds-gray-800'],
    },
    color: tokens['--ds-background-100'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
    outlineStyle: 'none',
    // The Tailwind ring omitted an offset color, whose preflight default is white.
    boxShadow: {
      default: null,
      ':is([data-focus-visible])': `0 0 0 2px #fff, 0 0 0 4px ${tokens['--ds-focus-color']}`,
    },
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
})

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type FeedbackOwnedStyle = OwnedStyle<
  | 'display'
  | 'flexDirection'
  | 'flexFlow'
  | 'gap'
  | 'columnGap'
  | 'rowGap'
  | 'padding'
  | 'paddingBlock'
  | 'paddingInline'
  | 'background'
  | 'backgroundColor'
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderRadius'
>

type FeedbackEmojiButtonOwnedStyle = OwnedStyle<
  | 'display'
  | 'alignItems'
  | 'justifyContent'
  | 'width'
  | 'height'
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderRadius'
  | 'background'
  | 'backgroundColor'
  | 'boxShadow'
  | 'fontSize'
  | 'lineHeight'
  | 'outline'
  | 'outlineStyle'
  | 'cursor'
  | 'scale'
  | 'transition'
  | 'transitionProperty'
  | 'transitionTimingFunction'
  | 'transitionDuration'
>

/** Default emoji options */
const defaultEmojis = [
  { value: 'sad', emoji: '😞', label: 'Sad' },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'happy', emoji: '😊', label: 'Happy' },
  { value: 'excited', emoji: '🤩', label: 'Excited' },
]

export interface FeedbackEmoji {
  /** Unique value identifier */
  value: string
  /** Emoji character */
  emoji: string
  /** Accessible label */
  label: string
}

export interface FeedbackProps {
  /** Header/title text */
  title?: string
  /** Placeholder text for the textarea */
  placeholder?: string
  /** Hint text shown in footer */
  hint?: string
  /** Submit button text */
  submitText?: string
  /** Custom emoji options */
  emojis?: FeedbackEmoji[]
  /** Currently selected emoji value */
  selectedEmoji?: string
  /** Callback when emoji is selected */
  onEmojiChange?: (value: string) => void
  /** Callback when feedback text changes */
  onTextChange?: (value: string) => void
  /** Callback when feedback is submitted */
  onSubmit?: (data: { emoji: string | undefined; text: string }) => void
  /** Current text value (controlled) */
  textValue?: string
  /** Whether the submit button is disabled */
  isSubmitDisabled?: boolean
  /** Whether the component is in loading state */
  isLoading?: boolean
  /** Additional content in the header */
  headerContent?: ReactNode
  /** Whether the component uses compact spacing and controls */
  compact?: boolean | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned presentation is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<FeedbackOwnedStyle>
}

/** Feedback widget for collecting user sentiment and comments */
export const Feedback = ({
  title,
  placeholder = 'Your feedback...',
  hint,
  submitText = 'Send',
  emojis = defaultEmojis,
  selectedEmoji,
  onEmojiChange,
  onTextChange,
  onSubmit,
  textValue,
  isSubmitDisabled,
  isLoading,
  headerContent,
  compact = false,
  className,
  stylexStyle,
}: FeedbackProps) => {
  const [internalText, setInternalText] = useState('')
  const [internalEmoji, setInternalEmoji] = useState<string | undefined>()

  const currentText = textValue ?? internalText
  const currentEmoji = selectedEmoji ?? internalEmoji

  const handleEmojiSelect = (value: string) => {
    const newValue = currentEmoji === value ? undefined : value
    if (onEmojiChange) {
      onEmojiChange(newValue ?? '')
    } else {
      setInternalEmoji(newValue)
    }
  }

  const handleTextChange = (value: string) => {
    if (onTextChange) {
      onTextChange(value)
    } else {
      setInternalText(value)
    }
  }

  const handleSubmit = () => {
    onSubmit?.({ emoji: currentEmoji, text: currentText })
  }

  return (
    <div {...styled(className, styles.root, compact && styles.rootCompact, stylexStyle)}>
      {(title ?? headerContent) && (
        <div {...styled(undefined, styles.header)}>
          {title && <span>{title}</span>}
          {headerContent}
        </div>
      )}

      <div {...styled(undefined, styles.emojiGroup)}>
        {emojis.map((item) => {
          const isSelected = currentEmoji === item.value

          return (
            <AriaButton
              key={item.value}
              {...styled(
                undefined,
                styles.emojiButton,
                compact && styles.emojiButtonCompact,
                isSelected && styles.emojiButtonSelected,
              )}
              aria-label={item.label}
              data-selected={isSelected}
              onPress={() => handleEmojiSelect(item.value)}
            >
              {item.emoji}
            </AriaButton>
          )
        })}
      </div>

      <AriaTextField
        {...styled(undefined, styles.textField)}
        value={currentText}
        onChange={handleTextChange}
      >
        <AriaTextArea
          {...styled(undefined, styles.textarea, compact && styles.textareaCompact)}
          placeholder={placeholder}
        />
      </AriaTextField>

      <div {...styled(undefined, styles.footer)}>
        {hint && <span {...styled(undefined, styles.hint)}>{hint}</span>}
        <AriaButton
          {...styled(undefined, styles.submitButton)}
          isDisabled={isSubmitDisabled ?? (!currentText.trim() && !currentEmoji)}
          onPress={handleSubmit}
        >
          {isLoading ? 'Sending...' : submitText}
        </AriaButton>
      </div>
    </div>
  )
}

export interface FeedbackEmojiButtonProps extends Omit<AriaButtonProps, 'children' | 'className'> {
  /** Emoji character */
  emoji: string
  /** Accessible label */
  label: string
  /** Whether selected */
  isSelected?: boolean
  /** Whether the button uses compact dimensions */
  compact?: boolean | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned presentation is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<FeedbackEmojiButtonOwnedStyle>
}

/** Standalone emoji button for custom feedback layouts */
export const FeedbackEmojiButton = ({
  emoji,
  label,
  isSelected,
  compact = false,
  className,
  style,
  stylexStyle,
  ...props
}: FeedbackEmojiButtonProps) => (
  <AriaButton
    {...styled(
      { className, style },
      styles.emojiButton,
      compact && styles.emojiButtonCompact,
      isSelected && styles.emojiButtonSelected,
      stylexStyle,
    )}
    aria-label={label}
    data-selected={isSelected}
    {...props}
  >
    {emoji}
  </AriaButton>
)
