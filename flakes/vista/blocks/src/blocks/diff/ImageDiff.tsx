/**
 * Image lens: compares a BEFORE and AFTER image (screenshot, PDF page render, scan).
 *
 * The model half is pure and React-free: `computePixelDiff` over RGBA rasters, the
 * `compose*Image` / `changedRegions` renderers for the difference canvas,
 * `imageDiffModel` for the semantic classification and `imageDiffCounts` for the frame
 * summary. Identity comes only from `contentHash`: equal hashes mean the same bytes
 * (single render, no pixel work); equal renders with different hashes are reported as
 * "same render, different bytes".
 *
 * The view renders both arrangements: `split` (side by side, synced zoom and scroll)
 * and `unified` (one stage) with the combined modes `swipe`, `overlay` and `difference`.
 * Pixels are not line-oriented, so `@pierre/diffs` does not apply; controls are React
 * Aria (`Slider`, `Button`, `GridList`, `Tooltip`).
 *
 * `ImageCompareSet` is the N-way peer variant: one reference against N candidates.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import {
  Button,
  GridList,
  GridListItem,
  Label,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  Tooltip,
  TooltipTrigger,
  type Selection,
  type SliderProps,
} from 'react-aria-components'

import type { Theme } from '../../model.ts'
import { useTheme } from '../../theme.ts'
import type { ChangeCounts, ChangeKind, DiffArrangement, DiffMode, DiffSide } from './contract.ts'
import {
  ChangeMark,
  changeKindAccent,
  DiffFrame,
  useDiffArrangement,
  useDiffMode,
  type DiffRelation,
} from './DiffFrame.tsx'
import {
  computePixelDiff,
  type ImageJob,
  type ImageJobResult,
  makeJobQueue,
} from './imageDiffJob.ts'

export { computePixelDiff }

// ---------------------------------------------------------------------------
// Model (pure, React-free)
// ---------------------------------------------------------------------------

/** One image to compare. `contentHash` is the identity: equal hashes mean the same bytes. */
export interface ImageSource {
  readonly src: string
  readonly alt?: string | undefined
  readonly contentHash?: string | undefined
}

/** Pixel dimensions. */
export interface Size {
  readonly width: number
  readonly height: number
}

/** RGBA pixel buffer, structurally compatible with DOM `ImageData`. */
export interface Raster extends Size {
  readonly data: Uint8ClampedArray
}

/** Axis-aligned pixel rectangle. */
export interface PixelRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Per-pixel classification stored in `PixelDiff.mask`. */
export const PixelMark = {
  none: 0,
  /** AFTER is darker: ink/content appeared. */
  inkAdded: 1,
  /** AFTER is lighter: ink/content disappeared. */
  inkRemoved: 2,
  /** Color changed without a clear lightness direction. */
  recolored: 3,
} as const

/** Result of comparing two rasters pixel by pixel. */
export interface PixelDiff extends Size {
  readonly totalPixels: number
  readonly changedPixels: number
  /** `changedPixels / totalPixels`, 0..1. */
  readonly ratio: number
  readonly inkAdded: number
  readonly inkRemoved: number
  readonly recolored: number
  /** One `PixelMark` value per pixel, row-major. */
  readonly mask: Uint8Array<ArrayBuffer>
  /** Max per-channel delta (0..255) per pixel, row-major, including deltas below tolerance. */
  readonly delta: Uint8Array<ArrayBuffer>
  /** Bounding box of all changed pixels; `undefined` when nothing changed. */
  readonly bounds: PixelRect | undefined
}

/** Knobs for pixel comparison and classification. */
export interface ImageDiffThresholds {
  /** Max per-channel delta (0..255) still considered equal; absorbs antialiasing and compression noise. */
  readonly tolerance: number
  /** Changed-pixel ratio (0..1) above which the image counts as `changed`. */
  readonly minChangedRatio: number
}

/** Defaults tuned for rendered documents: ignore antialias fringes, flag a single changed digit. */
export const defaultImageDiffThresholds: ImageDiffThresholds = {
  tolerance: 32,
  minChangedRatio: 0.00005,
}

/** RGB triple, 0..255. */
export type Rgb = readonly [number, number, number]

/** How the `difference` mode renders changed pixels. */
export type DifferenceStyle =
  /** Changed pixels in one highlight color over the dimmed grayscale base. */
  | 'pixels'
  /** Per-pixel delta magnitude as a heat ramp; sub-tolerance noise stays faintly visible. */
  | 'heat'
  /** Only bounding boxes around clustered changed regions, over the dimmed base. */
  | 'regions'

/** Colors for the difference canvas; `dim` (0..1) is how far the base fades toward `background`. */
export interface DifferencePalette {
  readonly background: Rgb
  readonly highlight: Rgb
  /** Heat ramp: low, mid, high delta. */
  readonly heat: readonly [Rgb, Rgb, Rgb]
  readonly dim: number
}

const at = (data: Uint8ClampedArray, index: number): number => data[index] ?? 0

/** Write one base pixel as grayscale composited over white, faded toward `background` by `dim`. */
const writeDimmedBase = (
  out: Uint8ClampedArray,
  o: number,
  base: Raster,
  x: number,
  y: number,
  background: Rgb,
  dim: number,
) => {
  const inBase = x < base.width && y < base.height
  const bi = (y * base.width + x) * 4
  const alpha = inBase ? at(base.data, bi + 3) / 255 : 0
  const r = inBase ? at(base.data, bi) * alpha + 255 * (1 - alpha) : 255
  const g = inBase ? at(base.data, bi + 1) * alpha + 255 * (1 - alpha) : 255
  const b = inBase ? at(base.data, bi + 2) * alpha + 255 * (1 - alpha) : 255
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const keep = 1 - dim
  out[o] = background[0] + (gray - background[0]) * keep
  out[o + 1] = background[1] + (gray - background[1]) * keep
  out[o + 2] = background[2] + (gray - background[2]) * keep
  out[o + 3] = 255
}

/** `pixels` style: changed pixels in the highlight color over the dimmed base. RGBA sized like `diff`. */
export const composeDifferenceImage = (
  base: Raster,
  diff: PixelDiff,
  palette: DifferencePalette,
): Uint8ClampedArray<ArrayBuffer> => {
  const out = new Uint8ClampedArray(diff.width * diff.height * 4)
  const [r, g, b] = palette.highlight
  for (let y = 0; y < diff.height; y++) {
    for (let x = 0; x < diff.width; x++) {
      const index = y * diff.width + x
      const o = index * 4
      if ((diff.mask[index] ?? PixelMark.none) === PixelMark.none) {
        writeDimmedBase(out, o, base, x, y, palette.background, palette.dim)
        continue
      }
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = 255
    }
  }
  return out
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/**
 * `heat` style: every non-zero delta blended over the dimmed base along the heat ramp.
 * Deltas at or below `tolerance` stay faint so compression noise is visible but not loud.
 */
export const composeHeatImage = (
  base: Raster,
  diff: PixelDiff,
  palette: DifferencePalette,
  tolerance: number,
): Uint8ClampedArray<ArrayBuffer> => {
  const out = new Uint8ClampedArray(diff.width * diff.height * 4)
  const [low, mid, high] = palette.heat
  for (let y = 0; y < diff.height; y++) {
    for (let x = 0; x < diff.width; x++) {
      const index = y * diff.width + x
      const o = index * 4
      writeDimmedBase(out, o, base, x, y, palette.background, palette.dim)
      const delta = diff.delta[index] ?? 0
      if (delta === 0) continue
      const t = Math.sqrt(delta / 255)
      const [from, to, u] = t < 0.5 ? [low, mid, t * 2] : [mid, high, (t - 0.5) * 2]
      const alpha = delta <= tolerance ? 0.3 : 0.92
      out[o] = lerp(at(out, o), lerp(from[0], to[0], u), alpha)
      out[o + 1] = lerp(at(out, o + 1), lerp(from[1], to[1], u), alpha)
      out[o + 2] = lerp(at(out, o + 2), lerp(from[2], to[2], u), alpha)
    }
  }
  return out
}

/** `regions` style base: the dimmed grayscale base alone; boxes from `changedRegions` are stroked on top. */
export const composeDimmedBase = (
  base: Raster,
  size: Size,
  palette: DifferencePalette,
  dim: number,
): Uint8ClampedArray<ArrayBuffer> => {
  const out = new Uint8ClampedArray(size.width * size.height * 4)
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++)
      writeDimmedBase(out, (y * size.width + x) * 4, base, x, y, palette.background, dim)
  }
  return out
}

/**
 * Cluster changed pixels into regions: pixels are binned into `cellSize` cells, touching
 * cells (8-neighborhood) form one region, and each region reports the tight pixel bounds
 * of its changed pixels. Ordered top-to-bottom, left-to-right.
 */
export const changedRegions = (diff: PixelDiff, cellSize = 16): readonly PixelRect[] => {
  const bounds = diff.bounds
  if (bounds === undefined) return []
  const cols = Math.ceil(diff.width / cellSize)
  const rows = Math.ceil(diff.height / cellSize)
  const cells = cols * rows
  const minX = new Int32Array(cells).fill(-1)
  const minY = new Int32Array(cells)
  const maxX = new Int32Array(cells)
  const maxY = new Int32Array(cells)
  for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
      if ((diff.mask[y * diff.width + x] ?? PixelMark.none) === PixelMark.none) continue
      const cell = Math.floor(y / cellSize) * cols + Math.floor(x / cellSize)
      if ((minX[cell] ?? -1) < 0) {
        minX[cell] = x
        minY[cell] = y
        maxX[cell] = x
        maxY[cell] = y
        continue
      }
      if (x < (minX[cell] ?? x)) minX[cell] = x
      if (y < (minY[cell] ?? y)) minY[cell] = y
      if (x > (maxX[cell] ?? x)) maxX[cell] = x
      if (y > (maxY[cell] ?? y)) maxY[cell] = y
    }
  }

  const visited = new Uint8Array(cells)
  const regions: PixelRect[] = []
  const stack: number[] = []
  for (let start = 0; start < cells; start++) {
    if (visited[start] === 1 || (minX[start] ?? -1) < 0) continue
    let x0 = Number.POSITIVE_INFINITY
    let y0 = Number.POSITIVE_INFINITY
    let x1 = -1
    let y1 = -1
    visited[start] = 1
    stack.push(start)
    while (stack.length > 0) {
      const cell = stack.pop() ?? 0
      x0 = Math.min(x0, minX[cell] ?? x0)
      y0 = Math.min(y0, minY[cell] ?? y0)
      x1 = Math.max(x1, maxX[cell] ?? x1)
      y1 = Math.max(y1, maxY[cell] ?? y1)
      const cx = cell % cols
      const cy = Math.floor(cell / cols)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          const next = ny * cols + nx
          if (visited[next] === 1 || (minX[next] ?? -1) < 0) continue
          visited[next] = 1
          stack.push(next)
        }
      }
    }
    regions.push({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
  }
  return regions.toSorted((a, b) => a.y - b.y || a.x - b.x)
}

