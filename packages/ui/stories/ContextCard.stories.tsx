import type { Meta, StoryObj } from '@storybook/react'

import { Button } from '../src/components/Button/Button.tsx'
import { ContextCardTrigger, ContextCard } from '../src/components/ContextCard/ContextCard.tsx'

const meta = {
  title: 'Components/ContextCard',
  component: ContextCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof ContextCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <ContextCardTrigger>
      <Button>Hover me</Button>
      <ContextCard {...args} />
    </ContextCardTrigger>
  ),
  args: {
    title: 'John Doe',
    subtitle: '@johndoe',
    children: 'Software Engineer at Vercel. Building great developer experiences.',
    avatarFallback: 'JD',
    meta: 'Joined March 2023',
  },
}

export const WithAvatar: Story = {
  render: (args) => (
    <ContextCardTrigger>
      <Button>Hover me</Button>
      <ContextCard {...args} />
    </ContextCardTrigger>
  ),
  args: {
    title: 'Jane Smith',
    subtitle: 'Design Lead',
    avatarSrc: 'https://i.pravatar.cc/100?u=jane',
    children: 'Leading design at a fast-growing startup.',
  },
}

export const Small: Story = {
  render: (args) => (
    <ContextCardTrigger>
      <Button>Hover me</Button>
      <ContextCard {...args} />
    </ContextCardTrigger>
  ),
  args: {
    size: 'sm',
    title: 'Quick Info',
    subtitle: 'Compact card',
    avatarFallback: 'QI',
  },
}

export const Large: Story = {
  render: (args) => (
    <ContextCardTrigger>
      <Button>Hover me</Button>
      <ContextCard {...args} />
    </ContextCardTrigger>
  ),
  args: {
    size: 'lg',
    title: 'Detailed Profile',
    subtitle: 'Senior Software Engineer',
    avatarFallback: 'DP',
    children:
      'This is a larger context card with more space for content. Perfect for showing detailed information about a user or resource.',
    meta: 'Last active 2 hours ago',
  },
}

export const WithFooter: Story = {
  render: (args) => (
    <ContextCardTrigger>
      <Button>Hover me</Button>
      <ContextCard {...args} />
    </ContextCardTrigger>
  ),
  args: {
    title: 'Project Alpha',
    subtitle: 'Active Project',
    avatarFallback: 'PA',
    children: 'A cutting-edge project pushing the boundaries of web development.',
    footer: <Button size="sm">View Project</Button>,
  },
}

export const NoArrow: Story = {
  render: (args) => (
    <ContextCardTrigger>
      <Button>Hover me</Button>
      <ContextCard {...args} />
    </ContextCardTrigger>
  ),
  args: {
    title: 'Simple Card',
    subtitle: 'No arrow indicator',
    avatarFallback: 'SC',
    showArrow: false,
  },
}

export const ContentOnly: Story = {
  render: (args) => (
    <ContextCardTrigger>
      <Button>Hover me</Button>
      <ContextCard {...args} />
    </ContextCardTrigger>
  ),
  args: {
    children: 'This is a simple context card with just content and no header.',
  },
}
