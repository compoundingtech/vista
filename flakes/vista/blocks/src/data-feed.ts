import type { MetricSeries, TraceSpan } from './model.ts'

/** Tagged async value used by reusable data-backed React components. */
export type DataLoadState<T> =
  | { readonly _tag: 'loading' }
  | { readonly _tag: 'error'; readonly message: string }
  | {
      readonly _tag: 'degraded'
      readonly value: T
      readonly message: string
      readonly lastSuccessAt: string
    }
  | { readonly _tag: 'empty' }
  | { readonly _tag: 'loaded'; readonly value: T }

/**
 * Contract for a value source that declares whether it serves live or frozen data and exposes a
 * promise resolving to the current load state.
 */
export interface DataFeed<T> {
  readonly mode: 'live' | 'frozen'
  fetch(): Promise<DataLoadState<T>>
}

/**
 * Creates a feed frozen at a single constant value whose fetch always resolves immediately to a
 * loaded state containing that value.
 */
export const fixedFeed = <T>(value: T): DataFeed<T> => ({
  mode: 'frozen',
  fetch: async () => ({ _tag: 'loaded', value }),
})


/** Structural API of the separately bundled telemetry runtime (its own React). */
export interface TelemetryRuntimeModule {
  readonly mountMetric: (
    element: HTMLElement,
    props: { readonly title: string; readonly series: ReadonlyArray<MetricSeries> },
    options?: { readonly onError?: (error: unknown) => void },
  ) => () => void
  readonly mountTrace: (
    element: HTMLElement,
    props: {
      readonly traceId: string
      readonly title?: string
      readonly spans: ReadonlyArray<TraceSpan>
    },
    options?: { readonly onError?: (error: unknown) => void },
  ) => () => void
  readonly mountFlamegraph: (
    element: HTMLElement,
    props: {
      readonly profileTypeId: string
      readonly title?: string
      readonly flamebearer: {
        readonly names: ReadonlyArray<string>
        readonly levels: ReadonlyArray<ReadonlyArray<number>>
        readonly total: number
        readonly maxSelf: number
      }
      readonly unit?: string
    },
    options?: { readonly onError?: (error: unknown) => void },
  ) => () => void
}

/**
 * Contract for a loader that resolves the separately bundled telemetry runtime module on demand,
 * enabling lazy integration with mount-time error handling.
 */
export interface TelemetryRuntimeHost {
  readonly load: () => Promise<TelemetryRuntimeModule>
}
