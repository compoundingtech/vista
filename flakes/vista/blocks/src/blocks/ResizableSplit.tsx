import type { StyleXStylesWithout } from '@stylexjs/stylex'
import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import { mergeProps, useFocusRing, useHover, useMove, useSeparator } from 'react-aria'

/** Visible divider thickness. The divider itself is the resize target; an invisible
 * hit area extends over both panes so the 1px border stays grabbable. */
const separatorSize = 1
/** Invisible grab extension on each side of the divider. */
const hitExtension = 4
const keyboardStep = 16
const shiftedKeyboardStep = 64

type Direction = 'horizontal' | 'vertical'

/**
 * Declares how the first pane's size should be resolved: the responsive default, an explicit pixel
 * size, or clamping to the minimum or maximum useful extent.
 */
export type ResizeIntent =
  | { readonly _tag: 'default' }
  | { readonly _tag: 'explicit'; readonly px: number }
  | { readonly _tag: 'minimum' }
  | { readonly _tag: 'maximum-useful' }

/**
 * Classifies how a pane's content sizes and scrolls—natural document flow, a finite scrollable
 * region, or a canvas—so resizing heuristics can adapt.
 */
export type SplitContentSemantics = 'natural-flow' | 'finite-scroll' | 'canvas'

/**
 * Reports whether a pane's maximum-useful size is known, distinguishing unsupported, in-flight
 * (tagged with an epoch), and settled (tagged with an epoch) states.
 */
export type UsefulExtentReadiness =
  | { readonly _tag: 'unsupported' }
  | { readonly _tag: 'pending'; readonly epoch: number }
  | { readonly _tag: 'settled'; readonly epoch: number }

/**
 * A measured candidate for a pane's maximum useful size, tagged with the epoch that invalidates
 * stale samples.
 */
export interface UsefulExtentSample {
  readonly epoch: number
  readonly px: number
}

/**
 * Names a specific app version by owner, slug, and `vN` tag so persisted layout preferences such
 * as split sizes can be keyed to it.
 */
export interface AppVersionPreferenceIdentity {
  readonly owner: string
  readonly slug: string
  readonly version: `v${number}`
}

type MoveDelta = {
  readonly direction: Direction
  readonly deltaX: number
  readonly deltaY: number
  readonly pointerType: string
  readonly shiftKey: boolean
}

/** The inclusive pixel range within which the split position may be moved. */
export type SplitBounds = {
  readonly min: number
  readonly max: number
}

/**
 * Configures a resizable split: identity and direction, responsive initial size with optional
 * min/max lengths, the two panes, and optional semantics plus extent readiness/samples that drive
 * maximum-useful sizing.
 */
export interface ResizableSplitProps {
  readonly id: string
  readonly direction: Direction
  /** Responsive CSS length used for the first pane while intent is `default`. */
  readonly initialSize: string
  readonly minSize?: string | undefined
  readonly maxSize?: string | undefined
  readonly first: React.ReactNode
  readonly second?: React.ReactNode | undefined
  readonly contentSemantics?: SplitContentSemantics | undefined
  readonly usefulExtentReadiness?: UsefulExtentReadiness | undefined
  readonly usefulExtentSample?: UsefulExtentSample | undefined
  readonly style?: StyleXStylesWithout<{ display: string }> | undefined
  readonly onResize?: ((px: number) => void) | undefined
}

const defaultIntent: ResizeIntent = { _tag: 'default' }
const unsupportedUsefulExtent: UsefulExtentReadiness = { _tag: 'unsupported' }
const AppVersionPreferenceContext = React.createContext<AppVersionPreferenceIdentity | undefined>(
  undefined,
)

/**
 * Exposes the app-version identity (or its absence) through context so descendant splits can key
 * their persisted size preferences.
 */
export const AppVersionPreferenceProvider = ({
  identity,
  children,
}: {
  readonly identity: AppVersionPreferenceIdentity | undefined
  readonly children: React.ReactNode
}): React.ReactElement => (
  <AppVersionPreferenceContext.Provider value={identity}>
    {children}
  </AppVersionPreferenceContext.Provider>
)

const preferenceKeyPart = (value: string): string => encodeURIComponent(value)

