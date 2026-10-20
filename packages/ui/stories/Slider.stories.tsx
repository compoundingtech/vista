import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Slider } from '../src/components/Slider/mod.ts'

const meta = {
  title: 'Components/Slider',
  component: Slider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    isDisabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Slider>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  width300: {
    width: '300px',
  },
  allStates: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    width: '300px',
  },
})

export const Default: Story = {
  args: {
    defaultValue: 50,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width300)}>
      <Slider {...args} />
    </div>
  ),
}

export const WithLabel: Story = {
  args: {
    label: 'Volume',
    defaultValue: 70,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width300)}>
      <Slider {...args} />
    </div>
  ),
}

export const WithOutput: Story = {
  args: {
    label: 'Brightness',
    defaultValue: 50,
    showOutput: true,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width300)}>
      <Slider {...args} />
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    defaultValue: 30,
    isDisabled: true,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width300)}>
      <Slider {...args} />
    </div>
  ),
}

export const CustomRange: Story = {
  args: {
    label: 'Temperature',
    minValue: 0,
    maxValue: 40,
    defaultValue: 22,
    showOutput: true,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width300)}>
      <Slider {...args} />
    </div>
  ),
}

export const WithStep: Story = {
  args: {
    label: 'Rating',
    minValue: 1,
    maxValue: 5,
    step: 1,
    defaultValue: 3,
    showOutput: true,
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.width300)}>
      <Slider {...args} />
    </div>
  ),
}

export const AllStates: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.allStates)}>
      <Slider defaultValue={50} />
      <Slider label="With label" defaultValue={70} />
      <Slider label="With output" defaultValue={50} showOutput />
      <Slider label="Disabled" defaultValue={30} isDisabled />
      <Slider
        label="Custom range (0-100%)"
        minValue={0}
        maxValue={100}
        defaultValue={75}
        showOutput
      />
    </div>
  ),
}
