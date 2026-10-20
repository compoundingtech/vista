/** Rounds to the interval width's leading decimal place; unavailable precision is shown as a dash. */
export const roundToCi = (point: number, lo: number, hi: number): string => {
  const width = hi - lo
  if (!Number.isFinite(point) || !Number.isFinite(width) || width <= 0) return '—'

  const widthExponent = Math.floor(Math.log10(width))
  const pointExponent = point === 0 ? widthExponent : Math.floor(Math.log10(Math.abs(point)))
  // Never manufacture digits beyond the precision of the input number itself.
  const fractionDigits = Math.min(14, Math.max(0, pointExponent - widthExponent))
  if (point !== 0 && pointExponent < widthExponent) {
    const step = 10 ** widthExponent
    const rounded = Math.round(point / step) * step
    return rounded === 0 ? '0' : String(rounded)
  }

  const rounded = Number(point.toExponential(fractionDigits))
  if (!Number.isFinite(rounded)) return '—'
  const decimalPlaces = Math.max(0, fractionDigits - pointExponent)
  if (rounded === 0) return '0'
  if (pointExponent < -6 || pointExponent >= 21) {
    return rounded.toExponential(fractionDigits)
  }
  return rounded.toFixed(decimalPlaces)
}
