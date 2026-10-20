import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { StatusDot } from '../src/components/StatusDot/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/StatusDot',
  component: StatusDot,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['queued', 'building', 'error', 'ready', 'canceled'],
    },
    size: {
      control: 'select',
      options: ['small', 'default', 'large'],
    },
  },
} satisfies Meta<typeof StatusDot>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  sizeLabel: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  allStates: {
    display: 'flex',
    gap: '2rem',
  },
  sectionLabel: {
    margin: 0,
    marginBottom: '0.5rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
})

export const Default: Story = {
  args: {
    status: 'ready',
  },
}

export const AllStatuses: Story = {
  args: {
    status: 'queued',
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <StatusDot status="queued" />
      <StatusDot status="building" />
      <StatusDot status="error" />
      <StatusDot status="ready" />
      <StatusDot status="canceled" />
    </div>
  ),
}

export const WithLabels: Story = {
  args: {
    status: 'queued',
    label: 'Queued',
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <StatusDot status="queued" label="Queued" />
      <StatusDot status="building" label="Building" />
      <StatusDot status="error" label="Error" />
      <StatusDot status="ready" label="Ready" />
      <StatusDot status="canceled" label="Canceled" />
    </div>
  ),
}

export const Sizes: Story = {
  args: {
    status: 'ready',
    size: 'default',
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <div {...stylex.props(storyStyles.row)}>
        <StatusDot status="ready" size="small" />
        <span {...stylex.props(storyStyles.sizeLabel)}>Small</span>
      </div>
      <div {...stylex.props(storyStyles.row)}>
        <StatusDot status="ready" size="default" />
        <span {...stylex.props(storyStyles.sizeLabel)}>Default</span>
      </div>
      <div {...stylex.props(storyStyles.row)}>
        <StatusDot status="ready" size="large" />
        <span {...stylex.props(storyStyles.sizeLabel)}>Large</span>
      </div>
    </div>
  ),
}

export const SizesWithLabels: Story = {
  args: {
    status: 'building',
    size: 'default',
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <StatusDot status="building" size="small" label="Building (small)" />
      <StatusDot status="building" size="default" label="Building (default)" />
      <StatusDot status="building" size="large" label="Building (large)" />
    </div>
  ),
}

export const AllStates: Story = {
  args: {
    status: 'queued',
  },
  render: () => (
    <div {...stylex.props(storyStyles.allStates)}>
      <div {...stylex.props(storyStyles.stack)}>
        <p {...stylex.props(storyStyles.sectionLabel)}>Without Labels</p>
        <StatusDot status="queued" />
        <StatusDot status="building" />
        <StatusDot status="error" />
        <StatusDot status="ready" />
        <StatusDot status="canceled" />
      </div>
      <div {...stylex.props(storyStyles.stack)}>
        <p {...stylex.props(storyStyles.sectionLabel)}>With Labels</p>
        <StatusDot status="queued" label="Queued" />
        <StatusDot status="building" label="Building" />
        <StatusDot status="error" label="Error" />
        <StatusDot status="ready" label="Ready" />
        <StatusDot status="canceled" label="Canceled" />
      </div>
    </div>
  ),
}
