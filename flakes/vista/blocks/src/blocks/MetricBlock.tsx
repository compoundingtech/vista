/** Typed metric data rendered through the separately bundled telemetry island. */
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
import { MetricData, type MetricSeries } from '../model.ts'
import { TelemetryBadge, TelemetryFrame } from './telemetry-frame.tsx'

/** Stable empty series so the pre-load `mount` callback identity stays steady. */
const EMPTY_SERIES: readonly MetricSeries[] = []

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
 * Decode boundary for the lenient metric payload (decision 0041). The data source
 * yields `unknown`, so the block narrows it through the schema at the fetch seam
 * rather than force-casting `as DataFeed<MetricData>`. A decode failure collapses
 * into the block's existing `error` state (never a crash, never a false render).
 */
const decodeMetricData = Schema.decodeUnknownResult(MetricData)

/**
 * Configures a metric block with title, caption, and meta text, the data feed to load from, an
 * optional telemetry runtime host, and styles that may not override `overflow: 'hidden'`.
 */
export interface MetricBlockProps {
  readonly id: string
  readonly title: string
  readonly caption?: string
  readonly meta?: string
  readonly dataFeed: DataFeed<unknown>
  readonly island?: TelemetryRuntimeHost
  readonly style?: StyleXStylesWithout<{ overflow: 'hidden' }>
}

/**
 * Loads metric data from the data feed on mount into a loadable state (cancelling if unmounted)
 * and renders the metric together with its title, caption, and meta.
 */
export const MetricBlock = ({
  id,
  title,
  caption,
  meta,
  dataFeed,
  island,
  style,
}: MetricBlockProps) => {
  const [loadable, setDataLoadState] = useState<DataLoadState<MetricData>>({ _tag: 'loading' })
  useEffect(() => {
    let cancelled = false
    void dataFeed
      .fetch()
      .then((result) => {
        if (cancelled) return
        if (result._tag !== 'loaded' && result._tag !== 'degraded') {
          setDataLoadState(result)
          return
        }
        const decoded = decodeMetricData(result.value)
        setDataLoadState(
          Result.match(decoded, {
            onFailure: (error): DataLoadState<MetricData> => ({
              _tag: 'error',
              message: `malformed telemetry payload: ${String(error)}`,
            }),
            onSuccess: (value): DataLoadState<MetricData> =>
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

  const series =
    loadable._tag === 'loaded' || loadable._tag === 'degraded'
      ? loadable.value.series
      : EMPTY_SERIES
  const mount = useCallback(
    (mod: TelemetryRuntimeModule, el: HTMLElement) =>
      mod.mountMetric(el, { title, series }, { onError: () => undefined }),
    [title, series],
  )

  if (island === undefined) {
    return (
      <TelemetryFrame
        id={id}
        title={title}
        {...(meta === undefined ? {} : { meta })}
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

  const badge =
    loadable._tag === 'degraded' ? (
      <TelemetryBadge mode="degraded" asOf={loadable.lastSuccessAt} />
    ) : (
      <TelemetryBadge mode={dataFeed.mode} />
    )
  const body = (() => {
    switch (loadable._tag) {
      case 'loading':
        return (
          <p {...stylex.props(styles.emptyState)} role="status">
            loading telemetry…
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
            no telemetry series.
          </p>
        )
      case 'degraded':
        return (
          <>
            <p {...stylex.props(styles.emptyState)} role="alert">
              Metric refresh degraded: {loadable.message}. Last successful data:{' '}
              <time dateTime={loadable.lastSuccessAt}>{loadable.lastSuccessAt}</time>.
            </p>
            {loadable.value.series.length === 0 ? (
              <p {...stylex.props(styles.emptyState)} role="status">
                no telemetry series.
              </p>
            ) : loadable.value.series.every((s) => s.samples.length === 0) ? (
              <p {...stylex.props(styles.emptyState)} role="status">
                series present but no samples in range.
              </p>
            ) : (
              <LazyBlock load={island.load} mount={mount} height={220} label={title} />
            )}
          </>
        )
      case 'loaded': {
        // Structural empty reason, never a bare "no data" (decision 0026 spec).
        if (loadable.value.series.length === 0)
          return (
            <p {...stylex.props(styles.emptyState)} role="status">
              no telemetry series.
            </p>
          )
        if (loadable.value.series.every((s) => s.samples.length === 0))
          return (
            <p {...stylex.props(styles.emptyState)} role="status">
              series present but no samples in range.
            </p>
          )
        return <LazyBlock load={island.load} mount={mount} height={220} label={title} />
      }
    }
  })()

  return (
    <TelemetryFrame
      id={id}
      {...(meta === undefined ? {} : { meta })}
      title={title}
      badge={badge}
      {...(caption ? { caption } : {})}
      style={style}
    >
      {body}
    </TelemetryFrame>
  )
}
