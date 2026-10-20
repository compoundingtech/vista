import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Textarea } from '../src/components/Textarea/mod.ts'

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    resize: {
      control: 'select',
      options: ['none', 'vertical', 'horizontal', 'both'],
    },
    isDisabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  width400: {
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
    placeholder: 'Enter your message...',
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Textarea {...args} />
    </div>
  ),
}

export const WithLabel: Story = {
  args: {
    label: 'Message',
    placeholder: 'Enter your message...',
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Textarea {...args} />
    </div>
  ),
}

export const WithValue: Story = {
  args: {
    label: 'Description',
    defaultValue:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Textarea {...args} />
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    placeholder:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    isDisabled: true,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Textarea {...args} />
    </div>
  ),
}

export const WithError: Story = {
  args: {
    defaultValue:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    errorMessage: 'There has been an error.',
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Textarea {...args} />
    </div>
  ),
}

export const Resizable: Story = {
  args: {
    placeholder: 'This textarea can be resized vertically...',
    resize: 'vertical',
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Textarea {...args} />
    </div>
  ),
}

export const WithRows: Story = {
  args: {
    label: 'Short feedback',
    placeholder: 'Enter brief feedback...',
    rows: 3,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width400)}>
      <Textarea {...args} />
    </div>
  ),
}

export const AllStates: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.allStates)}>
      <Textarea placeholder="Default" />
      <Textarea label="With label" placeholder="Enter text..." />
      <Textarea placeholder="Disabled textarea" isDisabled />
      <Textarea
        defaultValue="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
        errorMessage="There has been an error."
      />
      <Textarea placeholder="Resizable (vertical)" resize="vertical" />
    </div>
  ),
}
