/**
 * Grid component built on React Aria
 *
 * @see https://vercel.com/geist/grid
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'

/**
 * All spacing here is Tailwind's `--spacing` ramp at its default `0.25rem`, so
 * `gap-4` is `1rem` and so on.
 *
 * The `gap` variant is written as `rowGap` + `columnGap` rather than the `gap`
 * shorthand, deliberately. `gap`, `gapX` and `gapY` are independent props and
 * `defaultVariants` set `gap: 4`, so `<Grid gapX={8} gapY={2}>` applied all
 * three at once; under Tailwind the axis utilities won because `.gap-x-*` and
 * `.gap-y-*` are emitted after `.gap-*`. Expressed as longhands, that same
 * outcome falls out of argument order below and does not depend on how StyleX
 * expands a shorthand against a longhand.
 */
const styles = stylex.create({
  base: { display: 'grid' },

  cols1: { gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' },
  cols2: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  cols3: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
  cols4: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
  cols5: { gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' },
  cols6: { gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' },
  cols12: { gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' },

  gap0: { rowGap: 0, columnGap: 0 },
  gap1: { rowGap: '0.25rem', columnGap: '0.25rem' },
  gap2: { rowGap: '0.5rem', columnGap: '0.5rem' },
  gap3: { rowGap: '0.75rem', columnGap: '0.75rem' },
  gap4: { rowGap: '1rem', columnGap: '1rem' },
  gap5: { rowGap: '1.25rem', columnGap: '1.25rem' },
  gap6: { rowGap: '1.5rem', columnGap: '1.5rem' },
  gap8: { rowGap: '2rem', columnGap: '2rem' },
  gap10: { rowGap: '2.5rem', columnGap: '2.5rem' },
  gap12: { rowGap: '3rem', columnGap: '3rem' },

  gapX0: { columnGap: 0 },
  gapX1: { columnGap: '0.25rem' },
  gapX2: { columnGap: '0.5rem' },
  gapX3: { columnGap: '0.75rem' },
  gapX4: { columnGap: '1rem' },
  gapX5: { columnGap: '1.25rem' },
  gapX6: { columnGap: '1.5rem' },
  gapX8: { columnGap: '2rem' },

  gapY0: { rowGap: 0 },
  gapY1: { rowGap: '0.25rem' },
  gapY2: { rowGap: '0.5rem' },
  gapY3: { rowGap: '0.75rem' },
  gapY4: { rowGap: '1rem' },
  gapY5: { rowGap: '1.25rem' },
  gapY6: { rowGap: '1.5rem' },
  gapY8: { rowGap: '2rem' },

  alignStart: { alignItems: 'flex-start' },
  alignCenter: { alignItems: 'center' },
  alignEnd: { alignItems: 'flex-end' },
  alignStretch: { alignItems: 'stretch' },

  justifyStart: { justifyContent: 'flex-start' },
  justifyCenter: { justifyContent: 'center' },
  justifyEnd: { justifyContent: 'flex-end' },
  justifyBetween: { justifyContent: 'space-between' },

  flowRow: { gridAutoFlow: 'row' },
  flowCol: { gridAutoFlow: 'column' },
  flowDense: { gridAutoFlow: 'dense' },
  flowRowDense: { gridAutoFlow: 'row dense' },
  flowColDense: { gridAutoFlow: 'column dense' },
})

/** Column-count variants. */
export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6 | 12
/** Gap steps on both axes. */
export type GridGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12
/** Gap steps on a single axis. */
export type GridAxisGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8
/** Block-axis alignment variants. */
export type GridAlign = 'start' | 'center' | 'end' | 'stretch'
/** Inline-axis distribution variants. */
export type GridJustify = 'start' | 'center' | 'end' | 'between'
/** Auto-placement variants. */
export type GridFlow = 'row' | 'col' | 'dense' | 'rowDense' | 'colDense'

const columnStyles = {
  1: styles.cols1,
  2: styles.cols2,
  3: styles.cols3,
  4: styles.cols4,
  5: styles.cols5,
  6: styles.cols6,
  12: styles.cols12,
} as const

const gapStyles = {
  0: styles.gap0,
  1: styles.gap1,
  2: styles.gap2,
  3: styles.gap3,
  4: styles.gap4,
  5: styles.gap5,
  6: styles.gap6,
  8: styles.gap8,
  10: styles.gap10,
  12: styles.gap12,
} as const

const gapXStyles = {
  0: styles.gapX0,
  1: styles.gapX1,
  2: styles.gapX2,
  3: styles.gapX3,
  4: styles.gapX4,
  5: styles.gapX5,
  6: styles.gapX6,
  8: styles.gapX8,
} as const

const gapYStyles = {
  0: styles.gapY0,
  1: styles.gapY1,
  2: styles.gapY2,
  3: styles.gapY3,
  4: styles.gapY4,
  5: styles.gapY5,
  6: styles.gapY6,
  8: styles.gapY8,
} as const

const alignStyles = {
  start: styles.alignStart,
  center: styles.alignCenter,
  end: styles.alignEnd,
  stretch: styles.alignStretch,
} as const

const justifyStyles = {
  start: styles.justifyStart,
  center: styles.justifyCenter,
  end: styles.justifyEnd,
  between: styles.justifyBetween,
} as const

const flowStyles = {
  row: styles.flowRow,
  col: styles.flowCol,
  dense: styles.flowDense,
  rowDense: styles.flowRowDense,
  colDense: styles.flowColDense,
} as const

export interface GridProps {
  columns?: GridColumns | undefined
  gap?: GridGap | undefined
  gapX?: GridAxisGap | undefined
  gapY?: GridAxisGap | undefined
  align?: GridAlign | undefined
  justify?: GridJustify | undefined
  flow?: GridFlow | undefined
  /** Grid children */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** HTML element to render as */
  as?: 'div' | 'section' | 'article' | 'main' | 'ul'
}

/** Grid provides a CSS grid layout container */
export const Grid = ({
  children,
  columns = 1,
  gap = 4,
  gapX,
  gapY,
  align,
  justify,
  flow,
  className,
  as: Component = 'div',
}: GridProps) => {
  return (
    <Component
      {...styled(
        className,
        styles.base,
        columnStyles[columns],
        gapStyles[gap],
        gapX === undefined ? undefined : gapXStyles[gapX],
        gapY === undefined ? undefined : gapYStyles[gapY],
        align === undefined ? undefined : alignStyles[align],
        justify === undefined ? undefined : justifyStyles[justify],
        flow === undefined ? undefined : flowStyles[flow],
      )}
    >
      {children}
    </Component>
  )
}

const itemStyles = stylex.create({
  colSpan1: { gridColumn: 'span 1 / span 1' },
  colSpan2: { gridColumn: 'span 2 / span 2' },
  colSpan3: { gridColumn: 'span 3 / span 3' },
  colSpan4: { gridColumn: 'span 4 / span 4' },
  colSpan5: { gridColumn: 'span 5 / span 5' },
  colSpan6: { gridColumn: 'span 6 / span 6' },
  colSpan7: { gridColumn: 'span 7 / span 7' },
  colSpan8: { gridColumn: 'span 8 / span 8' },
  colSpan9: { gridColumn: 'span 9 / span 9' },
  colSpan10: { gridColumn: 'span 10 / span 10' },
  colSpan11: { gridColumn: 'span 11 / span 11' },
  colSpan12: { gridColumn: 'span 12 / span 12' },
  colSpanFull: { gridColumn: '1 / -1' },

  rowSpan1: { gridRow: 'span 1 / span 1' },
  rowSpan2: { gridRow: 'span 2 / span 2' },
  rowSpan3: { gridRow: 'span 3 / span 3' },
  rowSpan4: { gridRow: 'span 4 / span 4' },
  rowSpan5: { gridRow: 'span 5 / span 5' },
  rowSpan6: { gridRow: 'span 6 / span 6' },
  rowSpanFull: { gridRow: '1 / -1' },

  // StyleX types grid line numbers as `'auto' | string`, and a bare number
  // would get `px` appended, so these stay quoted.
  colStart1: { gridColumnStart: '1' },
  colStart2: { gridColumnStart: '2' },
  colStart3: { gridColumnStart: '3' },
  colStart4: { gridColumnStart: '4' },
  colStart5: { gridColumnStart: '5' },
  colStart6: { gridColumnStart: '6' },
  colStart7: { gridColumnStart: '7' },
  colStartAuto: { gridColumnStart: 'auto' },

  rowStart1: { gridRowStart: '1' },
  rowStart2: { gridRowStart: '2' },
  rowStart3: { gridRowStart: '3' },
  rowStart4: { gridRowStart: '4' },
  rowStartAuto: { gridRowStart: 'auto' },
})

/** Column-span variants. */
export type GridItemColSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'full'
/** Row-span variants. */
export type GridItemRowSpan = 1 | 2 | 3 | 4 | 5 | 6 | 'full'
/** Column-start variants. */
export type GridItemColStart = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'auto'
/** Row-start variants. */
export type GridItemRowStart = 1 | 2 | 3 | 4 | 'auto'

const colSpanStyles = {
  1: itemStyles.colSpan1,
  2: itemStyles.colSpan2,
  3: itemStyles.colSpan3,
  4: itemStyles.colSpan4,
  5: itemStyles.colSpan5,
  6: itemStyles.colSpan6,
  7: itemStyles.colSpan7,
  8: itemStyles.colSpan8,
  9: itemStyles.colSpan9,
  10: itemStyles.colSpan10,
  11: itemStyles.colSpan11,
  12: itemStyles.colSpan12,
  full: itemStyles.colSpanFull,
} as const

const rowSpanStyles = {
  1: itemStyles.rowSpan1,
  2: itemStyles.rowSpan2,
  3: itemStyles.rowSpan3,
  4: itemStyles.rowSpan4,
  5: itemStyles.rowSpan5,
  6: itemStyles.rowSpan6,
  full: itemStyles.rowSpanFull,
} as const

const colStartStyles = {
  1: itemStyles.colStart1,
  2: itemStyles.colStart2,
  3: itemStyles.colStart3,
  4: itemStyles.colStart4,
  5: itemStyles.colStart5,
  6: itemStyles.colStart6,
  7: itemStyles.colStart7,
  auto: itemStyles.colStartAuto,
} as const

const rowStartStyles = {
  1: itemStyles.rowStart1,
  2: itemStyles.rowStart2,
  3: itemStyles.rowStart3,
  4: itemStyles.rowStart4,
  auto: itemStyles.rowStartAuto,
} as const

export interface GridItemProps {
  colSpan?: GridItemColSpan
  rowSpan?: GridItemRowSpan
  colStart?: GridItemColStart
  rowStart?: GridItemRowStart
  /** Grid item children */
  children: ReactNode
  /** Optional class name */
  className?: string
}

/** GridItem is a child of Grid with span controls */
export const GridItem = ({
  children,
  colSpan,
  rowSpan,
  colStart,
  rowStart,
  className,
}: GridItemProps) => {
  return (
    <div
      {...styled(
        className,
        colSpan === undefined ? undefined : colSpanStyles[colSpan],
        rowSpan === undefined ? undefined : rowSpanStyles[rowSpan],
        colStart === undefined ? undefined : colStartStyles[colStart],
        rowStart === undefined ? undefined : rowStartStyles[rowStart],
      )}
    >
      {children}
    </div>
  )
}
