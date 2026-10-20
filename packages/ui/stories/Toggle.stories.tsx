import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Toggle } from '../src/components/Toggle/mod.ts'

const meta = {
  title: 'Components/Toggle',
  component: Toggle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
    isDisabled: {
      control: 'boolean',
    },
    isSelected: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Toggle>

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
})

export const Default: Story = {
  args: {
    label: 'Enable Firewall',
  },
}

export const Selected: Story = {
  args: {
    label: 'Enable Firewall',
    defaultSelected: true,
  },
}

export const Disabled: Story = {
  args: {
    label: 'Enable Firewall',
    isDisabled: true,
  },
}

export const DisabledSelected: Story = {
  args: {
    label: 'Enable Firewall',
    defaultSelected: true,
    isDisabled: true,
  },
}

export const Sizes: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Toggle size="sm" label="Small toggle" />
      <Toggle size="md" label="Medium toggle" />
    </div>
  ),
}

export const WithoutLabel: Story = {
  args: {
    'aria-label': 'Enable Firewall',
  },
}

export const AllStates: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <div {...stylex.props(storyStyles.row)}>
        <Toggle label="Unchecked" />
        <Toggle label="Checked" defaultSelected />
      </div>
      <div {...stylex.props(storyStyles.row)}>
        <Toggle label="Disabled unchecked" isDisabled />
        <Toggle label="Disabled checked" defaultSelected isDisabled />
      </div>
    </div>
  ),
}
