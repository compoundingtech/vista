/**
 * Ambient type for the island's PURE `flamebearer.ts` helper (decision 0041),
 * reached by the service fixture test through the `@vista/flamebearer` vitest alias
 * — the same seam as the `@vista/telemetry-island` chunk. The island file lives
 * outside the service tsconfig `rootDir`, so tsc resolves it via this declaration
 * while vitest resolves the real module at runtime. Keep in sync with
 * `island/src/flamebearer.ts` (it has zero deps, so the signatures are the contract).
 */
declare module '@vista/flamebearer' {
  /** Pyroscope flamebearer (the `pyroscope` provider's `ProfileResult` flamebearer). */
  export interface Flamebearer {
    readonly names: ReadonlyArray<string>
    readonly levels: ReadonlyArray<ReadonlyArray<number>>
    readonly total: number
    readonly maxSelf: number
  }
  /** One nested-set row: a `@grafana/flamegraph` DataFrame field tuple. */
  export interface FlameNode {
    readonly label: string
    readonly level: number
    readonly value: number
    readonly self: number
  }
  /** Reconstruct the call tree and emit DFS pre-order nested-set rows. */
  export const flamebearerToNestedSet: (fb: Flamebearer) => FlameNode[]
}
