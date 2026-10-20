import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import { Button, Checkbox } from 'react-aria-components'

import type { SelectionModifiers } from '../pull-request/selection.ts'
import { ChevronDown, ChevronRight } from './icons.tsx'

/**
 * Contract for the disclosure affordance of an expandable check row: current expansion state, its
 * label, and the callback that toggles it.
 */
export interface CheckRowExpandable {
  readonly expanded: boolean
  readonly label: string
  readonly onToggle: () => void
}

/**
 * Props for the shared checkbox row: tri-state checked value, label and value nodes, indentation
 * depth, optional expansion, an aria label, and a toggle that receives the pointer modifiers so
 * the caller owns selection policy.
 */
export interface CheckRowProps {
  readonly checked: boolean | 'mixed'
  readonly label: React.ReactNode
  readonly value?: React.ReactNode
  readonly depth?: number
  readonly expandable?: CheckRowExpandable
  readonly ariaLabel?: string
  readonly onToggle: (modifiers: SelectionModifiers) => void
}

/** Shared checkbox-row presentation; callers own the selection policy. */
export const CheckRow = ({
  checked,
  label,
  value,
  depth = 0,
  expandable,
  ariaLabel,
  onToggle,
}: CheckRowProps) => {
  const modifiersRef = React.useRef<SelectionModifiers>({ shift: false, meta: false, alt: false })

  const rememberModifiers = (event: React.MouseEvent | React.KeyboardEvent): void => {
    modifiersRef.current = {
      shift: event.shiftKey,
      meta: event.metaKey || event.ctrlKey,
      alt: event.altKey,
    }
  }

  return (
    <div
      {...stylex.props(styles.row, styles.rowIndent(`${depth * 0.85 + 0.2}rem`))}
      onKeyDownCapture={rememberModifiers}
    >
      {expandable === undefined ? (
        <span {...stylex.props(styles.disclosure, styles.disclosureLeaf)} aria-hidden="true" />
      ) : (
        <Button
          className={({ isHovered, isFocusVisible }) =>
            stylex.props(
              styles.disclosure,
              isHovered && styles.disclosureHovered,
              isFocusVisible && styles.focused,
              isFocusVisible && styles.disclosureFocused,
            ).className ?? ''
          }
          aria-expanded={expandable.expanded}
          aria-label={expandable.label}
          onClick={(event) => event.stopPropagation()}
          onPress={expandable.onToggle}
        >
          {expandable.expanded ? (
            <ChevronDown rootStyle={styles.disclosureIcon} />
          ) : (
            <ChevronRight rootStyle={styles.disclosureIcon} />
          )}
        </Button>
      )}
      <Checkbox
        {...stylex.props(styles.check)}
        isSelected={checked === true}
        isIndeterminate={checked === 'mixed'}
        onClickCapture={rememberModifiers}
        onChange={() => {
          const modifiers = modifiersRef.current
          modifiersRef.current = { shift: false, meta: false, alt: false }
          onToggle(modifiers)
        }}
        {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
      >
        {({ isSelected, isIndeterminate, isFocusVisible }) => (
          <>
            <span
              {...stylex.props(
                styles.box,
                (isSelected || isIndeterminate) && styles.boxChecked,
                isFocusVisible && styles.focused,
              )}
              aria-hidden="true"
            >
              {isIndeterminate ? '–' : isSelected ? '✓' : ''}
            </span>
            <span {...stylex.props(styles.label)}>{label}</span>
          </>
        )}
      </Checkbox>
      {value === undefined ? null : <span {...stylex.props(styles.value)}>{value}</span>}
    </div>
  )
}

/**
 * Renders compact "all" and "none" buttons that bulk-check or bulk-clear a filter group via the
 * supplied callbacks.
 */
export const CheckRowActions = ({ onAll, onNone }: { onAll: () => void; onNone: () => void }) => (
  <span {...stylex.props(styles.actions)}>
    <Button
      className={({ isHovered, isFocusVisible }) =>
        stylex.props(
          styles.action,
          isHovered && styles.actionHovered,
          isFocusVisible && styles.focused,
        ).className ?? ''
      }
      onPress={onAll}
    >
      All
    </Button>
    <Button
      className={({ isHovered, isFocusVisible }) =>
        stylex.props(
          styles.action,
          isHovered && styles.actionHovered,
          isFocusVisible && styles.focused,
        ).className ?? ''
      }
      onPress={onNone}
    >
      None
    </Button>
  </span>
)

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    borderRadius: scale.radiusSm,
    paddingBlock: '0.12rem',
    paddingRight: '0.25rem',
    backgroundColor: { default: 'transparent', ':hover': tokens['--ds-gray-alpha-100'] },
  },
  rowIndent: (paddingLeft: string) => ({ paddingLeft }),
  disclosure: {
    flex: '0 0 auto',
    width: '1.1rem',
    height: '1.1rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-800'],
    cursor: 'pointer',
    borderRadius: scale.radiusSm,
    outline: 'none',
  },
  disclosureHovered: {
    color: tokens['--ds-foreground'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  disclosureFocused: { outlineOffset: -1 },
  disclosureLeaf: { cursor: 'default' },
  disclosureIcon: { width: '0.8rem', height: '0.8rem' },
  check: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    flex: '1 1 auto',
    minWidth: 0,
    cursor: 'pointer',
    fontSize: '0.76rem',
    color: tokens['--ds-foreground'],
    outline: 'none',
  },
  box: {
    flex: '0 0 auto',
    width: '0.95rem',
    height: '0.95rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: 3,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-background-100'],
    fontSize: '0.7rem',
    lineHeight: 1,
    outline: 'none',
  },
  boxChecked: {
    backgroundColor: tokens['--ds-blue-700'],
    borderColor: tokens['--ds-blue-700'],
    color: tokens['--ds-background-100'],
  },
  label: {
    minWidth: 0,
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: scale.fontMono,
  },
  value: {
    minWidth: 0,
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.68rem',
    fontVariantNumeric: 'tabular-nums',
  },
  actions: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
  action: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: tokens['--ds-blue-700'],
    font: 'inherit',
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    padding: 0,
    outline: 'none',
  },
  actionHovered: { textDecoration: 'underline' },
  focused: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: 1,
  },
})