/**
 * Builds the namespaced storage key under which a pane's resize intent is persisted, encoding the
 * app identity's owner, slug, and version plus the split id as sanitized key segments.
 */
export const resizeIntentStorageKey = (
  identity: AppVersionPreferenceIdentity,
  splitId: string,
): string =>
  `vista.blocks.v1/resize-intent/${preferenceKeyPart(identity.owner)}/${preferenceKeyPart(identity.slug)}/${preferenceKeyPart(identity.version)}/${preferenceKeyPart(splitId)}`

const isResizeIntent = (value: unknown): value is ResizeIntent => {
  if (typeof value !== 'object' || value === null) return false
  const tag = Reflect.get(value, '_tag')
  if (tag === 'default' || tag === 'minimum' || tag === 'maximum-useful') return true
  return (
    tag === 'explicit' &&
    typeof Reflect.get(value, 'px') === 'number' &&
    Number.isFinite(Reflect.get(value, 'px'))
  )
}

const readResizeIntent = (storageKey: string | undefined): ResizeIntent => {
  if (storageKey === undefined || typeof window === 'undefined') return defaultIntent
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null')
    const intent =
      typeof stored === 'object' && stored !== null && Reflect.get(stored, 'version') === 1
        ? Reflect.get(stored, 'intent')
        : undefined
    return isResizeIntent(intent) && intent._tag !== 'default' ? intent : defaultIntent
  } catch {
    return defaultIntent
  }
}

const persistResizeIntent = (storageKey: string | undefined, intent: ResizeIntent): void => {
  if (storageKey === undefined || typeof window === 'undefined') return
  try {
    if (intent._tag === 'default') {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, intent }))
    }
  } catch {
    // A storage denial or quota failure must never break resizing.
  }
}

const clamp = (value: number, { min, max }: SplitBounds) => Math.min(max, Math.max(min, value))

/** Project latent intent through current bounds without rewriting that intent. */
export const projectResizeIntent = (
  intent: ResizeIntent,
  initialSize: number,
  bounds: SplitBounds,
): number => {
  switch (intent._tag) {
    case 'default':
      return clamp(initialSize, bounds)
    case 'explicit':
      return clamp(intent.px, bounds)
    case 'minimum':
      return bounds.min
    case 'maximum-useful':
      return bounds.max
  }
}

/** Apply a settled, same-epoch finite-content cap; stale or unsupported data fails open. */
export const projectUsefulExtentBounds = ({
  bounds,
  contentSemantics,
  readiness,
  sample,
}: {
  readonly bounds: SplitBounds
  readonly contentSemantics: SplitContentSemantics
  readonly readiness: UsefulExtentReadiness
  readonly sample: UsefulExtentSample | undefined
}): SplitBounds => {
  if (
    contentSemantics !== 'finite-scroll' ||
    readiness._tag !== 'settled' ||
    sample === undefined ||
    sample.epoch !== readiness.epoch ||
    !Number.isFinite(sample.px) ||
    sample.px <= 0
  ) {
    return bounds
  }
  const max = Math.max(0, Math.min(bounds.max, sample.px))
  return { min: Math.min(bounds.min, max), max }
}

/** Compatibility projection for existing callers that still describe intent as a boolean. */
export const resolveMeasuredSplitSize = (
  currentSize: number | undefined,
  initialSize: number,
  bounds: SplitBounds,
  isUserSized: boolean,
): number =>
  projectResizeIntent(
    isUserSized && currentSize !== undefined
      ? { _tag: 'explicit', px: currentSize }
      : defaultIntent,
    initialSize,
    bounds,
  )

/** Convert React Aria's normalized keyboard movement into the splitter's pixel step. */
export const resizeDeltaForMove = ({
  direction,
  deltaX,
  deltaY,
  pointerType,
  shiftKey,
}: MoveDelta): number => {
  const delta = direction === 'horizontal' ? deltaX : deltaY
  if (pointerType !== 'keyboard') return delta
  return delta * (shiftKey ? shiftedKeyboardStep : keyboardStep)
}

