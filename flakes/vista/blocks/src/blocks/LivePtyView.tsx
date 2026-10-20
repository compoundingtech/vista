'use client'

import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { Terminal } from '@xterm/xterm'
import xtermStyles from '@xterm/xterm/css/xterm.css?inline'
import * as React from 'react'
import { Button } from 'react-aria-components'

import type { ActorSource, ScreenState } from '../provider-contracts.ts'

/**
 * Fully controlled props for the terminal view, supplying the screen snapshot, its sync
 * provenance, attachment and pending flags, and the callbacks used to toggle attach and deliver
 * input.
 */
export interface LivePtyViewProps {
  readonly id: string
  readonly actorSource: ActorSource
  readonly sessionId: string
  readonly state: ScreenState
  readonly provenance: 'Frozen' | 'CatchingUp' | 'Live'
  readonly attached: boolean
  readonly pending: boolean
  readonly height: number
  readonly error?: string
  readonly onToggleAttach: () => void
  readonly onData: (input: string) => void
}

const renderState = (terminal: Terminal, state: ScreenState, onRendered?: () => void): void => {
  if (terminal.cols !== state.columns || terminal.rows !== state.rowCount) {
    terminal.resize(state.columns, state.rowCount)
  }
  const cursorRow = Math.min(state.rowCount, state.cursorY + 1)
  const cursorColumn = Math.min(state.columns, state.cursorX + 1)
  terminal.write(
    `\u001b[H\u001b[2J${state.rows.join('\r\n')}\u001b[${cursorRow};${cursorColumn}H`,
    onRendered,
  )
}

const MAX_FONT_SIZE = 13
const MIN_FONT_SIZE = 6
const LINE_HEIGHT = 1.15
const TERMINAL_PADDING = 16

type ViewportMode = 'fit' | 'scroll'

const viewportModeKey = (id: string): string => `vista:livepty:${id}:viewport-mode`

const readViewportMode = (id: string): ViewportMode => {
  try {
    return globalThis.localStorage?.getItem(viewportModeKey(id)) === 'scroll' ? 'scroll' : 'fit'
  } catch {
    return 'fit'
  }
}

const persistViewportMode = (id: string, mode: ViewportMode): void => {
  try {
    globalThis.localStorage?.setItem(viewportModeKey(id), mode)
  } catch {
    // The fit policy still works when storage is unavailable.
  }
}

const initialFitHeight = (rows: number): number => Math.ceil(rows * MAX_FONT_SIZE * LINE_HEIGHT)

