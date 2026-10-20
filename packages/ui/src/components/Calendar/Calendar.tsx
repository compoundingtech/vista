/**
 * Calendar component built on React Aria
 *
 * @see https://vercel.com/geist/calendar
 */

import * as stylex from '@stylexjs/stylex'
import {
  Calendar as AriaCalendar,
  CalendarGrid as AriaCalendarGrid,
  CalendarGridHeader as AriaCalendarGridHeader,
  CalendarGridBody as AriaCalendarGridBody,
  CalendarHeaderCell as AriaCalendarHeaderCell,
  CalendarCell as AriaCalendarCell,
  Heading as AriaHeading,
  Button as AriaButton,
  RangeCalendar as AriaRangeCalendar,
  type CalendarProps as AriaCalendarProps,
  type RangeCalendarProps as AriaRangeCalendarProps,
  type DateValue,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    boxSizing: 'border-box',
    display: 'inline-block',
    backgroundColor: tokens['--ds-background-100'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusLg,
    userSelect: 'none',
  },
  rootSm: {
    padding: scale.space3,
  },
  rootMd: {
    padding: scale.space4,
  },
  rootLg: {
    padding: scale.space5,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale.space4,
  },
  heading: {
    margin: 0,
    color: tokens['--ds-gray-1000'],
    fontWeight: 600,
  },
  headingSm: {
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  headingMd: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  headingLg: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
  navButton: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 0,
    padding: 0,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '0.375rem',
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-900'],
    fontFamily: 'inherit',
    fontFeatureSettings: 'inherit',
    fontVariationSettings: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'none',
    appearance: 'button',
    opacity: 1,
    cursor: 'pointer',
    outlineWidth: 0,
    outlineStyle: 'none',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  navButtonSm: {
    width: '1.5rem',
    height: '1.5rem',
  },
  navButtonMd: {
    width: '2rem',
    height: '2rem',
  },
  navButtonLg: {
    width: '2.5rem',
    height: '2.5rem',
  },
  navButtonHovered: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  navButtonFocused: {
    boxShadow: `0 0 0 2px ${tokens['--ds-focus-color']}`,
  },
  navButtonDisabled: {
    cursor: 'not-allowed',
    opacity: 0.4,
  },
  navButtonDisabledHovered: {
    backgroundColor: 'transparent',
  },
  icon: {
    display: 'block',
    verticalAlign: 'middle',
    width: scale.space4,
    height: scale.space4,
    flexShrink: 0,
  },
  grid: {
    boxSizing: 'border-box',
    width: '100%',
    borderCollapse: 'collapse',
    borderSpacing: 0,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'inherit',
    textIndent: 0,
  },
  gridSection: {
    boxSizing: 'border-box',
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'inherit',
  },
  headerCell: {
    boxSizing: 'border-box',
    padding: 0,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'inherit',
    color: tokens['--ds-gray-700'],
    fontWeight: 500,
    textAlign: 'center',
  },
  headerCellSm: {
    width: '2rem',
    height: '2rem',
    // The arbitrary size replaced `text-xs`, including its line-height.
    fontSize: '10px',
  },
  headerCellMd: {
    width: '2.5rem',
    height: '2.5rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  headerCellLg: {
    width: '3rem',
    height: '3rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  cell: {
    boxSizing: 'border-box',
    padding: scale.space1,
    textAlign: 'center',
  },
  rangeHighlight: {
    borderRadius: 0,
    backgroundColor: tokens['--ds-gray-alpha-200'],
    color: tokens['--ds-gray-1000'],
  },
  cellButton: {
    boxSizing: 'border-box',
    backgroundColor: {
      default: 'transparent',
      '@media (hover: hover)': {
        ':hover': tokens['--ds-gray-alpha-200'],
      },
    },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '0.375rem',
    color: tokens['--ds-gray-1000'],
    cursor: 'pointer',
    outlineWidth: 0,
    outlineStyle: 'none',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  cellButtonSm: {
    width: '1.75rem',
    height: '1.75rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  cellButtonMd: {
    width: '2.25rem',
    height: '2.25rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  cellButtonLg: {
    width: '2.75rem',
    height: '2.75rem',
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
  error: {
    margin: 0,
    marginTop: scale.space2,
    color: tokens['--ds-red-700'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
})

type CalendarSize = 'sm' | 'md' | 'lg'

const rootSizeStyles: Record<CalendarSize, stylex.StyleXStyles> = {
  sm: styles.rootSm,
  md: styles.rootMd,
  lg: styles.rootLg,
}

const headingSizeStyles: Record<CalendarSize, stylex.StyleXStyles> = {
  sm: styles.headingSm,
  md: styles.headingMd,
  lg: styles.headingLg,
}

const navButtonSizeStyles: Record<CalendarSize, stylex.StyleXStyles> = {
  sm: styles.navButtonSm,
  md: styles.navButtonMd,
  lg: styles.navButtonLg,
}

const headerCellSizeStyles: Record<CalendarSize, stylex.StyleXStyles> = {
  sm: styles.headerCellSm,
  md: styles.headerCellMd,
  lg: styles.headerCellLg,
}

const cellButtonSizeStyles: Record<CalendarSize, stylex.StyleXStyles> = {
  sm: styles.cellButtonSm,
  md: styles.cellButtonMd,
  lg: styles.cellButtonLg,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type CalendarOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'display'
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
  | 'userSelect'
>

const makeNavButtonClassName =
  (size: CalendarSize) =>
  ({
    isHovered,
    isFocusVisible,
    isDisabled,
  }: {
    isHovered: boolean
    isFocusVisible: boolean
    isDisabled: boolean
  }): string =>
    stylex.props(
      styles.navButton,
      navButtonSizeStyles[size],
      isHovered && styles.navButtonHovered,
      isDisabled && styles.navButtonDisabled,
      isDisabled && isHovered && styles.navButtonDisabledHovered,
      isFocusVisible && styles.navButtonFocused,
    ).className ?? ''

const getCellButtonProps = (size: CalendarSize) =>
  styled(undefined, styles.cellButton, cellButtonSizeStyles[size])

/** Chevron left icon for previous month navigation */
const ChevronLeftIcon = () => (
  <svg
    {...styled(undefined, styles.icon)}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.7803 3.21967C11.0732 3.51256 11.0732 3.98744 10.7803 4.28033L6.81066 8.25L10.7803 12.2197C11.0732 12.5126 11.0732 12.9874 10.7803 13.2803C10.4874 13.5732 10.0126 13.5732 9.71967 13.2803L5.21967 8.78033C4.92678 8.48744 4.92678 8.01256 5.21967 7.71967L9.71967 3.21967C10.0126 2.92678 10.4874 2.92678 10.7803 3.21967Z"
    />
  </svg>
)

/** Chevron right icon for next month navigation */
const ChevronRightIcon = () => (
  <svg
    {...styled(undefined, styles.icon)}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.21967 3.21967C5.51256 2.92678 5.98744 2.92678 6.28033 3.21967L10.7803 7.71967C11.0732 8.01256 11.0732 8.48744 10.7803 8.78033L6.28033 13.2803C5.98744 13.5732 5.51256 13.5732 5.21967 13.2803C4.92678 12.9874 4.92678 12.5126 5.21967 12.2197L9.18934 8.25L5.21967 4.28033C4.92678 3.98744 4.92678 3.51256 5.21967 3.21967Z"
    />
  </svg>
)

export interface CalendarProps<T extends DateValue> extends Omit<
  AriaCalendarProps<T>,
  'visibleDuration' | 'style'
> {
  /** Error message for invalid state */
  errorMessage?: string
  /** Visual size */
  size?: CalendarSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned calendar styling is constrained. */
  style?: stylex.StyleXStylesWithout<CalendarOwnedStyle>
}

/** Single date selection calendar */
export const Calendar = <T extends DateValue>({
  size = 'md',
  errorMessage,
  className,
  style,
  ...props
}: CalendarProps<T>) => (
  <AriaCalendar
    {...styled(className, styles.root, rootSizeStyles[size], style)}
    aria-label={props['aria-label'] ?? 'Calendar'}
    {...props}
  >
    <header {...styled(undefined, styles.header)}>
      <AriaButton slot="previous" className={makeNavButtonClassName(size)}>
        <ChevronLeftIcon />
      </AriaButton>
      <AriaHeading {...styled(undefined, styles.heading, headingSizeStyles[size])} />
      <AriaButton slot="next" className={makeNavButtonClassName(size)}>
        <ChevronRightIcon />
      </AriaButton>
    </header>
    <AriaCalendarGrid {...styled(undefined, styles.grid)}>
      <AriaCalendarGridHeader {...styled(undefined, styles.gridSection)}>
        {(day) => (
          <AriaCalendarHeaderCell
            {...styled(undefined, styles.headerCell, headerCellSizeStyles[size])}
          >
            {day}
          </AriaCalendarHeaderCell>
        )}
      </AriaCalendarGridHeader>
      <AriaCalendarGridBody {...styled(undefined, styles.gridSection)}>
        {(date) => (
          <AriaCalendarCell date={date} {...styled(undefined, styles.cell)}>
            {(values) => <span {...getCellButtonProps(size)}>{values.formattedDate}</span>}
          </AriaCalendarCell>
        )}
      </AriaCalendarGridBody>
    </AriaCalendarGrid>
    {errorMessage && <p {...styled(undefined, styles.error)}>{errorMessage}</p>}
  </AriaCalendar>
)

export interface RangeCalendarProps<T extends DateValue> extends Omit<
  AriaRangeCalendarProps<T>,
  'visibleDuration' | 'style'
> {
  /** Error message for invalid state */
  errorMessage?: string
  /** Visual size */
  size?: CalendarSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned calendar styling is constrained. */
  style?: stylex.StyleXStylesWithout<CalendarOwnedStyle>
}

/** Date range selection calendar */
export const RangeCalendar = <T extends DateValue>({
  size = 'md',
  errorMessage,
  className,
  style,
  ...props
}: RangeCalendarProps<T>) => (
  <AriaRangeCalendar
    {...styled(className, styles.root, rootSizeStyles[size], style)}
    aria-label={props['aria-label'] ?? 'Date range'}
    {...props}
  >
    <header {...styled(undefined, styles.header)}>
      <AriaButton slot="previous" className={makeNavButtonClassName(size)}>
        <ChevronLeftIcon />
      </AriaButton>
      <AriaHeading {...styled(undefined, styles.heading, headingSizeStyles[size])} />
      <AriaButton slot="next" className={makeNavButtonClassName(size)}>
        <ChevronRightIcon />
      </AriaButton>
    </header>
    <AriaCalendarGrid {...styled(undefined, styles.grid)}>
      <AriaCalendarGridHeader {...styled(undefined, styles.gridSection)}>
        {(day) => (
          <AriaCalendarHeaderCell
            {...styled(undefined, styles.headerCell, headerCellSizeStyles[size])}
          >
            {day}
          </AriaCalendarHeaderCell>
        )}
      </AriaCalendarGridHeader>
      <AriaCalendarGridBody {...styled(undefined, styles.gridSection)}>
        {(date) => (
          <AriaCalendarCell
            date={date}
            className={({ isSelected, isSelectionStart, isSelectionEnd }) =>
              stylex.props(
                styles.cell,
                isSelected && !isSelectionStart && !isSelectionEnd && styles.rangeHighlight,
              ).className ?? ''
            }
          >
            {(values) => <span {...getCellButtonProps(size)}>{values.formattedDate}</span>}
          </AriaCalendarCell>
        )}
      </AriaCalendarGridBody>
    </AriaCalendarGrid>
    {errorMessage && <p {...styled(undefined, styles.error)}>{errorMessage}</p>}
  </AriaRangeCalendar>
)