/** Shared comparison canvas: union of both sizes, downscaled so it holds at most `maxPixels`. */
export interface FrameGeometry extends Size {
  /** Factor from natural image pixels to frame pixels (<= 1). */
  readonly scale: number
  /** Unscaled union size, used for aspect ratio and percentage placement. */
  readonly natural: Size
}

/** Compute the letterbox frame both images are drawn onto. */
export const fitFrame = (sizes: readonly Size[], maxPixels: number): FrameGeometry => {
  const natural = {
    width: Math.max(1, ...sizes.map((size) => size.width)),
    height: Math.max(1, ...sizes.map((size) => size.height)),
  }
  const factor = Math.min(1, Math.sqrt(maxPixels / (natural.width * natural.height)))
  return {
    width: Math.max(1, Math.round(natural.width * factor)),
    height: Math.max(1, Math.round(natural.height * factor)),
    scale: factor,
    natural,
  }
}

/** Where an image of `size` sits (centered) inside the frame, in percent of the frame. */
export const placeInFrame = (frame: FrameGeometry, size: Size): PixelRect => ({
  x: ((frame.natural.width - size.width) / 2 / frame.natural.width) * 100,
  y: ((frame.natural.height - size.height) / 2 / frame.natural.height) * 100,
  width: (size.width / frame.natural.width) * 100,
  height: (size.height / frame.natural.height) * 100,
})

/** Whether two sizes differ. */
export const sizesDiffer = (a: Size, b: Size): boolean =>
  a.width !== b.width || a.height !== b.height

/** Human note for a dimension change, or `undefined` when sizes match. */
export const describeSizeChange = (before: Size, after: Size): string | undefined =>
  sizesDiffer(before, after)
    ? `Dimensions changed ${before.width}×${before.height} → ${after.width}×${after.height}; both are centered on a shared ${Math.max(before.width, after.width)}×${Math.max(before.height, after.height)} canvas.`
    : undefined

/** Which side a comparison failure concerns. */
export type FailedSide = 'before' | 'after' | 'both' | 'pixels'

/** Progress of the (DOM-backed) pixel comparison fed into `imageDiffModel`. */
export type PixelComparison =
  | { readonly _tag: 'Pending' }
  | { readonly _tag: 'Failed'; readonly side: FailedSide; readonly message: string }
  | {
      readonly _tag: 'Done'
      readonly diff: PixelDiff
      readonly beforeSize: Size
      readonly afterSize: Size
    }

/** Whether the bytes of two compared images are known to differ (both hashed, hashes unequal). */
export type BytesRelation = 'different' | 'unknown'

/** Semantic classification of one image pair. */
export type ImageDiffModel =
  | { readonly _tag: 'Empty' }
  | { readonly _tag: 'Added' }
  | { readonly _tag: 'Removed' }
  /** Equal `contentHash`: the same bytes, so pixel work is skipped and one render suffices. */
  | { readonly _tag: 'SameBytes'; readonly contentHash: string }
  | { readonly _tag: 'Pending' }
  | { readonly _tag: 'Failed'; readonly side: FailedSide; readonly message: string }
  | {
      readonly _tag: 'Compared'
      readonly kind: 'changed' | 'unchanged'
      readonly diff: PixelDiff
      readonly beforeSize: Size
      readonly afterSize: Size
      readonly dimensionsDiffer: boolean
      /** `unchanged` + `different` is "same render, different bytes". */
      readonly bytes: BytesRelation
    }

/** The shared content hash when both sides are the same bytes; URLs never imply identity. */
export const sameBytes = (before: ImageSource, after: ImageSource): string | undefined =>
  before.contentHash !== undefined && before.contentHash === after.contentHash
    ? before.contentHash
    : undefined

/** Byte relation of two images that are not the same bytes. */
export const bytesRelation = (before: ImageSource, after: ImageSource): BytesRelation =>
  before.contentHash !== undefined && after.contentHash !== undefined ? 'different' : 'unknown'

/** Classify an image pair from its sources and (optional) pixel comparison. */
export const imageDiffModel = ({
  before,
  after,
  pixels,
  minChangedRatio = defaultImageDiffThresholds.minChangedRatio,
}: {
  readonly before?: ImageSource | undefined
  readonly after?: ImageSource | undefined
  readonly pixels?: PixelComparison | undefined
  readonly minChangedRatio?: number | undefined
}): ImageDiffModel => {
  if (before === undefined && after === undefined) return { _tag: 'Empty' }
  if (before === undefined) return { _tag: 'Added' }
  if (after === undefined) return { _tag: 'Removed' }
  const hash = sameBytes(before, after)
  if (hash !== undefined) return { _tag: 'SameBytes', contentHash: hash }
  if (pixels === undefined || pixels._tag === 'Pending') return { _tag: 'Pending' }
  if (pixels._tag === 'Failed')
    return { _tag: 'Failed', side: pixels.side, message: pixels.message }
  const dimensionsDiffer = sizesDiffer(pixels.beforeSize, pixels.afterSize)
  return {
    _tag: 'Compared',
    kind: dimensionsDiffer || pixels.diff.ratio > minChangedRatio ? 'changed' : 'unchanged',
    diff: pixels.diff,
    beforeSize: pixels.beforeSize,
    afterSize: pixels.afterSize,
    dimensionsDiffer,
    bytes: bytesRelation(before, after),
  }
}

/** The `ChangeKind` of a model, `undefined` while pending, failed or empty. */
export const imageDiffKind = (model: ImageDiffModel): ChangeKind | undefined => {
  switch (model._tag) {
    case 'Added':
      return 'added'
    case 'Removed':
      return 'removed'
    case 'SameBytes':
      return 'unchanged'
    case 'Compared':
      return model.kind
    case 'Empty':
    case 'Pending':
    case 'Failed':
      return undefined
  }
}

/** Frame summary counts for one image pair. */
export const imageDiffCounts = (model: ImageDiffModel): ChangeCounts => {
  const kind = imageDiffKind(model)
  return kind === undefined ? {} : { [kind]: 1 }
}

/** Format a 0..1 ratio as a percentage that never rounds a real change down to `0%`. */
export const formatChangedRatio = (ratio: number): string =>
  ratio === 0 ? '0%' : ratio < 0.0001 ? '<0.01%' : `${(ratio * 100).toFixed(ratio < 0.01 ? 2 : 1)}%`

/** Short display form of a content hash. */
export const shortHash = (hash: string): string =>
  hash.length > 12 ? `${hash.slice(0, 12)}…` : hash

// ---------------------------------------------------------------------------
// DOM adapters: loading, rasterizing, cached verdicts
// ---------------------------------------------------------------------------

/** Load state of one image URL. */
export type ImageLoad =
  | { readonly _tag: 'Loading' }
  | { readonly _tag: 'Loaded'; readonly image: HTMLImageElement; readonly size: Size }
  | { readonly _tag: 'Failed'; readonly message: string }

const loadImageElement = (
  src: string,
): Promise<{ readonly image: HTMLImageElement; readonly size: Size }> => {
  const { promise, resolve, reject } = Promise.withResolvers<{
    readonly image: HTMLImageElement
    readonly size: Size
  }>()
  const image = new Image()
  if (!src.startsWith('data:') && !src.startsWith('blob:')) image.crossOrigin = 'anonymous'
  image.decoding = 'async'
  image.addEventListener('load', () => {
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (width > 0 && height > 0) resolve({ image, size: { width, height } })
    else reject(new Error('Image has no intrinsic size.'))
  })
  image.addEventListener('error', () => reject(new Error('Image could not be loaded.')))
  image.src = src
  return promise
}

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof DOMException && error.name === 'SecurityError'
    ? 'Pixel data unavailable: the image is cross-origin without CORS.'
    : error instanceof Error
      ? error.message
      : fallback

const displayedImages = new WeakMap<ImageSource, WeakRef<HTMLImageElement>>()
const rememberDisplayedImage = (source: ImageSource, image: HTMLImageElement) => {
  if (image.naturalWidth > 0 && image.naturalHeight > 0)
    displayedImages.set(source, new WeakRef(image))
}

/** Load an image element for rasterizing; `undefined` when there is no source. */
export const useLoadedImage = (
  src: string | undefined,
  source?: ImageSource,
): ImageLoad | undefined => {
  const [state, setState] = React.useState<
    { readonly src: string; readonly load: ImageLoad } | undefined
  >(undefined)
  const displayed = source === undefined ? undefined : displayedImages.get(source)?.deref()

  // Syncs with the browser's image decoder (an external system); the result is keyed by `src`.
  React.useEffect(() => {
    if (src === undefined || displayed !== undefined) return
    let live = true
    loadImageElement(src).then(
      ({ image, size }) => live && setState({ src, load: { _tag: 'Loaded', image, size } }),
      (error: unknown) =>
        live &&
        setState({
          src,
          load: { _tag: 'Failed', message: errorMessage(error, 'Image could not be loaded.') },
        }),
    )
    return () => {
      live = false
    }
  }, [src, displayed])

  if (src === undefined) return undefined
  if (displayed !== undefined)
    return {
      _tag: 'Loaded',
      image: displayed,
      size: { width: displayed.naturalWidth, height: displayed.naturalHeight },
    }
  return state?.src === src ? state.load : { _tag: 'Loading' }
}

const rasterize = (image: HTMLImageElement, size: Size, frame: FrameGeometry): Raster => {
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null) throw new Error('Canvas 2D context unavailable.')
  const placed = placeInFrame(frame, size)
  context.drawImage(
    image,
    (placed.x / 100) * frame.width,
    (placed.y / 100) * frame.height,
    (placed.width / 100) * frame.width,
    (placed.height / 100) * frame.height,
  )
  return context.getImageData(0, 0, frame.width, frame.height)
}
/** One comparison as queued; images already loaded by a view are reused. */
interface ImageTask {
  readonly before: ImageSource
  readonly after: ImageSource
  readonly beforeImage?: LoadedImage | undefined
  readonly afterImage?: LoadedImage | undefined
  readonly tolerance: number
  readonly maxPixels: number
  readonly style?: DifferenceStyle | undefined
  readonly palette?: DifferencePalette | undefined
}
type LoadedImage = { readonly image: HTMLImageElement; readonly size: Size }
const imageTasks = makeJobQueue(4)
let nextImageJobId = 0

/** Decode on the main thread: Chromium rejects `createImageBitmap(svgBlob)` in workers but decodes SVG `<img>` here. */
const decodeImage = async (
  source: ImageSource,
  loaded: LoadedImage | undefined,
): Promise<LoadedImage> => {
  // Reuse a view's element only if a canvas can read its pixels untainted; otherwise reload with CORS.
  const src = loaded?.image.src
  const readable =
    loaded !== undefined &&
    src !== undefined &&
    (src.startsWith('data:') ||
      src.startsWith('blob:') ||
      loaded.image.crossOrigin === 'anonymous' ||
      new URL(src, location.href).origin === location.origin)
  const image = readable ? loaded : await loadImageElement(source.src)
  // Already loaded, so a rejected `decode()` only means the raster is not pre-decoded; drawing still works.
  await image.image.decode().catch(() => undefined)
  return image
}

