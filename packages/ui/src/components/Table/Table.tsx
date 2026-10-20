/**
 * Table component built on React Aria
 *
 * @see https://vercel.com/geist/table
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  Table as AriaTable,
  TableHeader as AriaTableHeader,
  TableBody as AriaTableBody,
  Row as AriaRow,
  Cell as AriaCell,
  Column as AriaColumn,
  ResizableTableContainer,
  ColumnResizer,
  Checkbox as AriaCheckbox,
  type TableProps as AriaTableProps,
  type TableHeaderProps as AriaTableHeaderProps,
  type TableBodyProps as AriaTableBodyProps,
  type RowProps as AriaRowProps,
  type CellProps as AriaCellProps,
  type ColumnProps as AriaColumnProps,
  type CheckboxRenderProps,
  type ColumnResizerRenderProps,
  type RowRenderProps,
  type SortDescriptor,
  type Selection,
  type Key,
  type TableBodyRenderProps,
} from 'react-aria-components'

import { styled, type StyledProps } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const skeletonShimmer = stylex.keyframes({
  '0%': { transform: 'translateX(-100%)' },
  '100%': { transform: 'translateX(100%)' },
})

const styles = stylex.create({
  container: {
    position: 'relative',
    width: '100%',
    overflow: 'auto',
  },
  table: {
    width: '100%',
    captionSide: 'bottom',
    textAlign: 'left',
    borderCollapse: 'collapse',
  },
  header: {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  headerSticky: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  column: {
    position: 'relative',
    paddingInline: scale.space4,
    textAlign: 'left',
    verticalAlign: 'middle',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    outlineWidth: 0,
    outlineStyle: 'none',
    ':focus-visible': {
      outlineWidth: '2px',
      outlineColor: tokens['--ds-focus-color'],
      outlineOffset: '-2px',
    },
  },
  columnStatic: {
    color: tokens['--ds-gray-900'],
  },
  columnSortable: {
    color: {
      default: tokens['--ds-gray-900'],
      ':hover': tokens['--ds-gray-1000'],
    },
    cursor: 'pointer',
    userSelect: 'none',
  },
  columnContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  sortIndicator: {
    flexShrink: 0,
    color: tokens['--ds-gray-700'],
    opacity: 0,
    transitionProperty: 'opacity',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  sortIndicatorActive: {
    opacity: 1,
  },
  resizer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: scale.space1,
    height: '100%',
    backgroundColor: 'transparent',
    cursor: 'col-resize',
  },
  resizerHovered: {
    backgroundColor: tokens['--ds-gray-alpha-400'],
  },
  resizerActive: {
    backgroundColor: tokens['--ds-blue-700'],
  },
  row: {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    outlineWidth: 0,
    outlineStyle: 'none',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  rowHovered: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  rowSelected: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  rowFocused: {
    outlineWidth: '2px',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: '-2px',
  },
  cell: {
    paddingInline: scale.space4,
    verticalAlign: 'middle',
    color: tokens['--ds-gray-1000'],
    outlineWidth: 0,
    outlineStyle: 'none',
    ':focus-visible': {
      outlineWidth: '2px',
      outlineColor: tokens['--ds-focus-color'],
      outlineOffset: '-2px',
    },
  },
  checkboxCell: {
    width: scale.space10,
    paddingLeft: scale.space4,
    paddingRight: 0,
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: scale.space5,
    height: scale.space5,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-600'],
    borderRadius: '2px',
    backgroundColor: tokens['--ds-background-100'],
    cursor: 'pointer',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  checkboxSelected: {
    borderColor: tokens['--ds-gray-1000'],
    backgroundColor: tokens['--ds-gray-1000'],
  },
  checkboxFocused: {
    // Tailwind's ring offset defaults to opaque white. Preserve the visible
    // white band in dark mode rather than folding this into the theme surface.
    boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${tokens['--ds-gray-1000']}`,
  },
  checkboxIcon: {
    width: scale.space3,
    height: scale.space3,
    color: tokens['--ds-background-100'],
    opacity: 0,
  },
  checkboxIconActive: {
    opacity: 1,
  },
  emptyState: {
    paddingBlock: scale.space12,
    color: tokens['--ds-gray-700'],
    textAlign: 'center',
  },
  skeleton: {
    position: 'relative',
    width: '72%',
    height: scale.space4,
    overflow: 'hidden',
    borderRadius: '0.25rem',
    backgroundColor: tokens['--ds-gray-200'],
  },
  skeletonWidth88: {
    width: '88%',
  },
  skeletonWidth64: {
    width: '64%',
  },
  skeletonWidth80: {
    width: '80%',
  },
  skeletonWidth96: {
    width: '96%',
  },
  skeletonShimmer: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `linear-gradient(90deg, transparent, ${tokens['--ds-gray-300']}, transparent)`,
    animationName: skeletonShimmer,
    animationDuration: '1.5s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
  iconSm: {
    width: scale.space3,
    height: scale.space3,
  },
  iconMd: {
    width: scale.space4,
    height: scale.space4,
  },
  columnCompact: {
    height: scale.space8,
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  columnDefault: {
    height: '2.25rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  columnRelaxed: {
    height: scale.space12,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  cellCompact: {
    paddingBlock: scale.space1,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  cellDefault: {
    paddingBlock: '0.625rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  cellRelaxed: {
    paddingBlock: scale.space4,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
})

/** Table density. Root `size` remains inert; thread it to columns and cells. */
type TableSize = 'compact' | 'default' | 'relaxed'

