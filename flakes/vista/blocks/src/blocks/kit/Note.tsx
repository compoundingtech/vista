import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'

import { placeCallouts, sketchArrow, sketchLoop, type Box } from './sketch.ts'

interface NoteEntry {
  readonly id: string
  readonly text: string
  readonly element: HTMLElement
}

/** Explain state owned by the shell: whether the overlay is on, and the registered notes. */
export interface ExplainState {
  readonly on: boolean
  readonly setOn: (on: boolean) => void
  readonly notes: readonly NoteEntry[]
  readonly register: (entry: NoteEntry) => () => void
}

const ExplainContext = createContext<ExplainState | null>(null)

/** Provides the Explain registry; the shell renders the toggle only when `notes` is non-empty. */
export const ExplainProvider = ExplainContext.Provider

/** The shell's Explain state: off by default, notes kept in document order. */
export const useExplainState = (): ExplainState => {
  const [on, setOn] = useState(false)
  const [notes, setNotes] = useState<readonly NoteEntry[]>([])
  const register = useCallback((entry: NoteEntry) => {
    setNotes((previous) =>
      [...previous.filter((note) => note.id !== entry.id), entry].toSorted((a, b) =>
        a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      ),
    )
    return () => setNotes((previous) => previous.filter((note) => note.id !== entry.id))
  }, [])
  // A page whose notes all unmount has nothing to explain, so the overlay reads as off.
  const active = on && notes.length > 0
  return useMemo(() => ({ on: active, setOn, notes, register }), [active, notes, register])
}

/** Props for Note: what the wrapped element means, shown when the reader asks the page to explain itself. */
export interface NoteProps {
  readonly text: string
  readonly children: ReactNode
}

/**
 * Wrap an element and say what it means. Renders no box of its own; the shell's Explain toggle
 * appears once a page has a Note and draws every note over the page at once.
 */
export const Note = ({ text, children }: NoteProps) => {
  const register = useContext(ExplainContext)?.register
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()
  useLayoutEffect(
    () =>
      ref.current !== null && register !== undefined
        ? register({ id, text, element: ref.current })
        : undefined,
    [id, text, register],
  )
  return (
    <span ref={ref} {...stylex.props(styles.note)} data-vista-note="">
      {children}
    </span>
  )
}

