import type { ActivitySegment } from './types.ts'

const BERLIN = 'Europe/Berlin'
/** API-equivalent USD display shared by compact and detail views. */
export const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
/** Compact token counts with one fractional digit. */
export const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
/** Exact integral evidence counters. */
export const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
/** Second-resolution ledger clock in Europe/Berlin. */
export const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: BERLIN,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})
/** Minute-resolution model-change and compaction labels. */
export const minuteClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: BERLIN,
  hour: '2-digit',
  minute: '2-digit',
})
/** Full session timestamp in Europe/Berlin. */
export const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: BERLIN,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Readable model identity without provider prefix or dated release suffix. */
export const shortModel = (model: string): string =>
  model.replace(/^(openai|anthropic|google)\//, '').replace(/-\d{4}-\d{2}-\d{2}$/, '')

/** Human-readable elapsed session time. */
export const durationLabel = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

/** Unknown context remains distinct from a recorded zero token count. */
export const tokenLabel = (value: number | null): string =>
  value === null ? '—' : compactNumber.format(value)

/** Ledger-inferred activity containing the cursor, idle outside recorded segments. */
export const activitySegmentAt = (
  segments: ReadonlyArray<ActivitySegment>,
  ts: number,
): ActivitySegment['state'] =>
  segments.find((segment) => ts >= segment.from && ts <= segment.to)?.state ?? 'idle'
