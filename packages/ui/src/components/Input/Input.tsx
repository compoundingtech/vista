/**
 * Input component built on React Aria
 *
 * @see https://vercel.com/geist/input
 */

import * as stylex from '@stylexjs/stylex'
import {
  TextField as AriaTextField,
  Input as AriaInput,
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
  wrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':is([data-disabled])': tokens['--ds-gray-100'],
    },
    boxShadow: {
      default: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
      ':focus-within': `0 0 0 1px ${tokens['--ds-gray-900']}, 0 0 0 4px ${tokens['--ds-gray-alpha-400']}`,
    },
    cursor: {
      default: null,
      ':is([data-disabled])': 'not-allowed',
    },
    transitionProperty: 'box-shadow',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  wrapperInvalid: {
    boxShadow: {
      default: null,
      ':is([data-invalid])': `0 0 0 1px ${tokens['--ds-red-700']}`,
      // Invalid wins over focus-within in the Tailwind baseline. Repeating the
      // same condition lets argument order preserve that overlap deterministically.
      ':focus-within': `0 0 0 1px ${tokens['--ds-red-700']}`,
    },
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    width: '100%',
    backgroundColor: 'transparent',
    color: {
      default: tokens['--ds-gray-1000'],
      ':disabled': tokens['--ds-gray-700'],
    },
    cursor: {
      default: null,
      ':disabled': 'not-allowed',
    },
    outlineStyle: 'none',
    '::placeholder': {
      color: tokens['--ds-gray-700'],
    },
  },
  inputWithPrefixIcon: {
    paddingLeft: 0,
  },
  inputWithSuffixIcon: {
    paddingRight: 0,
  },
  label: {
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
  },
  prefix: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: tokens['--ds-gray-700'],
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-100'],
  },
  suffix: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: tokens['--ds-gray-700'],
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-100'],
  },
  prefixIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: tokens['--ds-gray-700'],
  },
  suffixIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: tokens['--ds-gray-700'],
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    color: tokens['--ds-red-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  errorIcon: {
    width: '1rem',
    height: '1rem',
    flexShrink: 0,
  },
  wrapperXs: {
    height: '1.5rem',
    borderRadius: '6px',
  },
  wrapperSm: {
    height: scale.formHeightSm,
    borderRadius: '6px',
  },
  wrapperMd: {
    height: scale.formHeightMd,
    borderRadius: '6px',
  },
  wrapperLg: {
    height: scale.formHeightLg,
    borderRadius: '8px',
  },
  inputXs: {
    height: '1.5rem',
    paddingInline: '0.375rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  inputSm: {
    height: scale.formHeightSm,
    paddingInline: scale.space3,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  inputMd: {
    height: scale.formHeightMd,
    paddingInline: scale.space3,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  inputLg: {
    height: scale.formHeightLg,
    paddingInline: scale.space3,
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
  prefixXs: {
    height: '1.5rem',
    paddingInline: '0.375rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
    borderTopLeftRadius: '6px',
    borderBottomLeftRadius: '6px',
  },
  prefixSm: {
    height: scale.formHeightSm,
    paddingInline: scale.space3,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    borderTopLeftRadius: '6px',
    borderBottomLeftRadius: '6px',
  },
  prefixMd: {
    height: scale.formHeightMd,
    paddingInline: scale.space3,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    borderTopLeftRadius: '6px',
    borderBottomLeftRadius: '6px',
  },
  prefixLg: {
    height: scale.formHeightLg,
    paddingInline: scale.space3,
    fontSize: '1rem',
    lineHeight: '1.5rem',
    borderTopLeftRadius: '8px',
    borderBottomLeftRadius: '8px',
  },
  suffixXs: {
    height: '1.5rem',
    paddingInline: '0.375rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
    borderTopRightRadius: '6px',
    borderBottomRightRadius: '6px',
  },
  suffixSm: {
    height: scale.formHeightSm,
    paddingInline: scale.space3,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    borderTopRightRadius: '6px',
    borderBottomRightRadius: '6px',
  },
  suffixMd: {
    height: scale.formHeightMd,
    paddingInline: scale.space3,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    borderTopRightRadius: '6px',
    borderBottomRightRadius: '6px',
  },
  suffixLg: {
    height: scale.formHeightLg,
    paddingInline: scale.space3,
    fontSize: '1rem',
    lineHeight: '1.5rem',
    borderTopRightRadius: '8px',
    borderBottomRightRadius: '8px',
  },
  iconXs: {
    width: '1.5rem',
    height: '1.5rem',
  },
  iconSm: {
    width: scale.formHeightSm,
    height: scale.formHeightSm,
  },
  iconMd: {
    width: scale.formHeightMd,
    height: scale.formHeightMd,
  },
  iconLg: {
    width: scale.formHeightLg,
    height: scale.formHeightLg,
  },
})

/** Available Input sizes. */
export type InputSize = 'xs' | 'sm' | 'md' | 'lg'

const wrapperSizeStyles = {
  xs: styles.wrapperXs,
  sm: styles.wrapperSm,
  md: styles.wrapperMd,
  lg: styles.wrapperLg,
} as const

const inputSizeStyles = {
  xs: styles.inputXs,
  sm: styles.inputSm,
  md: styles.inputMd,
  lg: styles.inputLg,
} as const

const prefixSizeStyles = {
  xs: styles.prefixXs,
  sm: styles.prefixSm,
  md: styles.prefixMd,
  lg: styles.prefixLg,
} as const

const suffixSizeStyles = {
  xs: styles.suffixXs,
  sm: styles.suffixSm,
  md: styles.suffixMd,
  lg: styles.suffixLg,
} as const

const iconSizeStyles = {
  xs: styles.iconXs,
  sm: styles.iconSm,
  md: styles.iconMd,
  lg: styles.iconLg,
} as const

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type InputOwnedStyle = OwnedStyle<
  'display' | 'flexDirection' | 'flexFlow' | 'gap' | 'columnGap' | 'rowGap'
>

export interface InputProps extends Omit<AriaTextFieldProps, 'children' | 'style'> {
  /** Label text */
  label?: string
  /** Placeholder text */
  placeholder?: string
  /** Prefix text (e.g., "https://") */
  prefix?: string
  /** Suffix text (e.g., ".com") */
  suffix?: string
  /** Prefix icon element */
  prefixIcon?: React.ReactNode
  /** Suffix icon element */
  suffixIcon?: React.ReactNode
  /** Error message */
  errorMessage?: string
  /** Visual size */
  size?: InputSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root layout adaptation. Component-owned layout is constrained. */
  style?: stylex.StyleXStylesWithout<InputOwnedStyle>
}

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

/** Text input field for retrieving text from a user */
export const Input = ({
  label,
  placeholder,
  prefix,
  suffix,
  prefixIcon,
  suffixIcon,
  errorMessage,
  size = 'md',
  className,
  style,
  ...props
}: InputProps) => {
  const hasError = !!errorMessage
  const hasPrefix = !!prefix || !!prefixIcon
  const hasSuffix = !!suffix || !!suffixIcon

  return (
    <AriaTextField {...styled(className, styles.root, style)} isInvalid={hasError} {...props}>
      {label && <AriaLabel {...styled(undefined, styles.label)}>{label}</AriaLabel>}
      <div
        {...styled(
          undefined,
          styles.wrapper,
          hasError && styles.wrapperInvalid,
          wrapperSizeStyles[size],
        )}
        data-disabled={props.isDisabled || undefined}
        data-invalid={hasError || undefined}
      >
        {prefix && (
          <span {...styled(undefined, styles.prefix, prefixSizeStyles[size])}>{prefix}</span>
        )}
        {prefixIcon && !prefix && (
          <span {...styled(undefined, styles.prefixIcon, iconSizeStyles[size])}>{prefixIcon}</span>
        )}
        <AriaInput
          {...styled(
            undefined,
            styles.input,
            inputSizeStyles[size],
            hasPrefix && !prefix && styles.inputWithPrefixIcon,
            hasSuffix && !suffix && styles.inputWithSuffixIcon,
          )}
          {...(placeholder !== undefined && { placeholder })}
        />
        {suffix && (
          <span {...styled(undefined, styles.suffix, suffixSizeStyles[size])}>{suffix}</span>
        )}
        {suffixIcon && !suffix && (
          <span {...styled(undefined, styles.suffixIcon, iconSizeStyles[size])}>{suffixIcon}</span>
        )}
      </div>
      {hasError && (
        <AriaText slot="errorMessage" {...styled(undefined, styles.error)}>
          <ErrorIcon />
          {errorMessage}
        </AriaText>
      )}
    </AriaTextField>
  )
}
