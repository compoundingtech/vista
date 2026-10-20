/**
 * Pixel comparison job shared by the image lens and its Worker entry
 * (`imageDiff.worker.ts`): pure rasterize → diff → paint, plus the lens's bounded job queue.
 * No module-scope side effects.
 */
import type {
  DifferencePalette,
  DifferenceStyle,
  FrameGeometry,
  PixelDiff,
  Raster,
  Size,
} from './ImageDiff.tsx'

const channel = (data: Uint8ClampedArray, index: number) => data[index] ?? 0

/** Pure pixel model, also exported by ImageDiff for callers and tests. */
export const computePixelDiff = (
  before: Raster,
  after: Raster,
  { tolerance }: { readonly tolerance: number },
): PixelDiff => {
  const width = Math.max(before.width, after.width)
  const height = Math.max(before.height, after.height)
  const mask = new Uint8Array(width * height)
  const delta = new Uint8Array(width * height)
  let inkAdded = 0
  let inkRemoved = 0
  let recolored = 0
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bi = (y * before.width + x) * 4
      const ai = (y * after.width + x) * 4
      const ba = x < before.width && y < before.height ? channel(before.data, bi + 3) / 255 : 0
      const aa = x < after.width && y < after.height ? channel(after.data, ai + 3) / 255 : 0
      const br = channel(before.data, bi) * ba + 255 * (1 - ba)
      const bg = channel(before.data, bi + 1) * ba + 255 * (1 - ba)
      const bb = channel(before.data, bi + 2) * ba + 255 * (1 - ba)
      const ar = channel(after.data, ai) * aa + 255 * (1 - aa)
      const ag = channel(after.data, ai + 1) * aa + 255 * (1 - aa)
      const ab = channel(after.data, ai + 2) * aa + 255 * (1 - aa)
      const value = Math.max(Math.abs(br - ar), Math.abs(bg - ag), Math.abs(bb - ab))
      const index = y * width + x
      delta[index] = value
      if (value <= tolerance) continue
      const lumaBefore = 0.2126 * br + 0.7152 * bg + 0.0722 * bb
      const lumaAfter = 0.2126 * ar + 0.7152 * ag + 0.0722 * ab
      if (lumaAfter < lumaBefore - tolerance) {
        mask[index] = 1
        inkAdded++
      } else if (lumaAfter > lumaBefore + tolerance) {
        mask[index] = 2
        inkRemoved++
      } else {
        mask[index] = 3
        recolored++
      }
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  const totalPixels = width * height
  const changedPixels = inkAdded + inkRemoved + recolored
  return {
    width,
    height,
    totalPixels,
    changedPixels,
    ratio: totalPixels === 0 ? 0 : changedPixels / totalPixels,
    inkAdded,
    inkRemoved,
    recolored,
    mask,
    delta,
    bounds:
      maxX < 0 ? undefined : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  }
}

/** Both sides arrive decoded: SVG cannot be decoded in Chromium workers, so the main thread decodes. */
export interface ImageJob {
  readonly id: number
  readonly beforeBitmap: ImageBitmap
  readonly afterBitmap: ImageBitmap
  readonly beforeSize: Size
  readonly afterSize: Size
  readonly frame: FrameGeometry
  readonly tolerance: number
  readonly style?: DifferenceStyle | undefined
  readonly palette?: DifferencePalette | undefined
}

/** What the worker posts back: the raw diff plus an optional pre-painted bitmap and raster fallback. */
export interface ImageJobResult {
  readonly id: number
  readonly beforeSize: Size
  readonly afterSize: Size
  readonly frame: FrameGeometry
  readonly diff: PixelDiff
  readonly painting?: ImageBitmap | undefined
  readonly fallbackRaster?: Raster | undefined
}

const rasterize = (bitmap: ImageBitmap, size: Size, frame: FrameGeometry): Raster => {
  const canvas = new OffscreenCanvas(frame.width, frame.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null) throw new Error('Canvas 2D context unavailable.')
  const x = ((frame.natural.width - size.width) * frame.width) / frame.natural.width / 2
  const y = ((frame.natural.height - size.height) * frame.height) / frame.natural.height / 2
  context.drawImage(
    bitmap,
    x,
    y,
    (size.width * frame.width) / frame.natural.width,
    (size.height * frame.height) / frame.natural.height,
  )
  return context.getImageData(0, 0, frame.width, frame.height)
}

