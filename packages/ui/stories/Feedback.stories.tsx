import type { Meta, StoryObj } from '@storybook/react'

import { Feedback } from '../src/components/Feedback/Feedback.tsx'

const meta = {
  title: 'Components/Feedback',
  component: Feedback,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    compact: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Feedback>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'How was your experience?',
    placeholder: 'Share your thoughts...',
    hint: 'Your feedback helps us improve',
  },
}

export const Compact: Story = {
  args: {
    title: 'Quick feedback',
    placeholder: 'Your feedback...',
    compact: true,
  },
}

export const WithCustomEmojis: Story = {
  args: {
    title: 'Rate this feature',
    emojis: [
      { value: 'terrible', emoji: '😡', label: 'Terrible' },
      { value: 'bad', emoji: '😕', label: 'Bad' },
      { value: 'okay', emoji: '😐', label: 'Okay' },
      { value: 'good', emoji: '🙂', label: 'Good' },
      { value: 'amazing', emoji: '😍', label: 'Amazing' },
    ],
  },
}

export const WithSelectedEmoji: Story = {
  args: {
    title: 'How was your experience?',
    selectedEmoji: 'happy',
  },
}

export const Loading: Story = {
  args: {
    title: 'Submitting feedback',
    isLoading: true,
    textValue: 'Great experience overall!',
    selectedEmoji: 'excited',
  },
}

export const SubmitDisabled: Story = {
  args: {
    title: 'Feedback',
    isSubmitDisabled: true,
  },
}

export const CustomSubmitText: Story = {
  args: {
    title: 'Share your thoughts',
    submitText: 'Submit Feedback',
  },
}

export const WithHeaderContent: Story = {
  args: {
    title: 'Feedback',
    headerContent: (
      <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'gray' }}>Optional</span>
    ),
  },
}

export const NoTitle: Story = {
  args: {
    placeholder: 'Tell us what you think...',
    hint: 'We read every response',
  },
}