/** Both frame-sized bitmaps or none: a half-created pair is closed. */
const frameBitmaps = async (before: LoadedImage, after: LoadedImage, frame: FrameGeometry) => {
  const settled = await Promise.allSettled(
    [before, after].map(({ image, size }) =>
      createImageBitmap(image, {
        resizeWidth: Math.max(1, Math.round((size.width * frame.width) / frame.natural.width)),
        resizeHeight: Math.max(1, Math.round((size.height * frame.height) / frame.natural.height)),
      }),
    ),
  )
  const [b, a] = settled
  if (b?.status === 'fulfilled' && a?.status === 'fulfilled') return [b.value, a.value] as const
  for (const result of settled) if (result.status === 'fulfilled') result.value.close()
  return undefined
}

/** Rasterize and diff transferred bitmaps off the main thread; rejects on any worker failure. */
const runInWorker = (job: ImageJob): Promise<ImageJobResult> => {
  const { promise, resolve, reject } = Promise.withResolvers<ImageJobResult>()
  const worker = new Worker(new URL('./imageDiff.worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener(
    'message',
    (event: MessageEvent<ImageJobResult | { readonly id: number; readonly error: string }>) => {
      worker.terminate()
      if ('error' in event.data) reject(new Error(event.data.error))
      else resolve(event.data)
    },
  )
  // A result that cannot be deserialized fires neither `message` nor `error`.
  worker.addEventListener('messageerror', () => {
    worker.terminate()
    reject(new Error('Comparison result could not be received.'))
  })
  worker.addEventListener('error', (event) => {
    worker.terminate()
    reject(new Error(event.message))
  })
  try {
    worker.postMessage(job, [job.beforeBitmap, job.afterBitmap])
  } catch (error) {
    worker.terminate()
    reject(error)
  }
  return promise
}

const runImageTask = async (task: ImageTask): Promise<ImageJobResult> => {
  const [before, after] = await Promise.all([
    decodeImage(task.before, task.beforeImage),
    decodeImage(task.after, task.afterImage),
  ])
  const frame = fitFrame([before.size, after.size], task.maxPixels)
  const bitmaps =
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined'
      ? await frameBitmaps(before, after, frame)
      : undefined
  if (bitmaps !== undefined) {
    const job: ImageJob = {
      id: ++nextImageJobId,
      beforeBitmap: bitmaps[0],
      afterBitmap: bitmaps[1],
      beforeSize: before.size,
      afterSize: after.size,
      frame,
      tolerance: task.tolerance,
      style: task.style,
      palette: task.palette,
    }
    try {
      return await runInWorker(job)
    } catch {
      // Closing is a no-op once transferred; otherwise it frees the pair. Fall through to the main thread.
      bitmaps[0].close()
      bitmaps[1].close()
    }
  }
  return runMainThreadImageTask(task, before, after, frame)
}

const scheduleImageTask = (task: ImageTask): Promise<ImageJobResult> =>
  imageTasks.schedule(() => runImageTask(task))

/** Browser/test fallback: split the comparison into narrow row bands between animation frames. */
const runMainThreadImageTask = async (
  task: ImageTask,
  before: LoadedImage,
  after: LoadedImage,
  frame: FrameGeometry,
): Promise<ImageJobResult> => {
  const b = rasterize(before.image, before.size, frame)
  const a = rasterize(after.image, after.size, frame)
  const mask = new Uint8Array(frame.width * frame.height)
  const delta = new Uint8Array(mask.length)
  let inkAdded = 0,
    inkRemoved = 0,
    recolored = 0
  let minX = frame.width,
    minY = frame.height,
    maxX = -1,
    maxY = -1
  const bandHeight = Math.max(8, Math.floor(32_000 / frame.width))
  for (let y = 0; y < frame.height; y += bandHeight) {
    const { promise, resolve } = Promise.withResolvers<void>()
    requestAnimationFrame(() => resolve())
    await promise
    const height = Math.min(bandHeight, frame.height - y)
    const from = y * frame.width
    const to = (y + height) * frame.width
    const part = computePixelDiff(
      { width: frame.width, height, data: b.data.subarray(from * 4, to * 4) },
      { width: frame.width, height, data: a.data.subarray(from * 4, to * 4) },
      { tolerance: task.tolerance },
    )
    mask.set(part.mask, from)
    delta.set(part.delta, from)
    inkAdded += part.inkAdded
    inkRemoved += part.inkRemoved
    recolored += part.recolored
    if (part.bounds !== undefined) {
      minX = Math.min(minX, part.bounds.x)
      minY = Math.min(minY, y + part.bounds.y)
      maxX = Math.max(maxX, part.bounds.x + part.bounds.width - 1)
      maxY = Math.max(maxY, y + part.bounds.y + part.bounds.height - 1)
    }
  }
  const changedPixels = inkAdded + inkRemoved + recolored
  const diff: PixelDiff = {
    width: frame.width,
    height: frame.height,
    totalPixels: mask.length,
    changedPixels,
    ratio: mask.length === 0 ? 0 : changedPixels / mask.length,
    inkAdded,
    inkRemoved,
    recolored,
    mask,
    delta,
    bounds:
      maxX < 0 ? undefined : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  }
  return {
    id: ++nextImageJobId,
    beforeSize: before.size,
    afterSize: after.size,
    frame,
    diff,
    fallbackRaster: task.style === undefined ? undefined : a,
  }
}

/** Everything the views need about one image pair. */
export interface ImageComparison {
  readonly before: ImageLoad | undefined
  readonly after: ImageLoad | undefined
  readonly frame: FrameGeometry | undefined
  readonly painting: ImageBitmap | undefined
  readonly fallbackRaster: Raster | undefined
  readonly pixels: PixelComparison | undefined
}

/** Run only while `visible`: the lens passes true once its expanded body is mounted near the viewport. */
export const useImageComparison = ({
  before,
  after,
  tolerance,
  maxPixels,
  skipPixels = false,
  visible = true,
  differenceStyle = 'pixels',
  palette,
}: {
  readonly before: ImageSource | undefined
  readonly after: ImageSource | undefined
  readonly tolerance: number
  readonly maxPixels: number
  readonly skipPixels?: boolean | undefined
  readonly visible?: boolean | undefined
  readonly differenceStyle?: DifferenceStyle | undefined
  readonly palette?: DifferencePalette | undefined
}): ImageComparison => {
  const beforeLoad = useLoadedImage(visible ? before?.src : undefined, before)
  const afterLoad = useLoadedImage(visible && !skipPixels ? after?.src : undefined, after)
  const [state, setState] = React.useState<
    | {
        readonly before: ImageSource
        readonly after: ImageSource
        readonly tolerance: number
        readonly maxPixels: number
        readonly style: DifferenceStyle
        readonly palette: DifferencePalette | undefined
        readonly result: ImageJobResult
      }
    | undefined
  >()
  const [failure, setFailure] = React.useState<
    | {
        readonly before: ImageSource
        readonly after: ImageSource
        readonly tolerance: number
        readonly maxPixels: number
        readonly style: DifferenceStyle
        readonly palette: DifferencePalette | undefined
        readonly message: string
      }
    | undefined
  >()
  // Load completion is part of the trigger: the job is enqueued only once both sides are loaded,
  // so it re-runs when they finish. Swapping to the displayed element of the same source does not re-trigger.
  const loaded = beforeLoad?._tag === 'Loaded' && afterLoad?._tag === 'Loaded'
  const loadsRef = React.useRef({ beforeLoad, afterLoad })
  loadsRef.current = { beforeLoad, afterLoad }
  React.useEffect(() => {
    if (!visible || skipPixels || !loaded || before === undefined || after === undefined) return
    if (
      state?.before === before &&
      state.after === after &&
      state.tolerance === tolerance &&
      state.maxPixels === maxPixels &&
      state.style === differenceStyle &&
      state.palette === palette
    )
      return
    const { beforeLoad: b, afterLoad: a } = loadsRef.current
    if (b?._tag !== 'Loaded' || a?._tag !== 'Loaded') return
    let live = true
    scheduleImageTask({
      before,
      after,
      beforeImage: b,
      afterImage: a,
      tolerance,
      maxPixels,
      style: differenceStyle,
      palette,
    }).then(
      (result) => {
        if (live)
          setState({ before, after, tolerance, maxPixels, style: differenceStyle, palette, result })
        else result.painting?.close()
      },
      (error: unknown) => {
        if (live)
          setFailure({
            before,
            after,
            tolerance,
            maxPixels,
            style: differenceStyle,
            palette,
            message: errorMessage(error, 'Comparison failed.'),
          })
      },
    )
    return () => {
      live = false
    }
  }, [
    visible,
    skipPixels,
    loaded,
    before,
    after,
    tolerance,
    maxPixels,
    differenceStyle,
    palette,
    state,
  ])
  React.useEffect(() => () => state?.result.painting?.close(), [state])
  const current =
    state !== undefined &&
    state.before === before &&
    state.after === after &&
    state.tolerance === tolerance &&
    state.maxPixels === maxPixels &&
    state.style === differenceStyle &&
    state.palette === palette
      ? state.result
      : undefined
  const loadedFrame = React.useMemo(() => {
    const sizes = [beforeLoad, afterLoad].flatMap((load) =>
      load?._tag === 'Loaded' ? [load.size] : [],
    )
    return sizes.length === 0 ? undefined : fitFrame(sizes, maxPixels)
  }, [beforeLoad, afterLoad, maxPixels])
  const frame = current?.frame ?? loadedFrame
  const pixels: PixelComparison | undefined =
    before === undefined || after === undefined || skipPixels
      ? undefined
      : current !== undefined
        ? {
            _tag: 'Done',
            diff: current.diff,
            beforeSize: current.beforeSize,
            afterSize: current.afterSize,
          }
        : failure?.before === before &&
            failure.after === after &&
            failure.tolerance === tolerance &&
            failure.maxPixels === maxPixels &&
            failure.style === differenceStyle &&
            failure.palette === palette
          ? { _tag: 'Failed', side: 'pixels', message: failure.message }
          : beforeLoad?._tag === 'Failed' && afterLoad?._tag === 'Failed'
            ? { _tag: 'Failed', side: 'both', message: 'Neither image could be loaded.' }
            : beforeLoad?._tag === 'Failed'
              ? { _tag: 'Failed', side: 'before', message: beforeLoad.message }
              : afterLoad?._tag === 'Failed'
                ? { _tag: 'Failed', side: 'after', message: afterLoad.message }
                : { _tag: 'Pending' }
  return {
    before: beforeLoad,
    after: afterLoad,
    frame,
    painting: current?.painting,
    fallbackRaster: current?.fallbackRaster,
    pixels,
  }
}

/** Compact, mask-free comparison result used by thumbnails in page sets and compare sets. */
export type ImageVerdict =
  | { readonly _tag: 'SameBytes'; readonly contentHash: string }
  | { readonly _tag: 'Pending' }
  | { readonly _tag: 'Failed'; readonly message: string }
  | {
      readonly _tag: 'Compared'
      readonly kind: 'changed' | 'unchanged'
      readonly ratio: number
      readonly bytes: BytesRelation
    }

/** One pair to classify with `useImageVerdicts`. */
export interface ImageVerdictRequest {
  readonly before: ImageSource
  readonly after: ImageSource
  readonly tolerance: number
  readonly minChangedRatio: number
}

/** The `ChangeKind` of a verdict, `undefined` while pending or failed. */
export const imageVerdictKind = (verdict: ImageVerdict): ChangeKind | undefined =>
  verdict._tag === 'SameBytes'
    ? 'unchanged'
    : verdict._tag === 'Compared'
      ? verdict.kind
      : undefined

const thumbnailPixels = 240_000
const verdictCacheLimit = 512

/** Classify one pair at thumbnail resolution without holding its large pixel buffers. */
export const compareImages = async ({
  before,
  after,
  tolerance,
  minChangedRatio,
}: ImageVerdictRequest): Promise<ImageVerdict> => {
  const displayed = (source: ImageSource): LoadedImage | undefined => {
    const image = displayedImages.get(source)?.deref()
    return image === undefined
      ? undefined
      : { image, size: { width: image.naturalWidth, height: image.naturalHeight } }
  }
  const result = await scheduleImageTask({
    before,
    after,
    beforeImage: displayed(before),
    afterImage: displayed(after),
    tolerance,
    maxPixels: thumbnailPixels,
  })
  const model = imageDiffModel({
    before,
    after,
    minChangedRatio,
    pixels: {
      _tag: 'Done',
      diff: result.diff,
      beforeSize: result.beforeSize,
      afterSize: result.afterSize,
    },
  })
  return model._tag === 'Compared'
    ? { _tag: 'Compared', kind: model.kind, ratio: model.diff.ratio, bytes: model.bytes }
    : { _tag: 'Failed', message: 'Unexpected comparison state.' }
}

const pendingVerdict: ImageVerdict = { _tag: 'Pending' }
const verdicts = new Map<string, ImageVerdict>()
const flights = new Map<string, Promise<ImageVerdict>>()
const verdictListeners = new Map<string, Set<() => void>>()
const verdictVersions = new Map<string, number>()
const changedKeys = new Set<string>()
const sourceTokens = new WeakMap<ImageSource, number>()
const pairTokens = new WeakMap<ImageSource, WeakMap<ImageSource, string>>()
let nextSourceToken = 0
let verdictNotificationFrame = 0

const sourceKey = (source: ImageSource) => {
  if (source.contentHash !== undefined) return `h:${source.contentHash}`
  let token = sourceTokens.get(source)
  if (token === undefined) {
    token = ++nextSourceToken
    sourceTokens.set(source, token)
  }
  return `p:${token}`
}
const verdictKey = ({ before, after, tolerance, minChangedRatio }: ImageVerdictRequest) => {
  let partners = pairTokens.get(before)
  if (partners === undefined) {
    partners = new WeakMap()
    pairTokens.set(before, partners)
  }
  let pair = partners.get(after)
  if (pair === undefined) {
    pair = JSON.stringify([sourceKey(before), sourceKey(after)])
    partners.set(after, pair)
  }
  return `${pair}:${tolerance}:${minChangedRatio}`
}

const trimVerdicts = () => {
  if (verdicts.size <= verdictCacheLimit) return
  for (const key of verdicts.keys()) {
    if (verdicts.size <= verdictCacheLimit) break
    if (verdictListeners.has(key)) continue // Pinned subscribers may exceed the limit.
    verdicts.delete(key)
    verdictVersions.delete(key)
  }
}
const notifyVerdict = (key: string) => {
  changedKeys.add(key)
  if (verdictNotificationFrame !== 0) return
  verdictNotificationFrame = requestAnimationFrame(() => {
    verdictNotificationFrame = 0
    const listeners = new Set<() => void>()
    for (const changed of changedKeys)
      for (const listener of verdictListeners.get(changed) ?? []) listeners.add(listener)
    changedKeys.clear()
    for (const listener of listeners) listener()
  })
}
const startVerdict = (request: ImageVerdictRequest) => {
  if (sameBytes(request.before, request.after) !== undefined) return
  const key = verdictKey(request)
  const cached = verdicts.get(key)
  if (cached !== undefined) {
    verdicts.delete(key)
    verdicts.set(key, cached)
    return
  }
  if (flights.has(key)) return
  const flight = compareImages(request).then(
    (verdict) => verdict,
    (error: unknown): ImageVerdict => ({
      _tag: 'Failed',
      message: errorMessage(error, 'Comparison failed.'),
    }),
  )
  flights.set(key, flight)
  void flight.then((verdict) => {
    flights.delete(key)
    verdicts.delete(key)
    verdicts.set(key, verdict)
    verdictVersions.set(key, (verdictVersions.get(key) ?? 0) + 1)
    trimVerdicts()
    notifyVerdict(key)
  })
}

const observedVerdicts = new WeakMap<Element, ImageVerdictRequest>()
let verdictObserver: IntersectionObserver | undefined
/** Attach to the rendered thumbnail; collapsed/off-screen pairs never enter the comparison queue. */
export const observeImageVerdict = (element: Element | null, request: ImageVerdictRequest) => {
  if (element === null || typeof document === 'undefined') return
  observedVerdicts.set(element, request)
  if (typeof IntersectionObserver === 'undefined') {
    requestAnimationFrame(() => startVerdict(request))
    return
  }
  verdictObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        verdictObserver?.unobserve(entry.target)
        const pending = observedVerdicts.get(entry.target)
        if (pending !== undefined) startVerdict(pending)
      }
    },
    { rootMargin: '600px' },
  )
  verdictObserver.observe(element)
}

