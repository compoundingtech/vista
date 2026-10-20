import type { Meta, StoryObj } from '@storybook/react'

import { Button } from '../src/components/Button/Button.tsx'

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'error', 'warning'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    shape: {
      control: 'select',
      options: ['default', 'rounded', 'square'],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    children: 'Button',
    variant: 'primary',
  },
}

export const Secondary: Story = {
  args: {
    children: 'Button',
    variant: 'secondary',
  },
}

export const Tertiary: Story = {
  args: {
    children: 'Button',
    variant: 'tertiary',
  },
}

export const Error: Story = {
  args: {
    children: 'Delete',
    variant: 'error',
  },
}

export const Warning: Story = {
  args: {
    children: 'Warning',
    variant: 'warning',
  },
}

export const Small: Story = {
  args: {
    children: 'Small',
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    children: 'Large',
    size: 'lg',
  },
}

export const Rounded: Story = {
  args: {
    children: 'Rounded',
    shape: 'rounded',
  },
}

export const Square: Story = {
  args: {
    children: '+',
    shape: 'square',
  },
}

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    isDisabled: true,
  },
}
