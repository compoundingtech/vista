// STUB for `@grafana/o11y-ds-frontend` (vendor unit, decision 0042; aliased in
// vite.config.ts). The trace waterfall reaches this package for only three
// span-bar-label constants (used by `SpanBarRow`) plus two types. Importing the
// real package dragged @grafana/plugin-ui → sql-formatter-plus → @babel/polyfill →
// core-js@2.6.12 — a deprecated build-script dependency that made the standalone
// `pnpm install --ignore-workspace` non-deterministic (its unrun postinstall is a
// hard error under pnpm 11, unsuppressable with `--ignore-workspace`). The three
// constants mirror upstream `@grafana/o11y-ds-frontend` `SpanBarSettings`.
export const NONE = 'None'
export const DURATION = 'Duration'
export const TAG = 'Tag'

export interface SpanBarOptions {
  type?: string
  tag?: string
}

/** Placeholder for the upstream type (used type-only on the waterfall render path). */
export type TraceToProfilesOptions = Record<string, unknown>
