import type { Meta, StoryObj } from '@storybook/react'

import { Pill } from '../src/components/Pill/Pill.tsx'

const meta: Meta<typeof Pill> = {
  title: 'Components/Pill',
  component: Pill,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['gray', 'blue', 'purple', 'amber', 'red', 'pink', 'green', 'teal'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Label',
  },
}

export const Gray: Story = {
  args: {
    children: 'Gray',
    variant: 'gray',
  },
}

export const Blue: Story = {
  args: {
    children: 'Blue',
    variant: 'blue',
  },
}

export const Purple: Story = {
  args: {
    children: 'Purple',
    variant: 'purple',
  },
}

export const Amber: Story = {
  args: {
    children: 'Amber',
    variant: 'amber',
  },
}

export const Red: Story = {
  args: {
    children: 'Red',
    variant: 'red',
  },
}

export const Pink: Story = {
  args: {
    children: 'Pink',
    variant: 'pink',
  },
}

export const Green: Story = {
  args: {
    children: 'Green',
    variant: 'green',
  },
}

export const Teal: Story = {
  args: {
    children: 'Teal',
    variant: 'teal',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      <Pill variant="gray">Gray</Pill>
      <Pill variant="blue">Blue</Pill>
      <Pill variant="purple">Purple</Pill>
      <Pill variant="amber">Amber</Pill>
      <Pill variant="red">Red</Pill>
      <Pill variant="pink">Pink</Pill>
      <Pill variant="green">Green</Pill>
      <Pill variant="teal">Teal</Pill>
    </div>
  ),
}

export const StatusLabels: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      <Pill variant="green">Active</Pill>
      <Pill variant="amber">Pending</Pill>
      <Pill variant="red">Error</Pill>
      <Pill variant="gray">Inactive</Pill>
    </div>
  ),
}

export const CategoryLabels: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      <Pill variant="blue">Frontend</Pill>
      <Pill variant="purple">Backend</Pill>
      <Pill variant="teal">DevOps</Pill>
      <Pill variant="pink">Design</Pill>
    </div>
  ),
}