/** Subscribe only to keys owned by this lens; no module-wide scalar update fan-out. */
export const useImageVerdicts = (
  requests: readonly ImageVerdictRequest[],
): readonly ImageVerdict[] => {
  const signature = requests.map(verdictKey).join('\u0000')
  // Verdict keys are JSON plus numbers: never empty and never containing a raw NUL, so the
  // signature round-trips and the subscription stays stable across renders with equal requests.
  const keys = React.useMemo(() => (signature === '' ? [] : signature.split('\u0000')), [signature])
  const subscribe = React.useCallback(
    (listener: () => void) => {
      for (const key of keys) {
        let listeners = verdictListeners.get(key)
        if (listeners === undefined) {
          listeners = new Set()
          verdictListeners.set(key, listeners)
        }
        listeners.add(listener)
        const cached = verdicts.get(key)
        if (cached !== undefined) {
          verdicts.delete(key)
          verdicts.set(key, cached)
        }
      }
      return () => {
        for (const key of keys) {
          const listeners = verdictListeners.get(key)
          listeners?.delete(listener)
          if (listeners?.size === 0) verdictListeners.delete(key)
        }
        trimVerdicts()
      }
    },
    [keys],
  )
  const snapshot = React.useCallback(
    () => keys.reduce((version, key) => version + (verdictVersions.get(key) ?? 0), 0),
    [keys],
  )
  React.useSyncExternalStore(subscribe, snapshot, () => 0)
  return requests.map((request, index) => {
    const hash = sameBytes(request.before, request.after)
    return hash !== undefined
      ? { _tag: 'SameBytes', contentHash: hash }
      : (verdicts.get(keys[index] ?? '') ?? pendingVerdict)
  })
}

// ---------------------------------------------------------------------------
// Frame pass-through
// ---------------------------------------------------------------------------

/** Frame props the image-family lenses forward to their `DiffFrame`. */
export interface LensFrameProps {
  readonly id?: string | undefined
  readonly arrangement?: DiffArrangement | undefined
  readonly defaultArrangement?: DiffArrangement | undefined
  readonly onArrangementChange?: ((arrangement: DiffArrangement) => void) | undefined
  readonly collapsed?: boolean | undefined
  readonly defaultCollapsed?: boolean | undefined
  readonly onCollapsedChange?: ((collapsed: boolean) => void) | undefined
  readonly nested?: boolean | undefined
  readonly relation?: DiffRelation | undefined
}

type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> }

/** Drop `undefined` values so optional frame props stay absent under `exactOptionalPropertyTypes`. */
export const definedProps = <T extends object>(props: T): Defined<T> =>
  Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined)) as Defined<T>

/** Pick the frame pass-through props out of a lens's props. */
export const lensFrameProps = ({
  id,
  arrangement,
  defaultArrangement,
  onArrangementChange,
  collapsed,
  defaultCollapsed,
  onCollapsedChange,
  nested,
  relation,
}: LensFrameProps): Defined<LensFrameProps> =>
  definedProps({
    id,
    arrangement,
    defaultArrangement,
    onArrangementChange,
    collapsed,
    defaultCollapsed,
    onCollapsedChange,
    nested,
    relation,
  })

// ---------------------------------------------------------------------------
// ImageDiff view
// ---------------------------------------------------------------------------

/** Combined (`unified`) modes of the image lens. `split` has no modes: it is plain side by side. */
export type ImageCombinedMode = 'swipe' | 'overlay' | 'difference'

/** Combined modes in picker order. */
export const imageDiffModes: readonly DiffMode[] = [
  { id: 'swipe', label: 'Swipe', arrangement: 'unified' },
  { id: 'overlay', label: 'Overlay', arrangement: 'unified' },
  { id: 'difference', label: 'Difference', arrangement: 'unified' },
]

const isCombinedMode = (mode: string | undefined): mode is ImageCombinedMode =>
  mode === 'swipe' || mode === 'overlay' || mode === 'difference'

/** Props for `ImageDiff`. Omit `beforeImage` or `afterImage` for an added or removed image. */
export interface ImageDiffProps extends LensFrameProps {
  readonly title: React.ReactNode
  readonly before: DiffSide
  readonly after: DiffSide
  readonly beforeImage?: ImageSource | undefined
  readonly afterImage?: ImageSource | undefined
  /** Controlled combined mode; pair with `onModeChange`. */
  readonly mode?: ImageCombinedMode | undefined
  readonly defaultMode?: ImageCombinedMode | undefined
  readonly onModeChange?: ((mode: ImageCombinedMode) => void) | undefined
  /** How the `difference` mode paints changes. */
  readonly differenceStyle?: DifferenceStyle | undefined
  /** Initial per-channel tolerance; adjustable in the difference mode. */
  readonly tolerance?: number | undefined
  readonly minChangedRatio?: number | undefined
  /** Upper bound on compared pixels; larger images are downscaled before diffing. */
  readonly maxPixels?: number | undefined
}

const zoomLevels = [1, 1.5, 2, 3, 4] as const

const differencePalette = (theme: Theme): DifferencePalette =>
  theme === 'dark'
    ? {
        background: [10, 10, 10],
        highlight: [255, 72, 220],
        heat: [
          [70, 110, 255],
          [255, 178, 36],
          [255, 72, 72],
        ],
        dim: 0.72,
      }
    : {
        background: [250, 250, 250],
        highlight: [214, 0, 170],
        heat: [
          [37, 99, 235],
          [217, 119, 6],
          [220, 38, 38],
        ],
        dim: 0.78,
      }

