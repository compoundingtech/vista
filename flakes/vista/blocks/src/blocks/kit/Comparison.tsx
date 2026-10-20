import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import type { ReactNode } from 'react'

/** Props for Comparison: peer columns, one row per measure, and what the peers share. */
export interface ComparisonProps {
  /** Peer names, e.g. `['Before', 'After']` or option names. */
  readonly columns: readonly string[]
  /** One row per measure: `[measure, ...value per column]`. */
  readonly rows: readonly (readonly [string, ...ReactNode[]])[]
  /** What is identical across peers, shown once instead of repeated per column. */
  readonly same?: ReactNode
}

/** Aligned peers (options, before/after) measured on the same rows (MED.DOC.TASTE-R04). */
export const Comparison = ({ columns, rows, same }: ComparisonProps) => (
  <table {...stylex.props(styles.table)}>
    <thead>
      <tr>
        <th {...stylex.props(styles.cell, styles.head)} scope="col">
          <span {...stylex.props(styles.hidden)}>Measure</span>
        </th>
        {columns.map((column) => (
          <th key={column} {...stylex.props(styles.cell, styles.head)} scope="col">
            {column}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map(([measure, ...values]) => (
        <tr key={measure}>
          <th {...stylex.props(styles.cell, styles.measure)} scope="row">
            {measure}
          </th>
          {columns.map((column, index) => (
            <td key={column} {...stylex.props(styles.cell, styles.value)}>
              {values[index]}
            </td>
          ))}
        </tr>
      ))}
      {same === undefined ? null : (
        <tr>
          <th {...stylex.props(styles.cell, styles.measure, styles.same)} scope="row">
            Same in all
          </th>
          <td {...stylex.props(styles.cell, styles.same)} colSpan={columns.length}>
            {same}
          </td>
        </tr>
      )}
    </tbody>
  </table>
)

const styles = stylex.create({
  table: {
    width: '100%',
    maxWidth: '48rem',
    borderCollapse: 'collapse',
    fontSize: '0.8125rem',
    fontVariantNumeric: 'tabular-nums',
    color: tokens['--ds-gray-1000'],
  },
  cell: {
    textAlign: 'left',
    verticalAlign: 'baseline',
    paddingBlock: '0.5rem',
    paddingInline: '0 0.75rem',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-200'],
  },
  head: {
    fontSize: '0.75rem',
    fontWeight: 600,
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  measure: {
    width: '40%',
    fontWeight: 400,
    color: tokens['--ds-gray-900'],
  },
  value: {
    fontWeight: 600,
  },
  same: {
    fontSize: '0.75rem',
    fontWeight: 400,
    color: tokens['--ds-gray-800'],
    borderBottomWidth: 0,
  },
  hidden: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  },
})
