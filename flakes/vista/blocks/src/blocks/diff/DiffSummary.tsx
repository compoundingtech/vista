/**
 * Aggregate, class- or section-level change summary: semantic delta chips such as
 * `13 moved · parent: Inbox → Archive`, in the shared change-kind colors, optionally with a
 * ledger that reconciles the totals (`before + Σ deltas = after`) so a reviewer can trust
 * that every change is accounted for.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import type * as React from 'react'

import type { ChangeKind } from './contract.ts'
import { changeKindLabel, changeKindStyles, withOccurrenceKeys } from './DiffFrame.tsx'

/** One semantic delta, e.g. `{ kind: 'moved', label: 'parent: Inbox → Archive', count: 13 }`. */
export interface DiffSummaryDelta {
  readonly kind: ChangeKind
  /** What changed, phrased for the class of items, not one item. */
  readonly label: React.ReactNode
  /** How many items the delta covers; omit for a single qualitative change. */
  readonly count?: number
}

/** One ledger step: how a delta moves the total (`0` for moves and in-place edits). */
export interface DiffLedgerStep {
  readonly kind: ChangeKind
  readonly label: string
  readonly delta: number
}

/** Reconciles a total across the change: `before.value + Σ steps.delta` must equal `after.value`. */
export interface DiffLedger {
  /** Unit of the totals, e.g. `pages`. */
  readonly unit?: string
  readonly before: { readonly label: string; readonly value: number }
  readonly steps: readonly DiffLedgerStep[]
  readonly after: { readonly label: string; readonly value: number }
}

/** Inputs for {@link DiffSummary}: the chip rows plus an optional before/after ledger. */
export interface DiffSummaryProps {
  /** Optional heading, e.g. the class or section the deltas aggregate over. */
  readonly title?: React.ReactNode
  readonly deltas: readonly DiffSummaryDelta[]
  readonly ledger?: DiffLedger
}

const formatDelta = (delta: number): string =>
  delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '±0'

/** Chip identity: kind plus the label when it is plain text (rich labels fall back to kind). */
const deltaIdentity = (delta: DiffSummaryDelta): string =>
  typeof delta.label === 'string' || typeof delta.label === 'number'
    ? `${delta.kind}:${delta.label}`
    : delta.kind

/** Row of semantic delta chips plus an optional reconciliation ledger. */
export const DiffSummary = ({ title, deltas, ledger }: DiffSummaryProps) => {
  const reconciled =
    ledger === undefined
      ? undefined
      : ledger.after.value -
        ledger.steps.reduce((total, step) => total + step.delta, ledger.before.value)
  return (
    <div {...stylex.props(styles.root)}>
      {title === undefined ? null : <div {...stylex.props(styles.title)}>{title}</div>}
      <ul aria-label="Change summary" {...stylex.props(styles.chips)}>
        {withOccurrenceKeys(deltas, deltaIdentity).map(({ key, item: delta }) => (
          <li
            key={key}
            data-change-kind={delta.kind}
            {...stylex.props(
              styles.chip,
              changeKindStyles[delta.kind],
              delta.kind === 'moved' && styles.chipMoved,
              delta.kind === 'unchanged' && styles.chipUnchanged,
            )}
          >
            <span {...stylex.props(styles.kind, kindColor[delta.kind])}>
              {delta.count === undefined
                ? changeKindLabel[delta.kind]
                : `${delta.count} ${changeKindLabel[delta.kind]}`}
            </span>
            <span {...stylex.props(styles.label)}>{delta.label}</span>
          </li>
        ))}
      </ul>
      {ledger === undefined ? null : (
        <table {...stylex.props(styles.ledger)}>
          <caption {...stylex.props(styles.caption)}>
            Ledger{ledger.unit === undefined ? '' : ` (${ledger.unit})`}
          </caption>
          <tbody>
            <tr {...stylex.props(styles.totalRow)}>
              <th scope="row" {...stylex.props(styles.rowLabel)}>
                {ledger.before.label}
              </th>
              <td {...stylex.props(styles.value)}>{ledger.before.value}</td>
            </tr>
            {ledger.steps.map((step) => (
              <tr key={step.label} data-change-kind={step.kind}>
                <th scope="row" {...stylex.props(styles.rowLabel, styles.stepLabel)}>
                  <span aria-hidden {...stylex.props(styles.swatch, changeKindStyles[step.kind])} />
                  {step.label}
                </th>
                <td {...stylex.props(styles.value, kindColor[step.kind])}>
                  {formatDelta(step.delta)}
                </td>
              </tr>
            ))}
            <tr {...stylex.props(styles.totalRow, styles.afterRow)}>
              <th scope="row" {...stylex.props(styles.rowLabel)}>
                {ledger.after.label}
              </th>
              <td {...stylex.props(styles.value)}>{ledger.after.value}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={2}
                data-reconciled={reconciled === 0}
                {...stylex.props(
                  styles.status,
                  reconciled === 0 ? styles.statusOk : styles.statusOff,
                )}
              >
                {reconciled === 0
                  ? 'reconciled: every change is accounted for'
                  : `does not reconcile: ${formatDelta(reconciled ?? 0)} unaccounted`}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

const kindColor = stylex.create({
  added: { color: tokens['--ds-green-900'] },
  removed: { color: tokens['--ds-red-900'] },
  changed: { color: tokens['--ds-amber-900'] },
  moved: { color: tokens['--ds-blue-700'] },
  unchanged: { color: tokens['--ds-gray-900'] },
})

const styles = stylex.create({
  root: {
    display: 'grid',
    gap: scale.space2,
    minWidth: 0,
    color: tokens['--ds-gray-1000'],
  },
  title: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: tokens['--ds-gray-900'],
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: scale.space2,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    maxWidth: '100%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: scale.radiusSm,
    paddingInline: '0.45rem',
    paddingBlock: '0.1rem',
    fontSize: '0.75rem',
    lineHeight: 1.5,
  },
  chipMoved: {
    borderStyle: 'dashed',
  },
  chipUnchanged: {
    borderColor: tokens['--ds-gray-alpha-400'],
  },
  kind: {
    flexShrink: 0,
    fontWeight: 650,
    fontVariantNumeric: 'tabular-nums',
  },
  label: {
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  ledger: {
    borderCollapse: 'collapse',
    fontSize: '0.75rem',
    width: 'max-content',
    maxWidth: '100%',
  },
  caption: {
    captionSide: 'top',
    textAlign: 'start',
    fontSize: '0.68rem',
    fontFamily: scale.fontMono,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens['--ds-gray-900'],
    paddingBottom: scale.space1,
  },
  totalRow: {
    fontWeight: 600,
  },
  afterRow: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
  },
  rowLabel: {
    textAlign: 'start',
    fontWeight: 'inherit',
    paddingBlock: '0.15rem',
    paddingInlineEnd: scale.space4,
  },
  stepLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontWeight: 400,
    paddingInlineStart: scale.space2,
  },
  swatch: {
    display: 'inline-block',
    width: '0.6rem',
    height: '0.6rem',
    borderRadius: 2,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  value: {
    textAlign: 'end',
    fontFamily: scale.fontMono,
    fontVariantNumeric: 'tabular-nums',
    paddingBlock: '0.15rem',
  },
  status: {
    paddingTop: scale.space1,
    fontSize: '0.7rem',
  },
  statusOk: {
    color: tokens['--ds-gray-900'],
  },
  statusOff: {
    color: tokens['--ds-red-900'],
    fontWeight: 600,
  },
})
