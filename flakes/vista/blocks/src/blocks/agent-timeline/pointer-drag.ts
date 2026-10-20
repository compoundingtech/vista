import * as React from 'react'

interface UsePointerDragOptions {
  readonly onDrag: (deltaX: number, deltaY: number) => void
}

interface PointerDragProps {
  readonly 'data-pointer-dragging': 'true' | 'false'
  readonly onPointerDown: React.PointerEventHandler<HTMLElement>
  readonly onPointerMove: React.PointerEventHandler<HTMLElement>
  readonly onPointerUp: React.PointerEventHandler<HTMLElement>
  readonly onPointerCancel: React.PointerEventHandler<HTMLElement>
  readonly onLostPointerCapture: React.PointerEventHandler<HTMLElement>
  readonly onKeyDown: React.KeyboardEventHandler<HTMLElement>
}

interface UsePointerDragResult {
  readonly dragProps: PointerDragProps
  readonly isDragging: boolean
}

interface PointerPosition {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
}

/** Pointer-captured drag movement, reported as incremental pixel deltas. */
export const usePointerDrag = ({ onDrag }: UsePointerDragOptions): UsePointerDragResult => {
  const [isDragging, setIsDragging] = React.useState(false)
  const positionRef = React.useRef<PointerPosition | null>(null)
  const onDragRef = React.useRef(onDrag)
  onDragRef.current = onDrag

  const finish = (target: HTMLElement, pointerId: number): void => {
    if (positionRef.current?.pointerId !== pointerId) return
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
    positionRef.current = null
    setIsDragging(false)
  }

  const dragProps: PointerDragProps = {
    'data-pointer-dragging': isDragging ? 'true' : 'false',
    onPointerDown: (event: React.PointerEvent<HTMLElement>): void => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.focus({ preventScroll: true })
      event.currentTarget.setPointerCapture(event.pointerId)
      positionRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      }
      setIsDragging(true)
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>): void => {
      const previous = positionRef.current
      if (previous?.pointerId !== event.pointerId) return
      event.preventDefault()
      positionRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      }
      onDragRef.current(event.clientX - previous.clientX, event.clientY - previous.clientY)
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>): void => {
      finish(event.currentTarget, event.pointerId)
    },
    onPointerCancel: (event: React.PointerEvent<HTMLElement>): void => {
      finish(event.currentTarget, event.pointerId)
    },
    onLostPointerCapture: (event: React.PointerEvent<HTMLElement>): void => {
      if (positionRef.current?.pointerId !== event.pointerId) return
      positionRef.current = null
      setIsDragging(false)
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>): void => {
      if (event.key !== 'Escape' || positionRef.current === null) return
      event.preventDefault()
      event.stopPropagation()
      finish(event.currentTarget, positionRef.current.pointerId)
    },
  }

  return { dragProps, isDragging }
}
