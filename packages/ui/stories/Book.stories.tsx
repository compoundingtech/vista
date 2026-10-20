import type { Meta, StoryObj } from '@storybook/react'

import { Book } from '../src/components/Book/Book.tsx'

const meta = {
  title: 'Components/Book',
  component: Book,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    coverColor: {
      control: 'select',
      options: ['dark', 'blue', 'purple', 'green', 'red'],
    },
  },
} satisfies Meta<typeof Book>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Open: Story = {
  args: {
    open: true,
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
  },
}

export const BlueColor: Story = {
  args: {
    coverColor: 'blue',
  },
}

export const PurpleColor: Story = {
  args: {
    coverColor: 'purple',
  },
}

export const GreenColor: Story = {
  args: {
    coverColor: 'green',
  },
}

export const RedColor: Story = {
  args: {
    coverColor: 'red',
  },
}

export const WithCoverContent: Story = {
  args: {
    coverContent: 'My Book',
  },
}

export const NonInteractive: Story = {
  args: {
    interactive: false,
    open: true,
  },
}
