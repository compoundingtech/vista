'use client'

import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import { GridList, GridListItem } from 'react-aria-components'

import type {
  CheckConclusion,
  CheckJob,
  CheckStep,
  WorkflowRunDetails,
} from '../provider-contracts.ts'

/**
 * Supplies the workflow run to chart, an optional frozen snapshot to show while catching up, and
 * the provenance label that selects which content is rendered.
 */
export interface PullRequestChecksWaterfallProps {
  readonly run: WorkflowRunDetails
  readonly snapshot?: WorkflowRunDetails | null
  readonly provenance: 'Frozen' | 'CatchingUp' | 'Live'
}

interface Timeline {
  readonly start: number
  readonly end: number
  readonly span: number
}

const timestamp = (value: string | null): number | null => {
  if (value === null) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

const jobEnd = (job: CheckJob, now: number): number => timestamp(job.completedAt) ?? now

const executionStart = (job: CheckJob): number | null =>
  job.status === 'queued' ? null : timestamp(job.startedAt)

const runtime = (job: CheckJob, now: number): number => {
  const started = executionStart(job)
  return started === null ? 0 : Math.max(0, jobEnd(job, now) - started)
}

const durationLabel = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainder}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

const outcomeLabel = (status: CheckJob['status'], conclusion: CheckConclusion): string =>
  (conclusion ?? status).replaceAll('_', ' ')

const outcomeColor = (status: CheckJob['status'], conclusion: CheckConclusion): string => {
  if (status === 'in_progress') return 'var(--ds-blue-700)'
  if (status === 'queued') return 'var(--ds-amber-700)'
  switch (conclusion) {
    case 'success':
      return 'var(--ds-green-700)'
    case 'failure':
    case 'timed_out':
    case 'action_required':
      return 'var(--ds-red-700)'
    case 'cancelled':
    case 'skipped':
    case 'neutral':
    case null:
      return 'var(--ds-gray-700)'
  }
}

/** Compact timing legend shared by the two-row checks header and waterfall. */
export const PullRequestChecksLegend = ({
  run,
}: {
  readonly run: WorkflowRunDetails
}): React.ReactNode => (
  <span {...stylex.props(styles.legend)}>
    <span {...stylex.props(styles.queueSwatch)} aria-hidden="true" /> queue
    <span
      {...stylex.props(styles.runSwatch)}
      style={{ backgroundColor: outcomeColor(run.status, run.conclusion) }}
      aria-hidden="true"
    />
    run
  </span>
)

const isFailure = (conclusion: CheckConclusion): boolean =>
  conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'action_required'

const changedJob = (snapshot: WorkflowRunDetails | null | undefined, job: CheckJob): boolean => {
  const previous = snapshot?.jobs.find(({ id }) => id === job.id)
  return previous === undefined || JSON.stringify(previous) !== JSON.stringify(job)
}

const changedStep = (
  snapshot: WorkflowRunDetails | null | undefined,
  job: CheckJob,
  step: CheckStep,
): boolean => {
  const previous = snapshot?.jobs
    .find(({ id }) => id === job.id)
    ?.steps.find(({ number }) => number === step.number)
  return previous === undefined || JSON.stringify(previous) !== JSON.stringify(step)
}

const timelineFor = (run: WorkflowRunDetails, now: number): Timeline => {
  const candidates = [timestamp(run.createdAt) ?? now]
  for (const job of run.jobs) {
    candidates.push(timestamp(job.createdAt) ?? now)
    candidates.push(jobEnd(job, now))
  }
  const start = Math.min(...candidates)
  const end = Math.max(now, ...candidates)
  return { start, end, span: Math.max(1, end - start) }
}

const percent = (value: number, timeline: Timeline): number =>
  Math.max(0, Math.min(100, ((value - timeline.start) / timeline.span) * 100))

