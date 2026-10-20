import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import { Popover } from 'react-aria-components'

import type { AgentTimelineScene } from '@overeng/agent-timeline/projection'
import type { TraceViewport } from '@overeng/agent-timeline/types'

import { useTheme } from '../../theme.ts'
import type { TimelineHoverPoint } from './SpanHover.tsx'

const BERLIN = 'Europe/Berlin'

const time = new Intl.DateTimeFormat('en-GB', {
  timeZone: BERLIN,
  weekday: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const bucketWidthLabel = (milliseconds: number): string => {
  const seconds = Math.max(1, Math.round(milliseconds / 1_000))
  if (seconds < 60) return `${seconds} sec bucket`
  const minutes = Math.round(milliseconds / 60_000)
  if (minutes < 60) return `${minutes} min bucket`
  const wholeHours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (wholeHours < 24)
    return remainingMinutes === 0
      ? `${wholeHours} h bucket`
      : `${wholeHours} h ${remainingMinutes} min bucket`
  const days = Math.floor(wholeHours / 24)
  const remainingHours = wholeHours % 24
  return remainingHours === 0 ? `${days} d bucket` : `${days} d ${remainingHours} h bucket`
}

const cumulativeUsdAt = (scene: AgentTimelineScene, ts: number): number => {
  let low = 0
  let high = scene.cumulativeUsd.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (scene.cumulativeUsd[middle]!.ts <= ts) low = middle + 1
    else high = middle
  }
  return low === 0 ? 0 : scene.cumulativeUsd[low - 1]!.usd
}

/** Whole-window hover evidence for one minimap bucket and cursor position. */
export interface MinimapHoverProps {
  readonly scene: AgentTimelineScene
  readonly viewport: TraceViewport
  readonly hover: TimelineHoverPoint
  readonly requestCount: number
  readonly bucketWidthMs: number
  readonly binned: boolean
}

/** Cursor-following, non-modal readout for whole-window minimap evidence. */
export const MinimapHover = ({
  scene,
  viewport,
  hover,
  requestCount,
  bucketWidthMs,
  binned,
}: MinimapHoverProps): React.ReactNode => {
  const theme = useTheme()
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const [popoverWidth, setPopoverWidth] = React.useState(0)

  React.useLayoutEffect(() => {
    const nextWidth = popoverRef.current?.getBoundingClientRect().width
    if (nextWidth === undefined) return
    setPopoverWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth))
  }, [hover])

  const plotRight = hover.plotRect.left + hover.plotRect.width
  const minimumCenter = hover.plotRect.left + popoverWidth / 2
  const maximumCenter = plotRight - popoverWidth / 2
  const popoverCenter =
    minimumCenter <= maximumCenter
      ? clamp(hover.cursorX, minimumCenter, maximumCenter)
      : hover.plotRect.left + hover.plotRect.width / 2
  const targetCenter = hover.targetRect.left + hover.targetRect.width / 2
  const cumulativeUsd = cumulativeUsdAt(scene, hover.ts)
  const activeSessions = scene.lanes.filter(
    (lane) => lane.session.startedAt <= hover.ts && lane.endTs >= hover.ts,
  ).length
  const inViewport = hover.ts >= viewport.start && hover.ts <= viewport.end

  return (
    <>
      <div
        ref={anchorRef}
        aria-hidden="true"
        data-minimap-hover-anchor
        {...stylex.props(
          styles.anchor,
          styles.anchorBounds(
            hover.targetRect.left,
            hover.targetRect.top,
            hover.targetRect.width,
            hover.targetRect.height,
          ),
        )}
      />
      <Popover
        ref={popoverRef}
        triggerRef={anchorRef}
        isOpen
        isNonModal
        placement="top"
        offset={8}
        crossOffset={popoverCenter - targetCenter}
        shouldFlip
        aria-label="Minimap hover"
        data-minimap-hover
        data-minimap-hover-time={hover.ts}
        data-theme={theme}
        {...stylex.props(styles.popover)}
      >
        <div {...stylex.props(styles.readout)}>
          <time dateTime={new Date(hover.ts).toISOString()} {...stylex.props(styles.time)}>
            {time.format(hover.ts)}
          </time>
          <div {...stylex.props(styles.line)}>
            <span>requests: {integer.format(requestCount)} in this bucket</span>
            <span {...stylex.props(styles.muted)}>· {bucketWidthLabel(bucketWidthMs)}</span>
          </div>
          <div {...stylex.props(styles.line)}>
            $ cumulative: {money.format(cumulativeUsd)} so far
          </div>
          <div {...stylex.props(styles.line)}>
            active sessions: {integer.format(activeSessions)}
          </div>
          {binned ? (
            <div data-minimap-hover-binned {...stylex.props(styles.binned)}>
              binned
            </div>
          ) : null}
          <div data-minimap-hover-viewport {...stylex.props(styles.muted)}>
            {inViewport ? 'in viewport' : 'outside viewport'}
          </div>
        </div>
      </Popover>
    </>
  )
}

const styles = stylex.create({
  anchor: { position: 'fixed', pointerEvents: 'none' },
  anchorBounds: (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    width,
    height,
  }),
  popover: { pointerEvents: 'none' },
  readout: {
    minWidth: '18rem',
    maxWidth: '25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    padding: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontMono,
    fontSize: '0.72rem',
    fontVariantNumeric: 'tabular-nums',
  },
  time: { color: tokens['--ds-foreground'], fontWeight: 600 },
  line: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: scale.space1 },
  binned: { color: tokens['--ds-amber-900'] },
  muted: { color: tokens['--ds-gray-700'] },
})
