/**
 * Select component built on React Aria
 *
 * @see https://vercel.com/geist/select
 */

import * as stylex from '@stylexjs/stylex'
import { useContext } from 'react'
import {
  Select as AriaSelect,
  Label as AriaLabel,
  Button as AriaButton,
  SelectValue as AriaSelectValue,
  Popover as AriaPopover,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Text as AriaText,
  SelectStateContext,
  type SelectProps as AriaSelectProps,
  type ListBoxItemProps as AriaListBoxItemProps,
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
  trigger: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':is([data-disabled])': tokens['--ds-gray-100'],
    },
    boxShadow: {
      default: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
      ':focus': `0 0 0 1px ${tokens['--ds-gray-900']}, 0 0 0 4px ${tokens['--ds-gray-alpha-400']}`,
    },
    color: {
      default: tokens['--ds-gray-1000'],
      ':is([data-disabled])': tokens['--ds-gray-700'],
    },
    cursor: {
      default: 'pointer',
      ':is([data-disabled])': 'not-allowed',
    },
    outlineStyle: 'none',
    transitionProperty: 'box-shadow',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
  },
  triggerInvalid: {
    boxShadow: {
      default: `0 0 0 1px ${tokens['--ds-red-700']}`,
      // The Tailwind source declares invalid after focus, so invalid wins the overlap.
      ':focus': `0 0 0 1px ${tokens['--ds-red-700']}`,
    },
  },
  value: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    color: {
      default: null,
      ':is([data-placeholder])': tokens['--ds-gray-700'],
    },
  },
  icon: {
    flexShrink: 0,
    color: tokens['--ds-gray-700'],
    transitionProperty: 'transform',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  iconOpen: {
    transform: 'rotate(180deg)',
  },
  iconGraphic: {
    width: '1rem',
    height: '1rem',
  },
  // The Tailwind baseline listed `entering:*`/`exiting:*` animation utilities,
  // but its production Storybook CSS emitted no matching rules or keyframes.
  popover: {
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
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  optionSelected: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  optionFocused: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  optionDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  optionWithDescription: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  itemLabel: {
    color: tokens['--ds-gray-1000'],
  },
  itemDescription: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
    lineHeight: '1rem',
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
    width: '1rem',
    height: '1rem',
    flexShrink: 0,
  },
  triggerXs: {
    height: '1.5rem',
    paddingInline: '0.375rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  triggerSm: {
    height: scale.formHeightSm,
    paddingInline: scale.space3,
    borderRadius: '6px',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  triggerMd: {
    height: scale.formHeightMd,
    paddingInline: scale.space3,
    borderRadius: '6px',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  triggerLg: {
    height: scale.formHeightLg,
    paddingInline: scale.space3,
    borderRadius: '8px',
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
})

/** Available Select sizes. */
export type SelectSize = 'xs' | 'sm' | 'md' | 'lg'

const triggerSizeStyles: Record<SelectSize, stylex.StyleXStyles> = {
  xs: styles.triggerXs,
  sm: styles.triggerSm,
  md: styles.triggerMd,
  lg: styles.triggerLg,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type SelectOwnedStyle = OwnedStyle<
  'display' | 'flexDirection' | 'flexFlow' | 'gap' | 'columnGap' | 'rowGap'
>

/** Chevron icon for select dropdown */
const ChevronIcon = () => (
  <svg
    {...styled(undefined, styles.iconGraphic)}
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
/**
 * Keep React Aria's localized default placeholder, but use textValue for a
 * selection so an item's optional description stays in the popover.
 */
const SelectTriggerValue = () => {
  const state = useContext(SelectStateContext)

  if (state?.selectedItems.length) {
    return (
      <AriaSelectValue {...styled(undefined, styles.value)}>
        {({ selectedText }) => selectedText}
      </AriaSelectValue>
    )
  }

  return <AriaSelectValue {...styled(undefined, styles.value)} />
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

export interface SelectProps<T extends object> extends Omit<
  AriaSelectProps<T>,
  'children' | 'style'
> {
  /** Label text */
  label?: string
  /** Placeholder text when no value is selected */
  placeholder?: string
  /** Select options */
  children: React.ReactNode
  /** Error message */
  errorMessage?: string
  /** Visual size */
  size?: SelectSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root layout adaptation. Component-owned layout is constrained. */
  style?: stylex.StyleXStylesWithout<SelectOwnedStyle>
}

/** Display a dropdown list of items */
export const Select = <T extends object>({
  label,
  placeholder,
  children,
  errorMessage,
  size = 'md',
  className,
  style,
  ...props
}: SelectProps<T>) => {
  const hasError = !!errorMessage

  return (
    <AriaSelect
      {...styled(className, styles.root, style)}
      {...(placeholder === undefined ? {} : { placeholder })}
      isInvalid={hasError}
      {...props}
    >
      {({ isInvalid, isOpen }) => (
        <>
          {label && <AriaLabel {...styled(undefined, styles.label)}>{label}</AriaLabel>}
          <AriaButton
            {...styled(
              undefined,
              styles.trigger,
              isInvalid && styles.triggerInvalid,
              triggerSizeStyles[size],
            )}
            data-invalid={isInvalid || undefined}
          >
            <SelectTriggerValue />
            <span
              {...styled(undefined, styles.icon, isOpen && styles.iconOpen)}
              data-open={isOpen || undefined}
            >
              <ChevronIcon />
            </span>
          </AriaButton>
          <AriaPopover {...styled(undefined, styles.popover)}>
            <AriaListBox {...styled(undefined, styles.listBox)}>{children}</AriaListBox>
          </AriaPopover>
          {hasError && (
            <div {...styled(undefined, styles.error)}>
              <ErrorIcon />
              {errorMessage}
            </div>
          )}
        </>
      )}
    </AriaSelect>
  )
}

export interface SelectItemProps extends AriaListBoxItemProps {
  /** Secondary text rendered below the item label. */
  description?: string
  /** Optional class name override */
  className?: string
}

/** A single option within a Select */
export const SelectItem = ({
  className,
  description,
  children,
  textValue,
  ...props
}: SelectItemProps) => {
  const hasDescription = description !== undefined
  const resolvedTextValue =
    textValue ?? (hasDescription && typeof children === 'string' ? children : undefined)

  return (
    <AriaListBoxItem
      className={({ isSelected, isFocused, isDisabled }) =>
        styled(
          className,
          styles.option,
          hasDescription && styles.optionWithDescription,
          isFocused && styles.optionFocused,
          isSelected && styles.optionSelected,
          isDisabled && styles.optionDisabled,
        ).className ?? ''
      }
      {...(resolvedTextValue === undefined ? {} : { textValue: resolvedTextValue })}
      {...props}
    >
      {hasDescription ? (
        typeof children === 'function' ? (
          (values) => (
            <>
              <AriaText slot="label" {...styled(undefined, styles.itemLabel)}>
                {children(values)}
              </AriaText>
              <AriaText slot="description" {...styled(undefined, styles.itemDescription)}>
                {description}
              </AriaText>
            </>
          )
        ) : (
          <>
            <AriaText slot="label" {...styled(undefined, styles.itemLabel)}>
              {children}
            </AriaText>
            <AriaText slot="description" {...styled(undefined, styles.itemDescription)}>
              {description}
            </AriaText>
          </>
        )
      ) : (
        children
      )}
    </AriaListBoxItem>
  )
}
