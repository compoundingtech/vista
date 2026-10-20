import type { Meta, StoryObj } from '@storybook/react'

import { Badge } from '../src/components/Badge/Badge.tsx'

const meta = {
  title: 'Components/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'gray',
        'gray-subtle',
        'blue',
        'blue-subtle',
        'purple',
        'purple-subtle',
        'amber',
        'amber-subtle',
        'red',
        'red-subtle',
        'pink',
        'pink-subtle',
        'green',
        'green-subtle',
        'teal',
        'teal-subtle',
        'inverted',
      ],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Badge',
  },
}

export const Blue: Story = {
  args: {
    children: 'Blue',
    variant: 'blue',
  },
}

export const BlueSubtle: Story = {
  args: {
    children: 'Blue Subtle',
    variant: 'blue-subtle',
  },
}

export const Green: Story = {
  args: {
    children: 'Success',
    variant: 'green',
  },
}

export const Red: Story = {
  args: {
    children: 'Error',
    variant: 'red',
  },
}

export const Amber: Story = {
  args: {
    children: 'Warning',
    variant: 'amber',
  },
}

export const Small: Story = {
  args: {
    children: 'SM',
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    children: 'Large Badge',
    size: 'lg',
  },
}

export const Inverted: Story = {
  args: {
    children: 'Inverted',
    variant: 'inverted',
  },
}
