import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { LoadingDots } from '../src/components/LoadingDots/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/LoadingDots',
  component: LoadingDots,
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
} satisfies Meta<typeof LoadingDots>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  sizeLabel: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  allStates: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  sectionLabel: {
    margin: 0,
    marginBottom: '0.5rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  sizesRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  compactStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
})

export const Default: Story = {
  args: {},
}

export const WithText: Story = {
  args: {
    children: 'Loading',
  },
}

export const Small: Story = {
  args: {
    size: 'small',
  },
}

export const Large: Story = {
  args: {
    size: 'large',
  },
}

export const Sizes: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <div {...stylex.props(storyStyles.row)}>
        <LoadingDots size="small" />
        <span {...stylex.props(storyStyles.sizeLabel)}>Small</span>
      </div>
      <div {...stylex.props(storyStyles.row)}>
        <LoadingDots size="default" />
        <span {...stylex.props(storyStyles.sizeLabel)}>Default</span>
      </div>
      <div {...stylex.props(storyStyles.row)}>
        <LoadingDots size="large" />
        <span {...stylex.props(storyStyles.sizeLabel)}>Large</span>
      </div>
    </div>
  ),
}

export const WithTextSizes: Story = {
  args: {
    children: 'Loading',
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <LoadingDots size="small">Loading</LoadingDots>
      <LoadingDots size="default">Loading</LoadingDots>
      <LoadingDots size="large">Loading</LoadingDots>
    </div>
  ),
}

export const AllStates: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.allStates)}>
      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Dots Only</p>
        <div {...stylex.props(storyStyles.sizesRow)}>
          <LoadingDots size="small" />
          <LoadingDots size="default" />
          <LoadingDots size="large" />
        </div>
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>With Label</p>
        <div {...stylex.props(storyStyles.compactStack)}>
          <LoadingDots size="small">Loading</LoadingDots>
          <LoadingDots size="default">Loading</LoadingDots>
          <LoadingDots size="large">Loading</LoadingDots>
        </div>
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Custom Labels</p>
        <div {...stylex.props(storyStyles.compactStack)}>
          <LoadingDots>Saving</LoadingDots>
          <LoadingDots>Processing</LoadingDots>
          <LoadingDots>Uploading</LoadingDots>
        </div>
      </div>
    </div>
  ),
}
