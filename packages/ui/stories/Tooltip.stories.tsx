import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Button } from '../src/components/Button/mod.ts'
import { Tooltip, TooltipTrigger } from '../src/components/Tooltip/mod.ts'

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  placements: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2rem',
    paddingBlock: '4rem',
  },
  wideRow: {
    display: 'flex',
    gap: '8rem',
  },
  row: {
    display: 'flex',
    gap: '2rem',
  },
})

export const Default: Story = {
  args: {
    children: 'This is a tooltip',
  },
  render: () => (
    <TooltipTrigger>
      <Button>Hover me</Button>
      <Tooltip>This is a tooltip</Tooltip>
    </TooltipTrigger>
  ),
}

export const Placements: Story = {
  args: {
    children: 'Tooltip content',
  },
  render: () => (
    <div {...stylex.props(storyStyles.placements)}>
      <TooltipTrigger>
        <Button>Top</Button>
        <Tooltip placement="top">Tooltip on top</Tooltip>
      </TooltipTrigger>

      <div {...stylex.props(storyStyles.wideRow)}>
        <TooltipTrigger>
          <Button>Left</Button>
          <Tooltip placement="left">Tooltip on left</Tooltip>
        </TooltipTrigger>

        <TooltipTrigger>
          <Button>Right</Button>
          <Tooltip placement="right">Tooltip on right</Tooltip>
        </TooltipTrigger>
      </div>

      <TooltipTrigger>
        <Button>Bottom</Button>
        <Tooltip placement="bottom">Tooltip on bottom</Tooltip>
      </TooltipTrigger>
    </div>
  ),
}

export const WithDelay: Story = {
  args: {
    children: 'Tooltip content',
  },
  render: () => (
    <TooltipTrigger delay={500}>
      <Button>Hover me (500ms delay)</Button>
      <Tooltip>This tooltip has a delay</Tooltip>
    </TooltipTrigger>
  ),
}

export const NoDelay: Story = {
  args: {
    children: 'Tooltip content',
  },
  render: () => (
    <TooltipTrigger delay={0}>
      <Button>Hover me (no delay)</Button>
      <Tooltip>This tooltip appears instantly</Tooltip>
    </TooltipTrigger>
  ),
}

export const LongContent: Story = {
  args: {
    children: 'Long tooltip content',
  },
  render: () => (
    <TooltipTrigger>
      <Button>Hover for long text</Button>
      <Tooltip>
        The Evil Rabbit jumped over the fence. This is a longer tooltip that demonstrates text
        wrapping behavior.
      </Tooltip>
    </TooltipTrigger>
  ),
}

export const AllStates: Story = {
  args: {
    children: 'Tooltip content',
  },
  render: () => (
    <div {...stylex.props(storyStyles.placements)}>
      <div {...stylex.props(storyStyles.row)}>
        <TooltipTrigger>
          <Button>Default</Button>
          <Tooltip>Default tooltip</Tooltip>
        </TooltipTrigger>

        <TooltipTrigger delay={0}>
          <Button>No delay</Button>
          <Tooltip>Instant tooltip</Tooltip>
        </TooltipTrigger>
      </div>

      <div {...stylex.props(storyStyles.row)}>
        <TooltipTrigger>
          <Button>Top</Button>
          <Tooltip placement="top">Top placement</Tooltip>
        </TooltipTrigger>

        <TooltipTrigger>
          <Button>Bottom</Button>
          <Tooltip placement="bottom">Bottom placement</Tooltip>
        </TooltipTrigger>
      </div>

      <div {...stylex.props(storyStyles.row)}>
        <TooltipTrigger>
          <Button>Left</Button>
          <Tooltip placement="left">Left placement</Tooltip>
        </TooltipTrigger>

        <TooltipTrigger>
          <Button>Right</Button>
          <Tooltip placement="right">Right placement</Tooltip>
        </TooltipTrigger>
      </div>
    </div>
  ),
}
