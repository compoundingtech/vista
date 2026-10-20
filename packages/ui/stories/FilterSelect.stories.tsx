import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import type { Selection } from 'react-aria-components'

import { FilterSelect, FilterSelectItem } from '../src/components/FilterSelect/mod.ts'
import { styled } from '../src/foundations/props.ts'
import { scale, tokens } from '../src/foundations/tokens.stylex.ts'

const styles = stylex.create({
  priorityDot: {
    display: 'block',
    width: '0.5rem',
    height: '0.5rem',
    borderRadius: scale.radiusFull,
  },
  priorityUrgent: {
    backgroundColor: tokens['--ds-red-700'],
  },
  priorityHigh: {
    backgroundColor: tokens['--ds-amber-700'],
  },
  priorityMedium: {
    backgroundColor: tokens['--ds-blue-700'],
  },
  priorityLow: {
    backgroundColor: tokens['--ds-gray-600'],
  },
  filters: {
    display: 'flex',
    gap: scale.space2,
  },
})

type PriorityTone = 'urgent' | 'high' | 'medium' | 'low'

const priorityToneStyles: Record<PriorityTone, stylex.StyleXStyles> = {
  urgent: styles.priorityUrgent,
  high: styles.priorityHigh,
  medium: styles.priorityMedium,
  low: styles.priorityLow,
}

const PriorityDot = ({ tone }: { tone: PriorityTone }) => (
  <span {...styled(undefined, styles.priorityDot, priorityToneStyles[tone])} />
)

const meta: Meta<typeof FilterSelect> = {
  title: 'Components/FilterSelect',
  component: FilterSelect,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <FilterSelect label="Status">
      <FilterSelectItem id="open">Open</FilterSelectItem>
      <FilterSelectItem id="in-progress">In Progress</FilterSelectItem>
      <FilterSelectItem id="done">Done</FilterSelectItem>
      <FilterSelectItem id="closed">Closed</FilterSelectItem>
    </FilterSelect>
  ),
}

const ControlledExample = () => {
  const [selected, setSelected] = useState<Selection>(new Set(['open', 'in-progress']))
  return (
    <FilterSelect label="Status" selectedKeys={selected} onSelectionChange={setSelected}>
      <FilterSelectItem id="open">Open</FilterSelectItem>
      <FilterSelectItem id="in-progress">In Progress</FilterSelectItem>
      <FilterSelectItem id="done">Done</FilterSelectItem>
      <FilterSelectItem id="closed">Closed</FilterSelectItem>
    </FilterSelect>
  )
}

export const WithSelection: Story = {
  render: () => <ControlledExample />,
}

export const WithPrefixIcons: Story = {
  render: () => (
    <FilterSelect label="Priority" defaultSelectedKeys={new Set(['p1'])}>
      <FilterSelectItem id="p0" prefix={<PriorityDot tone="urgent" />}>
        Urgent
      </FilterSelectItem>
      <FilterSelectItem id="p1" prefix={<PriorityDot tone="high" />}>
        High
      </FilterSelectItem>
      <FilterSelectItem id="p2" prefix={<PriorityDot tone="medium" />}>
        Medium
      </FilterSelectItem>
      <FilterSelectItem id="p3" prefix={<PriorityDot tone="low" />}>
        Low
      </FilterSelectItem>
    </FilterSelect>
  ),
}

export const MediumSize: Story = {
  render: () => (
    <FilterSelect label="Type" size="md">
      <FilterSelectItem id="bug">Bug</FilterSelectItem>
      <FilterSelectItem id="feature">Feature</FilterSelectItem>
      <FilterSelectItem id="task">Task</FilterSelectItem>
      <FilterSelectItem id="epic">Epic</FilterSelectItem>
    </FilterSelect>
  ),
}

export const Disabled: Story = {
  render: () => (
    <FilterSelect label="Status" isDisabled>
      <FilterSelectItem id="open">Open</FilterSelectItem>
      <FilterSelectItem id="closed">Closed</FilterSelectItem>
    </FilterSelect>
  ),
}

export const MultipleFilters: Story = {
  render: () => (
    <div {...styled(undefined, styles.filters)}>
      <FilterSelect label="Status" defaultSelectedKeys={new Set(['open'])}>
        <FilterSelectItem id="open">Open</FilterSelectItem>
        <FilterSelectItem id="in-progress">In Progress</FilterSelectItem>
        <FilterSelectItem id="done">Done</FilterSelectItem>
        <FilterSelectItem id="closed">Closed</FilterSelectItem>
      </FilterSelect>
      <FilterSelect label="Priority" defaultSelectedKeys={new Set(['p0', 'p1'])}>
        <FilterSelectItem id="p0">Urgent</FilterSelectItem>
        <FilterSelectItem id="p1">High</FilterSelectItem>
        <FilterSelectItem id="p2">Medium</FilterSelectItem>
        <FilterSelectItem id="p3">Low</FilterSelectItem>
      </FilterSelect>
      <FilterSelect label="Type">
        <FilterSelectItem id="bug">Bug</FilterSelectItem>
        <FilterSelectItem id="feature">Feature</FilterSelectItem>
        <FilterSelectItem id="task">Task</FilterSelectItem>
      </FilterSelect>
    </div>
  ),
}

export const ManyOptions: Story = {
  render: () => (
    <FilterSelect label="Assignee">
      <FilterSelectItem id="alice">Alice</FilterSelectItem>
      <FilterSelectItem id="bob">Bob</FilterSelectItem>
      <FilterSelectItem id="charlie">Charlie</FilterSelectItem>
      <FilterSelectItem id="diana">Diana</FilterSelectItem>
      <FilterSelectItem id="eve">Eve</FilterSelectItem>
      <FilterSelectItem id="frank">Frank</FilterSelectItem>
      <FilterSelectItem id="grace">Grace</FilterSelectItem>
      <FilterSelectItem id="heidi">Heidi</FilterSelectItem>
      <FilterSelectItem id="ivan">Ivan</FilterSelectItem>
      <FilterSelectItem id="judy">Judy</FilterSelectItem>
    </FilterSelect>
  ),
}