const measuredLength = (container: HTMLElement, value: string, direction: Direction): number => {
  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  probe.style.boxSizing = 'border-box'
  probe.style.width = direction === 'horizontal' ? value : '0px'
  probe.style.height = direction === 'vertical' ? value : '0px'
  container.append(probe)
  const pixels =
    direction === 'horizontal'
      ? probe.getBoundingClientRect().width
      : probe.getBoundingClientRect().height
  probe.remove()
  return Number.isFinite(pixels) ? pixels : 0
}

/**
 * Computes the effective minimum and maximum pane sizes for a resizable split by reconciling the
 * configured limits against the container and viewport dimensions, applying special handling when
 * running in the Edge browser.
 */
export const resolveSplitBounds = ({
  containerSize,
  viewportSize,
  configuredMin,
  configuredMax,
  isEdge,
}: {
  readonly containerSize: number
  readonly viewportSize: number
  readonly configuredMin: number
  readonly configuredMax: number | undefined
  readonly isEdge: boolean
}): SplitBounds | undefined => {
  const viewportAvailable = Math.max(0, viewportSize - separatorSize)
  const available = isEdge
    ? Math.max(viewportAvailable, configuredMin, configuredMax ?? 0)
    : Math.max(0, containerSize - separatorSize)
  if (available <= 0) return undefined

  const min = Math.min(available, Math.max(0, configuredMin))
  const max = Math.max(min, Math.min(available, configuredMax ?? available))
  return { min, max }
}

const measureBounds = (
  container: HTMLElement,
  direction: Direction,
  minSize: string | undefined,
  maxSize: string | undefined,
  isEdge: boolean,
): SplitBounds | undefined => {
  const rect = container.getBoundingClientRect()
  const containerSize = direction === 'horizontal' ? rect.width : rect.height
  const viewportSize =
    direction === 'horizontal'
      ? document.documentElement.clientWidth - rect.left
      : document.documentElement.clientHeight - rect.top
  return resolveSplitBounds({
    containerSize,
    viewportSize,
    configuredMin: minSize === undefined ? 0 : measuredLength(container, minSize, direction),
    configuredMax:
      maxSize === undefined ? undefined : measuredLength(container, maxSize, direction),
    isEdge,
  })
}

/**
 * Renders a two-pane layout with a draggable divider whose size changes are clamped to resolved
 * bounds and persisted as resize intent, honoring live or frozen content semantics and deferring
 * to the supplied useful-extent readiness when enforcing minimum sizes.
 */
