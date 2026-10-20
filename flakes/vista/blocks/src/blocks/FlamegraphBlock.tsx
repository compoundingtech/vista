/** Typed profile data rendered through the separately bundled telemetry island. */
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
import { ProfileData } from '../model.ts'
import { TelemetryBadge, TelemetryFrame } from './telemetry-frame.tsx'

/** Stable empty levels so the pre-load `mount` callback identity stays steady. */
const EMPTY_LEVELS: ReadonlyArray<ReadonlyArray<number>> = []
const EMPTY_NAMES: readonly string[] = []

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
 * Decode boundary for the lenient Pyroscope flamebearer payload (decision 0041).
 * The data source yields `unknown`, so the block narrows it through the schema at
 * the fetch seam rather than force-casting `as DataFeed<ProfileData>`. A decode
 * failure collapses into the block's existing `error` state.
 */
const decodeProfileData = Schema.decodeUnknownResult(ProfileData)

/**
 * Props for the flamegraph block: the profile type to load, optional title and caption, the data
 * feed supplying profile data, an optional telemetry runtime host, and style overrides excluding
 * overflow.
 */
export interface FlamegraphBlockProps {
  readonly id: string
  readonly profileTypeId: string
  readonly title?: string
  readonly caption?: string
  readonly dataFeed: DataFeed<unknown>
  readonly island?: TelemetryRuntimeHost
  readonly style?: StyleXStylesWithout<{ overflow: 'hidden' }>
}

/**
 * Renders a flamegraph for the given profile type by subscribing to the data feed, defaulting its
 * heading to the profileTypeId and tracking a loading state until profile data arrives.
 */
export const FlamegraphBlock = ({
  id,
  profileTypeId,
  title,
  caption,
  dataFeed,
  island,
  style,
}: FlamegraphBlockProps) => {
  const heading = title ?? profileTypeId
  const [loadable, setDataLoadState] = useState<DataLoadState<ProfileData>>({ _tag: 'loading' })

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
        const decoded = decodeProfileData(result.value)
        setDataLoadState(
          Result.match(decoded, {
            onFailure: (error): DataLoadState<ProfileData> => ({
              _tag: 'error',
              message: `malformed profile payload: ${String(error)}`,
            }),
            onSuccess: (value): DataLoadState<ProfileData> =>
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
  const names = value?.names ?? EMPTY_NAMES
  const levels = value?.levels ?? EMPTY_LEVELS
  const total = value?.total ?? 0
  const maxSelf = value?.maxSelf ?? 0
  const resolvedProfileTypeId = value?.profileTypeId ?? profileTypeId
  const unit = value?.unit
  const mount = useCallback(
    (mod: TelemetryRuntimeModule, el: HTMLElement) =>
      mod.mountFlamegraph(
        el,
        {
          profileTypeId: resolvedProfileTypeId,
          ...(title ? { title } : {}),
          flamebearer: { names, levels, total, maxSelf },
          ...(unit ? { unit } : {}),
        },
        { onError: () => undefined },
      ),
    [resolvedProfileTypeId, title, names, levels, total, maxSelf, unit],
  )

  if (island === undefined) {
    return (
      <TelemetryFrame
        id={id}
        title={heading}
        meta={profileTypeId}
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
            loading profile…
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
            no profile samples in range.
          </p>
        )
      case 'degraded':
      case 'loaded': {
        // Structural empty reason, never a bare "no data" (decision 0026 spec). An
        // empty flamebearer is a names/levels table with no stacks beyond the root.
        if (loadable.value.levels.length === 0 || loadable.value.names.length === 0)
          return (
            <p {...stylex.props(styles.emptyState)} role="status">
              no profile samples in range.
            </p>
          )
        return <LazyBlock load={island.load} mount={mount} height={360} label={heading} />
      }
    }
  })()

  return (
    <TelemetryFrame
      id={id}
      title={heading}
      meta={profileTypeId}
      badge={badge}
      {...(caption ? { caption } : {})}
      style={style}
    >
      {body}
    </TelemetryFrame>
  )
}
