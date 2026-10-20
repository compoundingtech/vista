'use client'

import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'

import type { ChecksState } from '../provider-contracts.ts'

/** Carries the row markup that the summary frame places inside its scrollable, headered table. */
export interface PullRequestStackSummaryFrameProps {
  readonly children?: React.ReactNode
}

/**
 * Renders the scrollable table shell with Pull request and Tier column headers and lays the
 * supplied children rows inside it.
 */
export const PullRequestStackSummaryFrame = ({
  children,
}: PullRequestStackSummaryFrameProps): React.ReactNode => (
  <div {...stylex.props(styles.tableScroll)}>
    <table {...stylex.props(styles.table)} aria-label="Pull request stack summary">
      <thead>
        <tr>
          <th scope="col" {...stylex.props(styles.cell)}>
            Pull request
          </th>
          <th scope="col" {...stylex.props(styles.cell)}>
            Tier
          </th>
          <th scope="col" {...stylex.props(styles.cell)}>
            State
          </th>
          <th scope="col" {...stylex.props(styles.cell)}>
            Merge
          </th>
          <th scope="col" {...stylex.props(styles.cell)}>
            Review
          </th>
          <th scope="col" {...stylex.props(styles.cell)}>
            Checks
          </th>
          <th scope="col" {...stylex.props(styles.cell)}>
            Head
          </th>
          <th scope="col" {...stylex.props(styles.cell, styles.linksCell)}>
            Links
          </th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
)

const statePresentation = (state: ChecksState['pullRequest']): readonly [string, string] => {
  if (state.isDraft) return ['◌', 'Draft']
  switch (state.state) {
    case 'open':
      return ['●', 'Open']
    case 'closed':
      return ['×', 'Closed']
    case 'merged':
      return ['◆', 'Merged']
  }
}

const mergePresentation = (
  mergeable: ChecksState['pullRequest']['mergeable'],
): readonly [string, string] => {
  switch (mergeable) {
    case 'mergeable':
      return ['✓', 'Mergeable']
    case 'conflicting':
      return ['×', 'Conflicting']
    case 'unknown':
      return ['?', 'Mergeability unknown']
  }
}

const reviewPresentation = (
  reviewDecision: ChecksState['pullRequest']['reviewDecision'],
): readonly [string, string] => {
  switch (reviewDecision) {
    case 'approved':
      return ['✓', 'Review approved']
    case 'changes_requested':
      return ['×', 'Changes requested']
    case 'review_required':
      return ['…', 'Review required']
    case null:
      return ['?', 'Review decision unavailable']
  }
}

const conclusionPresentation = (state: ChecksState): readonly [string, string, string?] => {
  const run = state.latestWorkflowRun
  if (run === null) return ['–', 'No workflow run']
  if (run.headSha !== state.pullRequest.headSha) {
    const runHead = run.headSha.slice(0, 7)
    const currentHead = state.pullRequest.headSha.slice(0, 7)
    return ['?', `Checks stale: run ${runHead}, current head ${currentHead}`, `Stale ${runHead}`]
  }
  if (run.status !== 'completed' || run.conclusion === null) return ['…', 'Checks in progress']
  switch (run.conclusion) {
    case 'success':
      return ['✓', 'Checks successful']
    case 'failure':
    case 'timed_out':
    case 'action_required':
      return ['×', `Checks ${run.conclusion.replaceAll('_', ' ')}`]
    case 'cancelled':
    case 'neutral':
    case 'skipped':
      return ['–', `Checks ${run.conclusion}`]
  }
}

const Glyph = ({ presentation }: { readonly presentation: readonly [string, string, string?] }) => (
  <span title={presentation[1]} aria-label={presentation[1]} {...stylex.props(styles.status)}>
    <span {...stylex.props(styles.glyph)}>{presentation[0]}</span>
    {presentation[2] === undefined ? null : (
      <span {...stylex.props(styles.statusDetail)}>{presentation[2]}</span>
    )}
  </span>
)

/**
 * Describes one stack row's checks state and optional tier label, its selection flag, the full
 * ordered PR list for keyboard navigation, and the selection callback.
 */
export interface PullRequestStackSummaryRowViewProps {
  readonly state: ChecksState
  readonly tier?: string
  readonly selected: boolean
  readonly orderedPrs: readonly number[]
  readonly onSelect: (pr: number) => void
}

/**
 * Renders one selectable PR row whose ArrowUp/ArrowDown handling moves the selection to the
 * adjacent PR in the ordered stack.
 */