const firstFailure = (run: WorkflowRunDetails, now: number): string => {
  const failures: Array<{ readonly at: number; readonly label: string }> = []
  for (const job of run.jobs) {
    for (const step of job.steps) {
      if (!isFailure(step.conclusion)) continue
      failures.push({
        at: timestamp(step.completedAt) ?? timestamp(step.startedAt) ?? jobEnd(job, now),
        label: `${job.name} › ${step.name}`,
      })
    }
    if (isFailure(job.conclusion) && !job.steps.some((step) => isFailure(step.conclusion))) {
      failures.push({ at: jobEnd(job, now), label: job.name })
    }
  }
  return failures.toSorted((left, right) => left.at - right.at)[0]?.label ?? 'None'
}

const TimelineBar = ({
  job,
  timeline,
  now,
}: {
  readonly job: CheckJob
  readonly timeline: Timeline
  readonly now: number
}): React.ReactNode => {
  const created = timestamp(job.createdAt) ?? timeline.start
  const started = executionStart(job)
  const ended = jobEnd(job, now)
  const queueEnd = started ?? ended
  const queueX = percent(created, timeline)
  const queueWidth = Math.max(0, percent(queueEnd, timeline) - queueX)
  const runX = percent(started ?? ended, timeline)
  const runWidth = started === null ? 0 : Math.max(0.45, percent(ended, timeline) - runX)
  const patternId = `checks-queue-${job.id}`
  const label = `${job.name}: ${durationLabel(queueEnd - created)} queue wait, ${durationLabel(
    runtime(job, now),
  )} run time, ${outcomeLabel(job.status, job.conclusion)}`
  return (
    <svg
      viewBox="0 0 100 18"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      {...stylex.props(styles.timeline)}
    >
      <title>{label}</title>
      <defs>
        <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="var(--ds-gray-alpha-200)" />
          <path d="M-1 1L1-1M0 4L4 0M3 5L5 3" stroke="var(--ds-gray-700)" strokeWidth="0.7" />
        </pattern>
      </defs>
      {queueWidth === 0 ? null : (
        <rect x={queueX} y="3" width={queueWidth} height="12" rx="1" fill={`url(#${patternId})`} />
      )}
      {runWidth === 0 ? null : (
        <rect
          x={runX}
          y="3"
          width={runWidth}
          height="12"
          rx="1"
          fill={outcomeColor(job.status, job.conclusion)}
        />
      )}
    </svg>
  )
}

