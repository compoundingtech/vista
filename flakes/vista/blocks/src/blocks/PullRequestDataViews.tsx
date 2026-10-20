'use client'

import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'

import type { CheckRun, ChecksState, PullRequestData } from '../provider-contracts.ts'
import { formatCompactAge } from './pull-request/time.ts'
import {
  PullRequestChecksLegend,
  PullRequestChecksWaterfall,
} from './PullRequestChecksWaterfall.tsx'
import { PullRequestViewer, type PullRequestViewerProps } from './PullRequestViewer.tsx'

/**
 * Extends the viewer props with the captured pull-request data and an optional live-refresh error
 * so the frozen content can render alongside the visible failure.
 */
export interface PullRequestReviewViewProps extends Omit<
  PullRequestViewerProps,
  'pullRequest' | 'stack'
> {
  readonly pullRequest: PullRequestData
  readonly error?: string
}

/** Static viewer over a captured pull request, with the live refresh failure (if any) kept visible. */
export const PullRequestReviewView = ({
  error,
  ...viewer
}: PullRequestReviewViewProps): React.ReactNode => (
  <>
    {error === undefined ? null : (
      <p role="alert" {...stylex.props(styles.warning)}>
        The live pull request could not be refreshed. The captured review remains visible. {error}
      </p>
    )}
    <PullRequestViewer {...viewer} />
  </>
)

const checkChanged = (snapshot: ChecksState | undefined, check: CheckRun): boolean => {
  const previous = snapshot?.checks[check.name]
  return (
    previous === undefined ||
    previous.source !== check.source ||
    previous.status !== check.status ||
    previous.conclusion !== check.conclusion ||
    previous.startedAt !== check.startedAt ||
    previous.completedAt !== check.completedAt ||
    previous.url !== check.url
  )
}

/**
 * Supplies the current checks state, an optional frozen snapshot, sync provenance, and an optional
 * error, while `observedAt` pins the observation instant for deterministic stories.
 */
export interface PullRequestChecksViewProps {
  /** Stable observation instant for deterministic review stories; live Blocks use mount time. */
  readonly observedAt?: number
  readonly state: ChecksState
  readonly snapshot?: ChecksState
  readonly provenance: 'Frozen' | 'CatchingUp' | 'Live'
  readonly error?: string
}

