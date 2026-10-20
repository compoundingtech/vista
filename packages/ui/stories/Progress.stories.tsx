import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Progress } from '../src/components/Progress/mod.ts'

const meta = {
  title: 'Components/Progress',
  component: Progress,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['default', 'blue', 'red', 'orange', 'green'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof Progress>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  width400: {
    width: '400px',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '400px',
  },
  allStates: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    width: '400px',
  },
})

export const Default: Story = {
  args: {
    value: 50,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Progress {...args} />
    </div>
  ),
}

export const WithLabel: Story = {
  args: {
    label: 'Loading...',
    value: 75,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Progress {...args} />
    </div>
  ),
}

export const WithValue: Story = {
  args: {
    label: 'Progress',
    value: 60,
    showValue: true,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Progress {...args} />
    </div>
  ),
}

export const CustomMax: Story = {
  args: {
    label: 'Usage',
    value: 7,
    maxValue: 10,
    showValue: true,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Progress {...args} />
    </div>
  ),
}

export const Indeterminate: Story = {
  args: {
    label: 'Loading...',
    isIndeterminate: true,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Progress {...args} />
    </div>
  ),
}

export const Colors: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Progress value={80} color="default" />
      <Progress value={80} color="blue" />
      <Progress value={30} color="red" />
      <Progress value={60} color="orange" />
      <Progress value={90} color="green" />
    </div>
  ),
}

export const Sizes: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Progress value={60} size="sm" label="Small" />
      <Progress value={60} size="md" label="Medium (default)" />
      <Progress value={60} size="lg" label="Large" />
    </div>
  ),
}

export const AllStates: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.allStates)}>
      <Progress value={50} />
      <Progress value={75} label="With label" />
      <Progress value={60} label="With value" showValue />
      <Progress value={80} color="blue" label="Blue" />
      <Progress value={30} color="red" label="Red" />
      <Progress value={60} color="orange" label="Orange" />
      <Progress value={90} color="green" label="Green" />
    </div>
  ),
}
