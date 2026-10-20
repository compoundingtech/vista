/**
 * Colocated variant picker for `/sk-explore-variants` explorations: one row per
 * dimension, short IDs (e.g. `H2`) the reviewer can quote, and the active
 * variant's description inline.
 */
import * as stylex from '@stylexjs/stylex'
import * as React from 'react'
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'

import { tokens } from '@vista/ui/tokens.stylex'

/** One pickable option on a dimension: short quotable `id` plus the sentence shown when it is active. */
export interface Variant<T extends string> {
  readonly id: T
  readonly description: string
}

/** One variant dimension: label, ID buttons, active description. */
export const VariantPicker = <T extends string>({
  label,
  variants,
  value,
  onChange,
}: {
  readonly label: string
  readonly variants: readonly Variant<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
}) => (
  <div {...stylex.props(styles.row)}>
    <span {...stylex.props(styles.label)}>{label}</span>
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const next = [...keys][0]
        if (next !== undefined) onChange(next as T)
      }}
      {...stylex.props(styles.group)}
    >
      {variants.map((variant) => (
        <ToggleButton key={variant.id} id={variant.id} {...stylex.props(styles.button)}>
          {variant.id}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
    <span {...stylex.props(styles.description)}>
      {variants.find((variant) => variant.id === value)?.description}
    </span>
  </div>
)

/** Panel that groups the pickers above the live preview. */
export const VariantPanel = ({ children }: { readonly children: React.ReactNode }) => (
  <div {...stylex.props(styles.panel)}>{children}</div>
)

const styles = stylex.create({
  panel: {
    display: 'grid',
    gap: 8,
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: tokens['--ds-background-200'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-400'],
  },
  row: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  label: { width: 110, fontSize: 12, fontWeight: 600, color: tokens['--ds-gray-900'] },
  group: { display: 'flex', gap: 4 },
  button: {
    paddingInline: 10,
    paddingBlock: 3,
    fontSize: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-400'],
    cursor: 'pointer',
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':is([data-selected])': tokens['--ds-gray-1000'],
    },
    color: {
      default: tokens['--ds-gray-1000'],
      ':is([data-selected])': tokens['--ds-background-100'],
    },
    outline: {
      default: 'none',
      ':is([data-focus-visible])': `2px solid ${tokens['--ds-blue-700']}`,
    },
  },
  description: { fontSize: 12, color: tokens['--ds-gray-900'] },
})
