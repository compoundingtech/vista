/**
 * Textarea component built on React Aria
 *
 * @see https://vercel.com/geist/textarea
 */

import * as stylex from '@stylexjs/stylex'
import {
  TextField as AriaTextField,
  TextArea as AriaTextArea,
  Label as AriaLabel,
  Text as AriaText,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  label: {
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    paddingInline: scale.space3,
    paddingBlock: '0.625rem',
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':disabled': tokens['--ds-gray-100'],
    },
    boxShadow: {
      default: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
      ':focus': `0 0 0 1px ${tokens['--ds-gray-900']}, 0 0 0 4px ${tokens['--ds-gray-alpha-400']}`,
    },
    borderRadius: scale.radiusDefault,
    color: {
      default: tokens['--ds-gray-1000'],
      ':disabled': tokens['--ds-gray-700'],
    },
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    transitionProperty: 'box-shadow',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    outlineStyle: 'none',
    cursor: {
      default: null,
      ':disabled': 'not-allowed',
    },
    '::placeholder': {
      color: tokens['--ds-gray-700'],
    },
  },
  textareaInvalid: {
    boxShadow: {
      default: `0 0 0 1px ${tokens['--ds-red-700']}`,
      // The invalid utility followed focus in the Tailwind baseline, so the
      // red border remains the winner while an invalid textarea is focused.
      ':focus': `0 0 0 1px ${tokens['--ds-red-700']}`,
    },
  },
  resizeNone: {
    resize: 'none',
  },
  resizeVertical: {
    resize: 'vertical',
  },
  resizeHorizontal: {
    resize: 'horizontal',
  },
  resizeBoth: {
    resize: 'both',
  },
  error: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: scale.space2,
    color: tokens['--ds-red-700'],
    fontSize: '13px',
    lineHeight: '1.25rem',
  },
  errorIcon: {
    width: scale.space4,
    height: scale.space4,
    flexShrink: 0,
  },
})

type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both'

const resizeStyles: Record<TextareaResize, stylex.StyleXStyles> = {
  none: styles.resizeNone,
  vertical: styles.resizeVertical,
  horizontal: styles.resizeHorizontal,
  both: styles.resizeBoth,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type TextareaOwnedStyle = OwnedStyle<
  'display' | 'flexDirection' | 'flexFlow' | 'gap' | 'columnGap' | 'rowGap'
>

/** Error icon for validation messages */
const ErrorIcon = () => (
  <svg
    {...styled(undefined, styles.errorIcon)}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1ZM7.25 11V9.5H8.75V11H7.25ZM7.25 5V8H8.75V5H7.25Z"
    />
  </svg>
)

export interface TextareaProps extends Omit<AriaTextFieldProps, 'children'> {
  /** Label text */
  label?: string
  /** Placeholder text */
  placeholder?: string
  /** Error message */
  errorMessage?: string
  /** Resize behavior */
  resize?: TextareaResize | undefined
  /** Number of visible rows */
  rows?: number
  /** Optional class name override */
  className?: string
  /** Caller-last root layout adaptation. Component-owned layout is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<TextareaOwnedStyle>
}

/** Multi-line text input for retrieving longer text from a user */
export const Textarea = ({
  label,
  placeholder,
  errorMessage,
  resize = 'none',
  rows,
  className,
  style,
  stylexStyle,
  ...props
}: TextareaProps) => {
  const hasError = !!errorMessage

  return (
    <AriaTextField
      {...styled({ className, style }, styles.root, stylexStyle)}
      isInvalid={hasError}
      {...props}
    >
      {label && <AriaLabel {...styled(undefined, styles.label)}>{label}</AriaLabel>}
      <AriaTextArea
        {...styled(
          undefined,
          styles.textarea,
          resizeStyles[resize],
          hasError && styles.textareaInvalid,
        )}
        placeholder={placeholder}
        rows={rows}
        data-invalid={hasError || undefined}
      />
      {hasError && (
        <AriaText slot="errorMessage" {...styled(undefined, styles.error)}>
          <ErrorIcon />
          {errorMessage}
        </AriaText>
      )}
    </AriaTextField>
  )
}
