'use client'

import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { Result, Schema } from 'effect'
import * as React from 'react'

import {
  availableValue,
  bind,
  bindingFailureMessage,
  type BindingResult,
  type Resolved,
  useBindingContext,
  useRefresh,
} from '../data-query.tsx'
import type { ChartSpec } from '../model.ts'
import {
  type LensChecked,
  type LensEnvelope,
  type LensWindow,
  ompUsage,
  type OmpUsageError,
  type ProjectDrilldown,
  SpendByProjectRow,
  UsageOverTimeRow,
} from '../provider-contracts.ts'

const ChartBlock = React.lazy(() =>
  import('./ChartBlock.tsx').then((module) => ({ default: module.ChartBlock })),
)

const DEFAULT_REFRESH_EVERY = 60_000
const MAX_USAGE_SERIES = 5
const CAPTURED_PROJECT_RANK_LIMIT = 5

/**
 * Union selecting how usage evidence is aggregated in usage views: left ungrouped, or grouped by
 * model, account, or worktree.
 */
export type UsageGroupBy = 'none' | 'model' | 'account' | 'worktree'

const formatUsd = (value: number): string =>
  `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const CoverageLine = ({ envelope }: { readonly envelope: LensEnvelope }) => (
  <p {...stylex.props(styles.coverage)}>
    Coverage: {(envelope.coverage.account_share * 100).toFixed(1)}% account-attributed ·{' '}
    API-equivalent cost, not billed spend
  </p>
)

const MaterializedOutcome = ({
  outcome,
  children,
}: {
  readonly outcome: Exclude<LensChecked, { readonly _tag: 'unmaterialized' }>
  readonly children: React.ReactNode
}) => {
  const warning =
    outcome._tag === 'below-gate'
      ? `Coverage is below the 95% confidence gate (${(outcome.accountShare * 100).toFixed(1)}%). Rankings are partial.`
      : outcome._tag === 'stale'
        ? `This ${outcome.window} generation is stale (computed ${outcome.computedAt}). Values are unmeasured until materialization catches up.`
        : undefined
  return (
    <section {...stylex.props(styles.content)}>
      {warning === undefined ? null : (
        <p role="status" {...stylex.props(styles.warning)}>
          {warning}
        </p>
      )}
      <CoverageLine envelope={outcome.envelope} />
      {outcome._tag === 'stale' ? null : children}
    </section>
  )
}

const Unmaterialized = ({
  lens,
  window,
}: {
  readonly lens: string
  readonly window: LensWindow
}) => (
  <p role="status" {...stylex.props(styles.warning)}>
    {lens}@{window} has not been materialized. Run the OMP Usage lens materializer.
  </p>
)

/**
 * Renders the provenance summary for usage evidence, reporting whether the resolved state is live
 * or frozen, when the last successful data was observed, and any binding error that occurred.
 */
export const UsageEvidenceStatus = ({
  resolved,
  result,
}: {
  readonly resolved: Resolved<LensChecked>
  readonly result: BindingResult<LensChecked, OmpUsageError>
}): React.ReactNode => {
  const lastSuccessAt = resolved._tag === 'Live' ? resolved.observedAt : resolved.frozenAt
  return (
    <>
      <p role="status" {...stylex.props(styles.provenance)}>
        Provenance: {resolved._tag} · Last successful data:{' '}
        <time dateTime={lastSuccessAt}>{lastSuccessAt}</time>
      </p>
      {result._tag === 'Failure' ? (
        <p role="alert" {...stylex.props(styles.warning)}>
          Live refresh degraded: {bindingFailureMessage(result)}. Last successful data:{' '}
          <time dateTime={lastSuccessAt}>{lastSuccessAt}</time>.
        </p>
      ) : null}
    </>
  )
}

/**
 * Props for the spend-by-project view, pairing a checked lens outcome with optional drilldown
 * detail, the drilldown's frozen/catching-up/live provenance, a drilldown error message, and a
 * callback to open the live view.
 */
export interface SpendByProjectViewProps {
  readonly outcome: LensChecked
  readonly drilldown?: ProjectDrilldown
  readonly drilldownProvenance?: 'Frozen' | 'CatchingUp' | 'Live'
  readonly drilldownError?: string
  readonly onOpenLive?: () => void
}

/**
 * Renders per-project spend with expandable project rows, falling back to the unmaterialized lens
 * state when the window has not been materialized and decoding the envelope rows against the
 * captured schema before display.
 */
export const SpendByProjectView = ({
  outcome,
  drilldown,
  drilldownProvenance,
  drilldownError,
  onOpenLive,
}: SpendByProjectViewProps): React.ReactNode => {
  const [expandedProject, setExpandedProject] = React.useState<string | undefined>(undefined)
  if (outcome._tag === 'unmaterialized') {
    return <Unmaterialized lens={outcome.lens} window={outcome.window} />
  }
  const decoded = Schema.decodeUnknownResult(Schema.Array(SpendByProjectRow))(outcome.envelope.rows)
  if (Result.isFailure(decoded)) {
    return (
      <MaterializedOutcome outcome={outcome}>
        <p role="alert" {...stylex.props(styles.warning)}>
          {outcome.envelope.lens} rows do not match the captured schema. This evidence is
          unavailable.
        </p>
      </MaterializedOutcome>
    )
  }
  const rows = decoded.success
  return (
    <MaterializedOutcome outcome={outcome}>
      <div {...stylex.props(styles.tableScroll)}>
        <table
          {...stylex.props(styles.table)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || expandedProject === undefined) return
            event.preventDefault()
            setExpandedProject(undefined)
          }}
        >
          <thead>
            <tr>
              <th scope="col" {...stylex.props(styles.cell)}>
                Project
              </th>
              <th scope="col" {...stylex.props(styles.cell, styles.numberCell)}>
                API-equivalent cost
              </th>
              <th scope="col" {...stylex.props(styles.cell, styles.numberCell)}>
                Requests
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const captured = row.rank <= CAPTURED_PROJECT_RANK_LIMIT
              const expanded = row.key === expandedProject
              const liveReady = drilldownProvenance === 'Live'
              const detail = drilldown?.projects.find((project) => project.project === row.key)
              const canShowDetail = captured || liveReady
              return (
                <React.Fragment key={row.key}>
                  <tr
                    data-expanded={expanded ? 'true' : undefined}
                    {...stylex.props(styles.interactiveRow, expanded && styles.expandedRow)}
                    onClick={(event) => {
                      if ((event.target as Element).closest('button') !== null) return
                      const opening = !expanded
                      setExpandedProject(opening ? row.key : undefined)
                      if (opening && !captured) onOpenLive?.()
                    }}
                  >
                    <th scope="row" {...stylex.props(styles.cell)}>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`usage-project-${row.rank}`}
                        {...stylex.props(styles.projectButton)}
                        onClick={() => {
                          const opening = !expanded
                          setExpandedProject(opening ? row.key : undefined)
                          if (opening && !captured) onOpenLive?.()
                        }}
                      >
                        <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                        <span>{row.key}</span>
                        <span {...stylex.props(styles.captureLabel)}>
                          {captured ? 'Captured' : 'Not captured — opens live'}
                        </span>
                      </button>
                    </th>
                    <td {...stylex.props(styles.cell, styles.numberCell)}>{formatUsd(row.usd)}</td>
                    <td {...stylex.props(styles.cell, styles.numberCell)}>
                      {row.requests.toLocaleString()}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr id={`usage-project-${row.rank}`}>
                      <td colSpan={3} {...stylex.props(styles.drilldownCell)}>
                        {drilldownError !== undefined ? (
                          <p role="alert" {...stylex.props(styles.drilldownStatus)}>
                            Unable to open the live worktree breakdown: {drilldownError}
                          </p>
                        ) : !canShowDetail ? (
                          <p role="status" {...stylex.props(styles.drilldownStatus)}>
                            Not captured — opening the live worktree breakdown…
                          </p>
                        ) : detail === undefined ? (
                          <p role="status" {...stylex.props(styles.drilldownStatus)}>
                            No worktree breakdown is available for {row.key}.
                          </p>
                        ) : detail.status === 'un-drilled' ? (
                          <p role="status" {...stylex.props(styles.drilldownStatus)}>
                            This project was not present in the bounded worktree result; absence is
                            not zero usage.
                          </p>
                        ) : (
                          <table
                            {...stylex.props(styles.drilldownTable)}
                            aria-label={`${row.key} worktrees`}
                          >
                            <thead>
                              <tr>
                                <th scope="col">Worktree</th>
                                <th scope="col">Branch</th>
                                <th scope="col">Cost</th>
                                <th scope="col">Requests</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.worktrees.map((worktree) => (
                                <tr key={worktree.key}>
                                  <th scope="row">{worktree.key}</th>
                                  <td>
                                    <code>{worktree.branch}</code>
                                  </td>
                                  <td>{formatUsd(worktree.usd)}</td>
                                  <td>{worktree.requests.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p role="status">No project usage rows are available.</p> : null}
    </MaterializedOutcome>
  )
}

/**
 * Validates the envelope's rows against the usage-over-time schema and, on success, builds a chart
 * spec aggregating daily input-token USD totals per group; any schema failure is propagated as a
 * failed result.
 */
export const usageChronologyChart = (
  envelope: LensEnvelope,
): Result.Result<ChartSpec, Schema.SchemaError> => {
  const decoded = Schema.decodeUnknownResult(Schema.Array(UsageOverTimeRow))(envelope.rows)
  if (Result.isFailure(decoded)) return Result.fail(decoded.failure)
  const rows = decoded.success.filter(
    (row) => row.bucket === 'day' && row.token_type === 'input' && row.usd !== null,
  )
  const totals = new Map<string, number>()
  const byDay = new Map<string, Map<string, number>>()
  for (const row of rows) {
    totals.set(row.group, (totals.get(row.group) ?? 0) + (row.usd ?? 0))
    const values = byDay.get(row.bucket_start) ?? new Map<string, number>()
    // There is exactly one daily/input row per group. Never add hour/week/month buckets.
    values.set(row.group, row.usd ?? 0)
    byDay.set(row.bucket_start, values)
  }

  const groups = [...totals.keys()].toSorted((left, right) => {
    const costOrder = (totals.get(right) ?? 0) - (totals.get(left) ?? 0)
    return costOrder === 0 ? left.localeCompare(right) : costOrder
  })
  const visibleGroups = groups.slice(0, MAX_USAGE_SERIES)
  const otherGroups = groups.slice(MAX_USAGE_SERIES)
  let otherKey = '__other__'
  while (groups.includes(otherKey)) otherKey = `_${otherKey}`

  const series = [
    ...visibleGroups.map((group) => ({ key: group, label: group })),
    ...(otherGroups.length === 0
      ? []
      : [{ key: otherKey, label: `Other (${String(otherGroups.length)})` }]),
  ]
  return Result.succeed({
    title: 'Daily API-equivalent cost',
    description:
      otherGroups.length === 0
        ? "Only bucket='day' and token_type='input' rows are rendered."
        : `Top ${String(MAX_USAGE_SERIES)} series by total API-equivalent cost; ${String(otherGroups.length)} remaining series are combined as Other. Only bucket='day' and token_type='input' rows are rendered.`,
    kind: 'line',
    xLabel: 'Day',
    yLabel: 'API-equivalent USD',
    unit: 'USD',
    series,
    data: [...byDay.entries()]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([day, groupValues]) => {
        const values = Object.fromEntries(
          visibleGroups.map((group) => [group, groupValues.get(group) ?? 0]),
        )
        if (otherGroups.length > 0) {
          values[otherKey] = otherGroups.reduce(
            (sum, group) => sum + (groupValues.get(group) ?? 0),
            0,
          )
        }
        return { label: day.slice(0, 10), values }
      }),
  })
}

/**
 * Props for the usage-over-time view, consisting of an element identifier and the checked lens
 * outcome whose envelope supplies the rows to be charted.
 */
export interface UsageOverTimeViewProps {
  readonly id: string
  readonly outcome: LensChecked
}

/**
 * Renders the usage-over-time chart derived from the outcome's envelope, showing the
 * unmaterialized lens state or a schema-mismatch alert when the rows cannot be decoded into a
 * chart spec.
 */
export const UsageOverTimeView = ({ id, outcome }: UsageOverTimeViewProps): React.ReactNode => {
  if (outcome._tag === 'unmaterialized') {
    return <Unmaterialized lens={outcome.lens} window={outcome.window} />
  }
  const chart = usageChronologyChart(outcome.envelope)
  if (Result.isFailure(chart)) {
    return (
      <MaterializedOutcome outcome={outcome}>
        <p role="alert" {...stylex.props(styles.warning)}>
          {outcome.envelope.lens} rows do not match the captured schema. This evidence is
          unavailable.
        </p>
      </MaterializedOutcome>
    )
  }
  return (
    <MaterializedOutcome outcome={outcome}>
      <React.Suspense fallback={<p role="status">Loading usage chart…</p>}>
        <ChartBlock id={`${id}-chart`} chart={chart.success} caption="Usage over time" />
      </React.Suspense>
    </MaterializedOutcome>
  )
}

/**
 * Props for the spend-by-project container, taking the lens window to query and an optional
 * refresh interval for periodic live revalidation.
 */
export interface SpendByProjectProps {
  readonly window: LensWindow
  readonly refreshEvery?: number
}

/**
 * Binds the spend-by-project lens in live mode with periodic refresh for the chosen window and
 * renders the resulting view, covering load, error, and provenance states of the binding.
 */
export const SpendByProject = ({
  window,
  refreshEvery = DEFAULT_REFRESH_EVERY,
}: SpendByProjectProps): React.ReactNode => {
  const binding = React.useMemo(
    () =>
      bind(
        ompUsage.ops.lensChecked,
        { lens: 'spend_by_project', window },
        {
          mode: 'live',
          refreshEvery,
          effectfulCapture: 'acknowledged',
        },
      ),
    [refreshEvery, window],
  )
  const drilldownBinding = React.useMemo(
    () =>
      bind(
        ompUsage.ops.projectDrilldown,
        { window },
        { mode: 'live', effectfulCapture: 'acknowledged' },
      ),
    [window],
  )
  const { extracting, result } = useBindingContext(binding)
  const { extracting: extractingDrilldown, result: drilldownResult } =
    useBindingContext(drilldownBinding)
  const refreshDrilldown = useRefresh(drilldownBinding)
  if (extracting || extractingDrilldown) return undefined
  const resolved = availableValue(result)
  const resolvedDrilldown = availableValue(drilldownResult)
  if (resolved === undefined) {
    return result._tag === 'Failure' ? (
      <p role="alert">Unable to load project usage: {bindingFailureMessage(result)}</p>
    ) : (
      <p role="status">Loading project usage…</p>
    )
  }
  return (
    <>
      <UsageEvidenceStatus resolved={resolved} result={result} />
      <SpendByProjectView
        outcome={resolved.value}
        onOpenLive={refreshDrilldown}
        {...(resolvedDrilldown === undefined
          ? {}
          : {
              drilldown: resolvedDrilldown.value,
              drilldownProvenance: resolvedDrilldown._tag,
            })}
        {...(drilldownResult._tag === 'Failure'
          ? { drilldownError: bindingFailureMessage(drilldownResult) }
          : {})}
      />
    </>
  )
}

/**
 * Props for the usage-over-time container, requiring the lens window and grouping dimension, with
 * an optional element id defaulting to usage-over-time and an optional refresh interval.
 */
export interface UsageOverTimeProps {
  readonly id?: string
  readonly window: LensWindow
  readonly groupBy: UsageGroupBy
  readonly refreshEvery?: number
}

/**
 * Binds the usage-over-time lens in live mode, applying the requested grouping and refresh
 * interval, and renders the resulting chronology chart view.
 */
export const UsageOverTime = ({
  id = 'usage-over-time',
  window,
  groupBy,
  refreshEvery = DEFAULT_REFRESH_EVERY,
}: UsageOverTimeProps): React.ReactNode => {
  const binding = React.useMemo(
    () =>
      bind(
        ompUsage.ops.lensChecked,
        {
          lens: 'usage_over_time',
          window,
          groupBy,
        },
        {
          mode: 'live',
          refreshEvery,
          effectfulCapture: 'acknowledged',
        },
      ),
    [groupBy, refreshEvery, window],
  )
  const { extracting, result } = useBindingContext(binding)
  if (extracting) return undefined
  const resolved = availableValue(result)
  if (resolved === undefined) {
    return result._tag === 'Failure' ? (
      <p role="alert">Unable to load usage chronology: {bindingFailureMessage(result)}</p>
    ) : (
      <p role="status">Loading usage chronology…</p>
    )
  }
  return (
    <>
      <UsageEvidenceStatus resolved={resolved} result={result} />
      <UsageOverTimeView id={id} outcome={resolved.value} />
    </>
  )
}

const styles = stylex.create({
  content: {
    display: 'grid',
    gap: scale.space3,
  },
  coverage: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.8rem',
    margin: 0,
  },
  provenance: {
    color: tokens['--ds-gray-800'],
    fontSize: '0.8rem',
    margin: 0,
  },
  warning: {
    backgroundColor: tokens['--ds-amber-100'],
    borderColor: tokens['--ds-amber-400'],
    borderRadius: scale.radiusSm,
    borderStyle: 'solid',
    borderWidth: 1,
    color: tokens['--ds-amber-900'],
    margin: 0,
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
  },
  tableScroll: {
    maxWidth: '100%',
    overflowX: 'auto',
  },
  table: {
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
    fontVariantNumeric: 'tabular-nums',
    width: '100%',
  },
  cell: {
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  numberCell: {
    textAlign: 'right',
  },
  interactiveRow: {
    cursor: 'pointer',
    backgroundColor: {
      default: 'transparent',
      ':hover': tokens['--ds-gray-alpha-100'],
    },
  },
  expandedRow: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  projectButton: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    width: '100%',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: tokens['--ds-foreground'],
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  captureLabel: {
    color: tokens['--ds-gray-800'],
    fontSize: '0.7rem',
    fontWeight: 450,
  },
  drilldownCell: {
    paddingBlock: scale.space2,
    paddingInline: scale.space4,
    backgroundColor: tokens['--ds-background-200'],
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
  },
  drilldownStatus: {
    margin: 0,
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
  },
  drilldownTable: {
    width: '100%',
    borderCollapse: 'collapse',
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
  },
})
