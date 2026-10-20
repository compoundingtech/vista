import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { ThemeSwitcher } from '../src/components/ThemeSwitcher/ThemeSwitcher.tsx'

const meta = {
  title: 'Components/ThemeSwitcher',
  component: ThemeSwitcher,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'default', 'large'],
    },
  },
} satisfies Meta<typeof ThemeSwitcher>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
})

export const Default: Story = {
  args: {
    defaultValue: 'system',
  },
}

export const Small: Story = {
  args: {
    size: 'small',
    defaultValue: 'system',
  },
}

export const Large: Story = {
  args: {
    size: 'large',
    defaultValue: 'system',
  },
}

export const LightSelected: Story = {
  args: {
    defaultValue: 'light',
  },
}

export const DarkSelected: Story = {
  args: {
    defaultValue: 'dark',
  },
}

export const SystemSelected: Story = {
  args: {
    defaultValue: 'system',
  },
}

export const AllSizes: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <ThemeSwitcher size="small" defaultValue="system" />
      <ThemeSwitcher size="default" defaultValue="system" />
      <ThemeSwitcher size="large" defaultValue="system" />
    </div>
  ),
}
