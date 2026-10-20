/**
 * FilterSelect — multi-select filter dropdown built on React Aria
 *
 * Button trigger with popover containing a checkable list.
 * Shows a count badge when items are selected.
 */

import * as stylex from '@stylexjs/stylex'
import { useState, useMemo, type ReactNode, Children, isValidElement } from 'react'
import {
  DialogTrigger,
  Popover as AriaPopover,
  Dialog as AriaDialog,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Button as AriaButton,
  Input as AriaInput,
  type ButtonProps as AriaButtonProps,
  type ButtonRenderProps,
  type ListBoxItemProps as AriaListBoxItemProps,
  type ListBoxItemRenderProps,
  type Selection,
} from 'react-aria-components'

import {
  styled,
  type StyledRenderOverrides,
  type StyledRenderProps,
} from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
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
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':hover': {
        default: tokens['--ds-background-100'],
        '@media (hover: hover)': tokens['--ds-gray-100'],
      },
      ':is([data-pressed])': tokens['--ds-gray-100'],
    },
    boxShadow: {
      default: `inset 0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
      ':is([data-focus-visible])': `0 0 0 2px #fff, 0 0 0 4px ${tokens['--ds-focus-color']}, inset 0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
    },
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    outlineStyle: 'none',
    transitionProperty: 'all',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  triggerActive: {
    color: tokens['--ds-gray-1000'],
  },
  triggerSm: {
    height: scale.formHeightSm,
    paddingInline: scale.space2,
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  triggerMd: {
    height: '2.25rem',
    paddingInline: scale.space3,
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  badge: {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '18px',
    height: '18px',
    paddingInline: scale.space1,
    borderRadius: scale.radiusFull,
    backgroundColor: tokens['--ds-gray-1000'],
    color: tokens['--ds-background-100'],
    fontSize: '11px',
    lineHeight: 1,
    fontWeight: 500,
  },
  // The previous entering/exiting animation utilities emitted no CSS because
  // the animation plugin is not installed. Keep the actual static behavior.
  popover: {
    boxSizing: 'border-box',
    backgroundColor: tokens['--ds-background-100'],
    borderRadius: '0.75rem',
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`,
    outlineStyle: 'none',
  },
  popoverSm: {
    minWidth: '180px',
  },
  popoverMd: {
    minWidth: '220px',
  },
  dialog: {
    outlineStyle: 'none',
  },
  searchWrapper: {
    boxSizing: 'border-box',
    paddingTop: scale.space2,
    paddingRight: scale.space2,
    paddingBottom: scale.space1,
    paddingLeft: scale.space2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  searchInput: {
    width: '100%',
    paddingInline: scale.space2,
    paddingBlock: '0.375rem',
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-1000'],
    borderRadius: '0.375rem',
    outlineStyle: 'none',
    boxShadow: {
      default: null,
      ':focus': `0 0 0 1px ${tokens['--ds-focus-color']}`,
    },
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    '::placeholder': {
      color: tokens['--ds-gray-700'],
    },
  },
  listBox: {
    boxSizing: 'border-box',
    maxHeight: '240px',
    padding: scale.space1,
    overflowY: 'auto',
    outlineStyle: 'none',
  },
  item: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    paddingInline: scale.space2,
    paddingBlock: '0.375rem',
    color: tokens['--ds-gray-1000'],
    borderRadius: '0.375rem',
    outlineStyle: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  itemActive: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  itemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  checkbox: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: '1rem',
    height: '1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-600'],
    borderRadius: '4px',
    backgroundColor: tokens['--ds-background-100'],
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  checkboxSelected: {
    borderColor: tokens['--ds-gray-1000'],
    backgroundColor: tokens['--ds-gray-1000'],
  },
  checkIcon: {
    width: '0.75rem',
    height: '0.75rem',
    color: tokens['--ds-background-100'],
  },
  checkGraphic: {
    display: 'block',
    width: '0.75rem',
    height: '0.75rem',
  },
  chevronGraphic: {
    display: 'block',
    width: '1rem',
    height: '1rem',
  },
  prefix: {
    flexShrink: 0,
  },
  itemLabel: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

export type FilterSelectSize = 'sm' | 'md'

const triggerSizeStyles: Record<FilterSelectSize, stylex.StyleXStyles> = {
  sm: styles.triggerSm,
  md: styles.triggerMd,
}

const popoverSizeStyles: Record<FilterSelectSize, stylex.StyleXStyles> = {
  sm: styles.popoverSm,
  md: styles.popoverMd,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type FilterSelectOwnedStyle = OwnedStyle<
  | 'display'
  | 'alignItems'
  | 'gap'
  | 'columnGap'
  | 'rowGap'
  | 'height'
  | 'padding'
  | 'paddingBlock'
  | 'paddingBlockStart'
  | 'paddingBlockEnd'
  | 'paddingInline'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingStart'
  | 'paddingEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'background'
  | 'backgroundColor'
  | 'boxShadow'
  | 'color'
  | 'cursor'
  | 'outline'
  | 'outlineStyle'
  | 'borderRadius'
  | 'borderStartStartRadius'
  | 'borderStartEndRadius'
  | 'borderEndStartRadius'
  | 'borderEndEndRadius'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderBottomLeftRadius'
  | 'borderBottomRightRadius'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
>

type FilterSelectItemOwnedStyle = OwnedStyle<
  | 'display'
  | 'alignItems'
  | 'gap'
  | 'columnGap'
  | 'rowGap'
  | 'padding'
  | 'paddingBlock'
  | 'paddingBlockStart'
  | 'paddingBlockEnd'
  | 'paddingInline'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingStart'
  | 'paddingEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'background'
  | 'backgroundColor'
  | 'color'
  | 'borderRadius'
  | 'borderStartStartRadius'
  | 'borderStartEndRadius'
  | 'borderEndStartRadius'
  | 'borderEndEndRadius'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderBottomLeftRadius'
  | 'borderBottomRightRadius'
  | 'outline'
  | 'outlineStyle'
  | 'cursor'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
  | 'opacity'
>

const CheckIcon = () => (
  <svg
    {...styled(undefined, styles.checkGraphic)}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ChevronDownIcon = () => (
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

export interface FilterSelectProps extends Pick<AriaButtonProps, 'className' | 'style'> {
  /** Label shown on the trigger button */
  label: string
  /** Currently selected keys (controlled) */
  selectedKeys?: Selection
  /** Default selected keys (uncontrolled) */
  defaultSelectedKeys?: Selection
  /** Called when selection changes */
  onSelectionChange?: (keys: Selection) => void
  /** Filter options */
  children: ReactNode
  /** Visual size */
  size?: FilterSelectSize | undefined
  /** Disable the filter */
  isDisabled?: boolean | undefined
  /** Show a search input to filter options */
  isSearchable?: boolean | undefined
  /** Caller-last trigger adaptation. Component-owned presentation is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<FilterSelectOwnedStyle>
}

/** Multi-select filter dropdown with count badge and optional search */
export const FilterSelect = ({
  label,
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  children,
  size = 'sm',
  className,
  style,
  stylexStyle,
  isDisabled,
  isSearchable,
}: FilterSelectProps) => {
  const isControlled = selectedKeys !== undefined
  const [internalKeys, setInternalKeys] = useState<Selection>(defaultSelectedKeys ?? new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const effectiveKeys = isControlled ? selectedKeys : internalKeys

  const count =
    effectiveKeys === 'all'
      ? undefined
      : effectiveKeys instanceof Set
        ? effectiveKeys.size
        : undefined
  const hasSelection = count !== undefined && count > 0

  const handleSelectionChange = (keys: Selection) => {
    if (!isControlled) setInternalKeys(keys)
    onSelectionChange?.(keys)
  }

  const filteredChildren = useMemo(() => {
    if (!isSearchable || !searchQuery) return children
    const lower = searchQuery.toLowerCase()
    const result: ReactNode[] = []
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return
      const textValue =
        (child.props as { textValue?: string; children?: ReactNode }).textValue ??
        (typeof (child.props as { children?: ReactNode }).children === 'string'
          ? (child.props as { children: string }).children
          : '')
      if (textValue.toLowerCase().includes(lower)) {
        result.push(child)
      }
    })
    return result
  }, [children, searchQuery, isSearchable])

  return (
    <DialogTrigger>
      <AriaButton
        {...styled<ButtonRenderProps>(
          { className, style },
          styles.controlReset,
          styles.buttonReset,
          styles.trigger,
          triggerSizeStyles[size],
          hasSelection && styles.triggerActive,
          stylexStyle,
        )}
        isDisabled={isDisabled ?? false}
      >
        <span>{label}</span>
        {hasSelection && <span {...styled(undefined, styles.badge)}>{count}</span>}
        <ChevronDownIcon />
      </AriaButton>
      <AriaPopover
        {...styled(undefined, styles.popover, popoverSizeStyles[size])}
        offset={4}
        placement="bottom start"
      >
        <AriaDialog {...styled(undefined, styles.dialog)}>
          {isSearchable && (
            <div {...styled(undefined, styles.searchWrapper)}>
              <AriaInput
                {...styled(undefined, styles.controlReset, styles.searchInput)}
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={`Search ${label}`}
              />
            </div>
          )}
          <AriaListBox
            aria-label={label}
            {...styled(undefined, styles.listBox)}
            selectionMode="multiple"
            selectedKeys={effectiveKeys}
            onSelectionChange={handleSelectionChange}
          >
            {filteredChildren}
          </AriaListBox>
        </AriaDialog>
      </AriaPopover>
    </DialogTrigger>
  )
}

export interface FilterSelectItemProps extends Omit<
  AriaListBoxItemProps,
  'children' | 'textValue'
> {
  /** Item label */
  children: ReactNode
  /** Text value for accessibility (auto-derived from string children) */
  textValue?: string | undefined
  /** Optional prefix element (icon, color dot, etc.) */
  prefix?: ReactNode
  /** Caller-last item adaptation. Component-owned presentation is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<FilterSelectItemOwnedStyle>
}

const makeFilterSelectItemStyleProps = ({
  className,
  style,
  stylexStyle,
}: StyledRenderOverrides<ListBoxItemRenderProps> & {
  stylexStyle?: stylex.StyleXStylesWithout<FilterSelectItemOwnedStyle> | undefined
}): StyledRenderProps<ListBoxItemRenderProps> => {
  const merged = styled<ListBoxItemRenderProps>({ className, style }, styles.item, stylexStyle)

  return {
    className: (values) => {
      const callerClassName = typeof className === 'function' ? className(values) : className

      return (
        styled(
          callerClassName,
          styles.item,
          (values.isFocused || values.isHovered) && styles.itemActive,
          values.isDisabled && styles.itemDisabled,
          stylexStyle,
        ).className ?? ''
      )
    },
    ...(merged.style === undefined ? {} : { style: merged.style }),
  }
}

/** Individual option within a FilterSelect */
export const FilterSelectItem = ({
  children,
  textValue,
  prefix,
  className,
  style,
  stylexStyle,
  ...props
}: FilterSelectItemProps) => {
  const resolvedTextValue = textValue ?? (typeof children === 'string' ? children : undefined)

  return (
    <AriaListBoxItem
      {...makeFilterSelectItemStyleProps({ className, style, stylexStyle })}
      {...(resolvedTextValue !== undefined ? { textValue: resolvedTextValue } : {})}
      {...props}
    >
      {({ isSelected }) => (
        <>
          <span {...styled(undefined, styles.checkbox, isSelected && styles.checkboxSelected)}>
            {isSelected && (
              <span {...styled(undefined, styles.checkIcon)}>
                <CheckIcon />
              </span>
            )}
          </span>
          {prefix && <span {...styled(undefined, styles.prefix)}>{prefix}</span>}
          <span {...styled(undefined, styles.itemLabel)}>{children}</span>
        </>
      )}
    </AriaListBoxItem>
  )
}
