import type { Meta, StoryObj } from '@storybook/react'

import { Comparison } from '../blocks/kit/Comparison.tsx'

/** Aligned peers measured on the same rows; what they share is said once. */
const meta = {
  title: 'Vista/Blocks/Kit/Comparison',
  component: Comparison,
  args: {
    columns: ['Through relay', 'Direct path'],
    rows: [
      ['Fresh page open', '3.89 s', '93 ms'],
      ['Samples', 'n=3', 'n=3'],
      ['Setup', 'Default', 'One config flag'],
    ],
    same: 'Same host, same workspace, warm cache.',
  },
} satisfies Meta<typeof Comparison>

export default meta

type Story = StoryObj<typeof meta>

/** Before/after style peers. */
export const Default: Story = {}

/** Three options compared without a shared footnote. */
export const ThreeOptions: Story = {
  args: {
    columns: ['Direct path', 'Trace inventory', 'Wait'],
    rows: [
      ['Cost', 'Low', 'Medium', 'None now'],
      ['Gain', '~3.8 s per open', 'Up to 8.2 s per read', '—'],
      ['Proven', 'Yes', 'No', '—'],
    ],
    same: undefined,
  },
}