const columnSizeStyles = {
  compact: styles.columnCompact,
  default: styles.columnDefault,
  relaxed: styles.columnRelaxed,
} as const

const cellSizeStyles = {
  compact: styles.cellCompact,
  default: styles.cellDefault,
  relaxed: styles.cellRelaxed,
} as const

const skeletonWidthStyles = [
  undefined,
  styles.skeletonWidth88,
  styles.skeletonWidth64,
  styles.skeletonWidth80,
  styles.skeletonWidth96,
] as const

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type TableOwnedStyle = OwnedStyle<
  | 'width'
  | 'minWidth'
  | 'maxWidth'
  | 'inlineSize'
  | 'minInlineSize'
  | 'maxInlineSize'
  | 'captionSide'
  | 'textAlign'
  | 'borderCollapse'
>

type TableHeaderOwnedStyle = OwnedStyle<
  | 'border'
  | 'borderBottom'
  | 'borderBlockEnd'
  | 'borderWidth'
  | 'borderBottomWidth'
  | 'borderBlockEndWidth'
  | 'borderStyle'
  | 'borderBottomStyle'
  | 'borderBlockEndStyle'
  | 'borderColor'
  | 'borderBottomColor'
  | 'borderBlockEndColor'
  | 'position'
  | 'top'
  | 'insetBlockStart'
  | 'zIndex'
>

type TableColumnOwnedStyle = OwnedStyle<
  | 'position'
  | 'width'
  | 'minWidth'
  | 'maxWidth'
  | 'inlineSize'
  | 'minInlineSize'
  | 'maxInlineSize'
  | 'height'
  | 'minHeight'
  | 'maxHeight'
  | 'blockSize'
  | 'minBlockSize'
  | 'maxBlockSize'
  | 'padding'
  | 'paddingBlock'
  | 'paddingInline'
  | 'paddingBlockStart'
  | 'paddingBlockEnd'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'textAlign'
  | 'verticalAlign'
  | 'font'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'color'
  | 'whiteSpace'
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
  | 'cursor'
  | 'userSelect'
>

type TableRowOwnedStyle = OwnedStyle<
  | 'border'
  | 'borderBottom'
  | 'borderBlockEnd'
  | 'borderWidth'
  | 'borderBottomWidth'
  | 'borderBlockEndWidth'
  | 'borderStyle'
  | 'borderBottomStyle'
  | 'borderBlockEndStyle'
  | 'borderColor'
  | 'borderBottomColor'
  | 'borderBlockEndColor'
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
  | 'transition'
  | 'transitionProperty'
  | 'transitionDuration'
  | 'transitionTimingFunction'
  | 'background'
  | 'backgroundColor'