export const ResizableSplit = ({
  id,
  direction,
  initialSize,
  minSize,
  maxSize,
  first,
  second,
  contentSemantics = 'canvas',
  usefulExtentReadiness = unsupportedUsefulExtent,
  usefulExtentSample,
  style,
  onResize,
}: ResizableSplitProps): React.ReactElement => {
  const publicationIdentity = React.useContext(AppVersionPreferenceContext)
  const storageKey =
    publicationIdentity === undefined ? undefined : resizeIntentStorageKey(publicationIdentity, id)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const sizeRef = React.useRef<number | undefined>(undefined)
  const initialSizeRef = React.useRef<number | undefined>(undefined)
  const boundsRef = React.useRef<SplitBounds | undefined>(undefined)
  const onResizeRef = React.useRef(onResize)
  const [intentPreference, setIntentPreference] = React.useState<{
    readonly storageKey: string | undefined
    readonly intent: ResizeIntent
  }>({ storageKey: undefined, intent: defaultIntent })
  const intent =
    intentPreference.storageKey === storageKey ? intentPreference.intent : defaultIntent
  const intentRef = React.useRef(intent)
  const [size, setSize] = React.useState<number | undefined>(undefined)
  const [bounds, setBounds] = React.useState<SplitBounds | undefined>(undefined)
  const [isDragging, setIsDragging] = React.useState(false)
  onResizeRef.current = onResize
  intentRef.current = intent
  const isEdge = second === undefined

  React.useEffect(() => {
    const restored = readResizeIntent(storageKey)
    intentRef.current = restored
    setIntentPreference({ storageKey, intent: restored })
  }, [storageKey])

  const renderIntent = (nextIntent: ResizeIntent, notify = true) => {
    intentRef.current = nextIntent
    setIntentPreference({ storageKey, intent: nextIntent })
    persistResizeIntent(storageKey, nextIntent)
    const currentBounds = boundsRef.current
    const measuredInitial = initialSizeRef.current
    if (currentBounds === undefined || measuredInitial === undefined) return
    const nextSize = projectResizeIntent(nextIntent, measuredInitial, currentBounds)
    if (nextSize === sizeRef.current) return
    sizeRef.current = nextSize
    setSize(nextSize)
    if (notify) onResizeRef.current?.(nextSize)
  }

  React.useLayoutEffect(() => {
    const container = containerRef.current
    if (container === null || contentSemantics === 'natural-flow') return

    const measure = () => {
      const authoredBounds = measureBounds(container, direction, minSize, maxSize, isEdge)
      if (authoredBounds === undefined) return
      const nextBounds = projectUsefulExtentBounds({
        bounds: authoredBounds,
        contentSemantics,
        readiness: usefulExtentReadiness,
        sample: usefulExtentSample,
      })
      boundsRef.current = nextBounds
      setBounds((current) =>
        current?.min === nextBounds.min && current.max === nextBounds.max ? current : nextBounds,
      )
      const measuredInitialSize = measuredLength(container, initialSize, direction)
      initialSizeRef.current = measuredInitialSize
      const nextSize = projectResizeIntent(intentRef.current, measuredInitialSize, nextBounds)
      const currentSize = sizeRef.current
      if (nextSize === currentSize) return
      sizeRef.current = nextSize
      setSize(nextSize)
      if (currentSize !== undefined) onResizeRef.current?.(nextSize)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    if (isEdge) observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [
    contentSemantics,
    direction,
    initialSize,
    intent,
    isEdge,
    maxSize,
    minSize,
    usefulExtentReadiness,
    usefulExtentSample,
  ])

  const separatorOrientation = direction === 'horizontal' ? 'vertical' : 'horizontal'
  const { separatorProps: separatorAriaProps } = useSeparator({
    orientation: separatorOrientation,
    'aria-label': 'Resize first pane',
  })
  const { moveProps } = useMove({
    onMoveStart: () => setIsDragging(true),
    onMove: (event) => {
      const current = sizeRef.current
      if (current === undefined) return
      renderIntent({
        _tag: 'explicit',
        px:
          current +
          resizeDeltaForMove({
            direction,
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            pointerType: event.pointerType,
            shiftKey: event.shiftKey,
          }),
      })
    },
    onMoveEnd: () => setIsDragging(false),
  })
  const { hoverProps, isHovered } = useHover({})
  const { focusProps, isFocusVisible } = useFocusRing()

  const firstPaneId = `${id}-first-pane`
  const separatorProps = mergeProps(separatorAriaProps, moveProps, hoverProps, focusProps, {
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== 'Home' && event.key !== 'End') return
      event.preventDefault()
      event.stopPropagation()
      renderIntent({ _tag: event.key === 'Home' ? 'minimum' : 'maximum-useful' })
    },
    onDoubleClick: () => renderIntent(defaultIntent),
  })
  const renderedSize = size === undefined ? initialSize : `${size}px`
  const isSeparatorActive = isHovered || isDragging || isFocusVisible
  const hasMovableRange = bounds === undefined || bounds.min !== bounds.max
  if (contentSemantics === 'natural-flow') {
    return (
      <div ref={containerRef} id={id} {...stylex.props(styles.root, styles.naturalFlow, style)}>
        {first}
        {second}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      id={id}
      {...stylex.props(
        styles.root,
        direction === 'horizontal'
          ? isEdge
            ? styles.horizontalEdge(renderedSize, hasMovableRange)
            : styles.horizontal(renderedSize, hasMovableRange)
          : isEdge
            ? styles.verticalEdge(renderedSize, hasMovableRange)
            : styles.vertical(renderedSize, hasMovableRange),
        style,
      )}
    >
      <div id={firstPaneId} {...stylex.props(styles.pane)}>
        {first}
      </div>
      {hasMovableRange ? (
        <>
          <div
            {...separatorProps}
            {...stylex.props(
              styles.separator,
              direction === 'horizontal' ? styles.verticalSeparator : styles.horizontalSeparator,
              isSeparatorActive && styles.activeSeparator,
              isFocusVisible && styles.focusedSeparator,
            )}
            id={`${id}-separator`}
            aria-controls={firstPaneId}
            aria-orientation={separatorOrientation}
            aria-valuemin={Math.round(bounds?.min ?? 0)}
            aria-valuemax={Math.round(bounds?.max ?? 0)}
            aria-valuenow={Math.round(size ?? 0)}
            tabIndex={0}
          />
          <button
            type="button"
            {...stylex.props(
              styles.resetButton,
              direction === 'horizontal'
                ? styles.horizontalReset(renderedSize)
                : styles.verticalReset(renderedSize),
            )}
            onClick={() => renderIntent(defaultIntent)}
          >
            Reset size
          </button>
        </>
      ) : null}
      {second === undefined ? null : (
        <div id={`${id}-second-pane`} {...stylex.props(styles.pane)}>
          {second}
        </div>
      )}
    </div>
  )
}

const styles = stylex.create({
  root: {
    position: 'relative',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  naturalFlow: {
    overflow: 'visible',
  },
  horizontal: (firstSize: string, withSeparator: boolean) => ({
    inlineSize: '100%',
    blockSize: '100%',
    display: 'grid',
    gridTemplateColumns: withSeparator
      ? `${firstSize} ${separatorSize}px minmax(0, 1fr)`
      : `${firstSize} minmax(0, 1fr)`,
    gridTemplateRows: 'minmax(0, 1fr)',
  }),
  vertical: (firstSize: string, withSeparator: boolean) => ({
    inlineSize: '100%',
    blockSize: '100%',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: withSeparator
      ? `${firstSize} ${separatorSize}px minmax(0, 1fr)`
      : `${firstSize} minmax(0, 1fr)`,
  }),
  horizontalEdge: (firstSize: string, withSeparator: boolean) => ({
    display: 'grid',
    inlineSize: withSeparator ? `calc(${firstSize} + ${separatorSize}px)` : firstSize,
    blockSize: '100%',
    gridTemplateColumns: withSeparator ? `${firstSize} ${separatorSize}px` : firstSize,
    gridTemplateRows: 'minmax(0, 1fr)',
  }),
  verticalEdge: (firstSize: string, withSeparator: boolean) => ({
    display: 'grid',
    inlineSize: '100%',
    blockSize: withSeparator ? `calc(${firstSize} + ${separatorSize}px)` : firstSize,
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: withSeparator ? `${firstSize} ${separatorSize}px` : firstSize,
  }),
  pane: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: 'minmax(0, 1fr)',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  separator: {
    position: 'relative',
    boxSizing: 'border-box',
    outline: 'none',
    touchAction: 'none',
    userSelect: 'none',
    backgroundColor: tokens['--ds-gray-alpha-400'],
    transitionDuration: '120ms',
    transitionProperty: 'background-color',
    transitionTimingFunction: 'ease-out',
    zIndex: 1,
  },
  verticalSeparator: {
    inlineSize: separatorSize,
    blockSize: '100%',
    cursor: 'col-resize',
    '::after': {
      content: '""',
      position: 'absolute',
      insetBlock: 0,
      insetInlineStart: -hitExtension,
      insetInlineEnd: -hitExtension,
    },
  },
  horizontalSeparator: {
    inlineSize: '100%',
    blockSize: separatorSize,
    cursor: 'row-resize',
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      insetBlockStart: -hitExtension,
      insetBlockEnd: -hitExtension,
    },
  },
  activeSeparator: {
    backgroundColor: tokens['--ds-gray-alpha-700'],
  },
  focusedSeparator: {
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: -1,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  resetButton: {
    position: 'absolute',
    zIndex: 2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: 4,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-gray-900'],
    fontSize: 11,
    lineHeight: '18px',
    paddingInline: 6,
    cursor: 'pointer',
    opacity: {
      default: 0.72,
      ':hover': 1,
      ':focus-visible': 1,
    },
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineStyle: {
      default: 'none',
      ':focus-visible': 'solid',
    },
    outlineWidth: {
      default: 0,
      ':focus-visible': 2,
    },
  },
  horizontalReset: (firstSize: string) => ({
    insetInlineStart: `calc(${firstSize} - 4.5rem)`,
    insetBlockStart: 4,
  }),
  verticalReset: (firstSize: string) => ({
    insetInlineEnd: 4,
    insetBlockStart: `calc(${firstSize} - 1.5rem)`,
  }),
})
