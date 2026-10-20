declare module '*.css' {}

declare module '@vista/telemetry-island' {
  /** Mounts an interactive metric chart into an owned DOM element and returns its disposer. */
  export const mountMetric: (
    el: HTMLElement,
    props: {
      readonly title: string
      readonly series: ReadonlyArray<{
        readonly metric: string
        readonly labels: Record<string, string>
        readonly samples: ReadonlyArray<{ readonly t: number; readonly v: number }>
      }>
    },
    opts?: { readonly onError?: (e: unknown) => void },
  ) => () => void
}
