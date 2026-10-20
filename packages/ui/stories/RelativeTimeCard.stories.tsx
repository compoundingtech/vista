import type { Meta, StoryObj } from '@storybook/react'

import { RelativeTimeCard } from '../src/components/RelativeTimeCard/RelativeTimeCard.tsx'

const now = new Date('2026-01-15T12:00:00Z')
const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

const meta: Meta<typeof RelativeTimeCard> = {
  title: 'Components/RelativeTimeCard',
  component: RelativeTimeCard,
  parameters: {
    layout: 'centered',
  },
  // Every story measures from the same fixed instant, so a capture never depends
  // on how long the page took to load (`JustNow` flips to "5s ago" otherwise).
  args: {
    now,
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'default', 'large'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const JustNow: Story = {
  args: {
    date: now,
  },
}

export const MinutesAgo: Story = {
  args: {
    date: fiveMinutesAgo,
  },
}

export const HoursAgo: Story = {
  args: {
    date: twoHoursAgo,
  },
}

export const DaysAgo: Story = {
  args: {
    date: yesterday,
  },
}

export const WeeksAgo: Story = {
  args: {
    date: lastWeek,
  },
}

export const MonthsAgo: Story = {
  args: {
    date: lastMonth,
  },
}

export const Small: Story = {
  args: {
    date: fiveMinutesAgo,
    size: 'small',
  },
}

export const Large: Story = {
  args: {
    date: fiveMinutesAgo,
    size: 'large',
  },
}

export const NoIcon: Story = {
  args: {
    date: fiveMinutesAgo,
    showIcon: false,
  },
}

export const FromTimestamp: Story = {
  args: {
    date: now.getTime() - 3600000, // 1 hour ago as timestamp
  },
}

export const FromISOString: Story = {
  args: {
    date: new Date(now.getTime() - 7200000).toISOString(), // 2 hours ago as ISO string
  },
}

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <RelativeTimeCard date={fiveMinutesAgo} now={now} size="small" />
      <RelativeTimeCard date={fiveMinutesAgo} now={now} size="default" />
      <RelativeTimeCard date={fiveMinutesAgo} now={now} size="large" />
    </div>
  ),
}