const rgb = (color: Rgb) => `rgb(${color.join(' ')})`

const kindForSide = (side: 'before' | 'after'): ChangeKind =>
  side === 'before' ? 'removed' : 'added'

/** Semantic image diff: side by side, or combined as swipe, overlay or pixel difference. */
export const ImageDiff = ({
  title,
  before,
  after,
  beforeImage,
  afterImage,
  mode,
  defaultMode = 'difference',
  onModeChange,
  differenceStyle = 'pixels',
  tolerance: initialTolerance = defaultImageDiffThresholds.tolerance,
  minChangedRatio = defaultImageDiffThresholds.minChangedRatio,
  maxPixels = 2_000_000,
  ...frame
}: ImageDiffProps) => {
  const [tolerance, setTolerance] = React.useState(initialTolerance)
  // DiffFrame mounts the body only once the frame comes near the viewport, so a mounted body is
  // the visibility signal. Re-measuring the body here would race the frames above it growing and
  // leave a mounted body reading "Comparing pixels…" with no job enqueued.
  const [visible, setVisible] = React.useState(false)
  const theme = useTheme()
  const palette = React.useMemo(() => differencePalette(theme), [theme])
  const bodyRef = React.useCallback((element: HTMLDivElement | null) => {
    setVisible(element !== null)
  }, [])
  const hash =
    beforeImage !== undefined && afterImage !== undefined
      ? sameBytes(beforeImage, afterImage)
      : undefined
  const comparison = useImageComparison({
    before: beforeImage,
    after: afterImage,
    tolerance,
    maxPixels,
    skipPixels: hash !== undefined,
    visible,
    differenceStyle,
    palette,
  })
  const model = imageDiffModel({
    before: beforeImage,
    after: afterImage,
    pixels: comparison.pixels,
    minChangedRatio,
  })
  const comparable = beforeImage !== undefined && afterImage !== undefined && hash === undefined

  return (
    <DiffFrame
      {...lensFrameProps(frame)}
      title={title}
      lens="image"
      before={before}
      after={after}
      counts={imageDiffCounts(model)}
      {...(comparable
        ? definedProps({
            modes: imageDiffModes,
            mode,
            defaultMode,
            onModeChange:
              onModeChange === undefined
                ? undefined
                : (next: string) => isCombinedMode(next) && onModeChange(next),
          })
        : {})}
    >
      <ImageDiffBody
        before={before}
        after={after}
        beforeImage={beforeImage}
        afterImage={afterImage}
        comparison={comparison}
        model={model}
        defaultMode={defaultMode}
        differenceStyle={differenceStyle}
        tolerance={tolerance}
        onToleranceChange={setTolerance}
        bodyRef={bodyRef}
      />
    </DiffFrame>
  )
}

const ImageDiffBody = ({
  before,
  after,
  beforeImage,
  afterImage,
  comparison,
  model,
  defaultMode,
  differenceStyle,
  tolerance,
  onToleranceChange,
  bodyRef,
}: PairViewProps & {
  readonly model: ImageDiffModel
  readonly defaultMode: ImageCombinedMode
  readonly differenceStyle: DifferenceStyle
  readonly tolerance: number
  readonly onToleranceChange: (tolerance: number) => void
  readonly bodyRef: (element: HTMLDivElement | null) => void
}) => {
  const arrangement = useDiffArrangement()
  const activeMode = useDiffMode()
  const mode = isCombinedMode(activeMode) ? activeMode : defaultMode
  const sizeNote =
    comparison.before?._tag === 'Loaded' && comparison.after?._tag === 'Loaded'
      ? describeSizeChange(comparison.before.size, comparison.after.size)
      : undefined
  const pair = { before, after, beforeImage, afterImage, comparison }

  return (
    <div ref={bodyRef} {...stylex.props(styles.body)}>
      <ImageStatus model={model} beforeImage={beforeImage} afterImage={afterImage} />
      {sizeNote === undefined ? null : <p {...stylex.props(styles.note)}>{sizeNote}</p>}
      {model._tag === 'SameBytes' && beforeImage !== undefined ? (
        <SingleView
          {...pair}
          image={beforeImage}
          load={comparison.before}
          caption={`${before.label} = ${after.label}`}
        />
      ) : arrangement === 'split' ? (
        <SplitView {...pair} />
      ) : beforeImage === undefined || afterImage === undefined ? (
        afterImage !== undefined ? (
          <SingleView
            {...pair}
            image={afterImage}
            load={comparison.after}
            caption={after.label}
            mark="added"
          />
        ) : beforeImage !== undefined ? (
          <SingleView
            {...pair}
            image={beforeImage}
            load={comparison.before}
            caption={before.label}
            mark="removed"
          />
        ) : null
      ) : mode === 'swipe' ? (
        <SwipeView {...pair} beforeImage={beforeImage} afterImage={afterImage} />
      ) : mode === 'overlay' ? (
        <OverlayView {...pair} beforeImage={beforeImage} afterImage={afterImage} />
      ) : (
        <DifferenceView
          model={model}
          comparison={comparison}
          tolerance={tolerance}
          onToleranceChange={onToleranceChange}
          differenceStyle={differenceStyle}
        />
      )}
    </div>
  )
}

/** Chip with a tooltip carrying the byte-level evidence (hashes). */
export const BytesMark = ({
  label,
  detail,
}: {
  readonly label: string
  readonly detail: React.ReactNode
}) => (
  <TooltipTrigger delay={300}>
    <Button {...stylex.props(styles.bytesChip, styles.ring)}>{label}</Button>
    <Tooltip offset={6} {...stylex.props(styles.tooltip)}>
      {detail}
    </Tooltip>
  </TooltipTrigger>
)

const ImageStatus = ({
  model,
  beforeImage,
  afterImage,
}: {
  readonly model: ImageDiffModel
  readonly beforeImage: ImageSource | undefined
  readonly afterImage: ImageSource | undefined
}) => {
  switch (model._tag) {
    case 'Empty':
      return <p {...stylex.props(styles.status)}>No image on either side.</p>
    case 'Added':
      return (
        <p {...stylex.props(styles.status)}>
          <ChangeMark kind="added">Image added</ChangeMark>
        </p>
      )
    case 'Removed':
      return (
        <p {...stylex.props(styles.status)}>
          <ChangeMark kind="removed">Image removed</ChangeMark>
        </p>
      )
    case 'SameBytes':
      return (
        <p {...stylex.props(styles.status)}>
          <BytesMark
            label="Same bytes"
            detail={<span {...stylex.props(styles.mono)}>content hash {model.contentHash}</span>}
          />
          <span>Identical content; shown once, pixel comparison skipped.</span>
        </p>
      )
    case 'Pending':
      return <p {...stylex.props(styles.status)}>Comparing pixels…</p>
    case 'Failed':
      return (
        <p role="alert" {...stylex.props(styles.status, styles.error)}>
          {model.message}
        </p>
      )
    case 'Compared':
      return (
        <p {...stylex.props(styles.status)}>
          {model.kind === 'changed' ? (
            <ChangeMark kind="changed">
              {formatChangedRatio(model.diff.ratio)} of pixels differ
            </ChangeMark>
          ) : model.bytes === 'different' ? (
            <>
              <BytesMark
                label="Same render, different bytes"
                detail={
                  <span {...stylex.props(styles.mono)}>
                    {beforeImage?.contentHash} ≠ {afterImage?.contentHash}
                  </span>
                }
              />
              <span>
                The files differ but render identically
                {model.diff.changedPixels > 0
                  ? ` (${formatChangedRatio(model.diff.ratio)} below threshold)`
                  : ''}
                .
              </span>
            </>
          ) : (
            <span>
              No visible change
              {model.diff.changedPixels > 0
                ? ` (${formatChangedRatio(model.diff.ratio)} below threshold)`
                : ''}
            </span>
          )}
        </p>
      )
  }
}

interface PairViewProps {
  readonly before: DiffSide
  readonly after: DiffSide
  readonly beforeImage: ImageSource | undefined
  readonly afterImage: ImageSource | undefined
  readonly comparison: ImageComparison
}

const loadedSize = (load: ImageLoad | undefined): Size | undefined =>
  load?._tag === 'Loaded' ? load.size : undefined

const percent = (value: number) => `${value}%`

/** An image placed (centered, letterboxed) inside a frame-shaped box. */
const PlacedImage = ({
  image,
  load,
  frame,
  extra,
}: {
  readonly image: ImageSource
  readonly load: ImageLoad | undefined
  readonly frame: FrameGeometry | undefined
  readonly extra?: stylex.StyleXStyles | undefined
}) => {
  const size = loadedSize(load)
  const placed =
    frame !== undefined && size !== undefined
      ? placeInFrame(frame, size)
      : { x: 0, y: 0, width: 100, height: 100 }
  return (
    <img
      src={image.src}
      alt={image.alt ?? ''}
      onLoad={(event) => rememberDisplayedImage(image, event.currentTarget)}
      draggable={false}
      {...stylex.props(
        styles.placed,
        styles.placedAt(
          percent(placed.x),
          percent(placed.y),
          percent(placed.width),
          percent(placed.height),
        ),
        extra,
      )}
    />
  )
}

const stageAspect = (frame: FrameGeometry | undefined) =>
  frame === undefined ? '3 / 4' : `${frame.natural.width} / ${frame.natural.height}`

/** Stage width: full width, but never taller than ~560px. */
const stageWidth = (frame: FrameGeometry | undefined) =>
  frame === undefined
    ? '100%'
    : `min(100%, ${Math.round((560 * frame.natural.width) / frame.natural.height)}px)`

const LoadFailure = ({ load }: { readonly load: ImageLoad | undefined }) =>
  load?._tag === 'Failed' ? (
    <div role="alert" {...stylex.props(styles.paneMessage, styles.error)}>
      {load.message}
    </div>
  ) : null

/** One render: same bytes (shown once) or a one-sided image in the combined arrangement. */
const SingleView = ({
  image,
  load,
  comparison,
  caption,
  mark,
}: PairViewProps & {
  readonly image: ImageSource
  readonly load: ImageLoad | undefined
  readonly caption: string
  readonly mark?: 'added' | 'removed' | undefined
}) => {
  const frame = comparison.frame
  return (
    <figure {...stylex.props(styles.pane)}>
      <figcaption {...stylex.props(styles.paneLabel)}>{caption}</figcaption>
      {load?._tag === 'Failed' ? (
        <LoadFailure load={load} />
      ) : (
        <div
          {...stylex.props(styles.stage, styles.stageSize(stageWidth(frame), stageAspect(frame)))}
        >
          <PlacedImage
            image={image}
            load={load}
            frame={frame}
            extra={mark === undefined ? undefined : styles.markSingle(mark)}
          />
        </div>
      )}
    </figure>
  )
}