/** Union of the wrapped children's boxes relative to the host; a `display: contents` wrapper has none. */
const boxOf = (element: HTMLElement, host: DOMRect): Box | null => {
  const rects = [...element.children]
    .map((child) => child.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
  if (rects.length === 0) return null
  const x0 = Math.min(...rects.map((rect) => rect.left))
  const y0 = Math.min(...rects.map((rect) => rect.top))
  const x1 = Math.max(...rects.map((rect) => rect.right))
  const y1 = Math.max(...rects.map((rect) => rect.bottom))
  return { x: x0 - host.left, y: y0 - host.top, w: x1 - x0, h: y1 - y0 }
}

/** Notes measured against the host, re-measured whenever the host resizes. */
const useMeasuredNotes = (
  hostRef: RefObject<HTMLElement | null>,
  notes: readonly NoteEntry[],
  active: boolean,
) => {
  const [measured, setMeasured] = useState<{
    readonly items: readonly { readonly id: string; readonly text: string; readonly box: Box }[]
    readonly width: number
    readonly height: number
  }>({ items: [], width: 0, height: 0 })
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!active || host === null) return
    const measure = () => {
      const rect = host.getBoundingClientRect()
      const items = notes.flatMap((note) => {
        const box = boxOf(note.element, rect)
        return box === null ? [] : [{ id: note.id, text: note.text, box }]
      })
      setMeasured({ items, width: rect.width, height: rect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [hostRef, notes, active])
  return measured
}

/** Regions this large read from the dim cut-out alone; a ring would outweigh the small controls. */
const RING_MAX_AREA = 40_000

/**
 * Every note at once, in place: the page dims except the noted elements, and each note is a
 * numbered callout with a sketched arrow. Escape or a press on the dim closes it.
 */
export const ExplainLayer = ({ hostRef }: { readonly hostRef: RefObject<HTMLElement | null> }) => {
  const explain = useContext(ExplainContext)
  const on = explain?.on === true
  const setOn = explain?.setOn
  const { items, width, height } = useMeasuredNotes(hostRef, explain?.notes ?? [], on)
  const maskId = `vista-explain-${useId().replace(/:/g, '')}`
  useEffect(() => {
    if (!on || setOn === undefined) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOn(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [on, setOn])
  if (!on || width === 0) return null
  const callouts = placeCallouts(items, width, height)
  return (
    <div
      {...stylex.props(styles.layer)}
      role="region"
      aria-label="Page explanations"
      data-vista-explain=""
    >
      <svg
        {...stylex.props(styles.fill)}
        width={width}
        height={height}
        onPointerDown={() => setOn?.(false)}
        aria-hidden="true"
      >
        <mask id={maskId}>
          <rect width={width} height={height} fill="white" />
          {callouts.map((callout, index) => (
            <rect
              key={items[index]?.id}
              x={callout.target.x}
              y={callout.target.y}
              width={callout.target.w}
              height={callout.target.h}
              rx={8}
              fill="black"
            />
          ))}
        </mask>
        <rect
          width={width}
          height={height}
          mask={`url(#${maskId})`}
          {...stylex.props(styles.dim)}
        />
      </svg>
      <svg
        {...stylex.props(styles.fill, styles.ink)}
        width={width}
        height={height}
        aria-hidden="true"
      >
        {callouts.map((callout, index) => {
          const box = items[index]?.box
          const ring =
            box !== undefined && box.w * box.h < RING_MAX_AREA
              ? sketchLoop(callout.target, callout.seed)
              : null
          const arrow = sketchArrow(callout.tail, callout.tip, callout.seed + 1)
          return (
            <g key={items[index]?.id}>
              {ring === null ? null : (
                <>
                  <path d={ring[0]} {...stylex.props(styles.stroke)} />
                  <path d={ring[1]} {...stylex.props(styles.stroke, styles.ghost)} />
                </>
              )}
              <path d={arrow[0]} {...stylex.props(styles.stroke)} />
              <path d={arrow[1]} {...stylex.props(styles.stroke, styles.ghost)} />
            </g>
          )
        })}
      </svg>
      {callouts.map((callout, index) => (
        <p
          key={items[index]?.id}
          {...stylex.props(styles.callout)}
          style={{ left: callout.label.x, top: callout.label.y, width: callout.label.w }}
        >
          <span {...stylex.props(styles.number)} aria-hidden="true">
            {index + 1}
          </span>
          {items[index]?.text}
        </p>
      ))}
    </div>
  )
}

const INK = 'var(--ds-pink-900)'

const styles = stylex.create({
  note: {
    display: 'contents',
  },
  layer: {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
  },
  fill: {
    position: 'absolute',
    inset: 0,
  },
  dim: {
    fill: tokens['--ds-background-100'],
    fillOpacity: 0.86,
  },
  ink: {
    overflow: 'visible',
    pointerEvents: 'none',
  },
  stroke: {
    fill: 'none',
    stroke: INK,
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  ghost: {
    strokeWidth: 1.1,
    opacity: 0.5,
  },
  callout: {
    position: 'absolute',
    boxSizing: 'border-box',
    margin: 0,
    paddingBlock: '0.375rem',
    paddingInline: '0.625rem',
    fontSize: '0.8125rem',
    lineHeight: '1.125rem',
    fontWeight: 500,
    color: INK,
    backgroundColor: tokens['--ds-background-100'],
    borderRadius: '0.4375rem',
    boxShadow: `0 0 0 1.5px color-mix(in oklab, ${INK} 25%, transparent)`,
    textWrap: 'balance',
    pointerEvents: 'none',
  },
  number: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '1rem',
    height: '1rem',
    marginInlineEnd: '0.375rem',
    marginInlineStart: '-0.125rem',
    borderRadius: '50%',
    fontSize: '0.625rem',
    color: tokens['--ds-background-100'],
    backgroundColor: INK,
  },
})