/** Deterministic check-list presentation shared by the bound block and its stories. */
export const PullRequestChecksView = ({
  state,
  snapshot,
  provenance,
  error,
  observedAt,
}: PullRequestChecksViewProps): React.ReactNode => {
  const checks = Object.values(state.checks).toSorted((left, right) =>
    left.name.localeCompare(right.name),
  )
  const { pullRequest, run } = state
  const workflowFallback =
    checks.length > 0 && checks.every(({ source }) => source === 'workflow-run')
  const [mountedAt] = React.useState(() => Date.now())
  const renderedAt = observedAt ?? mountedAt
  const readiness = pullRequest.isDraft ? 'Draft pull request' : 'Ready for review'
  const mergeability =
    pullRequest.mergeable === 'mergeable'
      ? { glyph: '✓', label: 'Mergeable', style: styles.statusPositive }
      : pullRequest.mergeable === 'conflicting'
        ? { glyph: '✗', label: 'Merge conflict', style: styles.statusNegative }
        : { glyph: '●', label: 'Mergeability unknown', style: styles.statusPending }
  const review =
    pullRequest.reviewDecision === 'approved'
      ? { glyph: '✓', label: 'Review approved', style: styles.statusPositive }
      : pullRequest.reviewDecision === 'changes_requested'
        ? { glyph: '✗', label: 'Changes requested', style: styles.statusNegative }
        : { glyph: '●', label: 'Review pending', style: styles.statusPending }
  const head = pullRequest.headSha.slice(0, 7)
  const repositoryUrl = pullRequest.url.split('/pull/')[0] ?? pullRequest.url
  const headUrl = `${repositoryUrl}/commit/${pullRequest.headSha}`
  const runOutcome = run?.conclusion ?? run?.status ?? null
  const runGlyph =
    runOutcome === 'success'
      ? '✓'
      : runOutcome === 'failure' || runOutcome === 'timed_out' || runOutcome === 'action_required'
        ? '✗'
        : '●'
  const updatedAge = run === null ? null : formatCompactAge(run.updatedAt, renderedAt)
  const updatedLabel =
    updatedAge === null
      ? null
      : updatedAge === 'now'
        ? 'updated just now'
        : `updated ${updatedAge} ago`
  return (
    <section
      aria-label={`Pull request #${pullRequest.number} checks`}
      {...stylex.props(styles.checks)}
    >
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.primary)}>
          <h3 {...stylex.props(styles.heading)}>
            <a href={pullRequest.url}>#{pullRequest.number}</a> {pullRequest.title}
          </h3>
          <span {...stylex.props(styles.statusGlyphs)}>
            <span
              title={readiness}
              aria-label={readiness}
              {...stylex.props(
                styles.statusGlyph,
                pullRequest.isDraft ? styles.statusPending : styles.statusPositive,
              )}
            >
              <span aria-hidden="true">●</span>
            </span>
            <span
              title={mergeability.label}
              aria-label={mergeability.label}
              {...stylex.props(styles.statusGlyph, mergeability.style)}
            >
              <span aria-hidden="true">{mergeability.glyph}</span>
            </span>
            <span
              title={review.label}
              aria-label={review.label}
              {...stylex.props(styles.statusGlyph, review.style)}
            >
              <span aria-hidden="true">{review.glyph}</span>
            </span>
          </span>
        </div>
        <span
          data-provenance={provenance}
          {...stylex.props(styles.provenance, provenance === 'Live' && styles.live)}
        >
          {provenance}
        </span>
      </header>
      {run !== null ? (
        <div {...stylex.props(styles.runSummary)}>
          <a
            href={headUrl}
            title={`Head commit ${pullRequest.headSha}`}
            aria-label={`Head commit ${pullRequest.headSha}`}
            {...stylex.props(styles.headChip)}
          >
            {head}
          </a>
          <span aria-hidden="true">·</span>
          <code title={pullRequest.headRef} {...stylex.props(styles.branch)}>
            {pullRequest.headRef}
          </code>
          <span aria-hidden="true">·</span>
          <a
            href={run.url}
            title={`${runOutcome?.replaceAll('_', ' ') ?? 'No conclusion'} workflow run`}
            aria-label={`${runOutcome?.replaceAll('_', ' ') ?? 'No conclusion'} workflow run`}
            {...stylex.props(styles.runLink)}
          >
            <span aria-hidden="true">{runGlyph}</span> {run.name}
          </a>
          <span aria-hidden="true">·</span>
          <time dateTime={run.updatedAt} title={run.updatedAt} {...stylex.props(styles.updated)}>
            {updatedLabel}
          </time>
          <span {...stylex.props(styles.legendPush)}>
            <PullRequestChecksLegend run={run} />
          </span>
        </div>
      ) : state.latestWorkflowRun === null ? null : (
        <p {...stylex.props(styles.workflowSummary)}>
          Latest branch workflow:{' '}
          <a href={state.latestWorkflowRun.url}>{state.latestWorkflowRun.name}</a> ·{' '}
          {state.latestWorkflowRun.status.replace('_', ' ')} ·{' '}
          {state.latestWorkflowRun.conclusion?.replace('_', ' ') ?? 'no conclusion'} · head{' '}
          <code>{state.latestWorkflowRun.headSha.slice(0, 12)}</code>
        </p>
      )}
      {error === undefined ? null : (
        <p role="alert" {...stylex.props(styles.warning)}>
          Live checks are unavailable. The captured check state remains visible. {error}
        </p>
      )}
      {state.run === null && workflowFallback ? (
        <p role="status" {...stylex.props(styles.fallback)}>
          No check runs or commit statuses were reported on <code>{head}</code>; showing the latest
          workflows by name from {state.workflowRunCount} workflow runs on{' '}
          <code>{pullRequest.headRef}</code>.
        </p>
      ) : null}
      {state.run !== null ? (
        <PullRequestChecksWaterfall
          run={state.run}
          provenance={provenance}
          {...(snapshot === undefined ? {} : { snapshot: snapshot.run })}
        />
      ) : checks.length === 0 ? (
        <p role="status" {...stylex.props(styles.empty)}>
          No check runs or commit statuses were reported on <code>{head}</code>;{' '}
          {state.workflowRunCount} workflow runs were found on <code>{pullRequest.headRef}</code>.
        </p>
      ) : (
        <div {...stylex.props(styles.tableScroll)}>
          <table {...stylex.props(styles.table)}>
            <thead>
              <tr>
                <th scope="col" {...stylex.props(styles.cell)}>
                  Check
                </th>
                <th scope="col" {...stylex.props(styles.cell)}>
                  Source
                </th>
                <th scope="col" {...stylex.props(styles.cell)}>
                  Status
                </th>
                <th scope="col" {...stylex.props(styles.cell)}>
                  Conclusion
                </th>
              </tr>
            </thead>
            <tbody>
              {checks.map((check) => {
                const changed = provenance === 'Live' && checkChanged(snapshot, check)
                return (
                  <tr
                    key={`${check.source}:${check.name}`}
                    data-changed={changed || undefined}
                    {...stylex.props(changed && styles.changed)}
                  >
                    <th scope="row" {...stylex.props(styles.cell, styles.checkName)}>
                      {check.url === '' ? check.name : <a href={check.url}>{check.name}</a>}
                    </th>
                    <td {...stylex.props(styles.cell)}>{check.source.replaceAll('-', ' ')}</td>
                    <td {...stylex.props(styles.cell)}>{check.status.replace('_', ' ')}</td>
                    <td {...stylex.props(styles.cell)}>
                      {check.conclusion?.replace('_', ' ') ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const styles = stylex.create({
  checks: {
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    borderStyle: 'solid',
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    backgroundColor: tokens['--ds-background-100'],
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    display: 'flex',
    gap: scale.space2,
    justifyContent: 'space-between',
    minHeight: 32,
    paddingBlock: 4,
    paddingInline: scale.space3,
  },
  primary: {
    alignItems: 'center',
    display: 'flex',
    gap: scale.space2,
    minWidth: 0,
  },
  heading: {
    fontSize: '0.82rem',
    fontWeight: 600,
    margin: 0,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusGlyphs: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: 5,
  },
  statusGlyph: {
    fontFamily: scale.fontMono,
    fontSize: '0.68rem',
    lineHeight: 1,
  },
  statusPositive: {
    color: tokens['--ds-green-900'],
  },
  statusNegative: {
    color: tokens['--ds-red-900'],
  },
  statusPending: {
    color: tokens['--ds-amber-900'],
  },
  provenance: {
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1,
    color: tokens['--ds-gray-900'],
    flexShrink: 0,
    fontSize: '0.68rem',
    paddingBlock: 1,
    paddingInline: scale.space2,
  },
  live: {
    borderColor: tokens['--ds-green-600'],
    color: tokens['--ds-green-900'],
  },
  runSummary: {
    alignItems: 'center',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    color: tokens['--ds-gray-900'],
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: '0.68rem',
    gap: 6,
    minHeight: 32,
    paddingBlock: 3,
    paddingInline: scale.space3,
  },
  headChip: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
    borderRadius: scale.radiusSm,
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontMono,
    paddingBlock: 2,
    paddingInline: 5,
    textDecoration: 'none',
  },
  branch: {
    color: tokens['--ds-gray-900'],
    display: 'block',
    maxWidth: 'min(32vw, 24rem)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  runLink: {
    color: tokens['--ds-foreground'],
    flexShrink: 0,
    fontWeight: 550,
    textDecoration: 'none',
  },
  updated: {
    flexShrink: 0,
    fontFamily: scale.fontMono,
  },
  legendPush: {
    marginInlineStart: 'auto',
  },
  workflowSummary: {
    alignItems: 'center',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    color: tokens['--ds-gray-900'],
    display: 'flex',
    fontSize: '0.7rem',
    margin: 0,
    minHeight: 32,
    paddingInline: scale.space3,
  },
  fallback: {
    backgroundColor: tokens['--ds-gray-100'],
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
    margin: 0,
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
  },
  warning: {
    backgroundColor: tokens['--ds-amber-100'],
    borderColor: tokens['--ds-amber-400'],
    borderRadius: scale.radiusSm,
    borderStyle: 'solid',
    borderWidth: 1,
    color: tokens['--ds-amber-900'],
    marginBlock: scale.space2,
    marginInline: scale.space3,
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
  },
  empty: {
    color: tokens['--ds-gray-900'],
    margin: 0,
    padding: scale.space3,
  },
  tableScroll: {
    maxWidth: '100%',
    overflowX: 'auto',
  },
  table: {
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
    width: '100%',
  },
  cell: {
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
    textAlign: 'left',
  },
  checkName: {
    fontWeight: 500,
  },
  changed: {
    backgroundColor: tokens['--ds-amber-100'],
  },
})
