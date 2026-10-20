import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Radio, RadioGroup } from '../src/components/Radio/mod.ts'

const meta = {
  title: 'Components/Radio',
  component: RadioGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RadioGroup>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
})

export const Default: Story = {
  args: {
    label: 'Default Radio Example',
    children: (
      <>
        <Radio value="option1">Option 1</Radio>
        <Radio value="option2">Option 2</Radio>
      </>
    ),
  },
}

export const WithDefaultValue: Story = {
  args: {
    label: 'Select an option',
    defaultValue: 'option1',
    children: (
      <>
        <Radio value="option1">Option 1</Radio>
        <Radio value="option2">Option 2</Radio>
      </>
    ),
  },
}

export const Disabled: Story = {
  args: {
    label: 'Disabled Radio Example',
    isDisabled: true,
    defaultValue: 'option1',
    children: (
      <>
        <Radio value="option1">Option 1</Radio>
        <Radio value="option2">Option 2</Radio>
      </>
    ),
  },
}

export const Required: Story = {
  args: {
    label: 'Required Radio Example',
    isRequired: true,
    children: (
      <>
        <Radio value="option1">Option 1</Radio>
        <Radio value="option2">Option 2</Radio>
      </>
    ),
  },
}

export const WithoutLabel: Story = {
  args: {
    'aria-label': 'Choose an option',
    children: (
      <>
        <Radio value="option1">Option 1</Radio>
        <Radio value="option2">Option 2</Radio>
      </>
    ),
  },
}

export const ManyOptions: Story = {
  args: {
    label: 'Select your favorite',
    children: (
      <>
        <Radio value="apple">Apple</Radio>
        <Radio value="banana">Banana</Radio>
        <Radio value="cherry">Cherry</Radio>
        <Radio value="date">Date</Radio>
      </>
    ),
  },
}

export const AllStates: Story = {
  args: {
    children: null as unknown as React.ReactNode,
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <RadioGroup label="Default" defaultValue="option1">
        <Radio value="option1">Option 1</Radio>
        <Radio value="option2">Option 2</Radio>
      </RadioGroup>

      <RadioGroup label="Disabled" isDisabled defaultValue="option1">
        <Radio value="option1">Option 1</Radio>
        <Radio value="option2">Option 2</Radio>
      </RadioGroup>
    </div>
  ),
}