const SplitView = ({ before, after, beforeImage, afterImage, comparison }: PairViewProps) => {
  const [zoomIndex, setZoomIndex] = React.useState(0)
  const zoom = zoomLevels[zoomIndex] ?? 1
  const panes = React.useRef<{ before: HTMLDivElement | null; after: HTMLDivElement | null }>({
    before: null,
    after: null,
  })

  const sync = (from: 'before' | 'after') => {
    const source = panes.current[from]
    const target = panes.current[from === 'before' ? 'after' : 'before']
    if (source === null || target === null) return
    const ratioX = source.scrollLeft / Math.max(1, source.scrollWidth - source.clientWidth)
    const ratioY = source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight)
    const nextX = ratioX * (target.scrollWidth - target.clientWidth)
    const nextY = ratioY * (target.scrollHeight - target.clientHeight)
    if (Math.abs(target.scrollLeft - nextX) > 1) target.scrollLeft = nextX
    if (Math.abs(target.scrollTop - nextY) > 1) target.scrollTop = nextY
  }

  const pane = (which: 'before' | 'after') => {
    const side = which === 'before' ? before : after
    const image = which === 'before' ? beforeImage : afterImage
    const load = which === 'before' ? comparison.before : comparison.after
    return (
      <figure {...stylex.props(styles.pane)}>
        <figcaption {...stylex.props(styles.paneLabel)}>{side.label}</figcaption>
        {image === undefined ? (
          <div {...stylex.props(styles.paneMessage, styles.missing)}>
            {which === 'before' ? 'No image before' : 'No image after'}
          </div>
        ) : load?._tag === 'Failed' ? (
          <LoadFailure load={load} />
        ) : (
          <div
            ref={(element) => {
              panes.current[which] = element
            }}
            onScroll={() => sync(which)}
            tabIndex={0}
            aria-label={`${side.label} image, scrollable when zoomed`}
            {...stylex.props(styles.scroller, styles.focusable)}
          >
            <div {...stylex.props(styles.zoomBox(`${zoom * 100}%`, stageAspect(comparison.frame)))}>
              <PlacedImage
                image={image}
                load={load}
                frame={comparison.frame}
                extra={
                  beforeImage === undefined || afterImage === undefined
                    ? styles.markSingle(kindForSide(which))
                    : undefined
                }
              />
            </div>
          </div>
        )}
      </figure>
    )
  }

  const bothPresent = beforeImage !== undefined && afterImage !== undefined
  return (
    <div {...stylex.props(styles.column)}>
      {bothPresent ? (
        <div role="group" aria-label="Zoom" {...stylex.props(styles.controls)}>
          <Button
            isDisabled={zoomIndex === 0}
            onPress={() => setZoomIndex((index) => Math.max(0, index - 1))}
            aria-label="Zoom out"
            {...stylex.props(styles.button, styles.ring)}
          >
            −
          </Button>
          <Button
            onPress={() => setZoomIndex(0)}
            aria-label="Fit to width"
            {...stylex.props(styles.button, styles.ring, zoomIndex === 0 && styles.buttonActive)}
          >
            {zoomIndex === 0 ? 'Fit' : `${Math.round(zoom * 100)}%`}
          </Button>
          <Button
            isDisabled={zoomIndex === zoomLevels.length - 1}
            onPress={() => setZoomIndex((index) => Math.min(zoomLevels.length - 1, index + 1))}
            aria-label="Zoom in"
            {...stylex.props(styles.button, styles.ring)}
          >
            +
          </Button>
          <span {...stylex.props(styles.hint)}>Zoom and scroll are synced across both sides.</span>
        </div>
      ) : null}
      <div {...stylex.props(styles.split)}>
        {pane('before')}
        {pane('after')}
      </div>
    </div>
  )
}

const StageFailures = ({ comparison }: { readonly comparison: ImageComparison }) => (
  <>
    <LoadFailure load={comparison.before} />
    <LoadFailure load={comparison.after} />
  </>
)

/** Labelled horizontal React Aria slider with a live value output. */
const LabeledSlider = ({
  label,
  format,
  ...props
}: { readonly label: string; readonly format: (value: number) => string } & Omit<
  SliderProps<number>,
  'children' | 'className' | 'style'
>) => (
  <Slider {...props} {...stylex.props(styles.slider)}>
    <Label {...stylex.props(styles.sliderLabel)}>{label}</Label>
    <SliderTrack {...stylex.props(styles.sliderTrack)}>
      <span {...stylex.props(styles.sliderRail)} />
      <SliderThumb {...stylex.props(styles.sliderThumb, styles.ring)} />
    </SliderTrack>
    <SliderOutput {...stylex.props(styles.mono)}>
      {({ state }) => format(state.getThumbValue(0))}
    </SliderOutput>
  </Slider>
)

const SwipeView = ({
  before,
  after,
  beforeImage,
  afterImage,
  comparison,
}: PairViewProps & { readonly beforeImage: ImageSource; readonly afterImage: ImageSource }) => {
  const [position, setPosition] = React.useState(50)
  const frame = comparison.frame
  return (
    <div {...stylex.props(styles.column)}>
      <StageFailures comparison={comparison} />
      <Slider
        aria-label={`Swipe between ${before.label} and ${after.label}`}
        value={position}
        onChange={setPosition}
        minValue={0}
        maxValue={100}
        step={0.5}
        {...stylex.props(styles.stageSize(stageWidth(frame), stageAspect(frame)))}
      >
        <SliderTrack {...stylex.props(styles.stage, styles.fill, styles.swipeStage)}>
          <PlacedImage image={beforeImage} load={comparison.before} frame={frame} />
          <div {...stylex.props(styles.layer, styles.clipFrom(`inset(0 0 0 ${position}%)`))}>
            <PlacedImage image={afterImage} load={comparison.after} frame={frame} />
          </div>
          <span {...stylex.props(styles.cornerLabel, styles.cornerStart)}>{before.label}</span>
          <span {...stylex.props(styles.cornerLabel, styles.cornerEnd)}>{after.label}</span>
          <SliderThumb {...stylex.props(styles.divider, styles.ring)}>
            <span {...stylex.props(styles.dividerGrip)} />
          </SliderThumb>
        </SliderTrack>
      </Slider>
      <span {...stylex.props(styles.hint)}>
        Drag anywhere on the image, or focus the divider and use arrow keys (Page Up/Down for larger
        steps).
      </span>
    </div>
  )
}

const OverlayView = ({
  after,
  beforeImage,
  afterImage,
  comparison,
}: PairViewProps & { readonly beforeImage: ImageSource; readonly afterImage: ImageSource }) => {
  const [opacity, setOpacity] = React.useState(50)
  return (
    <div {...stylex.props(styles.column)}>
      <div {...stylex.props(styles.controls)}>
        <LabeledSlider
          label={`${after.label} opacity`}
          value={opacity}
          onChange={setOpacity}
          minValue={0}
          maxValue={100}
          format={(value) => `${Math.round(value)}%`}
        />
      </div>
      <StageFailures comparison={comparison} />
      <div
        {...stylex.props(
          styles.stage,
          styles.stageSize(stageWidth(comparison.frame), stageAspect(comparison.frame)),
        )}
      >
        <PlacedImage image={beforeImage} load={comparison.before} frame={comparison.frame} />
        <PlacedImage
          image={afterImage}
          load={comparison.after}
          frame={comparison.frame}
          extra={styles.fade(opacity / 100)}
        />
      </div>
    </div>
  )
}

const paintRegionOutlines = (
  context: CanvasRenderingContext2D,
  diff: PixelDiff,
  palette: DifferencePalette,
  regions: readonly PixelRect[],
) => {
  const pad = Math.max(3, Math.round(Math.min(diff.width, diff.height) * 0.006))
  context.lineWidth = Math.max(2, Math.round(pad / 1.5))
  context.strokeStyle = rgb(palette.highlight)
  context.fillStyle = `rgb(${palette.highlight.join(' ')} / 0.12)`
  for (const region of regions) {
    const x = region.x - pad
    const y = region.y - pad
    const width = region.width + pad * 2
    const height = region.height + pad * 2
    context.fillRect(x, y, width, height)
    context.strokeRect(x, y, width, height)
  }
}

/** Main-thread fallback, yielding after each small stripe instead of painting in React's commit. */
const paintDifference = async (
  canvas: HTMLCanvasElement,
  {
    base,
    diff,
    style,
    palette,
    tolerance,
    regions,
  }: {
    readonly base: Raster
    readonly diff: PixelDiff
    readonly style: DifferenceStyle
    readonly palette: DifferencePalette
    readonly tolerance: number
    readonly regions: readonly PixelRect[]
  },
  cancelled: () => boolean,
) => {
  const context = canvas.getContext('2d')
  if (context === null) return
  const bandHeight = Math.max(1, Math.floor(32_000 / diff.width))
  for (let y = 0; y < diff.height; y += bandHeight) {
    const { promise, resolve } = Promise.withResolvers<void>()
    requestAnimationFrame(() => resolve())
    await promise
    if (cancelled()) return
    const height = Math.min(bandHeight, diff.height - y)
    const start = y * diff.width
    const end = (y + height) * diff.width
    const band: PixelDiff = {
      ...diff,
      height,
      totalPixels: end - start,
      mask: diff.mask.subarray(start, end),
      delta: diff.delta.subarray(start, end),
    }
    const raster: Raster = {
      width: diff.width,
      height,
      data: base.data.subarray(start * 4, end * 4),
    }
    const pixels =
      style === 'pixels'
        ? composeDifferenceImage(raster, band, palette)
        : style === 'heat'
          ? composeHeatImage(raster, band, palette, tolerance)
          : composeDimmedBase(raster, band, palette, palette.dim * 0.5)
    context.putImageData(new ImageData(pixels, diff.width, height), 0, y)
  }
  if (style === 'regions' && !cancelled()) paintRegionOutlines(context, diff, palette, regions)
}