/** Native, deterministic run waterfall. Its live edge is the provider's run.updatedAt, never the browser clock. */
export const PullRequestChecksWaterfall = ({
  run,
  snapshot,
  provenance,
}: PullRequestChecksWaterfallProps): React.ReactNode => {
  const [selectedJobId, setSelectedJobId] = React.useState<number | null>(null)
  const now = timestamp(run.updatedAt) ?? timestamp(run.createdAt) ?? 0
  const timeline = timelineFor(run, now)
  const wall = Math.max(0, timeline.end - timeline.start)
  const sumRuntime = run.jobs.reduce((total, job) => total + runtime(job, now), 0)
  const longestLane = run.jobs
    .map((job) => ({
      job,
      duration: Math.max(0, jobEnd(job, now) - (timestamp(job.createdAt) ?? timeline.start)),
    }))
    .toSorted((left, right) => right.duration - left.duration)[0]
  const slowest = run.jobs
    .map((job) => ({ job, duration: runtime(job, now) }))
    .toSorted((left, right) => right.duration - left.duration)[0]

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape' && selectedJobId !== null) {
          event.stopPropagation()
          setSelectedJobId(null)
        }
      }}
      {...stylex.props(styles.root)}
    >
      <dl {...stylex.props(styles.metrics)}>
        <div {...stylex.props(styles.metric)}>
          <dt {...stylex.props(styles.metricLabel)}>Longest elapsed lane (queue + run)</dt>
          <dd {...stylex.props(styles.metricValue)}>
            {longestLane === undefined
              ? '—'
              : `${longestLane.job.name} · ${durationLabel(longestLane.duration)}`}
          </dd>
        </div>
        <div {...stylex.props(styles.metric)}>
          <dt {...stylex.props(styles.metricLabel)}>Wall / job time</dt>
          <dd {...stylex.props(styles.metricValue)}>
            {durationLabel(wall)} / {durationLabel(sumRuntime)}
          </dd>
        </div>
        <div {...stylex.props(styles.metric)}>
          <dt {...stylex.props(styles.metricLabel)}>Slowest job</dt>
          <dd {...stylex.props(styles.metricValue)}>
            {slowest === undefined
              ? '—'
              : `${slowest.job.name} · ${durationLabel(slowest.duration)}`}
          </dd>
        </div>
        <div {...stylex.props(styles.metric)}>
          <dt {...stylex.props(styles.metricLabel)}>First failure</dt>
          <dd {...stylex.props(styles.metricValue)}>{firstFailure(run, now)}</dd>
        </div>
      </dl>

      <div {...stylex.props(styles.axis)} aria-hidden="true">
        <span>Jobs</span>
        <span {...stylex.props(styles.axisTicks)}>
          <span>0</span>
          <span>{durationLabel(timeline.span / 4)}</span>
          <span>{durationLabel(timeline.span / 2)}</span>
          <span>{durationLabel((timeline.span * 3) / 4)}</span>
          <span>{durationLabel(timeline.span)}</span>
        </span>
      </div>

      <GridList
        aria-label="Workflow jobs. Use arrow keys to move, Enter to inspect steps, and Escape to return."
        items={run.jobs}
        dependencies={[selectedJobId, provenance, snapshot]}
        selectionMode="single"
        selectionBehavior="replace"
        selectedKeys={selectedJobId === null ? [] : [selectedJobId]}
        onSelectionChange={(keys) => {
          const key = keys === 'all' ? undefined : [...keys][0]
          setSelectedJobId(key === undefined ? null : Number(key))
        }}
        onAction={(key) => setSelectedJobId(Number(key))}
        {...stylex.props(styles.jobs)}
      >
        {(job) => {
          const queueWait =
            (executionStart(job) ?? jobEnd(job, now)) - (timestamp(job.createdAt) ?? now)
          const isSelected = selectedJobId === job.id
          const jobChanged = provenance === 'Live' && changedJob(snapshot, job)
          return (
            <GridListItem
              id={job.id}
              textValue={job.name}
              data-changed={jobChanged || undefined}
              {...stylex.props(
                styles.job,
                isSelected && styles.jobSelected,
                jobChanged && styles.changed,
              )}
            >
              <div {...stylex.props(styles.jobMain)}>
                <div {...stylex.props(styles.jobIdentity)}>
                  <span {...stylex.props(styles.jobName)}>{job.name}</span>
                  <span {...stylex.props(styles.jobMetaRow)}>
                    <span {...stylex.props(styles.jobMeta)}>
                      {outcomeLabel(job.status, job.conclusion)} · queue {durationLabel(queueWait)}{' '}
                      · run {durationLabel(runtime(job, now))}
                      {job.runner === '' ? '' : ` · ${job.runner}`}
                    </span>
                    {jobChanged ? (
                      <span
                        title="Changed since capture"
                        aria-label="Changed since capture"
                        {...stylex.props(styles.changedGlyph)}
                      >
                        ◆
                      </span>
                    ) : null}
                  </span>
                </div>
                <TimelineBar job={job} timeline={timeline} now={now} />
              </div>
              {isSelected ? (
                <div role="region" aria-label={`${job.name} steps`} {...stylex.props(styles.steps)}>
                  <div {...stylex.props(styles.stepHeader)}>
                    <strong>Steps</strong>
                    <span>Esc to return</span>
                  </div>
                  {job.steps.length === 0 ? (
                    <p {...stylex.props(styles.noSteps)}>GitHub has not reported steps yet.</p>
                  ) : (
                    <ul {...stylex.props(styles.stepList)}>
                      {job.steps.map((step) => {
                        const stepChanged =
                          provenance === 'Live' && changedStep(snapshot, job, step)
                        return (
                          <li
                            key={step.number}
                            data-changed={stepChanged || undefined}
                            {...stylex.props(styles.step, stepChanged && styles.changed)}
                          >
                            <a
                              href={`${job.url}#step:${step.number}:1`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {step.number}. {step.name}
                            </a>
                            <span>
                              {outcomeLabel(step.status, step.conclusion)} ·{' '}
                              {step.startedAt === null
                                ? 'not started'
                                : durationLabel(
                                    (timestamp(step.completedAt) ?? now) -
                                      (timestamp(step.startedAt) ?? now),
                                  )}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </GridListItem>
          )
        }}
      </GridList>
    </div>
  )
}

const styles = stylex.create({
  root: {
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    minWidth: 0,
    overflowX: 'auto',
  },
  changed: {
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-amber-900']} 7%, ${tokens['--ds-background-100']})`,
  },
  legend: {
    alignItems: 'center',
    color: tokens['--ds-gray-900'],
    display: 'flex',
    fontSize: '0.68rem',
    gap: 5,
  },
  queueSwatch: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
    backgroundImage: `repeating-linear-gradient(135deg, transparent 0 3px, ${tokens['--ds-gray-700']} 3px 4px)`,
    borderRadius: 2,
    height: 8,
    width: 18,
  },
  runSwatch: {
    borderRadius: 2,
    height: 8,
    marginInlineStart: 3,
    width: 18,
  },
  timeline: {
    display: 'block',
    height: 24,
    width: '100%',
  },
  metrics: {
    backgroundColor: tokens['--ds-background-200'],
    display: 'grid',
    gap: 1,
    gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
    margin: 0,
  },
  metric: {
    alignItems: 'center',
    backgroundColor: tokens['--ds-background-100'],
    display: 'flex',
    gap: scale.space2,
    minHeight: 32,
    minWidth: 0,
    paddingInline: scale.space3,
  },
  metricLabel: {
    color: tokens['--ds-gray-900'],
    flexShrink: 0,
    fontSize: '0.65rem',
  },
  metricValue: {
    fontSize: '0.72rem',
    fontWeight: 550,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  axis: {
    alignItems: 'end',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    color: tokens['--ds-gray-900'],
    display: 'grid',
    fontFamily: scale.fontMono,
    fontSize: '0.62rem',
    gridTemplateColumns: 'minmax(12rem, 18rem) minmax(24rem, 1fr)',
    paddingBlock: 5,
    paddingInline: scale.space3,
  },
  axisTicks: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  jobs: {
    display: 'grid',
    margin: 0,
    outline: 'none',
    padding: 0,
  },
  job: {
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    cursor: 'default',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: -2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  jobSelected: {
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-blue-700']} 8%, ${tokens['--ds-background-100']})`,
  },
  jobMain: {
    alignItems: 'center',
    display: 'grid',
    gap: scale.space3,
    gridTemplateColumns: 'minmax(12rem, 18rem) minmax(24rem, 1fr)',
    minHeight: 46,
    paddingBlock: 5,
    paddingInline: scale.space3,
  },
  jobIdentity: {
    display: 'grid',
    gap: 2,
    minWidth: 0,
  },
  jobName: {
    fontSize: '0.76rem',
    fontWeight: 550,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  jobMetaRow: {
    alignItems: 'center',
    display: 'flex',
    gap: 5,
    minWidth: 0,
  },
  jobMeta: {
    color: tokens['--ds-gray-900'],
    fontFamily: scale.fontMono,
    fontSize: '0.62rem',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  changedGlyph: {
    color: tokens['--ds-amber-900'],
    flexShrink: 0,
    fontSize: '0.58rem',
  },
  steps: {
    backgroundColor: tokens['--ds-background-200'],
    borderTopColor: tokens['--ds-gray-alpha-400'],
    borderTopStyle: 'solid',
    borderTopWidth: 1,
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
  },
  stepHeader: {
    alignItems: 'center',
    color: tokens['--ds-gray-900'],
    display: 'flex',
    fontSize: '0.68rem',
    justifyContent: 'space-between',
    marginBlockEnd: scale.space1,
  },
  stepList: {
    display: 'grid',
    gap: 1,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  step: {
    alignItems: 'center',
    backgroundColor: tokens['--ds-background-100'],
    display: 'flex',
    fontSize: '0.7rem',
    justifyContent: 'space-between',
    minHeight: 28,
    paddingBlock: 4,
    paddingInline: scale.space2,
  },
  noSteps: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.7rem',
    margin: 0,
  },
})
