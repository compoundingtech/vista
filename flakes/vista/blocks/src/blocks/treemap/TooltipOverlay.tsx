/** Collision-aware hover tooltip for the treemap block. */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { useRef } from 'react'
import { Popover } from 'react-aria-components'

import type { Theme } from '../../model.ts'

/**
 * The display payload for a treemap tooltip: node label and path, its formatted value with unit
 * noun, shares of parent and total, and an optional hint line.
 */
export interface TooltipContent {
  readonly label: string
  readonly path: string
  readonly valueNoun: string
  readonly valueStr: string
  readonly pctParent: string
  readonly pctTotal: string
  readonly hint?: string | undefined
}

const styles = stylex.create({
  anchor: { position: 'absolute', pointerEvents: 'none' },
  anchorBounds: (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    width,
    height,
  }),
  popover: { zIndex: 70, pointerEvents: 'none', outline: 'none' },
  tooltip: {
    minWidth: '10.5rem',
    maxWidth: '20rem',
    paddingBlock: '0.5rem',
    paddingInline: '0.6rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    boxShadow: tokens['--ds-shadow-medium'],
    pointerEvents: 'none',
    fontSize: '0.75rem',
  },
  title: {
    fontFamily: scale.fontMono,
    fontWeight: 600,
    fontSize: '0.78rem',
    marginBottom: '0.4rem',
    wordBreak: 'break-word',
  },
  path: {
    color: tokens['--ds-gray-900'],
    fontFamily: scale.fontMono,
    fontSize: '0.66rem',
    marginBottom: '0.4rem',
    paddingBottom: '0.4rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    wordBreak: 'break-word',
  },
  row: { display: 'flex', justifyContent: 'space-between', gap: '1rem', lineHeight: 1.6 },
  rowLabel: { color: tokens['--ds-gray-900'] },
  rowValue: { fontVariantNumeric: 'tabular-nums' },
  hint: {
    marginTop: '0.4rem',
    paddingTop: '0.4rem',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    color: tokens['--ds-gray-800'],
    fontSize: '0.66rem',
  },
})

/**
 * Renders an absolutely positioned, non-interactive tooltip anchored to a tile rectangle, themed
 * and closable, showing the supplied content only while open.
 */
export const TooltipOverlay = ({
  x0,
  y0,
  width,
  height,
  isOpen,
  onClose,
  theme,
  content,
}: {
  x0: number
  y0: number
  width: number
  height: number
  isOpen: boolean
  onClose: () => void
  theme: Theme
  content: TooltipContent
}) => {
  const anchorRef = useRef<HTMLDivElement>(null)
  return (
    <>
      <div
        ref={anchorRef}
        aria-hidden="true"
        {...stylex.props(
          styles.anchor,
          styles.anchorBounds(x0, y0, Math.max(1, width), Math.max(1, height)),
        )}
      />
      <Popover
        triggerRef={anchorRef}
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        placement="top"
        offset={10}
        containerPadding={10}
        isNonModal
        {...stylex.props(styles.popover)}
        data-theme={theme}
      >
        <div {...stylex.props(styles.tooltip)} role="tooltip">
          <div {...stylex.props(styles.path)}>{content.path}</div>
          <div {...stylex.props(styles.title)}>{content.label}</div>
          <div {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.rowLabel)}>{content.valueNoun}</span>
            <strong {...stylex.props(styles.rowValue)}>{content.valueStr}</strong>
          </div>
          <div {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.rowLabel)}>% of parent</span>
            <strong {...stylex.props(styles.rowValue)}>{content.pctParent}</strong>
          </div>
          <div {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.rowLabel)}>% of total</span>
            <strong {...stylex.props(styles.rowValue)}>{content.pctTotal}</strong>
          </div>
          {content.hint ? <div {...stylex.props(styles.hint)}>{content.hint}</div> : null}
        </div>
      </Popover>
    </>
  )
}
