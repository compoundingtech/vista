/**
 * Geometry for the Explain overlay: hand-drawn rings and arrows, and greedy callout placement.
 * Strokes are seeded, so callouts stay stable across re-renders and do not shimmer on resize.
 */
export interface Pt {
  readonly x: number
  readonly y: number
}

/** Axis-aligned bounds in overlay coordinates. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

const rng = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5
  }
}

const f = (n: number) => n.toFixed(1)

/** A sketched loop around a box: one rounded stroke that overshoots its start, as a marker would. */
export const sketchLoop = ({ x, y, w, h }: Box, seed: number): readonly [string, string] => {
  const loop = (r: () => number, j: number) => {
    const q = Math.min(12, h / 2, w / 2)
    const p = (px: number, py: number) => `${f(px + r() * j)} ${f(py + r() * j)}`
    const side = (bx: number, by: number, ex: number, ey: number) =>
      `Q${p((bx + ex) / 2 + r() * j * 1.5, (by + ey) / 2 + r() * j * 1.5)} ${p(ex, ey)}`
    return [
      `M${p(x + q + 10, y - 1)}`,
      side(x + q + 10, y, x + w - q, y),
      `Q${p(x + w, y)} ${p(x + w, y + q)}`,
      side(x + w, y + q, x + w, y + h - q),
      `Q${p(x + w, y + h)} ${p(x + w - q, y + h)}`,
      side(x + w - q, y + h, x + q, y + h),
      `Q${p(x, y + h)} ${p(x, y + h - q)}`,
      side(x, y + h - q, x, y + q),
      `Q${p(x, y)} ${p(x + q, y)}`,
      // Overshoot past the start, rising slightly: the tell of a hand-drawn ring.
      `Q${p(x + q + 14, y - 2)} ${p(x + q + 30, y - 4)}`,
    ].join('')
  }
  return [loop(rng(seed), 1.6), loop(rng(seed * 7 + 3), 2.6)]
}

/** A sketched arrow: one curved shaft with a two-stroke head at `to`. */
export const sketchArrow = (from: Pt, to: Pt, seed: number): readonly [string, string] => {
  const r = rng(seed)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const bow = (r() > 0 ? 1 : -1) * Math.min(len * 0.22, 36)
  const c = { x: from.x + dx / 2 - (dy / len) * bow, y: from.y + dy / 2 + (dx / len) * bow }
  // The head follows the curve's tangent at the tip, not the straight line.
  const angle = Math.atan2(to.y - c.y, to.x - c.x)
  const head = (side: number) => {
    const a = angle + Math.PI + side * (0.5 + r() * 0.12)
    return `M${f(to.x)} ${f(to.y)}L${f(to.x + Math.cos(a) * 10)} ${f(to.y + Math.sin(a) * 10)}`
  }
  const shaft = (k: number) =>
    `M${f(from.x + r() * k)} ${f(from.y + r() * k)}Q${f(c.x + r() * k * 3)} ${f(c.y + r() * k * 3)} ${f(to.x)} ${f(to.y)}`
  return [shaft(1.2) + head(1) + head(-1), shaft(2.4)]
}

/** Nearest point of `b` to `p`, used to land arrows on box edges. */
export const clampTo = (p: Pt, b: Box): Pt => ({
  x: Math.max(b.x, Math.min(p.x, b.x + b.w)),
  y: Math.max(b.y, Math.min(p.y, b.y + b.h)),
})

/** Expand each edge of a box by the given distance. */
export const inflate = (b: Box, d: number): Box => ({
  x: b.x - d,
  y: b.y - d,
  w: b.w + d * 2,
  h: b.h + d * 2,
})

/** Midpoint of an axis-aligned box. */
export const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

/** Callout size from text length; the extra 22px reserves the leading numeral. */
const estimate = (text: string) => {
  const w = Math.min(232, text.length * 6.9 + 44)
  const lines = Math.ceil((text.length * 6.9) / (w - 44))
  return { w, h: lines * 18 + 12 }
}

/** A placed callout: its label box, the ring target, and the arrow from label to target. */
export interface Callout {
  readonly label: Box
  readonly target: Box
  readonly tail: Pt
  readonly tip: Pt
  readonly seed: number
}

/**
 * Greedy callout placement. Candidates sit on all four sides at two distances and three
 * alignments; the cost prefers short arrows and forbids covering any target, an earlier
 * label, or the host edge.
 */
export const placeCallouts = (
  items: readonly { readonly text: string; readonly box: Box }[],
  width: number,
  height: number,
): readonly Callout[] => {
  const taken: Box[] = []
  return items.map((item, index) => {
    const { w, h } = estimate(item.text)
    const b = item.box
    const options: Box[] = [36, 64].flatMap((gap) => {
      const xs = [b.x + b.w / 2 - w / 2, b.x, b.x + b.w - w]
      const ys = [b.y + b.h / 2 - h / 2, b.y, b.y + b.h - h]
      return ys
        .map((y) => ({ x: b.x + b.w + gap, y, w, h }))
        .concat(
          ys.map((y) => ({ x: b.x - gap - w, y, w, h })),
          xs.map((x) => ({ x, y: b.y + b.h + gap * 0.6, w, h })),
          xs.map((x) => ({ x, y: b.y - gap * 0.6 - h, w, h })),
        )
    })
    const cost = (o: Box) =>
      items.reduce((sum, other) => sum + overlap(o, inflate(other.box, 8)), 0) * 10 +
      taken.reduce((sum, t) => sum + overlap(o, inflate(t, 8)), 0) * 30 +
      Math.hypot(center(o).x - center(b).x, center(o).y - center(b).y) * 4 +
      (o.x < 6 || o.y < 6 || o.x + o.w > width - 6 || o.y + o.h > height - 6 ? 1e7 : 0)
    const best = options.reduce((a, o) => (cost(o) < cost(a) ? o : a))
    taken.push(best)
    const target = inflate(b, 6)
    const tip = clampTo(center(best), target)
    const tail = clampTo(tip, inflate(best, 3))
    return { label: best, target, tail, tip, seed: index * 97 + 13 }
  })
}
