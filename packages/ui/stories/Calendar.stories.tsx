import { today, getLocalTimeZone } from '@internationalized/date'
import type { Meta, StoryObj } from '@storybook/react'
import type { ComponentProps } from 'react'

import { Calendar, RangeCalendar } from '../src/components/Calendar/Calendar.tsx'

const todayValue = () =>
  today(getLocalTimeZone()) as unknown as NonNullable<
    ComponentProps<typeof Calendar>['defaultValue']
  >

const meta = {
  title: 'Components/Calendar',
  component: Calendar,
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
} satisfies Meta<typeof Calendar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Small: Story = {
  args: {
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
  },
}

export const WithDefaultValue: Story = {
  args: {
    defaultValue: todayValue(),
  },
}

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
}

export const ReadOnly: Story = {
  args: {
    isReadOnly: true,
    defaultValue: todayValue(),
  },
}

export const WithError: Story = {
  args: {
    errorMessage: 'Please select a valid date',
  },
}

export const RangeSelection: StoryObj<typeof RangeCalendar> = {
  render: (args) => <RangeCalendar {...args} />,
  args: {
    'aria-label': 'Select date range',
  },
}

export const RangeSelectionSmall: StoryObj<typeof RangeCalendar> = {
  render: (args) => <RangeCalendar {...args} />,
  args: {
    size: 'sm',
    'aria-label': 'Select date range',
  },
}

export const RangeSelectionLarge: StoryObj<typeof RangeCalendar> = {
  render: (args) => <RangeCalendar {...args} />,
  args: {
    size: 'lg',
    'aria-label': 'Select date range',
  },
}
