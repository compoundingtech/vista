/**
 * MultiSelect component built on React Aria
 *
 * @see https://vercel.com/geist/multi-select
 */

import * as stylex from '@stylexjs/stylex'
import { useState, useMemo, useRef } from 'react'
import {
  TagGroup as AriaTagGroup,
  TagList as AriaTagList,
  Tag as AriaTag,
  ComboBox as AriaComboBox,
  Input as AriaInput,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Popover as AriaPopover,
  Label as AriaLabel,
  type Key,
  type ListBoxItemRenderProps,
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
  container: {
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.375rem',
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
  containerDisabled: {
    backgroundColor: tokens['--ds-gray-100'],
    cursor: 'not-allowed',
  },
  containerInvalid: {
    borderColor: {
      default: tokens['--ds-red-700'],
      ':focus-within': tokens['--ds-red-700'],
    },
  },
  tagList: {
    boxSizing: 'border-box',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  tag: {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space1,
    borderRadius: scale.radiusFull,
    backgroundColor: tokens['--ds-gray-200'],
    color: tokens['--ds-gray-1000'],
    cursor: 'default',
    outlineStyle: 'none',
  },
  tagSelected: {
    boxShadow: `0 0 0 2px ${tokens['--ds-blue-700']}`,
  },
  tagDisabled: {
    opacity: 0.5,
  },
  tagRemoveButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scale.radiusFull,
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: 'transparent',
        '@media (hover: hover)': tokens['--ds-gray-300'],
      },
    },
    color: {
      default: tokens['--ds-gray-700'],
      ':hover': {
        default: tokens['--ds-gray-700'],
        '@media (hover: hover)': tokens['--ds-gray-1000'],
      },
    },
    cursor: 'pointer',
    outlineStyle: 'none',
    boxShadow: {
      default: null,
      ':focus': `0 0 0 2px ${tokens['--ds-blue-700']}`,
    },
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  removeGraphic: {
    display: 'block',
    width: '0.75rem',
    height: '0.75rem',
  },
  comboBox: {
    boxSizing: 'border-box',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    minWidth: '120px',
  },
  input: {
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
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    paddingInline: scale.space3,
    paddingBlock: scale.space2,
    color: tokens['--ds-gray-1000'],
    borderRadius: '4px',
    cursor: 'pointer',
    outlineStyle: 'none',
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
  error: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    marginTop: scale.space2,
    color: tokens['--ds-red-700'],
    fontSize: '13px',
    lineHeight: '1.25rem',
  },
  errorGraphic: {
    display: 'block',
    width: '1rem',
    height: '1rem',
    flexShrink: 0,
  },
  emptyState: {
    boxSizing: 'border-box',
    paddingInline: scale.space3,
    paddingBlock: scale.space2,
    color: tokens['--ds-gray-700'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  containerSm: {
    minHeight: scale.formHeightSm,
    padding: '0.375rem',
    borderRadius: '6px',
  },
  containerMd: {
    minHeight: scale.formHeightMd,
    padding: scale.space2,
    borderRadius: '6px',
  },
  containerLg: {
    minHeight: scale.formHeightLg,
    padding: '0.625rem',
    borderRadius: '8px',
  },
  tagSm: {
    height: '1.25rem',
    paddingInline: scale.space2,
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  tagMd: {
    height: '1.5rem',
    paddingInline: scale.space3,
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  tagLg: {
    height: '1.75rem',
    paddingInline: scale.space3,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  tagRemoveSm: {
    width: '1rem',
    height: '1rem',
  },
  tagRemoveMd: {
    width: '1rem',
    height: '1rem',
  },
  tagRemoveLg: {
    width: '1.25rem',
    height: '1.25rem',
  },
  inputSm: {
    height: '1.25rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  inputMd: {
    height: '1.5rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  inputLg: {
    height: '1.75rem',
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
  optionSm: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  optionMd: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  optionLg: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
})

export type MultiSelectSize = 'sm' | 'md' | 'lg'

const containerSizeStyles: Record<MultiSelectSize, stylex.StyleXStyles> = {
  sm: styles.containerSm,
  md: styles.containerMd,
  lg: styles.containerLg,
}

const tagSizeStyles: Record<MultiSelectSize, stylex.StyleXStyles> = {
  sm: styles.tagSm,
  md: styles.tagMd,
  lg: styles.tagLg,
}

const tagRemoveSizeStyles: Record<MultiSelectSize, stylex.StyleXStyles> = {
  sm: styles.tagRemoveSm,
  md: styles.tagRemoveMd,
  lg: styles.tagRemoveLg,
}

const inputSizeStyles: Record<MultiSelectSize, stylex.StyleXStyles> = {
  sm: styles.inputSm,
  md: styles.inputMd,
  lg: styles.inputLg,
}

const optionSizeStyles: Record<MultiSelectSize, stylex.StyleXStyles> = {
  sm: styles.optionSm,
  md: styles.optionMd,
  lg: styles.optionLg,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type MultiSelectOwnedStyle = OwnedStyle<
  'display' | 'flexDirection' | 'flexFlow' | 'gap' | 'columnGap' | 'rowGap'
>

/** Close icon for tag removal */
const CloseIcon = () => (
  <svg
    {...styled(undefined, styles.removeGraphic)}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.28033 3.21967C3.98744 2.92678 3.51256 2.92678 3.21967 3.21967C2.92678 3.51256 2.92678 3.98744 3.21967 4.28033L6.93934 8L3.21967 11.7197C2.92678 12.0126 2.92678 12.4874 3.21967 12.7803C3.51256 13.0732 3.98744 13.0732 4.28033 12.7803L8 9.06066L11.7197 12.7803C12.0126 13.0732 12.4874 13.0732 12.7803 12.7803C13.0732 12.4874 13.0732 12.0126 12.7803 11.7197L9.06066 8L12.7803 4.28033C13.0732 3.98744 13.0732 3.51256 12.7803 3.21967C12.4874 2.92678 12.0126 2.92678 11.7197 3.21967L8 6.93934L4.28033 3.21967Z"
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

export interface MultiSelectOption {
  /** Unique identifier for the option */
  id: string
  /** Display label for the option */
  label: string
  /** Whether this option is disabled */
  disabled?: boolean
}

export interface MultiSelectProps {
  /** Label text */
  label?: string
  /** Placeholder text when no search input */
  placeholder?: string
  /** Available options to select from */
  options: MultiSelectOption[]
  /** Currently selected values (controlled) */
  value?: string[]
  /** Default selected values (uncontrolled) */
  defaultValue?: string[]
  /** Callback when selection changes */
  onChange?: (value: string[]) => void
  /** Whether the select is disabled */
  isDisabled?: boolean
  /** Error message to display */
  errorMessage?: string
  /** Maximum number of selections allowed */
  maxSelections?: number
  /** Visual size */
  size?: MultiSelectSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned layout is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<MultiSelectOwnedStyle>
}

/** Multi-select input with tags and searchable dropdown */
export const MultiSelect = ({
  label,
  placeholder = 'Search...',
  options,
  value: controlledValue,
  defaultValue = [],
  onChange,
  isDisabled = false,
  errorMessage,
  maxSelections,
  size = 'md',
  className,
  stylexStyle,
}: MultiSelectProps) => {
  const hasError = !!errorMessage
  const inputRef = useRef<HTMLInputElement>(null)

  const [internalValue, setInternalValue] = useState<string[]>(defaultValue)
  const selectedValues = controlledValue ?? internalValue

  const [inputValue, setInputValue] = useState('')

  const handleSelectionChange = (newValues: string[]) => {
    if (controlledValue === undefined) {
      setInternalValue(newValues)
    }
    onChange?.(newValues)
  }

  const handleRemoveTag = (id: string) => {
    const newValues = selectedValues.filter((v) => v !== id)
    handleSelectionChange(newValues)
  }

  const handleSelectOption = (key: Key | null) => {
    if (key === null) return

    const id = String(key)
    if (!selectedValues.includes(id)) {
      if (maxSelections && selectedValues.length >= maxSelections) {
        return
      }
      handleSelectionChange([...selectedValues, id])
    }
    setInputValue('')
    inputRef.current?.focus()
  }

  const filteredOptions = useMemo(() => {
    const searchLower = inputValue.toLowerCase()
    return options.filter((option) => {
      if (selectedValues.includes(option.id)) return false
      if (!inputValue) return true
      return option.label.toLowerCase().includes(searchLower)
    })
  }, [options, selectedValues, inputValue])

  const selectedTags = useMemo(() => {
    return selectedValues
      .map((id) => options.find((o) => o.id === id))
      .filter((o): o is MultiSelectOption => o !== undefined)
  }, [selectedValues, options])

  const isMaxReached = maxSelections !== undefined && selectedValues.length >= maxSelections

  return (
    <div {...styled(className, styles.root, stylexStyle)}>
      {label && <AriaLabel {...styled(undefined, styles.label)}>{label}</AriaLabel>}
      <div
        {...styled(
          undefined,
          styles.container,
          containerSizeStyles[size],
          isDisabled && styles.containerDisabled,
          hasError && styles.containerInvalid,
        )}
        data-disabled={isDisabled || undefined}
        data-invalid={hasError || undefined}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedTags.length > 0 && (
          <AriaTagGroup
            aria-label="Selected items"
            onRemove={(keys) => {
              const keysArray = [...keys]
              keysArray.forEach((key) => handleRemoveTag(String(key)))
            }}
          >
            <AriaTagList {...styled(undefined, styles.tagList)} items={selectedTags}>
              {(item) => (
                <AriaTag
                  id={item.id}
                  textValue={item.label}
                  className={({ isSelected, isDisabled: isTagDisabled }) =>
                    styled(
                      undefined,
                      styles.tag,
                      tagSizeStyles[size],
                      isSelected && styles.tagSelected,
                      isTagDisabled && styles.tagDisabled,
                    ).className ?? ''
                  }
                  isDisabled={isDisabled}
                >
                  {({ allowsRemoving }) => (
                    <>
                      {item.label}
                      {allowsRemoving && (
                        <button
                          type="button"
                          {...styled(
                            undefined,
                            styles.controlReset,
                            styles.buttonReset,
                            styles.tagRemoveButton,
                            tagRemoveSizeStyles[size],
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveTag(item.id)
                          }}
                          aria-label={`Remove ${item.label}`}
                          disabled={isDisabled}
                        >
                          <CloseIcon />
                        </button>
                      )}
                    </>
                  )}
                </AriaTag>
              )}
            </AriaTagList>
          </AriaTagGroup>
        )}

        <AriaComboBox
          {...styled(undefined, styles.comboBox)}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSelectionChange={handleSelectOption}
          isDisabled={isDisabled || isMaxReached}
          menuTrigger="focus"
          selectedKey={null}
          aria-label={label ?? 'Multi-select'}
        >
          <AriaInput
            ref={inputRef}
            {...styled(undefined, styles.controlReset, styles.input, inputSizeStyles[size])}
            placeholder={isMaxReached ? `Max ${maxSelections} selected` : placeholder}
          />
          <AriaPopover {...styled(undefined, styles.popover)}>
            <AriaListBox {...styled(undefined, styles.listBox)} items={filteredOptions}>
              {(item) => (
                <AriaListBoxItem
                  id={item.id}
                  textValue={item.label}
                  className={(values: ListBoxItemRenderProps) =>
                    styled(
                      undefined,
                      styles.option,
                      optionSizeStyles[size],
                      values.isFocused && styles.optionFocused,
                      values.isSelected && styles.optionSelected,
                      values.isDisabled && styles.optionDisabled,
                    ).className ?? ''
                  }
                  isDisabled={item.disabled === true}
                >
                  {item.label}
                </AriaListBoxItem>
              )}
            </AriaListBox>
            {filteredOptions.length === 0 && (
              <div {...styled(undefined, styles.emptyState)}>No options found</div>
            )}
          </AriaPopover>
        </AriaComboBox>
      </div>

      {hasError && (
        <div {...styled(undefined, styles.error)}>
          <ErrorIcon />
          {errorMessage}
        </div>
      )}
    </div>
  )
}
