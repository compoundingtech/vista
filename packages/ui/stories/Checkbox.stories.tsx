import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Checkbox } from '../src/components/Checkbox/mod.ts'

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    isDisabled: {
      control: 'boolean',
    },
    isIndeterminate: {
      control: 'boolean',
    },
    isSelected: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
})

export const Default: Story = {
  args: {
    children: 'Option 1',
  },
}

export const Checked: Story = {
  args: {
    children: 'Checked option',
    defaultSelected: true,
  },
}

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    isDisabled: true,
  },
}

export const DisabledChecked: Story = {
  args: {
    children: 'Disabled Checked',
    isDisabled: true,
    defaultSelected: true,
  },
}

export const Indeterminate: Story = {
  args: {
    children: 'Indeterminate',
    isIndeterminate: true,
  },
}

export const DisabledIndeterminate: Story = {
  args: {
    children: 'Disabled Indeterminate',
    isDisabled: true,
    isIndeterminate: true,
  },
}

export const WithoutLabel: Story = {
  args: {},
}

export const AllStates: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Checkbox>Unchecked</Checkbox>
      <Checkbox defaultSelected>Checked</Checkbox>
      <Checkbox isIndeterminate>Indeterminate</Checkbox>
      <Checkbox isDisabled>Disabled</Checkbox>
      <Checkbox isDisabled defaultSelected>
        Disabled Checked
      </Checkbox>
      <Checkbox isDisabled isIndeterminate>
        Disabled Indeterminate
      </Checkbox>
    </div>
  ),
}
