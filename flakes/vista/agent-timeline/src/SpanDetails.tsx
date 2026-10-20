/** Dense bottom span details for a selected agent-session span. */
import * as stylex from '@stylexjs/stylex'
import * as React from 'react'
import type { ReactNode } from 'react'
import {
  Button,
  Cell,
  Column,
  GridList,
  GridListItem,
  Row,
  Tab,
  Table,
  TableBody,
  TableHeader,
  TabList,
  TabPanel,
  Tabs,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components'

import { scale, tokens } from '@vista/ui/tokens.stylex'

import { laneEnd } from './encodings.ts'
import {
  clock,
  compactNumber,
  dateTime,
  durationLabel,
  integer,
  minuteClock,
  money,
  shortModel,
  tokenLabel,
} from './format.ts'
import { ZoomToSpanIcon } from './icons.tsx'
import { sessionLabel } from './labels.ts'
import type { AgentTimelineModel, AgentTimelineRequest } from './model.ts'
import { valuesAt } from './projection.ts'
import type { AgentTimelineScene, Lane } from './projection.ts'
import { SpendPanel } from './SpendPanel.tsx'
import type { SpanHue, ActivitySegment, TraceCursor } from './types.ts'

const TIMELINE_ROW_HEIGHT = 30
const TIMELINE_VIEWPORT_HEIGHT = 276
const TIMELINE_WINDOW_THRESHOLD = 500
const TIMELINE_OVERSCAN = 5
const CHART_WIDTH = 920
const CHART_HEIGHT = 156
const CHART_INSET_X = 10
const CHART_INSET_Y = 12

const requestsFor = (scene: AgentTimelineScene, lane: Lane): ReadonlyArray<AgentTimelineRequest> =>
  scene.model.requests.filter((request) => request.sessionId === lane.session.id)

const linePath = (points: ReadonlyArray<{ readonly x: number; readonly y: number }>): string =>
  points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ')

const xFor = (ts: number, start: number, end: number): number =>
  CHART_INSET_X + ((ts - start) / Math.max(1, end - start)) * (CHART_WIDTH - CHART_INSET_X * 2)

const yFor = (value: number, maximum: number): number =>
  CHART_HEIGHT - CHART_INSET_Y - (value / Math.max(1, maximum)) * (CHART_HEIGHT - CHART_INSET_Y * 2)

interface KeyValueProps {
  readonly label: string
  readonly children: ReactNode
  readonly wide?: boolean
}

const KeyValue = ({ label, children, wide = false }: KeyValueProps) => (
  <div {...stylex.props(styles.keyValue, wide && styles.keyValueWide)}>
    <dt {...stylex.props(styles.key)}>{label}</dt>
    <dd {...stylex.props(styles.value, wide && styles.valueWrap)}>{children}</dd>
  </div>
)

const SectionHeading = ({ children }: { readonly children: ReactNode }) => (
  <h3 {...stylex.props(styles.sectionHeading)}>{children}</h3>
)

const iconButtonClass = ({
  isHovered,
  isPressed,
  isFocusVisible,
}: {
  readonly isHovered: boolean
  readonly isPressed: boolean
  readonly isFocusVisible: boolean
}): string =>
  stylex.props(
    styles.iconButton,
    isHovered && styles.buttonHovered,
    isPressed && styles.buttonPressed,
    isFocusVisible && styles.focused,
  ).className ?? ''

interface OverviewPanelProps {
  readonly scene: AgentTimelineScene
  readonly lane: Lane
  readonly onSelectLane: (laneId: string) => void
}

const OverviewPanel = ({ scene, lane, onSelectLane }: OverviewPanelProps) => {
  const children = scene.forks.filter((fork) => fork.parentSessionId === lane.session.id)
  const contextSamples = lane.samples.filter((sample) => sample.contextTokens !== null)
  const currentContext = contextSamples.at(-1)
  const maximumContext = contextSamples.toSorted(
    (left, right) => (right.contextTokens ?? 0) - (left.contextTokens ?? 0),
  )[0]
  const label = sessionLabel(lane.session)
  const modelChanges = Math.max(0, lane.models.length - 1)

  return (
    <div {...stylex.props(styles.panelScroll)}>
      <div {...stylex.props(styles.overviewColumns)}>
        <section>
          <SectionHeading>Span</SectionHeading>
          <dl {...stylex.props(styles.propertyGrid)}>
            <KeyValue label="Name">{label.primary}</KeyValue>
            <KeyValue label="Agent type">{label.type ?? '—'}</KeyValue>
            <KeyValue label="Session ID">{lane.session.id}</KeyValue>
            <KeyValue label="Seat">{lane.session.actorId}</KeyValue>
            <KeyValue label="Root">{lane.rootId}</KeyValue>
            <KeyValue label="Role">{lane.session.role}</KeyValue>
            {label.task === null ? null : (
              <KeyValue label="Task" wide>
                {label.task}
              </KeyValue>
            )}
          </dl>
        </section>
        <section>
          <SectionHeading>Execution</SectionHeading>
          <dl {...stylex.props(styles.propertyGrid)}>
            <KeyValue label="Status">{lane.status._tag}</KeyValue>
            <KeyValue label="Span duration">
              {durationLabel(laneEnd(lane, scene) - lane.session.startedAt)}
            </KeyValue>
            <KeyValue
              label={
                lane.session.activitySampled === true
                  ? 'Wall / active (activity sampled)'
                  : 'Wall / active'
              }
            >
              {durationLabel(lane.wallMs)} / {durationLabel(lane.activeMs)}
            </KeyValue>
            <KeyValue label="Started">{dateTime.format(lane.session.startedAt)} CET/CEST</KeyValue>
            {lane.status._tag === 'exited' ? (
              <KeyValue label="Ended">{dateTime.format(lane.status.at)} CET/CEST</KeyValue>
            ) : (
              <KeyValue label="Last request">
                {dateTime.format(lane.status.lastRequestAt)} CET/CEST
              </KeyValue>
            )}
            <KeyValue label="Model">
              {lane.currentModel}
              {modelChanges === 0 ? '' : ` · changed ×${modelChanges}`}
            </KeyValue>
            <KeyValue label="Models" wide>
              {lane.models.map((entry) => `${clock.format(entry.from)} ${entry.model}`).join(' → ')}
            </KeyValue>
            <KeyValue label="Model role">{lane.session.modelRole ?? '—'}</KeyValue>
            <KeyValue label="Read only">{lane.session.readOnly ? 'yes' : 'no'}</KeyValue>
          </dl>
        </section>
        <section>
          <SectionHeading>Totals</SectionHeading>
          <dl {...stylex.props(styles.propertyGrid)}>
            <KeyValue label="Spend">
              {money.format(lane.totalUsd)}{' '}
              <span {...stylex.props(styles.muted)}>(API-equivalent)</span>
            </KeyValue>
            <KeyValue label="Requests">{integer.format(lane.requests)}</KeyValue>
            <KeyValue label="Agent turns">{integer.format(lane.agentTurns)}</KeyValue>
            <KeyValue label="Human prompts">
              {lane.session.parentId === null
                ? integer.format(lane.humanPromptCount)
                : '— (root only)'}
            </KeyValue>
            <KeyValue label="Tool calls">{integer.format(lane.toolCalls)}</KeyValue>
            <KeyValue label="Context now / max">
              {tokenLabel(currentContext?.contextTokens ?? null)}
              {currentContext?.isContextEstimated
                ? ' estimated'
                : currentContext === undefined
                  ? ''
                  : ' measured'}
              {' / '}
              {tokenLabel(maximumContext?.contextTokens ?? null)}
              {maximumContext?.isContextEstimated
                ? ' estimated'
                : maximumContext === undefined
                  ? ''
                  : ' measured'}
            </KeyValue>
            <KeyValue label="Context source">{lane.contextSource}</KeyValue>
            <KeyValue label="Compactions">{integer.format(lane.compactionCount)}</KeyValue>
            <KeyValue label="Children">{integer.format(children.length)}</KeyValue>
            <KeyValue label="Parent">
              {lane.session.parentId === null ? (
                '—'
              ) : (
                <Button
                  {...stylex.props(styles.inlineButton)}
                  onPress={() => onSelectLane(lane.session.parentId!)}
                >
                  {lane.session.parentId}
                </Button>
              )}
            </KeyValue>
          </dl>
        </section>
      </div>
    </div>
  )
}

type AgentTimelineBin = AgentTimelineModel['bins'][number]

type TimelineEvidence =
  | {
      readonly id: string
      readonly type: 'request'
      readonly ts: number
      readonly request: AgentTimelineRequest
      readonly contextTokens: number | null
      readonly isContextEstimated: boolean
    }
  | {
      readonly id: string
      readonly type: 'bin'
      readonly ts: number
      readonly bin: AgentTimelineBin
    }
  | {
      readonly id: string
      readonly type: 'compaction'
      readonly ts: number
      readonly before: number | null
      readonly after: number | null
    }
  | {
      readonly id: string
      readonly type: 'model-change'
      readonly ts: number
      readonly model: string
    }

type TimelineRow = TimelineEvidence & { readonly cumulativeUsd: number }

const timelineRows = (scene: AgentTimelineScene, lane: Lane): ReadonlyArray<TimelineRow> => {
  const requestRows: TimelineEvidence[] = requestsFor(scene, lane).map((request, index) => ({
    id: `request:${request.ts}:${index}`,
    type: 'request',
    ts: request.ts,
    request,
    contextTokens:
      request.contextTokens ??
      request.inputTokens + request.cacheReadTokens + request.cacheWriteTokens,
    isContextEstimated: request.contextTokens === null,
  }))
  const binRows: TimelineEvidence[] = scene.model.bins
    .filter((bin) => bin.sessionId === lane.session.id)
    .map((bin, index) => ({
      id: `bin:${bin.from}:${index}`,
      type: 'bin',
      ts: bin.from,
      bin,
    }))
  const compactionRows: TimelineEvidence[] = lane.compactions.map((compaction, index) => ({
    id: `compaction:${compaction.ts}:${index}`,
    type: 'compaction',
    ts: compaction.ts,
    before: compaction.before,
    after: compaction.after,
  }))
  const modelRows: TimelineEvidence[] = lane.models
    .filter((entry) => entry.from > lane.session.startedAt)
    .map((entry, index) => ({
      id: `model:${entry.from}:${index}`,
      type: 'model-change',
      ts: entry.from,
      model: entry.model,
    }))
  let cumulativeUsd = 0
  return [...requestRows, ...binRows, ...compactionRows, ...modelRows]
    .toSorted((left, right) => left.ts - right.ts)
    .map((row): TimelineRow => {
      if (row.type === 'request') cumulativeUsd += row.request.usd
      if (row.type === 'bin') cumulativeUsd += row.bin.usd
      return Object.assign(row, { cumulativeUsd })
    })
}

interface TimelinePanelProps {
  readonly scene: AgentTimelineScene
  readonly lane: Lane
  readonly cursor: TraceCursor | null
  readonly onSeek: (ts: number) => void
}

const TimelinePanel = ({ scene, lane, cursor, onSeek }: TimelinePanelProps) => {
  const rows = React.useMemo(() => timelineRows(scene, lane), [scene, lane])
  const nearestIndex = React.useMemo(() => {
    if (cursor === null || rows.length === 0) return -1
    let bestIndex = 0
    let bestDistance = Math.abs(rows[0]!.ts - cursor.ts)
    for (let index = 1; index < rows.length; index += 1) {
      const distance = Math.abs(rows[index]!.ts - cursor.ts)
      if (distance < bestDistance) {
        bestIndex = index
        bestDistance = distance
      }
    }
    return bestIndex
  }, [cursor, rows])
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = React.useState(0)

  React.useEffect(() => {
    if (nearestIndex < 0 || viewportRef.current === null) return
    const next = Math.max(0, nearestIndex * TIMELINE_ROW_HEIGHT - TIMELINE_VIEWPORT_HEIGHT / 2)
    viewportRef.current.scrollTop = next
    setScrollTop(next)
  }, [nearestIndex])

  const isWindowed = rows.length > TIMELINE_WINDOW_THRESHOLD
  const visibleCount =
    Math.ceil(TIMELINE_VIEWPORT_HEIGHT / TIMELINE_ROW_HEIGHT) + TIMELINE_OVERSCAN * 2
  const start = isWindowed
    ? Math.max(0, Math.floor(scrollTop / TIMELINE_ROW_HEIGHT) - TIMELINE_OVERSCAN)
    : 0
  const end = isWindowed ? Math.min(rows.length, start + visibleCount) : rows.length
  const visibleRows = rows.slice(start, end)
  const selectedId = nearestIndex < 0 ? null : rows[nearestIndex]!.id

  return (
    <div
      ref={viewportRef}
      {...stylex.props(styles.tableViewport)}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <Table
        {...stylex.props(styles.table)}
        aria-label={`Request timeline for ${sessionLabel(lane.session).primary}`}
        onRowAction={(key) => {
          const row = rows.find((candidate) => candidate.id === String(key))
          if (row !== undefined) onSeek(row.ts)
        }}
      >
        <TableHeader>
          <Column {...stylex.props(styles.column, styles.timeColumn)} isRowHeader>
            Time
          </Column>
          <Column {...stylex.props(styles.column, styles.kindColumn)}>Kind / stop</Column>
          <Column {...stylex.props(styles.column)}>In</Column>
          <Column {...stylex.props(styles.column)}>Cached</Column>
          <Column {...stylex.props(styles.column)}>Write</Column>
          <Column {...stylex.props(styles.column)}>Out</Column>
          <Column {...stylex.props(styles.column)}>Context</Column>
          <Column {...stylex.props(styles.column)}>Cost</Column>
          <Column {...stylex.props(styles.column)}>Cumulative</Column>
          <Column {...stylex.props(styles.column, styles.toolsColumn)}>Tools</Column>
        </TableHeader>
        <TableBody
          items={visibleRows}
          {...(isWindowed
            ? {
                style: {
                  paddingBlockStart: start * TIMELINE_ROW_HEIGHT,
                  paddingBlockEnd: (rows.length - end) * TIMELINE_ROW_HEIGHT,
                },
              }
            : {})}
        >
          {(row) => {
            const isTurn =
              row.type === 'request' &&
              row.request.kind === 'turn' &&
              row.request.stopReason === 'stop'
            return (
              <Row
                id={row.id}
                textValue={`${clock.format(row.ts)} ${row.type}`}
                className={({ isHovered, isFocusVisible }) =>
                  stylex.props(
                    styles.tableRow,
                    isTurn && styles.turnRow,
                    row.type === 'compaction' && styles.compactionRow,
                    row.type === 'bin' && styles.binnedRow,
                    row.type === 'model-change' && styles.modelChangeRow,
                    row.id === selectedId && styles.selectedRow,
                    isHovered && styles.tableRowHovered,
                    isFocusVisible && styles.focusedRow,
                  ).className ?? ''
                }
              >
                <Cell {...stylex.props(styles.cell, styles.timeCell)}>{clock.format(row.ts)}</Cell>
                {row.type === 'compaction' ? (
                  <>
                    <Cell {...stylex.props(styles.cell, styles.kindCell)}>◆ compaction</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {tokenLabel(row.before)} → {tokenLabel(row.after)}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>{money.format(row.cumulativeUsd)}</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                  </>
                ) : row.type === 'model-change' ? (
                  <>
                    <Cell {...stylex.props(styles.cell, styles.kindCell)}>
                      model change · {shortModel(row.model)}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                    <Cell {...stylex.props(styles.cell)}>{money.format(row.cumulativeUsd)}</Cell>
                    <Cell {...stylex.props(styles.cell)}>—</Cell>
                  </>
                ) : row.type === 'bin' ? (
                  <>
                    <Cell {...stylex.props(styles.cell, styles.kindCell)}>
                      {Math.max(1, Math.round((row.bin.to - row.bin.from) / 60_000))}-min bin
                      {' · '}
                      {integer.format(row.bin.requests)} requests
                      {' · '}
                      {money.format(row.bin.usd)}
                      {' · '}
                      {integer.format(row.bin.toolCalls)} tool calls
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {compactNumber.format(row.bin.inputTokens)}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {compactNumber.format(row.bin.cacheReadTokens)}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {compactNumber.format(row.bin.cacheWriteTokens)}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {compactNumber.format(row.bin.outputTokens)}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {row.bin.contextEstimated ? 'estimated aggregate' : '—'}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>{money.format(row.bin.usd)}</Cell>
                    <Cell {...stylex.props(styles.cell)}>{money.format(row.cumulativeUsd)}</Cell>
                    <Cell {...stylex.props(styles.cell, styles.toolsCell)}>
                      {row.bin.tools.length > 0 ? row.bin.tools.join(', ') : '—'}
                    </Cell>
                  </>
                ) : (
                  <>
                    <Cell {...stylex.props(styles.cell, styles.kindCell)}>
                      {row.request.kind} / {row.request.stopReason}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {compactNumber.format(row.request.inputTokens)}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {compactNumber.format(row.request.cacheReadTokens)}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {compactNumber.format(row.request.cacheWriteTokens)}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {compactNumber.format(row.request.outputTokens)}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>
                      {tokenLabel(row.contextTokens)}
                      {row.isContextEstimated ? ' · estimated' : ' · measured'}
                    </Cell>
                    <Cell {...stylex.props(styles.cell)}>{money.format(row.request.usd)}</Cell>
                    <Cell {...stylex.props(styles.cell)}>{money.format(row.cumulativeUsd)}</Cell>
                    <Cell {...stylex.props(styles.cell, styles.toolsCell)}>
                      {row.request.tools.length > 0 ? row.request.tools.join(', ') : '—'}
                    </Cell>
                  </>
                )}
              </Row>
            )
          }}
        </TableBody>
      </Table>
    </div>
  )
}

interface ContextPanelProps {
  readonly scene: AgentTimelineScene
  readonly lane: Lane
}

const ContextPanel = ({ scene, lane }: ContextPanelProps) => {
  const points = lane.samples.flatMap((sample) =>
    sample.contextTokens === null
      ? []
      : [{ ts: sample.ts, value: sample.contextTokens, estimated: sample.isContextEstimated }],
  )
  const start = lane.session.startedAt
  const end = laneEnd(lane, scene)
  const maximumPoint = points.toSorted((left, right) => right.value - left.value)[0]
  const maximumValue = maximumPoint?.value ?? 0
  const maximum = Math.max(1, maximumValue)
  const plot = points.map((point) => ({
    ts: point.ts,
    value: point.value,
    estimated: point.estimated,
    x: xFor(point.ts, start, end),
    y: yFor(point.value, maximum),
  }))
  const baseline = CHART_HEIGHT - CHART_INSET_Y
  const area =
    plot.length === 0
      ? ''
      : `${linePath(plot)} L${plot.at(-1)!.x.toFixed(1)},${baseline} L${plot[0]!.x.toFixed(1)},${baseline} Z`
  const sourceNote =
    lane.contextSource === 'measured'
      ? 'Measured prompt-token snapshots over the session span.'
      : lane.contextSource === 'estimated'
        ? 'Estimated from billed input because measured context snapshots are unavailable.'
        : 'Mixed measured snapshots and billed-input estimates; hollow points are estimated.'

  return (
    <div {...stylex.props(styles.panelScroll, styles.chartPanel)}>
      <div {...stylex.props(styles.chartHeader)}>
        <div>
          <SectionHeading>Context occupancy · {lane.contextSource}</SectionHeading>
          <p {...stylex.props(styles.note)}>{sourceNote}</p>
        </div>
        <span {...stylex.props(styles.chartMetric)}>
          max {compactNumber.format(maximumValue)} tokens
          {maximumPoint?.estimated
            ? ' · estimated'
            : maximumPoint === undefined
              ? ''
              : ' · measured'}
        </span>
      </div>
      <svg
        {...stylex.props(styles.chart)}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Context tokens over time, ${lane.contextSource}`}
      >
        <path
          d={`M${CHART_INSET_X} ${baseline}H${CHART_WIDTH - CHART_INSET_X}`}
          stroke={tokens['--ds-gray-alpha-400']}
        />
        {area ? <path d={area} fill={tokens['--ds-blue-700']} fillOpacity={0.12} /> : null}
        {plot.length > 0 ? (
          <path
            d={linePath(plot)}
            fill="none"
            stroke={tokens['--ds-blue-700']}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {plot
          .filter((point) => point.estimated)
          .map((point) => (
            <circle
              key={point.ts}
              cx={point.x}
              cy={point.y}
              r={3}
              fill={tokens['--ds-background-100']}
              stroke={tokens['--ds-blue-900']}
              strokeWidth={1.2}
              strokeDasharray="1 1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        {lane.compactions.map((compaction) => {
          const x = xFor(compaction.ts, start, end)
          return (
            <path
              key={compaction.ts}
              d={`M${x} ${CHART_INSET_Y}V${baseline}`}
              stroke={tokens['--ds-amber-900']}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      <div {...stylex.props(styles.axisLabels)}>
        <span>{clock.format(start)}</span>
        <span>Europe/Berlin</span>
        <span>{clock.format(end)}</span>
      </div>
      <SectionHeading>Compactions</SectionHeading>
      {lane.compactions.length === 0 ? (
        <p {...stylex.props(styles.emptyInline)}>
          {lane.compactionCount === 0
            ? 'No compactions occurred in this span.'
            : 'No compaction markers retained in this span.'}
        </p>
      ) : (
        <ol {...stylex.props(styles.compactionList)}>
          {lane.compactions.map((compaction) => (
            <li key={compaction.ts} {...stylex.props(styles.compactionItem)}>
              <time dateTime={new Date(compaction.ts).toISOString()}>
                {minuteClock.format(compaction.ts)}
              </time>
              <span {...stylex.props(styles.compactionArrow)}>↓</span>
              <span>
                {tokenLabel(compaction.before)} → {tokenLabel(compaction.after)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

interface ChildrenPanelProps {
  readonly scene: AgentTimelineScene
  readonly lane: Lane
  readonly onSelectLane: (laneId: string) => void
}

const ChildrenPanel = ({ scene, lane, onSelectLane }: ChildrenPanelProps) => {
  const laneById = new Map(scene.lanes.map((candidate) => [candidate.session.id, candidate]))
  const children = scene.forks.flatMap((fork) => {
    if (fork.parentSessionId !== lane.session.id) return []
    const child = laneById.get(fork.childSessionId)
    return child === undefined ? [] : [child]
  })

  if (children.length === 0)
    return (
      <div {...stylex.props(styles.emptyPanel)}>
        <strong>No child sessions</strong>
        <span>This span did not fork a resident child in the selected window.</span>
      </div>
    )

  return (
    <GridList
      {...stylex.props(styles.childList)}
      aria-label={`Children of ${sessionLabel(lane.session).primary}`}
      items={children}
      onAction={(key) => onSelectLane(String(key))}
    >
      {(child) => {
        const label = sessionLabel(child.session)
        return (
          <GridListItem
            id={child.session.id}
            textValue={`${label.primary} ${label.task ?? ''}`}
            className={({ isHovered, isPressed, isFocusVisible }) =>
              stylex.props(
                styles.childRow,
                isHovered && styles.childRowHovered,
                isPressed && styles.childRowPressed,
                isFocusVisible && styles.focusedRow,
              ).className ?? ''
            }
          >
            <span {...stylex.props(styles.childIdentity)}>
              <strong>{label.primary}</strong>
              {label.type ? <span>‹{label.type}›</span> : null}
              {label.task === null ? null : (
                <span {...stylex.props(styles.childTask)}>{label.task}</span>
              )}
            </span>
            <span
              {...stylex.props(
                styles.stateText,
                child.status._tag === 'active' && styles.activeText,
              )}
            >
              {child.status._tag}
            </span>
            <span>{durationLabel(laneEnd(child, scene) - child.session.startedAt)}</span>
            <span>{money.format(child.totalUsd)}</span>
            <span>
              {child.agentTurns} {child.agentTurns === 1 ? 'turn' : 'turns'}
            </span>
          </GridListItem>
        )
      }}
    </GridList>
  )
}

/** Detail-pane views available for a selected session span. */
export type SpanDetailsTab = 'overview' | 'timeline' | 'context' | 'spend' | 'children'

/** Selected-lane evidence and navigation callbacks consumed by the span detail pane. */
export interface SpanDetailsProps {
  readonly theme?: 'light' | 'dark'
  readonly scene: AgentTimelineScene
  readonly lane: Lane | null
  readonly cursor: TraceCursor | null
  readonly hue: SpanHue | null
  readonly segments: ReadonlyArray<ActivitySegment>
  readonly onSelectLane: (laneId: string) => void
  readonly onSeek: (ts: number) => void
  readonly onZoomToLane: (laneId: string) => void
  readonly onClose: () => void
  readonly height?: number | string
  /** Story/review seam; production selection remains uncontrolled within span details. */
  readonly initialTab?: SpanDetailsTab
  /** Alternate evidence panels for aggregate sources that cannot supply request-level facts. */
  readonly panels?: Partial<Readonly<Record<SpanDetailsTab, ReactNode>>>
  /** Observed runtime status when request recency is not a reliable activity boundary. */
  readonly statusLabel?: string
}

/** Render tabbed evidence for the selected span, or an empty state when none is selected. */
export const SpanDetails = ({
  theme = 'light',
  scene,
  lane,
  cursor,
  hue,
  segments: _segments,
  onSelectLane,
  onSeek,
  onZoomToLane,
  onClose,
  height = 380,
  initialTab = 'overview',
  panels,
  statusLabel,
}: SpanDetailsProps): ReactNode => {
  const label = lane === null ? null : sessionLabel(lane.session)

  return (
    <section
      {...stylex.props(styles.root)}
      style={{ height }}
      data-theme={theme}
      aria-label="Agent timeline details"
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
    >
      {lane === null || label === null ? (
        <>
          <header {...stylex.props(styles.header)}>
            <div {...stylex.props(styles.emptyHeader)}>
              <strong>Span details</strong>
              <span>Select a span to inspect its requests, context, spend, and children.</span>
            </div>
            <TooltipTrigger delay={300}>
              <Button className={iconButtonClass} aria-label="Close span details" onPress={onClose}>
                ×
              </Button>
              <Tooltip {...stylex.props(styles.tooltip)}>Close span details</Tooltip>
            </TooltipTrigger>
          </header>
          <div {...stylex.props(styles.emptyPanel)}>
            <strong>Select a span</strong>
            <span>
              Span details follow the selected session while the shared cursor follows time.
            </span>
          </div>
        </>
      ) : (
        <Tabs {...stylex.props(styles.tabs)} defaultSelectedKey={initialTab}>
          <header {...stylex.props(styles.header)}>
            <div {...stylex.props(styles.identity)}>
              <span
                {...stylex.props(styles.hueSwatch, styles.headerHueSwatch)}
                style={{ backgroundColor: hue?.base ?? tokens['--ds-gray-700'] }}
                aria-hidden="true"
              />
              <strong {...stylex.props(styles.identityName)}>{label.primary}</strong>
              {label.type ? <span {...stylex.props(styles.type)}>‹{label.type}›</span> : null}
              <span {...stylex.props(styles.modelChip)}>
                {shortModel(lane.currentModel)}
                {lane.models.length > 1 ? ` · changed ×${lane.models.length - 1}` : ''}
              </span>
              <span
                {...stylex.props(
                  styles.statusBadge,
                  lane.status._tag === 'active' && styles.activeBadge,
                  lane.status._tag === 'inactive' && styles.inactiveBadge,
                )}
              >
                {statusLabel ?? lane.status._tag}
              </span>
              {label.task === null ? null : (
                <>
                  <span {...stylex.props(styles.taskSeparator)}>·</span>
                  <span {...stylex.props(styles.headerTask)}>{label.task}</span>
                </>
              )}
            </div>
            <TabList {...stylex.props(styles.tabList)} aria-label="Span detail views">
              {(['overview', 'timeline', 'context', 'spend', 'children'] as const).map((id) => (
                <Tab
                  key={id}
                  id={id}
                  className={({ isSelected, isHovered, isFocusVisible }) =>
                    stylex.props(
                      styles.tab,
                      isSelected && styles.selectedTab,
                      isHovered && styles.tabHovered,
                      isFocusVisible && styles.focused,
                    ).className ?? ''
                  }
                >
                  {id[0]!.toUpperCase()}
                  {id.slice(1)}
                </Tab>
              ))}
            </TabList>
            <div {...stylex.props(styles.headerActions)}>
              <TooltipTrigger delay={300}>
                <Button
                  className={iconButtonClass}
                  aria-label="Zoom to span"
                  onPress={() => onZoomToLane(lane.session.id)}
                >
                  <ZoomToSpanIcon />
                </Button>
                <Tooltip {...stylex.props(styles.tooltip)}>Zoom to span</Tooltip>
              </TooltipTrigger>
              <TooltipTrigger delay={300}>
                <Button
                  className={iconButtonClass}
                  aria-label="Close span details"
                  onPress={onClose}
                >
                  ×
                </Button>
                <Tooltip {...stylex.props(styles.tooltip)}>Close span details</Tooltip>
              </TooltipTrigger>
            </div>
          </header>
          <TabPanel id="overview" {...stylex.props(styles.tabPanel)}>
            {panels?.overview ?? <OverviewPanel scene={scene} lane={lane} onSelectLane={onSelectLane} />}
          </TabPanel>
          <TabPanel id="timeline" {...stylex.props(styles.tabPanel)}>
            {panels?.timeline ?? <TimelinePanel scene={scene} lane={lane} cursor={cursor} onSeek={onSeek} />}
          </TabPanel>
          <TabPanel id="context" {...stylex.props(styles.tabPanel)}>
            {panels?.context ?? <ContextPanel scene={scene} lane={lane} />}
          </TabPanel>
          <TabPanel id="spend" {...stylex.props(styles.tabPanel)}>
            {panels?.spend ?? <SpendPanel scene={scene} lane={lane} />}
          </TabPanel>
          <TabPanel id="children" {...stylex.props(styles.tabPanel)}>
            {panels?.children ?? <ChildrenPanel scene={scene} lane={lane} onSelectLane={onSelectLane} />}
          </TabPanel>
        </Tabs>
      )}
    </section>
  )
}

const styles = stylex.create({
  root: {
    containerType: 'inline-size',
    minWidth: 0,
    inlineSize: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    overflow: 'hidden',
    fontSize: '0.75rem',
  },
  header: {
    flex: '0 0 auto',
    height: scale.space10,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: scale.space3,
    paddingInline: scale.space3,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-200'],
  },
  identity: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: scale.space1,
    flex: '1 1 auto',
  },
  identityName: {
    flex: '0 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  hueSwatch: {
    width: scale.space1,
    minHeight: scale.space4,
    flex: '0 0 auto',
    borderRadius: scale.radiusSm,
  },
  headerHueSwatch: { height: scale.space4 },
  type: { flex: '0 0 auto', color: tokens['--ds-gray-800'], whiteSpace: 'nowrap' },
  modelChip: {
    flex: '0 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    paddingBlock: 1,
    paddingInline: scale.space1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    color: tokens['--ds-gray-900'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
    fontFamily: scale.fontMono,
    fontSize: '0.66rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    flex: '0 0 auto',
    paddingBlock: 1,
    paddingInline: scale.space1,
    borderRadius: scale.radiusSm,
    color: tokens['--ds-gray-900'],
    backgroundColor: tokens['--ds-gray-alpha-200'],
    fontSize: '0.66rem',
    fontWeight: 600,
  },
  activeBadge: {
    color: tokens['--ds-green-900'],
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-green-900']} 12%, transparent)`,
  },
  inactiveBadge: {
    color: tokens['--ds-gray-800'],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-500'],
    backgroundColor: 'transparent',
  },
  taskSeparator: { flex: '0 0 auto', color: tokens['--ds-gray-700'] },
  headerTask: {
    flex: '1 1 8rem',
    minWidth: scale.space6,
    overflow: 'hidden',
    color: tokens['--ds-gray-800'],
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyHeader: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    color: tokens['--ds-gray-800'],
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: scale.space1, flexShrink: 0 },
  iconButton: {
    width: scale.space8,
    height: scale.space8,
    display: 'inline-grid',
    placeItems: 'center',
    padding: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: scale.radiusSm,
    color: tokens['--ds-gray-800'],
    backgroundColor: 'transparent',
    font: 'inherit',
    fontSize: '1rem',
    cursor: 'pointer',
    outline: 'none',
  },
  buttonHovered: {
    color: tokens['--ds-foreground'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  buttonPressed: { backgroundColor: tokens['--ds-gray-alpha-200'] },
  focused: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: 1,
  },
  inlineButton: {
    maxWidth: '100%',
    padding: 0,
    borderWidth: 0,
    color: tokens['--ds-blue-700'],
    backgroundColor: 'transparent',
    font: 'inherit',
    fontFamily: scale.fontMono,
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    cursor: 'pointer',
    overflowWrap: 'anywhere',
  },
  tabs: { minHeight: 0, display: 'flex', flex: '1 1 auto', flexDirection: 'column' },
  tabList: {
    display: 'flex',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: scale.space3,
    flex: '0 0 auto',
    minHeight: 0,
  },
  tab: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    paddingInline: 0,
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    color: tokens['--ds-gray-800'],
    backgroundColor: 'transparent',
    font: 'inherit',
    fontSize: '0.68rem',
    fontWeight: 550,
    cursor: 'pointer',
    outline: 'none',
  },
  tabHovered: { color: tokens['--ds-foreground'] },
  selectedTab: { color: tokens['--ds-foreground'], borderBottomColor: tokens['--ds-blue-700'] },
  tabPanel: { minHeight: 0, flex: '1 1 auto', outline: 'none', overflow: 'hidden' },
  tooltip: {
    maxWidth: 320,
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    fontSize: '0.68rem',
    outline: 'none',
  },
  panelScroll: {
    height: '100%',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  overviewColumns: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(3, minmax(0, 1fr))',
      '@container (max-width: 52rem)': '1fr',
    },
    gap: scale.space5,
    padding: scale.space3,
  },
  sectionHeading: {
    marginBlock: `0 ${scale.space2}`,
    marginInline: 0,
    color: tokens['--ds-gray-800'],
    fontSize: '0.66rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  propertyGrid: {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'minmax(6.5rem, auto) minmax(0, 1fr)',
    gap: `${scale.space1} ${scale.space3}`,
  },
  keyValue: { display: 'contents' },
  keyValueWide: {},
  key: { color: tokens['--ds-gray-800'], fontWeight: 500 },
  value: {
    minWidth: 0,
    margin: 0,
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontMono,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  valueWrap: { fontFamily: scale.fontSans, lineHeight: 1.4 },
  muted: { color: tokens['--ds-gray-800'], fontFamily: scale.fontSans },
  tableViewport: {
    height: '100%',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  table: {
    minWidth: '68rem',
    width: '100%',
    borderCollapse: 'collapse',
    outline: 'none',
    fontFamily: scale.fontMono,
    fontVariantNumeric: 'tabular-nums',
  },
  column: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    height: scale.space8,
    paddingInline: scale.space2,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    color: tokens['--ds-gray-800'],
    backgroundColor: tokens['--ds-background-200'],
    fontFamily: scale.fontSans,
    fontSize: '0.65rem',
    fontWeight: 600,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  timeColumn: { width: '5.5rem', textAlign: 'left' },
  kindColumn: { width: '9rem', textAlign: 'left' },
  toolsColumn: { width: '14rem', textAlign: 'left' },
  tableRow: {
    height: TIMELINE_ROW_HEIGHT,
    color: tokens['--ds-gray-900'],
    outline: 'none',
    cursor: 'pointer',
  },
  turnRow: { color: tokens['--ds-foreground'], fontWeight: 600 },
  compactionRow: {
    color: tokens['--ds-amber-900'],
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-amber-900']} 5%, transparent)`,
  },
  binnedRow: { backgroundColor: tokens['--ds-gray-alpha-100'] },
  modelChangeRow: { color: tokens['--ds-purple-900'] },
  selectedRow: {
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-blue-700']} 12%, transparent)`,
  },
  tableRowHovered: { backgroundColor: tokens['--ds-gray-alpha-100'] },
  focusedRow: {
    outlineWidth: 1,
    outlineStyle: 'solid',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: -1,
  },
  cell: {
    height: TIMELINE_ROW_HEIGHT,
    paddingInline: scale.space2,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-200'],
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  timeCell: { color: tokens['--ds-gray-800'], textAlign: 'left' },
  kindCell: { textAlign: 'left' },
  toolsCell: { maxWidth: '20rem', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' },
  chartPanel: { padding: scale.space3, boxSizing: 'border-box' },
  chartHeader: {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: scale.space3,
  },
  chartMetric: {
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontMono,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  note: { margin: 0, color: tokens['--ds-gray-800'], fontSize: '0.7rem', lineHeight: 1.4 },
  chart: {
    display: 'block',
    width: '100%',
    height: '8.5rem',
    marginBlockStart: scale.space2,
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  axisLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBlockStart: scale.space1,
    color: tokens['--ds-gray-800'],
    fontFamily: scale.fontMono,
    fontSize: '0.65rem',
    fontVariantNumeric: 'tabular-nums',
  },
  compactionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  compactionItem: {
    display: 'grid',
    gridTemplateColumns: '4.5rem 1rem minmax(0, 1fr)',
    alignItems: 'baseline',
    fontFamily: scale.fontMono,
    fontVariantNumeric: 'tabular-nums',
  },
  compactionArrow: { color: tokens['--ds-amber-900'] },
  emptyInline: { margin: 0, color: tokens['--ds-gray-800'] },
  childList: {
    height: '100%',
    margin: 0,
    padding: 0,
    overflow: 'auto',
    outline: 'none',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  childRow: {
    minHeight: scale.space10,
    display: 'grid',
    gridTemplateColumns: 'minmax(14rem, 1fr) 4.5rem 5.5rem 5rem 4.5rem',
    alignItems: 'center',
    gap: scale.space3,
    paddingBlock: scale.space1,
    paddingInline: scale.space3,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-200'],
    color: tokens['--ds-gray-900'],
    fontFamily: scale.fontMono,
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
    outline: 'none',
  },
  childRowHovered: { backgroundColor: tokens['--ds-gray-alpha-100'] },
  childRowPressed: { backgroundColor: tokens['--ds-gray-alpha-200'] },
  childIdentity: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'baseline',
    gap: scale.space1,
    fontFamily: scale.fontSans,
  },
  childTask: {
    minWidth: 0,
    marginInlineStart: scale.space1,
    color: tokens['--ds-gray-800'],
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stateText: { color: tokens['--ds-gray-800'], fontWeight: 600 },
  activeText: { color: tokens['--ds-green-900'] },
  emptyPanel: {
    minHeight: 0,
    flex: '1 1 auto',
    display: 'grid',
    placeContent: 'center',
    justifyItems: 'center',
    gap: scale.space1,
    padding: scale.space6,
    color: tokens['--ds-gray-800'],
    textAlign: 'center',
  },
})
