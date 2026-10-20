import type { Meta, StoryObj } from '@storybook/react'

import { Browser } from '../src/components/Browser/Browser.tsx'

const meta = {
  title: 'Components/Browser',
  component: Browser,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    variant: {
      control: 'select',
      options: ['default', 'elevated', 'flat'],
    },
  },
} satisfies Meta<typeof Browser>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    url: 'https://example.com',
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Example Content</h1>
        <p>This is content inside the browser mockup.</p>
      </div>
    ),
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    url: 'https://example.com',
    children: (
      <div style={{ padding: '10px' }}>
        <p>Small browser</p>
      </div>
    ),
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
    url: 'https://example.com',
    children: (
      <div style={{ padding: '20px' }}>
        <h1>Large Browser</h1>
        <p>More content space available.</p>
      </div>
    ),
  },
}

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    url: 'https://example.com',
    children: (
      <div style={{ padding: '20px' }}>
        <p>Elevated shadow variant</p>
      </div>
    ),
  },
}

export const Flat: Story = {
  args: {
    variant: 'flat',
    url: 'https://example.com',
    children: (
      <div style={{ padding: '20px' }}>
        <p>Flat (no shadow) variant</p>
      </div>
    ),
  },
}

export const NoControls: Story = {
  args: {
    showControls: false,
    url: 'https://example.com',
    children: (
      <div style={{ padding: '20px' }}>
        <p>Browser without window controls</p>
      </div>
    ),
  },
}

export const NoUrlBar: Story = {
  args: {
    showUrlBar: false,
    children: (
      <div style={{ padding: '20px' }}>
        <p>Browser without URL bar</p>
      </div>
    ),
  },
}