export const PullRequestStackSummaryRowView = ({
  state,
  tier,
  selected,
  orderedPrs,
  onSelect,
}: PullRequestStackSummaryRowViewProps): React.ReactNode => {
  const pr = state.pullRequest.number
  const moveSelection = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const current = orderedPrs.indexOf(pr)
    if (current === -1 || orderedPrs.length === 0) return
    const delta = event.key === 'ArrowDown' ? 1 : -1
    const next = orderedPrs[(current + delta + orderedPrs.length) % orderedPrs.length]
    if (next === undefined) return
    onSelect(next)
    event.currentTarget
      .closest('tbody')
      ?.querySelector<HTMLButtonElement>(`button[data-pr-select="${String(next)}"]`)
      ?.focus()
  }
  const workflow = state.latestWorkflowRun

  return (
    <tr
      data-vista-pr-summary-row={pr}
      data-selected={selected ? 'true' : undefined}
      {...stylex.props(styles.row, selected && styles.selectedRow)}
      onClick={(event) => {
        if ((event.target as Element).closest('a, button') === null) onSelect(pr)
      }}
    >
      <th scope="row" {...stylex.props(styles.cell, styles.prCell)}>
        <a href={state.pullRequest.url} {...stylex.props(styles.prLink)}>
          #{pr}
        </a>
        <button
          type="button"
          data-pr-select={pr}
          aria-label={`Select pull request #${String(pr)}: ${state.pullRequest.title}`}
          aria-pressed={selected}
          {...stylex.props(styles.selectButton)}
          onClick={() => onSelect(pr)}
          onKeyDown={moveSelection}
        >
          {state.pullRequest.title}
        </button>
      </th>
      <td {...stylex.props(styles.cell, styles.tier)}>{tier ?? '—'}</td>
      <td {...stylex.props(styles.cell)}>
        <Glyph presentation={statePresentation(state.pullRequest)} />
      </td>
      <td {...stylex.props(styles.cell)}>
        <Glyph presentation={mergePresentation(state.pullRequest.mergeable)} />
      </td>
      <td {...stylex.props(styles.cell)}>
        <Glyph presentation={reviewPresentation(state.pullRequest.reviewDecision)} />
      </td>
      <td {...stylex.props(styles.cell)}>
        <Glyph presentation={conclusionPresentation(state)} />
      </td>
      <td {...stylex.props(styles.cell)}>
        <code {...stylex.props(styles.headChip)} title={state.pullRequest.headRef}>
          {state.pullRequest.headRef}
        </code>
      </td>
      <td {...stylex.props(styles.cell, styles.linksCell)}>
        <a href={state.pullRequest.url}>PR</a>
        {workflow === null ? null : <a href={workflow.url}>Run</a>}
      </td>
    </tr>
  )
}

const styles = stylex.create({
  tableScroll: {
    maxWidth: '100%',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.78rem',
    fontVariantNumeric: 'tabular-nums',
  },
  row: {
    cursor: 'pointer',
    backgroundColor: {
      default: 'transparent',
      ':hover': tokens['--ds-gray-alpha-100'],
    },
  },
  selectedRow: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  cell: {
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    paddingBlock: scale.space2,
    paddingInline: scale.space2,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  prCell: {
    display: 'flex',
    alignItems: 'baseline',
    gap: scale.space2,
    minWidth: '18rem',
    maxWidth: '30rem',
  },
  prLink: {
    flex: 'none',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontWeight: 600,
  },
  selectButton: {
    minWidth: 0,
    overflow: 'hidden',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: tokens['--ds-foreground'],
    font: 'inherit',
    fontWeight: 520,
    textAlign: 'left',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  tier: {
    color: tokens['--ds-gray-900'],
    fontWeight: 600,
  },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space1,
  },
  glyph: {
    display: 'inline-flex',
    width: '1rem',
    justifyContent: 'center',
    color: tokens['--ds-gray-900'],
    fontWeight: 650,
  },
  statusDetail: {
    color: tokens['--ds-gray-900'],
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.7rem',
  },
  headChip: {
    display: 'inline-block',
    maxWidth: '13rem',
    overflow: 'hidden',
    paddingBlock: '0.08rem',
    paddingInline: '0.35rem',
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-gray-alpha-200'],
    textOverflow: 'ellipsis',
    verticalAlign: 'middle',
  },
  linksCell: {
    display: 'flex',
    gap: scale.space2,
  },
})
