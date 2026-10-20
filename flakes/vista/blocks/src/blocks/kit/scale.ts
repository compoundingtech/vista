/** A duration in milliseconds at about three significant figures: `29.5 ms`, `412 ms`, `3.89 s`, `10.7 s`. */
export const formatDuration = (ms: number): string => {
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1)} s`
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  if (ms >= 100) return `${Math.round(ms)} ms`
  return `${Number.isInteger(ms) ? ms : ms.toFixed(1)} ms`
}

/** A positioned axis: maps a duration to a 0..1 fraction and lists labelled ticks. */
export interface DurationScale {
  readonly position: (ms: number) => number
  readonly ticks: readonly { readonly ms: number; readonly label: string; readonly at: number }[]
}

/**
 * Linear scales start at zero and end at the largest value, so widths stay proportional to
 * duration. Log scales span whole decades around the values, so a 29 ms and an 8 s gap both
 * stay legible on one axis.
 */
export const durationScale = (values: readonly number[], log: boolean): DurationScale => {
  const positive = values.filter((value) => value > 0)
  const max = Math.max(...positive, 1)
  if (!log) {
    return {
      position: (ms) => Math.min(1, Math.max(0, ms / max)),
      ticks: [
        { ms: 0, label: '0', at: 0 },
        { ms: max, label: formatDuration(max), at: 1 },
      ],
    }
  }
  const low = 10 ** Math.floor(Math.log10(Math.min(...positive, max)))
  const high = Math.max(10 ** Math.ceil(Math.log10(max)), low * 10)
  const span = Math.log10(high / low)
  const position = (ms: number) =>
    ms <= 0 ? 0 : Math.min(1, Math.max(0, Math.log10(ms / low) / span))
  const ticks = []
  for (let ms = low; ms <= high; ms *= 10) {
    ticks.push({ ms, label: ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`, at: position(ms) })
  }
  return { position, ticks }
}

/** Whether values spread over enough decades that a linear axis would flatten the small ones. */
export const prefersLogScale = (values: readonly number[]): boolean => {
  const positive = values.filter((value) => value > 0)
  return positive.length > 1 && Math.max(...positive) / Math.min(...positive) >= 100
}
