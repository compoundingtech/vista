declare module '@vista/interview/component' {
  import type { ComponentType } from 'react'

  /** React component that binds a published app to its interactive interview question. */
  export const InterviewQuestion: ComponentType<{ readonly appId: string }>
}

declare module '@vista/interview/styles.css' {}

declare module '@vista/telemetry-island' {
  import type { MetricSeries, TraceSpan } from '../model.ts'

  /** Mounts an interactive metric chart into an owned DOM element and returns its disposer. */
  export const mountMetric: (
    element: HTMLElement,
    props: { readonly title: string; readonly series: ReadonlyArray<MetricSeries> },
    options?: { readonly onError?: (error: unknown) => void },
  ) => () => void
  /** Mounts the trace explorer into an owned DOM element and returns its disposer. */
  export const mountTrace: (
    element: HTMLElement,
    props: {
      readonly traceId: string
      readonly title?: string
      readonly spans: ReadonlyArray<TraceSpan>
    },
    options?: { readonly onError?: (error: unknown) => void },
  ) => () => void
  /** Mounts the flamegraph viewer into an owned DOM element and returns its disposer. */
  export const mountFlamegraph: (
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
