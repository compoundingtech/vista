const SECOND_MS = 1_000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const YEAR_MS = 365 * DAY_MS

/** Format a commit timestamp as a stable, compact age relative to one captured instant. */
export const formatCompactAge = (date: string, now: number): string => {
  const elapsed = Math.max(0, now - Date.parse(date))
  if (!Number.isFinite(elapsed) || elapsed < MINUTE_MS) return 'now'
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m`
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`
  if (elapsed < WEEK_MS) return `${Math.floor(elapsed / DAY_MS)}d`
  if (elapsed < YEAR_MS) return `${Math.floor(elapsed / WEEK_MS)}w`
  return `${Math.floor(elapsed / YEAR_MS)}y`
}
