import type { Meta, StoryObj } from '@storybook/react'

import { Scroller } from '../src/components/Scroller/Scroller.tsx'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta: Meta<typeof Scroller> = {
  title: 'Components/Scroller',
  component: Scroller,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    direction: {
      control: 'select',
      options: ['horizontal', 'vertical', 'both'],
    },
    shadowIntensity: {
      control: 'select',
      options: ['subtle', 'normal', 'strong'],
    },
    snap: {
      control: 'select',
      options: ['none', 'start', 'center'],
    },
    gap: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

const Card = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      minWidth: '200px',
      padding: '24px',
      background: tokens['--ds-gray-100'],
      borderRadius: '8px',
      border: `1px solid ${tokens['--ds-gray-alpha-400']}`,
      textAlign: 'center',
    }}
  >
    {children}
  </div>
)

export const Horizontal: Story = {
  render: (args) => (
    <Scroller {...args} width={600}>
      <Card>Card 1</Card>
      <Card>Card 2</Card>
      <Card>Card 3</Card>
      <Card>Card 4</Card>
      <Card>Card 5</Card>
      <Card>Card 6</Card>
    </Scroller>
  ),
  args: {
    direction: 'horizontal',
    gap: 'md',
  },
}

export const Vertical: Story = {
  render: (args) => (
    <Scroller {...args} height={300}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '16px',
            background: tokens['--ds-gray-100'],
            borderRadius: '8px',
            border: `1px solid ${tokens['--ds-gray-alpha-400']}`,
          }}
        >
          Item {i + 1}
        </div>
      ))}
    </Scroller>
  ),
  args: {
    direction: 'vertical',
    gap: 'sm',
  },
}

export const WithSnap: Story = {
  render: (args) => (
    <Scroller {...args} width={600}>
      <Card>Card 1</Card>
      <Card>Card 2</Card>
      <Card>Card 3</Card>
      <Card>Card 4</Card>
      <Card>Card 5</Card>
    </Scroller>
  ),
  args: {
    direction: 'horizontal',
    snap: 'start',
    gap: 'md',
  },
}

export const CenterSnap: Story = {
  render: (args) => (
    <Scroller {...args} width={600}>
      <Card>Card 1</Card>
      <Card>Card 2</Card>
      <Card>Card 3</Card>
      <Card>Card 4</Card>
      <Card>Card 5</Card>
    </Scroller>
  ),
  args: {
    direction: 'horizontal',
    snap: 'center',
    gap: 'md',
  },
}

export const SubtleShadows: Story = {
  render: (args) => (
    <Scroller {...args} width={600}>
      <Card>Card 1</Card>
      <Card>Card 2</Card>
      <Card>Card 3</Card>
      <Card>Card 4</Card>
      <Card>Card 5</Card>
    </Scroller>
  ),
  args: {
    direction: 'horizontal',
    shadowIntensity: 'subtle',
    gap: 'md',
  },
}

export const StrongShadows: Story = {
  render: (args) => (
    <Scroller {...args} width={600}>
      <Card>Card 1</Card>
      <Card>Card 2</Card>
      <Card>Card 3</Card>
      <Card>Card 4</Card>
      <Card>Card 5</Card>
    </Scroller>
  ),
  args: {
    direction: 'horizontal',
    shadowIntensity: 'strong',
    gap: 'md',
  },
}

export const HiddenScrollbar: Story = {
  render: (args) => (
    <Scroller {...args} width={600}>
      <Card>Card 1</Card>
      <Card>Card 2</Card>
      <Card>Card 3</Card>
      <Card>Card 4</Card>
      <Card>Card 5</Card>
    </Scroller>
  ),
  args: {
    direction: 'horizontal',
    hideScrollbar: true,
    gap: 'md',
  },
}

export const NoShadows: Story = {
  render: (args) => (
    <Scroller {...args} width={600}>
      <Card>Card 1</Card>
      <Card>Card 2</Card>
      <Card>Card 3</Card>
      <Card>Card 4</Card>
      <Card>Card 5</Card>
    </Scroller>
  ),
  args: {
    direction: 'horizontal',
    showShadows: false,
    gap: 'md',
  },
}

export const LargeGap: Story = {
  render: (args) => (
    <Scroller {...args} width={600}>
      <Card>Card 1</Card>
      <Card>Card 2</Card>
      <Card>Card 3</Card>
      <Card>Card 4</Card>
    </Scroller>
  ),
  args: {
    direction: 'horizontal',
    gap: 'lg',
  },
}
