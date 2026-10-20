/** Typed trace data rendered through the separately bundled telemetry island. */
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import { Result, Schema } from 'effect'
import { useCallback, useEffect, useState } from 'react'

import type {
  DataFeed,
  DataLoadState,
  TelemetryRuntimeHost,
  TelemetryRuntimeModule,
} from '../data-feed.ts'
import { LazyBlock } from '../LazyBlock.tsx'
import { TraceData, type TraceSpan } from '../model.ts'
import { TelemetryBadge, TelemetryFrame } from './telemetry-frame.tsx'

/** Stable empty spans so the pre-load `mount` callback identity stays steady. */
const EMPTY_SPANS: readonly TraceSpan[] = []

const styles = stylex.create({
  emptyState: {
    margin: 0,
    padding: '0.75rem 0.875rem',
    color: tokens['--ds-gray-800'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
    fontSize: '0.85rem',
    lineHeight: 1.4,
  },
})

/**
 * Decode boundary for the lenient OTLP trace payload (decision 0041). The data
 * source yields `unknown`, so the block narrows it through the schema at the fetch
 * seam rather than force-casting `as DataFeed<TraceData>`. A decode failure
 * collapses into the block's existing `error` state.
 */
const decodeTraceData = Schema.decodeUnknownResult(TraceData)

/**
 * Props for a telemetry trace block, supplying the block and trace identifiers, optional title and
 * caption, the data feed that loads the trace, an optional island runtime host, and a style that
 * cannot change overflow handling.
 */
export interface TraceBlockProps {
  readonly id: string
  readonly traceId: string
  readonly title?: string
  readonly caption?: string
  readonly dataFeed: DataFeed<unknown>
  readonly island?: TelemetryRuntimeHost
  readonly style?: StyleXStylesWithout<{ overflow: 'hidden' }>
}

/**
 * Renders a titled telemetry trace panel that loads trace data through the supplied feed
 * (optionally hosted on the island) and reflects the loadable's loading, success, and failure
 * states in place.
 */
export const TraceBlock = ({
  id,
  traceId,
  title,
  caption,
  dataFeed,
  island,
  style,
}: TraceBlockProps) => {
  const heading = title ?? traceId
  const [loadable, setDataLoadState] = useState<DataLoadState<TraceData>>({ _tag: 'loading' })

  useEffect(() => {
    let cancelled = false
    // oxlint-disable-next-line react/set-state-in-effect -- reset to loading when the feed identity changes; cancellation guard prevents stale writes.
    setDataLoadState({ _tag: 'loading' })
    void dataFeed
      .fetch()
      .then((result) => {
        if (cancelled) return
        if (result._tag !== 'loaded' && result._tag !== 'degraded') {
          setDataLoadState(result)
          return
        }
        const decoded = decodeTraceData(result.value)
        setDataLoadState(
          Result.match(decoded, {
            onFailure: (error): DataLoadState<TraceData> => ({
              _tag: 'error',
              message: `malformed trace payload: ${String(error)}`,
            }),
            onSuccess: (value): DataLoadState<TraceData> =>
              result._tag === 'degraded' ? { ...result, value } : { _tag: 'loaded', value },
          }),
        )
      })
      .catch((error: unknown) => {
        if (!cancelled) setDataLoadState({ _tag: 'error', message: String(error) })
      })
    return () => {
      cancelled = true
    }
  }, [dataFeed])

  const value =
    loadable._tag === 'loaded' || loadable._tag === 'degraded' ? loadable.value : undefined
  const spans = value?.spans ?? EMPTY_SPANS
  const resolvedTraceId = value?.traceId ?? traceId
  const mount = useCallback(
    (mod: TelemetryRuntimeModule, el: HTMLElement) =>
      mod.mountTrace(
        el,
        { traceId: resolvedTraceId, ...(title ? { title } : {}), spans },
        { onError: () => undefined },
      ),
    [resolvedTraceId, title, spans],
  )

  if (island === undefined) {
    return (
      <TelemetryFrame
        id={id}
        title={heading}
        meta={traceId}
        badge={<TelemetryBadge mode={dataFeed.mode} />}
        {...(caption ? { caption } : {})}
        style={style}
      >
        <p {...stylex.props(styles.emptyState)} role="alert">
          telemetry island not available in this host
        </p>
      </TelemetryFrame>
    )
  }

  const badge = <TelemetryBadge mode={dataFeed.mode} />
  const body = (() => {
    switch (loadable._tag) {
      case 'loading':
        return (
          <p {...stylex.props(styles.emptyState)} role="status">
            loading trace…
          </p>
        )
      case 'error':
        return (
          <p {...stylex.props(styles.emptyState)} role="alert">
            error: {loadable.message}
          </p>
        )
      case 'empty':
        return (
          <p {...stylex.props(styles.emptyState)} role="status">
            no spans recorded for this trace.
          </p>
        )
      case 'degraded':
      case 'loaded': {
        // Structural empty reason, never a bare "no data" (decision 0026 spec).
        if (loadable.value.spans.length === 0)
          return (
            <p {...stylex.props(styles.emptyState)} role="status">
              no spans recorded for this trace.
            </p>
          )
        return <LazyBlock load={island.load} mount={mount} height={260} label={heading} />
      }
    }
  })()

  return (
    <TelemetryFrame
      id={id}
      title={heading}
      meta={traceId}
      badge={badge}
      {...(caption ? { caption } : {})}
      style={style}
    >
      {body}
    </TelemetryFrame>
  )
}