const paint = (
  base: Raster,
  diff: PixelDiff,
  style: DifferenceStyle,
  palette: DifferencePalette,
  tolerance: number,
): ImageBitmap => {
  const canvas = new OffscreenCanvas(diff.width, diff.height)
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('Canvas 2D context unavailable.')
  const pixels = context.createImageData(diff.width, diff.height)
  const out = pixels.data
  const [low, mid, high] = palette.heat
  for (let i = 0; i < diff.totalPixels; i++) {
    const o = i * 4
    const alpha = channel(base.data, o + 3) / 255
    const gray =
      (0.2126 * channel(base.data, o) +
        0.7152 * channel(base.data, o + 1) +
        0.0722 * channel(base.data, o + 2)) *
        alpha +
      255 * (1 - alpha)
    const keep = 1 - palette.dim * (style === 'regions' ? 0.5 : 1)
    out[o] = palette.background[0] + (gray - palette.background[0]) * keep
    out[o + 1] = palette.background[1] + (gray - palette.background[1]) * keep
    out[o + 2] = palette.background[2] + (gray - palette.background[2]) * keep
    out[o + 3] = 255
    const mark = diff.mask[i] ?? 0
    if (style === 'pixels' && mark !== 0) {
      out[o] = palette.highlight[0]
      out[o + 1] = palette.highlight[1]
      out[o + 2] = palette.highlight[2]
    } else if (style === 'heat') {
      const delta = diff.delta[i] ?? 0
      if (delta === 0) continue
      const t = Math.sqrt(delta / 255)
      const from = t < 0.5 ? low : mid
      const to = t < 0.5 ? mid : high
      const u = t < 0.5 ? t * 2 : (t - 0.5) * 2
      const opacity = delta <= tolerance ? 0.3 : 0.92
      for (let c = 0; c < 3; c++)
        out[o + c] =
          channel(out, o + c) * (1 - opacity) +
          ((from[c] ?? 0) * (1 - u) + (to[c] ?? 0) * u) * opacity
    }
  }
  context.putImageData(pixels, 0, 0)
  return canvas.transferToImageBitmap()
}

/** Runs one pixel job and always closes both input bitmaps, even when painting throws. */
export const runImageJob = (job: ImageJob): ImageJobResult => {
  const { beforeBitmap, afterBitmap, beforeSize, afterSize, frame } = job
  try {
    const b = rasterize(beforeBitmap, beforeSize, frame)
    const a = rasterize(afterBitmap, afterSize, frame)
    const diff = computePixelDiff(b, a, { tolerance: job.tolerance })
    const painting =
      job.style !== undefined && job.palette !== undefined
        ? paint(a, diff, job.style, job.palette, job.tolerance)
        : undefined
    return { id: job.id, beforeSize, afterSize, frame, diff, painting }
  } finally {
    beforeBitmap.close()
    afterBitmap.close()
  }
}

/** A bounded job queue: `schedule` settles with its job, and every job frees its slot however it ends. */
export interface JobQueue {
  readonly schedule: <A>(run: () => Promise<A>) => Promise<A>
  /** Jobs currently holding a slot. */
  readonly active: () => number
  /** Jobs waiting for a slot. */
  readonly waiting: () => number
}

/** Runs at most `slots` jobs at once, in enqueue order. */
export const makeJobQueue = (slots: number): JobQueue => {
  const waiting: Array<() => void> = []
  let active = 0
  const drain = () => {
    while (active < slots && waiting.length > 0) {
      active++
      waiting.shift()?.()
    }
  }
  const schedule = <A>(run: () => Promise<A>): Promise<A> => {
    const { promise, resolve, reject } = Promise.withResolvers<A>()
    waiting.push(() => {
      // Called through an async function, a synchronous throw becomes a rejection too.
      void (async () => run())()
        .then(resolve, reject)
        .finally(() => {
          active--
          drain()
        })
    })
    drain()
    return promise
  }
  return { schedule, active: () => active, waiting: () => waiting.length }
}
