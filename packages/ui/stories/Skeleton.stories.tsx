import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Skeleton } from '../src/components/Skeleton/mod.ts'
import { scale, tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['text', 'circular', 'rectangular'],
    },
  },
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  card: {
    display: 'flex',
    gap: scale.space4,
    width: '300px',
    padding: scale.space4,
    borderRadius: scale.radiusLg,
    backgroundColor: tokens['--ds-gray-100'],
  },
  cardContent: {
    display: 'flex',
    flex: '1 1 0%',
    flexDirection: 'column',
    gap: scale.space2,
  },
})

export const Text: Story = {
  args: {
    variant: 'text',
    width: 200,
  },
}

export const Circular: Story = {
  args: {
    variant: 'circular',
    width: 40,
    height: 40,
  },
}

export const Rectangular: Story = {
  args: {
    variant: 'rectangular',
    width: 200,
    height: 100,
  },
}

export const CardExample: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.card)}>
      <Skeleton variant="circular" width={48} height={48} />
      <div {...stylex.props(storyStyles.cardContent)}>
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="60%" />
      </div>
    </div>
  ),
}
