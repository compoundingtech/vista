import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Gauge, defaultGaugeColorScale } from '../src/components/Gauge/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Gauge',
  component: Gauge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['tiny', 'small', 'medium', 'large'],
    },
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
  },
} satisfies Meta<typeof Gauge>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  rowEnd: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '1.5rem',
  },
  rowCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  wrappingRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '1rem',
  },
  states: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  label: {
    margin: 0,
    marginBottom: '1rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  compactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
})

export const Default: Story = {
  args: {
    value: 60,
  },
}

export const Sizes: Story = {
  args: {
    value: 60,
  },
  render: () => (
    <div {...stylex.props(storyStyles.rowEnd)}>
      <Gauge value={60} size="tiny" />
      <Gauge value={60} size="small" />
      <Gauge value={60} size="medium" />
      <Gauge value={60} size="large" />
    </div>
  ),
}

export const WithLabel: Story = {
  args: {
    value: 80,
    showLabel: true,
  },
  render: () => (
    <div {...stylex.props(storyStyles.rowEnd)}>
      <Gauge value={80} size="small" showLabel />
      <Gauge value={100} size="small" showLabel />
      <Gauge value={80} size="medium" showLabel />
      <Gauge value={100} size="medium" showLabel />
      <Gauge value={80} size="large" showLabel />
      <Gauge value={100} size="large" showLabel />
    </div>
  ),
}

export const DefaultColorScale: Story = {
  args: {
    value: 50,
    colorScale: defaultGaugeColorScale,
  },
  render: () => (
    <div {...stylex.props(storyStyles.rowCenter)}>
      <Gauge value={20} colorScale={defaultGaugeColorScale} size="medium" />
      <Gauge value={50} colorScale={defaultGaugeColorScale} size="medium" />
      <Gauge value={80} colorScale={defaultGaugeColorScale} size="medium" />
    </div>
  ),
}

export const CustomColorRange: Story = {
  args: {
    value: 50,
  },
  render: () => {
    const customScale = [
      { limit: 20, color: tokens['--ds-red-700'] },
      { limit: 40, color: tokens['--ds-amber-700'] },
      { limit: 60, color: tokens['--ds-amber-900'] },
      { limit: 80, color: tokens['--ds-green-700'] },
      { limit: 100, color: tokens['--ds-teal-700'] },
    ]
    return (
      <div {...stylex.props(storyStyles.wrappingRow)}>
        {[10, 30, 50, 70, 90].map((v) => (
          <Gauge key={v} value={v} colorScale={customScale} showLabel />
        ))}
      </div>
    )
  },
}

export const CustomColors: Story = {
  args: {
    value: 75,
    color: tokens['--ds-blue-700'],
  },
  render: () => (
    <div {...stylex.props(storyStyles.rowCenter)}>
      <Gauge value={75} color={tokens['--ds-blue-700']} size="medium" showLabel />
      <Gauge value={75} color={tokens['--ds-purple-700']} size="medium" showLabel />
      <Gauge value={75} color={tokens['--ds-pink-700']} size="medium" showLabel />
    </div>
  ),
}

export const CustomSecondaryColor: Story = {
  args: {
    value: 60,
    trackColor: tokens['--ds-blue-200'],
    color: tokens['--ds-blue-700'],
  },
}

export const EqualArcPriority: Story = {
  args: {
    value: 50,
    showLabel: true,
    arcPriority: 'equal',
    color: tokens['--ds-amber-700'],
  },
}

export const AllStates: Story = {
  args: {
    value: 60,
  },
  render: () => (
    <div {...stylex.props(storyStyles.states)}>
      <div>
        <p {...stylex.props(storyStyles.label)}>Sizes</p>
        <div {...stylex.props(storyStyles.rowEnd)}>
          <Gauge value={60} size="tiny" />
          <Gauge value={60} size="small" />
          <Gauge value={60} size="medium" />
          <Gauge value={60} size="large" />
        </div>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>With Labels</p>
        <div {...stylex.props(storyStyles.rowEnd)}>
          <Gauge value={80} size="small" showLabel />
          <Gauge value={80} size="medium" showLabel />
          <Gauge value={80} size="large" showLabel />
        </div>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>Default Color Scale</p>
        <div {...stylex.props(storyStyles.compactRow)}>
          <Gauge value={20} colorScale={defaultGaugeColorScale} showLabel />
          <Gauge value={50} colorScale={defaultGaugeColorScale} showLabel />
          <Gauge value={80} colorScale={defaultGaugeColorScale} showLabel />
        </div>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>Custom Colors</p>
        <div {...stylex.props(storyStyles.compactRow)}>
          <Gauge value={75} color={tokens['--ds-blue-700']} showLabel />
          <Gauge value={75} color={tokens['--ds-purple-700']} showLabel />
          <Gauge value={75} color={tokens['--ds-teal-700']} showLabel />
        </div>
      </div>
    </div>
  ),
}