const DifferenceView = ({
  model,
  comparison,
  tolerance,
  onToleranceChange,
  differenceStyle,
}: {
  readonly model: ImageDiffModel
  readonly comparison: ImageComparison
  readonly tolerance: number
  readonly onToleranceChange: (tolerance: number) => void
  readonly differenceStyle: DifferenceStyle
}) => {
  const theme = useTheme()
  const diff = model._tag === 'Compared' ? model.diff : undefined
  const base = comparison.fallbackRaster
  const regions = React.useMemo(
    () => (diff !== undefined && differenceStyle === 'regions' ? changedRegions(diff) : []),
    [diff, differenceStyle],
  )
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const painting = comparison.painting
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null || diff === undefined || (painting === undefined && base === undefined))
      return
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (cancelled) return
      canvas.width = diff.width
      canvas.height = diff.height
      if (painting !== undefined) {
        const context = canvas.getContext('2d')
        context?.drawImage(painting, 0, 0)
        if (differenceStyle === 'regions' && context !== null)
          paintRegionOutlines(context, diff, differencePalette(theme), regions)
      } else if (base !== undefined) {
        void paintDifference(
          canvas,
          {
            base,
            diff,
            style: differenceStyle,
            palette: differencePalette(theme),
            tolerance,
            regions,
          },
          () => cancelled,
        )
      }
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [painting, base, diff, differenceStyle, theme, tolerance, regions])
  const palette = differencePalette(theme)

  const controls = (
    <div {...stylex.props(styles.controls)}>
      <LabeledSlider
        label="Tolerance"
        defaultValue={tolerance}
        onChangeEnd={onToleranceChange}
        minValue={0}
        maxValue={128}
        format={(value) => `${value} / 255`}
      />
      {diff === undefined ? null : (
        <ul aria-label="Difference legend" {...stylex.props(styles.legend)}>
          {differenceStyle === 'pixels' ? (
            <li {...stylex.props(styles.legendItem)}>
              <span {...stylex.props(styles.swatch, styles.swatchColor(rgb(palette.highlight)))} />
              Changed pixel
            </li>
          ) : differenceStyle === 'heat' ? (
            <li {...stylex.props(styles.legendItem)}>
              <span
                {...stylex.props(
                  styles.ramp(`linear-gradient(to right, ${palette.heat.map(rgb).join(', ')})`),
                )}
              />
              Small → large delta; faint = below tolerance
            </li>
          ) : (
            <li {...stylex.props(styles.legendItem)}>
              <span
                {...stylex.props(styles.swatch, styles.swatchOutline(rgb(palette.highlight)))}
              />
              {regions.length} changed {regions.length === 1 ? 'region' : 'regions'}
            </li>
          )}
          <li {...stylex.props(styles.legendItem)}>
            ink +{diff.inkAdded.toLocaleString()} / −{diff.inkRemoved.toLocaleString()} / recolored{' '}
            {diff.recolored.toLocaleString()}
          </li>
          <li {...stylex.props(styles.legendItem, styles.mono)}>
            {diff.changedPixels.toLocaleString()} / {diff.totalPixels.toLocaleString()} px (
            {formatChangedRatio(diff.ratio)})
          </li>
        </ul>
      )}
    </div>
  )

  if (model._tag !== 'Compared') {
    return (
      <div {...stylex.props(styles.column)}>
        {model._tag === 'Pending' ? controls : null}
        <div {...stylex.props(styles.paneMessage)}>
          {model._tag === 'Pending' ? 'Computing difference…' : 'Difference needs both images.'}
        </div>
      </div>
    )
  }
  return (
    <div {...stylex.props(styles.column)}>
      {controls}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Pixel difference: ${formatChangedRatio(model.diff.ratio)} of pixels changed`}
        {...stylex.props(
          styles.stage,
          styles.stageSize(stageWidth(comparison.frame), stageAspect(comparison.frame)),
          styles.canvas,
        )}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thumbnails (shared with PageSetDiff)
// ---------------------------------------------------------------------------

/** Small letterboxed image or placeholder, optionally outlined by change kind. */
export const ImageThumb = ({
  image,
  placeholder,
  caption,
  mark,
  dimmed = false,
  verdictRequest,
}: {
  readonly image: ImageSource | undefined
  readonly placeholder: string
  readonly caption?: string | undefined
  readonly mark?: ChangeKind | undefined
  readonly dimmed?: boolean | undefined
  readonly verdictRequest?: ImageVerdictRequest | undefined
}) => (
  <span
    ref={
      verdictRequest === undefined
        ? undefined
        : (element) => observeImageVerdict(element, verdictRequest)
    }
    {...stylex.props(
      styles.thumb,
      mark !== undefined &&
        mark !== 'unchanged' &&
        styles.thumbMark(changeKindAccent[mark], `inset 0 0 0 1px ${changeKindAccent[mark]}`),
    )}
  >
    {image === undefined ? (
      <span {...stylex.props(styles.thumbPlaceholder)}>{placeholder}</span>
    ) : (
      <img
        src={image.src}
        alt={image.alt ?? ''}
        loading="lazy"
        draggable={false}
        onLoad={(event) => rememberDisplayedImage(image, event.currentTarget)}
        {...stylex.props(styles.thumbImage, dimmed && styles.fade(0.45))}
      />
    )}
    {caption === undefined ? null : <span {...stylex.props(styles.thumbCaption)}>{caption}</span>}
  </span>
)

/** One-line verdict label for thumbnails: kind plus the byte/pixel evidence. */
export const verdictLabel = (verdict: ImageVerdict, relation: DiffRelation): string => {
  switch (verdict._tag) {
    case 'SameBytes':
      return relation === 'peer' ? 'identical · same bytes' : 'unchanged · same bytes'
    case 'Pending':
      return 'comparing…'
    case 'Failed':
      return 'unavailable'
    case 'Compared':
      return verdict.kind === 'changed'
        ? `${relation === 'peer' ? 'different' : 'changed'} · ${formatChangedRatio(verdict.ratio)}`
        : verdict.bytes === 'different'
          ? 'same render · different bytes'
          : relation === 'peer'
            ? 'identical render'
            : 'no visible change'
  }
}

// ---------------------------------------------------------------------------
// ImageCompareSet: one reference vs N candidates
// ---------------------------------------------------------------------------

/** A candidate compared against the reference. */
export interface ImageCandidate {
  readonly id: string
  readonly side: DiffSide
  readonly image: ImageSource
}

/** Candidate plus its verdict against the reference. */
export interface CompareSetEntry {
  readonly candidate: ImageCandidate
  readonly verdict: ImageVerdict
  readonly kind: ChangeKind | undefined
}

/** Pure summary of a compare set: identical candidates count as `unchanged`, different ones as `changed`. */
export const compareSetModel = (
  candidates: readonly ImageCandidate[],
  verdictsByIndex: readonly ImageVerdict[],
): {
  readonly entries: readonly CompareSetEntry[]
  readonly counts: ChangeCounts
  readonly pending: number
} => {
  const counts: Partial<Record<ChangeKind, number>> = {}
  let pending = 0
  const entries = candidates.map((candidate, index): CompareSetEntry => {
    const verdict = verdictsByIndex[index] ?? { _tag: 'Pending' }
    const kind = imageVerdictKind(verdict)
    if (kind === undefined) pending++
    else counts[kind] = (counts[kind] ?? 0) + 1
    return { candidate, verdict, kind }
  })
  return { entries, counts, pending }
}

/** How one entry of a selectable set bears on its default selection. */
export type DefaultSelectionStatus = 'pending' | 'attention' | 'quiet'

/**
 * Default selection of a selectable set: the first entry needing attention, or the first
 * entry when none does. `undefined` while any entry before that point is still pending, so
 * the default is decided in entry order and never moves as later verdicts resolve (each
 * move would remount the nested lens and drop its state).
 */
export const settledDefault = <E,>(
  entries: readonly E[],
  status: (entry: E) => DefaultSelectionStatus,
): E | undefined => {
  for (const entry of entries) {
    const current = status(entry)
    if (current === 'attention') return entry
    if (current === 'pending') return undefined
  }
  return entries[0]
}

/** Default candidate of a compare set: the first different one, decided in candidate order. */
export const compareSetDefault = (
  entries: readonly CompareSetEntry[],
): CompareSetEntry | undefined =>
  settledDefault(entries, (entry) =>
    entry.verdict._tag === 'Pending' ? 'pending' : entry.kind === 'changed' ? 'attention' : 'quiet',
  )

/** Props for `ImageCompareSet`. */
export interface ImageCompareSetProps extends Omit<LensFrameProps, 'relation'> {
  readonly title: React.ReactNode
  readonly reference: { readonly side: DiffSide; readonly image: ImageSource }
  readonly candidates: readonly ImageCandidate[]
  readonly tolerance?: number | undefined
  readonly minChangedRatio?: number | undefined
  readonly differenceStyle?: DifferenceStyle | undefined
  readonly defaultImageMode?: ImageCombinedMode | undefined
}

/**
 * N-way peer comparison: one reference against N candidates, each marked identical or
 * different. Combined shows a candidate grid; side by side shows reference|candidate rows.
 * The selected candidate opens a nested peer `ImageDiff`.
 */
export const ImageCompareSet = ({
  title,
  reference,
  candidates,
  tolerance = defaultImageDiffThresholds.tolerance,
  minChangedRatio = defaultImageDiffThresholds.minChangedRatio,
  differenceStyle = 'pixels',
  defaultImageMode = 'difference',
  ...frame
}: ImageCompareSetProps) => {
  const results = useImageVerdicts(
    candidates.map((candidate) => ({
      before: reference.image,
      after: candidate.image,
      tolerance,
      minChangedRatio,
    })),
  )
  const model = compareSetModel(candidates, results)
  const candidatesSide: DiffSide = {
    label: `${candidates.length} ${candidates.length === 1 ? 'candidate' : 'candidates'}`,
    basis: candidates.every((candidate) => candidate.side.basis === 'observed')
      ? 'observed'
      : 'projected',
    provenance: candidates.map((candidate) => candidate.side.label).join(' · '),
  }
  return (
    <DiffFrame
      {...lensFrameProps({ ...frame, relation: 'peer' })}
      title={title}
      lens="image set"
      before={reference.side}
      after={candidatesSide}
      counts={model.counts}
    >
      <CompareSetBody
        reference={reference}
        entries={model.entries}
        pending={model.pending}
        tolerance={tolerance}
        minChangedRatio={minChangedRatio}
        differenceStyle={differenceStyle}
        defaultImageMode={defaultImageMode}
      />
    </DiffFrame>
  )
}

const CompareSetBody = ({
  reference,
  entries,
  pending,
  tolerance,
  minChangedRatio,
  differenceStyle,
  defaultImageMode,
}: {
  readonly reference: ImageCompareSetProps['reference']
  readonly entries: readonly CompareSetEntry[]
  readonly pending: number
  readonly tolerance: number
  readonly minChangedRatio: number
  readonly differenceStyle: DifferenceStyle
  readonly defaultImageMode: ImageCombinedMode
}) => {
  const arrangement = useDiffArrangement()
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined)
  const [imageMode, setImageMode] = React.useState<ImageCombinedMode>(defaultImageMode)
  const selected =
    entries.find((entry) => entry.candidate.id === selectedId) ?? compareSetDefault(entries)
  const onSelectionChange = (keys: Selection) => {
    if (keys === 'all') return
    const next = [...keys][0]
    if (next !== undefined) setSelectedId(String(next))
  }
  const identical = entries.filter((entry) => entry.kind === 'unchanged').length

  return (
    <div {...stylex.props(styles.body)}>
      <p {...stylex.props(styles.status)}>
        {identical} of {entries.length} identical to {reference.side.label}
        {pending > 0 ? ` · ${pending} comparing` : ''}
      </p>
      {arrangement === 'unified' ? (
        <div {...stylex.props(styles.compareGrid)}>
          <figure {...stylex.props(styles.referenceTile)}>
            <ImageThumb image={reference.image} placeholder="No reference" />
            <figcaption {...stylex.props(styles.tileFooter)}>
              <strong>{reference.side.label}</strong>
              <span {...stylex.props(styles.hint)}>reference</span>
            </figcaption>
          </figure>
          <GridList
            aria-label="Candidates"
            layout="grid"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={selected === undefined ? [] : [selected.candidate.id]}
            onSelectionChange={onSelectionChange}
            {...stylex.props(styles.tileGrid)}
          >
            {entries.map((entry) => (
              <GridListItem
                key={entry.candidate.id}
                id={entry.candidate.id}
                textValue={`${entry.candidate.side.label}: ${verdictLabel(entry.verdict, 'peer')}`}
                {...stylex.props(styles.tile, styles.ring)}
              >
                <ImageThumb
                  image={entry.candidate.image}
                  placeholder="No image"
                  mark={entry.kind}
                  verdictRequest={{
                    before: reference.image,
                    after: entry.candidate.image,
                    tolerance,
                    minChangedRatio,
                  }}
                />
                <span {...stylex.props(styles.tileFooter)}>
                  <strong>{entry.candidate.side.label}</strong>
                  <VerdictMark verdict={entry.verdict} kind={entry.kind} relation="peer" />
                </span>
              </GridListItem>
            ))}
          </GridList>
        </div>
      ) : (
        <GridList
          aria-label="Reference and candidate pairs"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={selected === undefined ? [] : [selected.candidate.id]}
          onSelectionChange={onSelectionChange}
          {...stylex.props(styles.rows)}
        >
          {entries.map((entry) => (
            <GridListItem
              key={entry.candidate.id}
              id={entry.candidate.id}
              textValue={`${entry.candidate.side.label}: ${verdictLabel(entry.verdict, 'peer')}`}
              {...stylex.props(styles.row, styles.ring)}
            >
              <ImageThumb
                image={reference.image}
                placeholder="No reference"
                caption={reference.side.label}
              />
              <span {...stylex.props(styles.rowVerdict)}>
                <span {...stylex.props(styles.hint)}>vs</span>
                <VerdictMark verdict={entry.verdict} kind={entry.kind} relation="peer" />
              </span>
              <ImageThumb
                image={entry.candidate.image}
                placeholder="No image"
                caption={entry.candidate.side.label}
                mark={entry.kind}
                verdictRequest={{
                  before: reference.image,
                  after: entry.candidate.image,
                  tolerance,
                  minChangedRatio,
                }}
              />
            </GridListItem>
          ))}
        </GridList>
      )}
      {selected === undefined ? null : (
        <ImageDiff
          key={selected.candidate.id}
          title={`${reference.side.label} vs ${selected.candidate.side.label}`}
          before={reference.side}
          after={selected.candidate.side}
          beforeImage={reference.image}
          afterImage={selected.candidate.image}
          relation="peer"
          mode={imageMode}
          onModeChange={setImageMode}
          differenceStyle={differenceStyle}
          tolerance={tolerance}
          minChangedRatio={minChangedRatio}
          nested
        />
      )}
    </div>
  )
}

/** Change mark with the verdict label; `unchanged` renders quiet text. */
export const VerdictMark = ({
  verdict,
  kind,
  relation,
}: {
  readonly verdict: ImageVerdict
  readonly kind: ChangeKind | undefined
  readonly relation: DiffRelation
}) =>
  kind === undefined || kind === 'unchanged' ? (
    <span {...stylex.props(styles.hint, verdict._tag === 'Failed' && styles.error)}>
      {verdictLabel(verdict, relation)}
    </span>
  ) : (
    <ChangeMark kind={kind}>{verdictLabel(verdict, relation)}</ChangeMark>
  )

const styles = stylex.create({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space2,
    minWidth: 0,
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space2,
    minWidth: 0,
  },
  status: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: scale.space2,
    margin: 0,
    fontSize: 13,
    color: tokens['--ds-gray-900'],
  },
  error: {
    color: tokens['--ds-red-900'],
  },
  note: {
    margin: 0,
    fontSize: 12,
    color: tokens['--ds-amber-900'],
  },
  hint: {
    fontSize: 12,
    color: tokens['--ds-gray-900'],
  },
  mono: {
    fontFamily: scale.fontMono,
    fontSize: 12,
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: scale.space3,
  },
  button: {
    minWidth: 28,
    height: 26,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':is([data-hovered])': tokens['--ds-gray-alpha-100'],
    },
    color: tokens['--ds-gray-1000'],
    fontFamily: scale.fontSans,
    fontSize: 12,
    cursor: {
      default: 'pointer',
      ':is([data-disabled])': 'default',
    },
    opacity: {
      default: 1,
      ':is([data-disabled])': 0.5,
    },
  },
  buttonActive: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  bytesChip: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-500'],
    borderRadius: scale.radiusFull,
    backgroundColor: tokens['--ds-gray-alpha-100'],
    color: tokens['--ds-gray-1000'],
    fontFamily: scale.fontSans,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'help',
  },
  tooltip: {
    maxWidth: 360,
    paddingBlock: 4,
    paddingInline: scale.space2,
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-gray-1000'],
    color: tokens['--ds-background-100'],
    fontSize: 12,
    overflowWrap: 'anywhere',
    boxShadow: tokens['--ds-shadow-medium'],
  },
  focusable: {
    outlineWidth: {
      default: 0,
      ':focus-visible': 2,
    },
    outlineStyle: {
      default: 'none',
      ':focus-visible': 'solid',
    },
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: 2,
  },
  /** Focus ring for React Aria components (`data-focus-visible`). */
  ring: {
    outlineWidth: {
      default: 0,
      ':is([data-focus-visible])': 2,
    },
    outlineStyle: {
      default: 'none',
      ':is([data-focus-visible])': 'solid',
    },
    outlineColor: {
      default: 'transparent',
      ':is([data-focus-visible])': tokens['--ds-focus-color'],
    },
    outlineOffset: 2,
  },
  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: scale.space2,
  },
  pane: {
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    minWidth: 0,
  },
  paneLabel: {
    fontSize: 12,
    color: tokens['--ds-gray-900'],
  },
  paneMessage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    padding: scale.space3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    fontSize: 13,
    color: tokens['--ds-gray-900'],
    textAlign: 'center',
  },
  missing: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  scroller: {
    maxHeight: 560,
    overflow: 'auto',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  zoomBox: (width: string, aspectRatio: string) => ({
    position: 'relative',
    width,
    aspectRatio,
  }),
  stage: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
  },
  stageSize: (width: string, aspectRatio: string) => ({
    width,
    aspectRatio,
  }),
  fill: {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
  },
  swipeStage: {
    cursor: 'ew-resize',
    touchAction: 'none',
    userSelect: 'none',
  },
  canvas: {
    display: 'block',
    height: 'auto',
  },
  layer: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
  placed: {
    position: 'absolute',
    display: 'block',
    objectFit: 'fill',
    pointerEvents: 'none',
  },
  placedAt: (left: string, top: string, width: string, height: string) => ({
    left,
    top,
    width,
    height,
  }),
  markSingle: (kind: ChangeKind) => ({
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineOffset: -2,
    outlineColor: kind === 'added' ? tokens['--ds-green-900'] : tokens['--ds-red-900'],
  }),
  clipFrom: (clipPath: string) => ({
    clipPath,
  }),
  fade: (opacity: number) => ({
    opacity,
  }),
  cornerLabel: {
    position: 'absolute',
    top: scale.space2,
    paddingBlock: 2,
    paddingInline: scale.space2,
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-1000'],
    fontSize: 11,
    boxShadow: tokens['--ds-shadow-medium'],
    pointerEvents: 'none',
  },
  cornerStart: {
    left: scale.space2,
  },
  cornerEnd: {
    right: scale.space2,
  },
  divider: {
    top: '50%',
    width: 2,
    height: '100%',
    backgroundColor: tokens['--ds-blue-700'],
    cursor: 'ew-resize',
  },
  dividerGrip: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 14,
    height: 32,
    transform: 'translate(-50%, -50%)',
    borderRadius: scale.radiusFull,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: tokens['--ds-blue-700'],
    backgroundColor: tokens['--ds-background-100'],
  },
  slider: {
    display: 'inline-grid',
    gridTemplateColumns: 'auto 160px auto',
    alignItems: 'center',
    gap: scale.space2,
  },
  sliderLabel: {
    fontSize: 12,
    color: tokens['--ds-gray-900'],
  },
  sliderTrack: {
    position: 'relative',
    height: 20,
    cursor: 'pointer',
  },
  sliderRail: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 4,
    marginTop: -2,
    borderRadius: scale.radiusFull,
    backgroundColor: tokens['--ds-gray-alpha-400'],
  },
  sliderThumb: {
    top: '50%',
    width: 14,
    height: 14,
    borderRadius: scale.radiusFull,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: tokens['--ds-blue-700'],
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':is([data-dragging])': tokens['--ds-blue-700'],
    },
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: scale.space3,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: 12,
    color: tokens['--ds-gray-900'],
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space1,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  swatchColor: (color: string) => ({
    backgroundColor: color,
  }),
  swatchOutline: (color: string) => ({
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: color,
  }),
  ramp: (backgroundImage: string) => ({
    width: 48,
    height: 10,
    borderRadius: 2,
    backgroundImage,
  }),
  thumb: {
    position: 'relative',
    display: 'block',
    overflow: 'hidden',
    height: 120,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
  },
  thumbMark: (borderColor: string, boxShadow: string) => ({
    borderColor,
    boxShadow,
  }),
  thumbImage: {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  thumbPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: scale.space1,
    backgroundImage: `repeating-linear-gradient(135deg, transparent 0 6px, ${tokens['--ds-gray-alpha-100']} 6px 12px)`,
    fontSize: 11,
    color: tokens['--ds-gray-900'],
    textAlign: 'center',
  },
  thumbCaption: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    paddingInline: 3,
    borderRadius: 2,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-900'],
    fontSize: 10,
  },
  compareGrid: {
    display: 'grid',
    gridTemplateColumns: '160px minmax(0, 1fr)',
    gap: scale.space3,
    alignItems: 'start',
  },
  referenceTile: {
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    padding: scale.space2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-500'],
    borderRadius: scale.radiusSm,
  },
  tileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: scale.space2,
    outline: 'none',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    padding: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: tokens['--ds-gray-alpha-400'],
      ':is([data-selected])': tokens['--ds-blue-700'],
    },
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':is([data-hovered])': tokens['--ds-gray-alpha-100'],
    },
    boxShadow: {
      default: 'none',
      ':is([data-selected])': `0 0 0 1px ${tokens['--ds-blue-700']}`,
    },
    color: tokens['--ds-gray-1000'],
    cursor: 'pointer',
  },
  tileFooter: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 11,
  },
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    outline: 'none',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 150px minmax(0, 1fr)',
    alignItems: 'center',
    gap: scale.space2,
    padding: scale.space1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: 'transparent',
      ':is([data-selected])': tokens['--ds-blue-700'],
    },
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: 'transparent',
      ':is([data-hovered])': tokens['--ds-gray-alpha-100'],
    },
    color: tokens['--ds-gray-1000'],
    cursor: 'pointer',
  },
  rowVerdict: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    fontSize: 11,
    textAlign: 'center',
  },
})
