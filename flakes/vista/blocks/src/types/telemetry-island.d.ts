/**
 * Ambient type for the standalone `@vista/telemetry-island` chunk (decision 0046).
 * The island is reached through a Storybook Vite ALIAS to the pre-built bundle
 * (`../../island/dist/island.js`), not a node-resolvable workspace package, so tsc
 * needs this declaration to resolve a story's dynamic
 * `import('@vista/telemetry-island')`. It mirrors the chunk's `mount*` exports
 * (`mountMetric`, `mountTrace`, `mountFlamegraph`) and the service's own
 * `telemetry-island.d.ts`.
 */
declare module '@vista/telemetry-island' {
  /** Metric-series payload consumed by the standalone island's metric renderer. */
  export interface MountMetricProps {
    readonly title: string
    readonly series: ReadonlyArray<{
      readonly metric: string
      readonly labels: Record<string, string>
      readonly samples: ReadonlyArray<{ readonly t: number; readonly v: number }>
    }>
  }
  /** Shared mount hooks for reporting asynchronous island render failures. */
  export interface MountOptions {
    readonly onError?: (error: unknown) => void
  }
  /** Mounts an interactive metric chart into an owned DOM element and returns its disposer. */
  export const mountMetric: (
    el: HTMLElement,
    props: MountMetricProps,
    opts?: MountOptions,
  ) => () => void

  /** One OTLP span (the `trace` provider's flattened `TraceResult.spans` shape). */
  export interface TraceSpanInput {
    readonly spanId: string
    readonly parentSpanId: string
    readonly name: string
    readonly serviceName: string
    readonly kind?: string
    readonly startTimeUnixNano: string
    readonly endTimeUnixNano: string
    readonly statusCode?: string
    readonly attributes?: ReadonlyArray<{ readonly key: string; readonly value: string }>
    readonly events?: ReadonlyArray<{
      readonly name: string
      readonly timeUnixNano: string
      readonly attributes?: ReadonlyArray<{ readonly key: string; readonly value: string }>
    }>
  }
  /** Trace identity, optional title, and flattened spans consumed by the island trace renderer. */
  export interface MountTraceProps {
    readonly traceId: string
    readonly title?: string
    readonly spans: ReadonlyArray<TraceSpanInput>
  }
  /** Mounts the trace explorer into an owned DOM element and returns its disposer. */
  export const mountTrace: (
    el: HTMLElement,
    props: MountTraceProps,
    opts?: MountOptions,
  ) => () => void

  /** One backend-faithful Pyroscope flamebearer (the `pyroscope` provider shape). */
  export interface FlamebearerInput {
    readonly names: ReadonlyArray<string>
    readonly levels: ReadonlyArray<ReadonlyArray<number>>
    readonly total: number
    readonly maxSelf: number
  }
  /** Profile identity and flamebearer payload consumed by the island flamegraph renderer. */
  export interface MountFlamegraphProps {
    readonly profileTypeId: string
    readonly title?: string
    readonly flamebearer: FlamebearerInput
    readonly unit?: string
  }
  /** Mounts the flamegraph viewer into an owned DOM element and returns its disposer. */
  export const mountFlamegraph: (
    el: HTMLElement,
    props: MountFlamegraphProps,
    opts?: MountOptions,
  ) => () => void
}
