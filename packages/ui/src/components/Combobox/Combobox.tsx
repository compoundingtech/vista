/**
 * Combobox component built on React Aria
 *
 * @see https://vercel.com/geist/combobox
 */

import * as stylex from '@stylexjs/stylex'
import {
  ComboBox as AriaComboBox,
  Input as AriaInput,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Popover as AriaPopover,
  Label as AriaLabel,
  Button as AriaButton,
  type ComboBoxProps as AriaComboBoxProps,
  type ListBoxItemProps as AriaListBoxItemProps,
  type ListBoxItemRenderProps,
} from 'react-aria-components'

import {
  styled,
  type StyledRenderOverrides,
  type StyledRenderProps,
} from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

/** Loading spinner rotation, emitted once in the compiled stylesheet. */
const spin = stylex.keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
})

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
  controlReset: {
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    fontFeatureSettings: 'inherit',
    fontVariationSettings: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    opacity: 1,
  },
  buttonReset: {
    appearance: 'button',
    textTransform: 'none',
  },
  wrapper: {
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: tokens['--ds-background-100'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: {
      default: tokens['--ds-gray-alpha-400'],
      ':focus-within': tokens['--ds-gray-1000'],
    },
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  wrapperInvalid: {
    borderColor: {
      default: tokens['--ds-red-700'],
      // The previous rule ordering made invalid win over focus-within, so the
      // border remains red while the input has focus.
      ':focus-within': tokens['--ds-red-700'],
    },
  },
  wrapperDisabled: {
    backgroundColor: tokens['--ds-gray-100'],
    cursor: 'not-allowed',
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
  inputWithPrefix: {
    paddingLeft: 0,
  },
  inputWithEndAdornment: {
    paddingRight: 0,
  },
  prefixIcon: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: tokens['--ds-gray-700'],
  },
  suffixIcon: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: tokens['--ds-gray-700'],
  },
  clearButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: {
      default: tokens['--ds-gray-700'],
      ':hover': tokens['--ds-gray-1000'],
    },
    cursor: 'pointer',
    borderRadius: scale.radiusSm,
    outlineStyle: 'none',
    boxShadow: {
      default: null,
      ':focus': `0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
    },
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  triggerButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: {
      default: tokens['--ds-gray-700'],
      ':hover': tokens['--ds-gray-1000'],
    },
    cursor: 'pointer',
    borderRadius: scale.radiusSm,
    outlineStyle: 'none',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  triggerButtonDisabled: {
    color: {
      default: tokens['--ds-gray-700'],
      ':hover': tokens['--ds-gray-700'],
    },
    cursor: 'not-allowed',
  },
  chevron: {
    transform: 'rotate(0deg)',
    transitionProperty: 'transform',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  chevronOpen: {
    transform: 'rotate(180deg)',
  },
  chevronGraphic: {
    width: '1rem',
    height: '1rem',
  },
  clearGraphic: {
    width: '0.875rem',
    height: '0.875rem',
  },
  spinner: {
    boxSizing: 'border-box',
    position: 'relative',
    flexShrink: 0,
  },
  spinnerCircle: {
    boxSizing: 'border-box',
    position: 'absolute',
    inset: 0,
    borderRadius: scale.radiusFull,
    borderTopWidth: '2px',
    borderRightWidth: '2px',
    borderBottomWidth: '2px',
    borderLeftWidth: '2px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: tokens['--ds-gray-1000'],
    borderRightColor: tokens['--ds-gray-alpha-400'],
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderLeftColor: tokens['--ds-gray-alpha-400'],
    animationName: spin,
    animationDuration: '0.6s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
  // The former entering/exiting utility names never emitted CSS because this
  // package has no animation plugin. Keep the popover's actual static behavior.
  popover: {
    boxSizing: 'border-box',
    width: 'var(--trigger-width)',
    backgroundColor: tokens['--ds-background-100'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '6px',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    overflow: 'hidden',
  },
  listBox: {
    boxSizing: 'border-box',
    maxHeight: '300px',
    padding: scale.space1,
    overflow: 'auto',
    outlineStyle: 'none',
  },
  option: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    paddingInline: scale.space3,
    paddingBlock: scale.space2,
    color: tokens['--ds-gray-1000'],
    borderRadius: '4px',
    cursor: 'pointer',
    outlineStyle: 'none',
    // ComboboxItem constructed the variant recipe without a size, which
    // selected its `md` default independently from the parent Combobox.
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  optionFocused: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  optionSelected: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  optionDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  emptyState: {
    paddingInline: scale.space3,
    paddingBlock: scale.space6,
    color: tokens['--ds-gray-700'],
    textAlign: 'center',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    color: tokens['--ds-red-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  errorGraphic: {
    width: '1rem',
    height: '1rem',
    flexShrink: 0,
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
  prefixSm: {
    width: scale.formHeightSm,
    height: scale.formHeightSm,
  },
  prefixMd: {
    width: scale.formHeightMd,
    height: scale.formHeightMd,
  },
  prefixLg: {
    width: scale.formHeightLg,
    height: scale.formHeightLg,
  },
  suffixSm: {
    width: '1.5rem',
    height: scale.formHeightSm,
  },
  suffixMd: {
    width: '2rem',
    height: scale.formHeightMd,
  },
  suffixLg: {
    width: '2.5rem',
    height: scale.formHeightLg,
  },
  clearSm: {
    width: '1rem',
    height: '1rem',
  },
  clearMd: {
    width: '1rem',
    height: '1rem',
  },
  clearLg: {
    width: '1.25rem',
    height: '1.25rem',
  },
  triggerSm: {
    width: '1.5rem',
    height: scale.formHeightSm,
    marginRight: scale.space1,
  },
  triggerMd: {
    width: '2rem',
    height: scale.formHeightMd,
    marginRight: scale.space1,
  },
  triggerLg: {
    width: '2.5rem',
    height: scale.formHeightLg,
    marginRight: scale.space1,
  },
  spinnerSm: {
    width: '1rem',
    height: '1rem',
    marginRight: scale.space2,
  },
  spinnerMd: {
    width: '1.25rem',
    height: '1.25rem',
    marginRight: scale.space2,
  },
  spinnerLg: {
    width: '1.5rem',
    height: '1.5rem',
    marginRight: scale.space2,
  },
})

type ComboboxSize = 'sm' | 'md' | 'lg'

const wrapperSizeStyles: Record<ComboboxSize, stylex.StyleXStyles> = {
  sm: styles.wrapperSm,
  md: styles.wrapperMd,
  lg: styles.wrapperLg,
}

const inputSizeStyles: Record<ComboboxSize, stylex.StyleXStyles> = {
  sm: styles.inputSm,
  md: styles.inputMd,
  lg: styles.inputLg,
}

const prefixSizeStyles: Record<ComboboxSize, stylex.StyleXStyles> = {
  sm: styles.prefixSm,
  md: styles.prefixMd,
  lg: styles.prefixLg,
}

const suffixSizeStyles: Record<ComboboxSize, stylex.StyleXStyles> = {
  sm: styles.suffixSm,
  md: styles.suffixMd,
  lg: styles.suffixLg,
}

const clearSizeStyles: Record<ComboboxSize, stylex.StyleXStyles> = {
  sm: styles.clearSm,
  md: styles.clearMd,
  lg: styles.clearLg,
}

const triggerSizeStyles: Record<ComboboxSize, stylex.StyleXStyles> = {
  sm: styles.triggerSm,
  md: styles.triggerMd,
  lg: styles.triggerLg,
}

const spinnerSizeStyles: Record<ComboboxSize, stylex.StyleXStyles> = {
  sm: styles.spinnerSm,
  md: styles.spinnerMd,
  lg: styles.spinnerLg,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type ComboboxOwnedStyle = OwnedStyle<
  'display' | 'flexDirection' | 'flexFlow' | 'gap' | 'columnGap' | 'rowGap'
>

type ComboboxItemOwnedStyle = OwnedStyle<
  | 'position'
  | 'display'
  | 'alignItems'
  | 'padding'
  | 'paddingInline'
  | 'paddingBlock'
  | 'paddingLeft'
  | 'paddingRight'
  | 'paddingTop'
  | 'paddingBottom'
  | 'color'
  | 'backgroundColor'
  | 'borderRadius'
  | 'cursor'
  | 'outline'
  | 'outlineStyle'
  | 'fontSize'
  | 'lineHeight'
  | 'opacity'
>

/** Chevron icon for dropdown trigger */
const ChevronIcon = () => (
  <svg
    {...styled(undefined, styles.chevronGraphic)}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.21967 6.21967C4.51256 5.92678 4.98744 5.92678 5.28033 6.21967L8 8.93934L10.7197 6.21967C11.0126 5.92678 11.4874 5.92678 11.7803 6.21967C12.0732 6.51256 12.0732 6.98744 11.7803 7.28033L8.53033 10.5303C8.23744 10.8232 7.76256 10.8232 7.46967 10.5303L4.21967 7.28033C3.92678 6.98744 3.92678 6.51256 4.21967 6.21967Z"
    />
  </svg>
)

/** Clear/close icon */
const ClearIcon = () => (
  <svg
    {...styled(undefined, styles.clearGraphic)}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.4697 3.46967C12.7626 3.17678 13.2374 3.17678 13.5303 3.46967C13.8232 3.76256 13.8232 4.23744 13.5303 4.53033L9.06066 9L13.5303 13.4697C13.8232 13.7626 13.8232 14.2374 13.5303 14.5303C13.2374 14.8232 12.7626 14.8232 12.4697 14.5303L8 10.0607L3.53033 14.5303C3.23744 14.8232 2.76256 14.8232 2.46967 14.5303C2.17678 14.2374 2.17678 13.7626 2.46967 13.4697L6.93934 9L2.46967 4.53033C2.17678 4.23744 2.17678 3.76256 2.46967 3.46967C2.76256 3.17678 3.23744 3.17678 3.53033 3.46967L8 7.93934L12.4697 3.46967Z"
    />
  </svg>
)

/** Error icon for validation messages */
const ErrorIcon = () => (
  <svg
    {...styled(undefined, styles.errorGraphic)}
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

/** Inline spinner for loading state */
const InlineSpinner = ({ size }: { size: ComboboxSize }) => (
  <div
    role="status"
    aria-label="Loading"
    {...styled(undefined, styles.spinner, spinnerSizeStyles[size])}
  >
    <div {...styled(undefined, styles.spinnerCircle)} />
  </div>
)

export interface ComboboxProps<T extends object> extends Omit<AriaComboBoxProps<T>, 'children'> {
  /** Label text */
  label?: string
  /** Placeholder text */
  placeholder?: string
  /** Combobox options */
  children: React.ReactNode
  /** Error message */
  errorMessage?: string
  /** Loading state */
  isLoading?: boolean
  /** Show clear button when value is present */
  allowsClear?: boolean
  /** Prefix icon element */
  prefixIcon?: React.ReactNode
  /** Suffix icon element (replaces chevron) */
  suffixIcon?: React.ReactNode
  /** Message shown when no items match the filter */
  emptyMessage?: string
  /** Visual size */
  size?: ComboboxSize | undefined
  /** Caller-last root adaptation. Component-owned layout is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ComboboxOwnedStyle>
  /** Callback when clear button is pressed */
  onClear?: () => void
}

/** Searchable dropdown with filtering and keyboard navigation */
export const Combobox = <T extends object>({
  label,
  placeholder,
  children,
  errorMessage,
  isLoading = false,
  allowsClear = false,
  prefixIcon,
  suffixIcon,
  emptyMessage = 'No results found',
  size = 'md',
  className,
  style,
  stylexStyle,
  onClear,
  ...props
}: ComboboxProps<T>) => {
  const hasError = !!errorMessage

  const handleClear = () => {
    onClear?.()
  }

  return (
    <AriaComboBox
      {...styled({ className, style }, styles.root, stylexStyle)}
      isInvalid={hasError}
      menuTrigger="focus"
      {...props}
    >
      {({ isOpen }) => (
        <>
          {label && <AriaLabel {...styled(undefined, styles.label)}>{label}</AriaLabel>}
          <div
            {...styled(
              undefined,
              styles.wrapper,
              wrapperSizeStyles[size],
              props.isDisabled && styles.wrapperDisabled,
              hasError && styles.wrapperInvalid,
            )}
            data-disabled={props.isDisabled || undefined}
            data-invalid={hasError || undefined}
          >
            {prefixIcon && (
              <span {...styled(undefined, styles.prefixIcon, prefixSizeStyles[size])}>
                {prefixIcon}
              </span>
            )}
            <AriaInput
              {...styled(
                undefined,
                styles.controlReset,
                styles.input,
                inputSizeStyles[size],
                prefixIcon !== undefined && styles.inputWithPrefix,
                // The previous condition was tautologically true, so the input
                // always had its right padding reset.
                styles.inputWithEndAdornment,
              )}
              {...(placeholder !== undefined && { placeholder })}
            />
            {isLoading && <InlineSpinner size={size} />}
            {!isLoading && allowsClear && props.inputValue && (
              <button
                type="button"
                {...styled(
                  undefined,
                  styles.controlReset,
                  styles.buttonReset,
                  styles.clearButton,
                  clearSizeStyles[size],
                )}
                onClick={handleClear}
                aria-label="Clear"
                tabIndex={-1}
              >
                <ClearIcon />
              </button>
            )}
            {suffixIcon && !isLoading && (
              <span {...styled(undefined, styles.suffixIcon, suffixSizeStyles[size])}>
                {suffixIcon}
              </span>
            )}
            {!suffixIcon && !isLoading && (
              <AriaButton
                {...styled(
                  undefined,
                  styles.controlReset,
                  styles.buttonReset,
                  styles.triggerButton,
                  triggerSizeStyles[size],
                  props.isDisabled && styles.triggerButtonDisabled,
                )}
                data-disabled={props.isDisabled || undefined}
              >
                <span {...styled(undefined, styles.chevron, isOpen && styles.chevronOpen)}>
                  <ChevronIcon />
                </span>
              </AriaButton>
            )}
          </div>
          <AriaPopover {...styled(undefined, styles.popover)}>
            <AriaListBox
              {...styled(undefined, styles.listBox)}
              renderEmptyState={() => (
                <div {...styled(undefined, styles.emptyState)}>{emptyMessage}</div>
              )}
            >
              {children}
            </AriaListBox>
          </AriaPopover>
          {hasError && (
            <div {...styled(undefined, styles.error)}>
              <ErrorIcon />
              {errorMessage}
            </div>
          )}
        </>
      )}
    </AriaComboBox>
  )
}

export interface ComboboxItemProps extends AriaListBoxItemProps {
  /** Caller-last item adaptation. Component-owned visual and state styling is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ComboboxItemOwnedStyle>
}

const makeComboboxItemStyleProps = ({
  className,
  style,
  stylexStyle,
}: StyledRenderOverrides<ListBoxItemRenderProps> & {
  stylexStyle?: stylex.StyleXStylesWithout<ComboboxItemOwnedStyle> | undefined
}): StyledRenderProps<ListBoxItemRenderProps> => {
  const merged = styled<ListBoxItemRenderProps>({ className, style }, styles.option, stylexStyle)

  return {
    className: (values) => {
      const callerClassName = typeof className === 'function' ? className(values) : className

      return (
        styled(
          callerClassName,
          styles.option,
          values.isFocused && styles.optionFocused,
          values.isSelected && styles.optionSelected,
          values.isDisabled && styles.optionDisabled,
          stylexStyle,
        ).className ?? ''
      )
    },
    ...(merged.style === undefined ? {} : { style: merged.style }),
  }
}

/** A single option within a Combobox */
export const ComboboxItem = ({ className, style, stylexStyle, ...props }: ComboboxItemProps) => (
  <AriaListBoxItem {...makeComboboxItemStyleProps({ className, style, stylexStyle })} {...props} />
)
