import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Switch } from '../src/components/Switch/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Switch',
  component: Switch,
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
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  allStates: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  tightStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  width400: {
    width: '400px',
  },
  width300: {
    width: '300px',
  },
  sectionLabel: {
    margin: 0,
    marginBottom: '0.5rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
})

const defaultOptions = [
  { value: 'source', label: 'Source' },
  { value: 'output', label: 'Output' },
]

export const Default: Story = {
  args: {
    options: defaultOptions,
    defaultValue: 'source',
  },
}

export const Disabled: Story = {
  args: {
    options: defaultOptions,
    defaultValue: 'source',
    isDisabled: true,
  },
}

export const Sizes: Story = {
  args: {
    options: defaultOptions,
    defaultValue: 'source',
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Switch options={defaultOptions} defaultValue="source" size="small" />
      <Switch options={defaultOptions} defaultValue="source" size="default" />
      <Switch options={defaultOptions} defaultValue="source" size="large" />
    </div>
  ),
}

export const FullWidth: Story = {
  args: {
    options: defaultOptions,
    defaultValue: 'source',
    fullWidth: true,
  },
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Switch options={defaultOptions} defaultValue="source" fullWidth />
    </div>
  ),
}

export const ThreeOptions: Story = {
  args: {
    options: [
      { value: 'day', label: 'Day' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
    ],
    defaultValue: 'week',
  },
}

export const WithIcons: Story = {
  args: {
    options: [
      {
        value: 'grid',
        icon: (
          <svg viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        ),
        tooltip: 'Grid view',
      },
      {
        value: 'list',
        icon: (
          <svg viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="2" width="14" height="2" rx="0.5" />
            <rect x="1" y="7" width="14" height="2" rx="0.5" />
            <rect x="1" y="12" width="14" height="2" rx="0.5" />
          </svg>
        ),
        tooltip: 'List view',
      },
    ],
    defaultValue: 'grid',
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Switch
        options={[
          {
            value: 'grid',
            icon: (
              <svg viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            ),
            tooltip: 'Grid view',
          },
          {
            value: 'list',
            icon: (
              <svg viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="14" height="2" rx="0.5" />
                <rect x="1" y="12" width="14" height="2" rx="0.5" />
              </svg>
            ),
            tooltip: 'List view',
          },
        ]}
        defaultValue="grid"
        size="small"
      />
      <Switch
        options={[
          {
            value: 'grid',
            icon: (
              <svg viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            ),
            tooltip: 'Grid view',
          },
          {
            value: 'list',
            icon: (
              <svg viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="14" height="2" rx="0.5" />
                <rect x="1" y="12" width="14" height="2" rx="0.5" />
              </svg>
            ),
            tooltip: 'List view',
          },
        ]}
        defaultValue="grid"
        size="default"
      />
      <Switch
        options={[
          {
            value: 'grid',
            icon: (
              <svg viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            ),
            tooltip: 'Grid view',
          },
          {
            value: 'list',
            icon: (
              <svg viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="14" height="2" rx="0.5" />
                <rect x="1" y="12" width="14" height="2" rx="0.5" />
              </svg>
            ),
            tooltip: 'List view',
          },
        ]}
        defaultValue="grid"
        size="large"
      />
    </div>
  ),
}

export const AllStates: Story = {
  args: {
    options: defaultOptions,
    defaultValue: 'source',
  },
  render: () => (
    <div {...stylex.props(storyStyles.allStates)}>
      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Default</p>
        <Switch options={defaultOptions} defaultValue="source" />
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Disabled</p>
        <Switch options={defaultOptions} defaultValue="source" isDisabled />
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Sizes</p>
        <div {...stylex.props(storyStyles.tightStack)}>
          <Switch options={defaultOptions} defaultValue="source" size="small" />
          <Switch options={defaultOptions} defaultValue="source" size="default" />
          <Switch options={defaultOptions} defaultValue="source" size="large" />
        </div>
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Full Width</p>
        <div {...stylex.props(storyStyles.width300)}>
          <Switch options={defaultOptions} defaultValue="source" fullWidth />
        </div>
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Multiple Options</p>
        <Switch
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
          defaultValue="week"
        />
      </div>
    </div>
  ),
}