/** Browser-only xterm presentation; the owning block stays Node-safe. */
export const LivePtyView = ({
  actorSource,
  id,
  sessionId,
  state,
  provenance,
  attached,
  pending,
  height,
  error,
  onToggleAttach,
  onData,
}: LivePtyViewProps): React.ReactNode => {
  const viewport = React.useRef<HTMLDivElement | null>(null)
  const surface = React.useRef<HTMLDivElement | null>(null)
  const controls = React.useRef<HTMLDivElement | null>(null)
  const terminal = React.useRef<Terminal | undefined>(undefined)
  const resizeTerminal = React.useRef<(() => void) | undefined>(undefined)
  const onDataRef = React.useRef(onData)
  const stateRef = React.useRef(state)
  const attachedRef = React.useRef(attached)
  const initiallyAttached = React.useRef(attached)
  const [viewportMode, setViewportMode] = React.useState<ViewportMode>(() => readViewportMode(id))
  const [fitHeight, setFitHeight] = React.useState(() => initialFitHeight(state.rowCount))
  onDataRef.current = onData
  stateRef.current = state
  attachedRef.current = attached

  React.useEffect(() => {
    const viewportElement = viewport.current
    const surfaceElement = surface.current
    if (viewportElement === null || surfaceElement === null) return
    const nextTerminal = new Terminal({
      cols: stateRef.current.columns,
      rows: stateRef.current.rowCount,
      convertEol: true,
      cursorBlink: false,
      disableStdin: !initiallyAttached.current,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: MAX_FONT_SIZE,
      lineHeight: LINE_HEIGHT,
      screenReaderMode: true,
      scrollback: 0,
      theme: {
        background: '#0a0a0a',
        foreground: '#ededed',
        cursor: '#ededed',
        selectionBackground: '#3b82f680',
      },
    })
    const fitToWidth = () => {
      const currentState = stateRef.current
      if (
        nextTerminal.cols !== currentState.columns ||
        nextTerminal.rows !== currentState.rowCount
      ) {
        nextTerminal.resize(currentState.columns, currentState.rowCount)
      }
      const screen = surfaceElement.querySelector<HTMLElement>('.xterm-screen')
      if (screen === null) return
      const currentFontSize = nextTerminal.options.fontSize ?? MAX_FONT_SIZE
      const currentWidth = screen.getBoundingClientRect().width
      if (currentWidth === 0) return
      const naturalWidth = currentWidth * (MAX_FONT_SIZE / currentFontSize)
      const availableWidth = Math.max(1, viewportElement.clientWidth - TERMINAL_PADDING)
      const fittedFontSize = Math.max(
        MIN_FONT_SIZE,
        Math.min(MAX_FONT_SIZE, MAX_FONT_SIZE * (availableWidth / naturalWidth)),
      )
      if (Math.abs(currentFontSize - fittedFontSize) > 0.01) {
        nextTerminal.options.fontSize = fittedFontSize
      }
      surfaceElement.dataset.fontSize = String(fittedFontSize)
      requestAnimationFrame(() => {
        const fittedScreen = surfaceElement.querySelector<HTMLElement>('.xterm-screen')
        if (fittedScreen === null) return
        const nextHeight = Math.ceil(fittedScreen.getBoundingClientRect().height)
        surfaceElement.style.height = `${nextHeight}px`
        setFitHeight(nextHeight + TERMINAL_PADDING)
      })
    }
    let fitFrame: number | undefined
    const scheduleFit = () => {
      if (fitFrame !== undefined) cancelAnimationFrame(fitFrame)
      fitFrame = requestAnimationFrame(() => {
        fitFrame = undefined
        fitToWidth()
      })
    }
    surfaceElement.style.height = `${initialFitHeight(stateRef.current.rowCount)}px`
    nextTerminal.open(surfaceElement)
    renderState(nextTerminal, stateRef.current, scheduleFit)
    const observer = new ResizeObserver(scheduleFit)
    observer.observe(viewportElement)
    window.addEventListener('resize', scheduleFit)
    const data = nextTerminal.onData((input) => onDataRef.current(input))
    const copySelection = (event: ClipboardEvent) => {
      const selection = nextTerminal.getSelection()
      if (selection.length === 0 || event.clipboardData === null) return
      event.clipboardData.setData('text/plain', selection)
      event.preventDefault()
    }
    const handleTerminalKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && event.ctrlKey && event.shiftKey && attachedRef.current) {
        event.preventDefault()
        event.stopPropagation()
        controls.current?.querySelector<HTMLButtonElement>('button')?.focus()
        return
      }
      if (
        event.key.toLowerCase() !== 'c' ||
        (!event.ctrlKey && !event.metaKey) ||
        !nextTerminal.hasSelection()
      )
        return
      event.preventDefault()
      const selection = nextTerminal.getSelection()
      if (navigator.clipboard?.writeText !== undefined) {
        void navigator.clipboard.writeText(selection).catch(() => {
          document.execCommand('copy')
        })
      } else {
        document.execCommand('copy')
      }
    }
    surfaceElement.addEventListener('copy', copySelection)
    surfaceElement.addEventListener('keydown', handleTerminalKeydown, true)
    terminal.current = nextTerminal
    resizeTerminal.current = scheduleFit
    return () => {
      window.removeEventListener('resize', scheduleFit)
      if (fitFrame !== undefined) cancelAnimationFrame(fitFrame)
      observer.disconnect()
      data.dispose()
      surfaceElement.removeEventListener('copy', copySelection)
      surfaceElement.removeEventListener('keydown', handleTerminalKeydown, true)
      resizeTerminal.current = undefined
      terminal.current = undefined
      nextTerminal.dispose()
    }
  }, [])

  React.useEffect(() => {
    const current = terminal.current
    if (current === undefined) return
    renderState(current, state, resizeTerminal.current)
  }, [state])

  React.useEffect(() => {
    const current = terminal.current
    const input = surface.current?.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea')
    if (current === undefined || input === undefined || input === null) return
    current.options.disableStdin = !attached
    input.tabIndex = attached ? 0 : -1
    if (!attached && document.activeElement === input) {
      controls.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }
  }, [attached])

  React.useEffect(() => {
    resizeTerminal.current?.()
  }, [viewportMode])

  const toggleViewportMode = (): void => {
    const nextMode = viewportMode === 'fit' ? 'scroll' : 'fit'
    persistViewportMode(id, nextMode)
    setViewportMode(nextMode)
  }

  const scrollWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (viewportMode !== 'scroll' || event.target !== event.currentTarget) return
    const element = event.currentTarget
    const pageDistance = Math.max(1, element.clientHeight - 32)
    switch (event.key) {
      case 'ArrowDown':
        element.scrollBy({ top: 40 })
        break
      case 'ArrowUp':
        element.scrollBy({ top: -40 })
        break
      case 'PageDown':
        element.scrollBy({ top: pageDistance })
        break
      case 'PageUp':
        element.scrollBy({ top: -pageDistance })
        break
      case 'End':
        element.scrollTop = element.scrollHeight
        break
      case 'Home':
        element.scrollTop = 0
        break
      default:
        return
    }
    event.preventDefault()
  }

  return (
    <section id={id} aria-label={`Live terminal ${sessionId}`} {...stylex.props(styles.root)}>
      <style>{xtermStyles}</style>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.identity)}>
          <strong {...stylex.props(styles.session)}>{sessionId}</strong>
          <span {...stylex.props(styles.provenance, provenance === 'Live' && styles.live)}>
            {provenance}
          </span>
        </div>
        <div ref={controls} {...stylex.props(styles.controls)}>
          <Button
            onPress={toggleViewportMode}
            aria-label={
              viewportMode === 'fit'
                ? 'Use fixed-height terminal viewport'
                : 'Use full-height terminal viewport'
            }
            aria-pressed={viewportMode === 'scroll'}
            {...stylex.props(styles.viewportToggle)}
          >
            {viewportMode === 'fit' ? 'Full height' : 'Fixed height'}
          </Button>
          {actorSource === 'none' ? (
            <span {...stylex.props(styles.readOnly)}>Read-only · no trusted actor source</span>
          ) : (
            <Button
              onPress={onToggleAttach}
              isDisabled={pending}
              aria-pressed={attached}
              {...stylex.props(styles.attach, attached && styles.attached)}
            >
              {pending ? 'Working…' : attached ? 'Release' : 'Attach'}
            </Button>
          )}
        </div>
      </header>
      <div
        ref={viewport}
        tabIndex={0}
        onKeyDown={scrollWithKeyboard}
        aria-label={attached ? 'Attached interactive terminal' : 'Read-only terminal'}
        aria-describedby={`${id}-terminal-status`}
        data-testid="livepty-viewport"
        data-viewport-mode={viewportMode}
        style={{ height: viewportMode === 'fit' ? fitHeight : height }}
        {...stylex.props(
          styles.terminalViewport,
          viewportMode === 'fit' ? styles.terminalViewportFit : styles.terminalViewportScroll,
        )}
      >
        <div
          ref={surface}
          data-testid="livepty-surface"
          {...stylex.props(styles.terminalSurface)}
        />
      </div>
      <footer {...stylex.props(styles.footer)}>
        <span id={`${id}-terminal-status`}>
          {attached
            ? 'Input lease active · Ctrl+Shift+Escape returns to controls'
            : actorSource === 'none'
              ? 'Read-only · session geometry'
              : `Read-only · attach available via ${actorSource}`}
        </span>
        <span>
          {state.columns}×{state.rowCount}
        </span>
      </footer>
      {error === undefined ? null : (
        <p role="alert" {...stylex.props(styles.error)}>
          {error}
        </p>
      )}
    </section>
  )
}