>

type TableCellOwnedStyle = OwnedStyle<
  | 'padding'
  | 'paddingBlock'
  | 'paddingInline'
  | 'paddingBlockStart'
  | 'paddingBlockEnd'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'verticalAlign'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
  | 'color'
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
>

type TableCheckboxCellOwnedStyle = TableCellOwnedStyle &
  OwnedStyle<'width' | 'minWidth' | 'maxWidth' | 'inlineSize' | 'minInlineSize' | 'maxInlineSize'>

type TableRowStyle = stylex.StyleXStylesWithout<TableRowOwnedStyle>

/** Checkmark icon for selection */
const CheckIcon = () => (
  <svg
    {...styled(undefined, styles.iconSm)}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Minus icon for indeterminate selection */
const MinusIcon = () => (
  <svg
    {...styled(undefined, styles.iconSm)}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M2 6H10" strokeLinecap="round" />
  </svg>
)

/** Sort ascending icon */
const SortAscIcon = () => (
  <svg {...styled(undefined, styles.iconMd)} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 4L12 9H4L8 4Z" />
  </svg>
)

/** Sort descending icon */
const SortDescIcon = () => (
  <svg {...styled(undefined, styles.iconMd)} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 12L4 7H12L8 12Z" />
  </svg>
)

const TableSelectionCheckbox = () => (
  <AriaCheckbox
    slot="selection"
    className={({ isSelected, isIndeterminate, isFocusVisible }: CheckboxRenderProps) =>
      styled(
        undefined,
        styles.checkbox,
        (isSelected || isIndeterminate) && styles.checkboxSelected,
        isFocusVisible && styles.checkboxFocused,
      ).className ?? ''
    }
  >
    {({ isSelected, isIndeterminate }) => (
      <span
        {...styled(
          undefined,
          styles.checkboxIcon,
          (isSelected || isIndeterminate) && styles.checkboxIconActive,
        )}
      >
        {isIndeterminate ? <MinusIcon /> : isSelected ? <CheckIcon /> : null}
      </span>
    )}
  </AriaCheckbox>
)

const makeTableRowStyleProps = ({
  className,
  style,
}: {
  className: string | undefined
  style: TableRowStyle | undefined
}) => {
  let cached:
    | {
        key: number
        props: StyledProps
      }
    | undefined

  const resolve = ({ isHovered, isSelected, isFocusVisible }: RowRenderProps): StyledProps => {
    const key = (isHovered ? 1 : 0) | (isSelected ? 2 : 0) | (isFocusVisible ? 4 : 0)
    if (cached?.key === key) return cached.props

    const props = styled(
      className,
      styles.row,
      isHovered && styles.rowHovered,
      isSelected && styles.rowSelected,
      isFocusVisible && styles.rowFocused,
      style,
    )
    cached = { key, props }
    return props
  }

  return {
    className: (values: RowRenderProps) => resolve(values).className ?? '',
    style: (values: RowRenderProps) => resolve(values).style ?? {},
  }
}

export interface TableProps extends Omit<AriaTableProps, 'children' | 'className' | 'style'> {
  /** Table content */
  children: ReactNode
  /** Density selection. Kept root-inert for compatibility; thread to subcomponents. */
  size?: TableSize | undefined
  /** Enable column resizing */
  resizable?: boolean
  /** Sticky selection. Kept root-inert for compatibility; pass to TableHeader. */
  sticky?: boolean
  /** Render table without scroll container wrapper (for custom virtualization) */
  bare?: boolean
  /** Legacy root loading prop. Kept inert; loading is rendered by TableBody. */
  isLoading?: boolean
  /** Legacy root skeleton count. Kept inert; loading is rendered by TableBody. */
  loadingRowCount?: number
  /** Legacy root empty content. Kept inert; empty content is rendered by TableBody. */
  emptyState?: ReactNode
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned table geometry is constrained. */
  style?: stylex.StyleXStylesWithout<TableOwnedStyle>
}

/** Data table with sorting, selection, and resizable columns */
export const Table = ({
  children,
  size: _size,
  sticky: _sticky,
  resizable = false,
  bare = false,
  className,
  style,
  ...props
}: TableProps) => {
  const tableContent = (
    <AriaTable {...styled(className, styles.table, style)} {...props}>
      {children}
    </AriaTable>
  )

  if (bare) {
    return tableContent
  }

  if (resizable) {
    return (
      <ResizableTableContainer {...styled(undefined, styles.container)}>
        {tableContent}
      </ResizableTableContainer>
    )
  }

  return <div {...styled(undefined, styles.container)}>{tableContent}</div>
}

export interface TableHeaderProps<T extends object> extends Omit<
  AriaTableHeaderProps<T>,
  'className' | 'style'
> {
  size?: TableSize | undefined
  sticky?: boolean
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned header styling is constrained. */
  style?: stylex.StyleXStylesWithout<TableHeaderOwnedStyle>
}

/** Table header container */
export const TableHeader = <T extends object>({
  className,
  size: _size,
  sticky = false,
  style,
  ...props
}: TableHeaderProps<T>) => {
  return (
    <AriaTableHeader
      {...styled(className, styles.header, sticky && styles.headerSticky, style)}
      {...props}
    />
  )
}

export interface TableColumnProps extends Omit<AriaColumnProps, 'width' | 'className' | 'style'> {
  size?: TableSize | undefined
  /** Allow resizing this column */
  allowsResizing?: boolean
  /** Column width (CSS value) - use style prop for string widths, or defaultWidth for numeric */
  columnWidth?: string | number
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned column styling is constrained. */
  style?: stylex.StyleXStylesWithout<TableColumnOwnedStyle>
}

/** Table column header */
export const TableColumn = ({
  children,
  allowsSorting = false,
  allowsResizing,
  columnWidth,
  minWidth,
  maxWidth,
  size = 'default',
  className,
  style,
  ...props
}: TableColumnProps) => {
  const styleProps = styled(
    className,
    styles.column,
    allowsSorting ? styles.columnSortable : styles.columnStatic,
    columnSizeStyles[size],
    style,
  )
  const columnProps: AriaColumnProps = {
    ...styleProps,
    allowsSorting,
    ...props,
  }

  if (typeof columnWidth === 'string') {
    columnProps.style = { ...styleProps.style, width: columnWidth }
  } else if (typeof columnWidth === 'number') {
    columnProps.defaultWidth = columnWidth
  }

  if (minWidth !== undefined) {
    columnProps.minWidth = minWidth
  }

  if (maxWidth !== undefined) {
    columnProps.maxWidth = maxWidth
  }

  return (
    <AriaColumn {...columnProps}>
      {({ sortDirection, allowsSorting: isSortable }) => (
        <>
          <div {...styled(undefined, styles.columnContent)}>
            {typeof children === 'function' ? null : children}
            {isSortable && (
              <span
                {...styled(
                  undefined,
                  styles.sortIndicator,
                  sortDirection !== undefined && styles.sortIndicatorActive,
                )}
                data-sort-direction={sortDirection ?? undefined}
              >
                {sortDirection === 'ascending' ? <SortAscIcon /> : <SortDescIcon />}
              </span>
            )}
          </div>
          {allowsResizing && (
            <ColumnResizer
              className={({ isHovered, isResizing, isFocusVisible }: ColumnResizerRenderProps) =>
                styled(
                  undefined,
                  styles.resizer,
                  isHovered && styles.resizerHovered,
                  (isResizing || isFocusVisible) && styles.resizerActive,
                ).className ?? ''
              }
            />
          )}
        </>
      )}
    </AriaColumn>
  )
}

export interface TableBodyProps<T extends object> extends Omit<
  AriaTableBodyProps<T>,
  'renderEmptyState' | 'className' | 'style'
> {
  size?: TableSize | undefined
  /** Content to show when table is empty */
  emptyState?: ReactNode
  /** Loading state - shows skeleton rows */
  isLoading?: boolean
  /** Number of skeleton rows to show when loading */
  loadingRowCount?: number
  /** Number of columns (for skeleton rows) */
  columnCount?: number
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. The body owns no visual properties. */
  style?: stylex.StyleXStyles
}

/** Table body container */
export const TableBody = <T extends object>({
  children,
  emptyState,
  isLoading,
  loadingRowCount = 5,
  columnCount = 3,
  size = 'default',
  className,
  style,
  ...props
}: TableBodyProps<T>) => {
  if (isLoading) {
    return (
      <AriaTableBody {...styled(className, style)} {...props}>
        {Array.from({ length: loadingRowCount }).map((_, rowIndex) => (
          <AriaRow key={rowIndex} {...styled(undefined, styles.row)}>
            {Array.from({ length: columnCount }).map((_, cellIndex) => (
              <AriaCell key={cellIndex} {...styled(undefined, styles.cell, cellSizeStyles[size])}>
                <TableSkeleton index={rowIndex * columnCount + cellIndex} />
              </AriaCell>
            ))}
          </AriaRow>
        ))}
      </AriaTableBody>
    )
  }

  if (emptyState) {
    return (
      <AriaTableBody
        {...styled(className, style)}
        renderEmptyState={(_props: TableBodyRenderProps) => (
          <tr>
            <td {...styled(undefined, styles.emptyState)}>{emptyState}</td>
          </tr>
        )}
        {...props}
      >
        {children}
      </AriaTableBody>
    )
  }

  return (
    <AriaTableBody {...styled(className, style)} {...props}>
      {children}
    </AriaTableBody>
  )
}

export interface TableRowProps<T extends object> extends Omit<
  AriaRowProps<T>,
  'className' | 'style'
> {
  size?: TableSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned row states are constrained. */
  style?: TableRowStyle
}

/** Table row */
export const TableRow = <T extends object>({
  className,
  size: _size,
  style,
  ...props
}: TableRowProps<T>) => {
  return <AriaRow {...makeTableRowStyleProps({ className, style })} {...props} />
}

export interface TableCellProps extends Omit<AriaCellProps, 'className' | 'style'> {
  size?: TableSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned cell styling is constrained. */
  style?: stylex.StyleXStylesWithout<TableCellOwnedStyle>
}

/** Table cell */
export const TableCell = ({ className, size = 'default', style, ...props }: TableCellProps) => {
  return <AriaCell {...styled(className, styles.cell, cellSizeStyles[size], style)} {...props} />
}

export interface TableCheckboxCellProps {
  size?: TableSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned selection cell styling is constrained. */
  style?: stylex.StyleXStylesWithout<TableCheckboxCellOwnedStyle>
}

/** Table cell for row selection checkbox - use within TableRow */
export const TableCheckboxCell = ({
  className,
  size = 'default',
  style,
}: TableCheckboxCellProps) => {
  return (
    <AriaCell {...styled(className, styles.cell, cellSizeStyles[size], styles.checkboxCell, style)}>
      <TableSelectionCheckbox />
    </AriaCell>
  )
}

export interface TableSelectAllColumnProps {
  size?: TableSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned selection column styling is constrained. */
  style?: stylex.StyleXStylesWithout<TableColumnOwnedStyle & TableCheckboxCellOwnedStyle>
}

/** Table column for "select all" checkbox - use within TableHeader */
export const TableSelectAllColumn = ({
  className,
  size = 'default',
  style,
}: TableSelectAllColumnProps) => {
  return (
    <AriaColumn
      {...styled(
        className,
        styles.column,
        styles.columnStatic,
        columnSizeStyles[size],
        styles.checkboxCell,
        style,
      )}
    >
      <TableSelectionCheckbox />
    </AriaColumn>
  )
}

/** Skeleton loading component for table cells */
const TableSkeleton = ({ index }: { index: number }) => {
  const widthStyle = skeletonWidthStyles[index % skeletonWidthStyles.length]
  return (
    <div {...styled(undefined, styles.skeleton, widthStyle)}>
      <div {...styled(undefined, styles.skeletonShimmer)} />
    </div>
  )
}

/** Re-export types for consumers */
export type { SortDescriptor, Selection, Key }
