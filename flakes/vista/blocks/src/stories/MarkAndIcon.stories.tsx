import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'

import { Icon, iconNames } from '../blocks/kit/icons.tsx'
import { Mark, tones, type Tone } from '../blocks/kit/Mark.tsx'

/**
 * The tone marks (icon + word, never color alone) and the curated Lucide icon set that ships
 * with Vista. App source imports `Icon` from `@vista/blocks`; lucide-react is not provided.
 */
const meta = {
  title: 'Vista/Blocks/Kit/Mark and Icon',
  component: Mark,
  args: { tone: 'recommend' },
} satisfies Meta<typeof Mark>

export default meta

type Story = StoryObj<typeof meta>

/** Every tone with its default word, plus one with an author label. */
export const Tones: Story = {
  render: () => (
    <div {...stylex.props(styles.column)} data-vista-tones="">
      {(Object.keys(tones) as Tone[]).map((tone) => (
        <Mark key={tone} tone={tone} />
      ))}
      <Mark tone="risk">Slowest path</Mark>
    </div>
  ),
}

/** The full icon catalog, named as `IconName` accepts them. */
export const Icons: Story = {
  render: () => (
    <ul {...stylex.props(styles.grid)}>
      {iconNames.map((name) => (
        <li key={name} {...stylex.props(styles.cell)}>
          <Icon name={name} size={20} />
          <code {...stylex.props(styles.name)}>{name}</code>
        </li>
      ))}
    </ul>
  ),
}

const styles = stylex.create({
  column: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 8,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: tokens['--ds-gray-1000'],
    padding: 6,
  },
  name: { fontSize: 12, color: tokens['--ds-gray-900'] },
})