const styles = stylex.create({
  root: {
    backgroundColor: tokens['--ds-background-100'],
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    borderStyle: 'solid',
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    display: 'flex',
    justifyContent: 'space-between',
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
  },
  identity: {
    alignItems: 'center',
    display: 'flex',
    gap: scale.space2,
    minWidth: 0,
  },
  session: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.8rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  provenance: {
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1,
    color: tokens['--ds-gray-900'],
    fontSize: '0.72rem',
    paddingBlock: 2,
    paddingInline: scale.space2,
  },
  live: {
    borderColor: tokens['--ds-green-600'],
    color: tokens['--ds-green-900'],
  },
  readOnly: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.72rem',
    fontWeight: 600,
  },
  controls: {
    alignItems: 'center',
    display: 'flex',
    gap: scale.space2,
  },
  viewportToggle: {
    backgroundColor: tokens['--ds-background-100'],
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    borderStyle: 'solid',
    borderWidth: 1,
    color: tokens['--ds-gray-1000'],
    cursor: 'pointer',
    fontSize: '0.72rem',
    fontWeight: 600,
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
  },
  attach: {
    backgroundColor: tokens['--ds-background-100'],
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    borderStyle: 'solid',
    borderWidth: 1,
    color: tokens['--ds-gray-1000'],
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 600,
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
  },
  attached: {
    borderColor: tokens['--ds-green-600'],
    color: tokens['--ds-green-900'],
  },
  terminalViewport: {
    backgroundColor: '#0a0a0a',
    minHeight: 160,
    padding: scale.space2,
  },
  terminalViewportFit: {
    overflow: 'hidden',
  },
  terminalViewportScroll: {
    overflowX: 'hidden',
    overflowY: 'scroll',
    scrollbarGutter: 'stable',
  },
  terminalSurface: {
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
    userSelect: 'text',
    width: '100%',
  },
  footer: {
    alignItems: 'center',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    borderTopStyle: 'solid',
    borderTopWidth: 1,
    color: tokens['--ds-gray-900'],
    display: 'flex',
    fontSize: '0.72rem',
    justifyContent: 'space-between',
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
  },
  error: {
    backgroundColor: tokens['--ds-red-100'],
    color: tokens['--ds-red-900'],
    fontSize: '0.78rem',
    margin: 0,
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
  },
})
