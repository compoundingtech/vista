import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Toast } from '../src/components/Toast/mod.ts'
import { scale } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Toast',
  component: Toast,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Toast>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space4,
  },
  actionButton: {
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
    appearance: 'button',
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    fontFeatureSettings: 'inherit',
    fontVariationSettings: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'none',
    opacity: 1,
  },
  actionLink: {
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    color: 'inherit',
    textDecoration: 'inherit',
  },
})

export const Default: Story = {
  args: {
    children: 'The Evil Rabbit jumped over the fence.',
    onDismiss: () => console.log('dismissed'),
  },
}

export const Success: Story = {
  args: {
    children: 'Your changes have been saved successfully.',
    type: 'success',
    onDismiss: () => console.log('dismissed'),
  },
}

export const Warning: Story = {
  args: {
    children: 'Your session is about to expire.',
    type: 'warning',
    onDismiss: () => console.log('dismissed'),
  },
}

export const Error: Story = {
  args: {
    children: 'Something went wrong. Please try again.',
    type: 'error',
    onDismiss: () => console.log('dismissed'),
  },
}

export const WithAction: Story = {
  args: {
    children: 'Document deleted.',
    action: (
      <button {...stylex.props(storyStyles.actionButton)} onClick={() => console.log('undo')}>
        Undo
      </button>
    ),
    onDismiss: () => console.log('dismissed'),
  },
}

export const WithLink: Story = {
  args: {
    children: 'New version available.',
    action: (
      <a {...stylex.props(storyStyles.actionLink)} href="#">
        Learn more
      </a>
    ),
    onDismiss: () => console.log('dismissed'),
  },
}

export const NonDismissible: Story = {
  args: {
    children: 'Processing your request...',
    dismissible: false,
  },
}

export const LongContent: Story = {
  args: {
    children:
      'This is a longer toast message that demonstrates how the toast handles multi-line content gracefully.',
    onDismiss: () => console.log('dismissed'),
  },
}

export const AllStates: Story = {
  args: {
    children: 'Toast message',
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Toast onDismiss={() => {}}>Default toast message</Toast>
      <Toast type="success" onDismiss={() => {}}>
        Success! Your changes have been saved.
      </Toast>
      <Toast type="warning" onDismiss={() => {}}>
        Warning: Your session expires soon.
      </Toast>
      <Toast type="error" onDismiss={() => {}}>
        Error: Something went wrong.
      </Toast>
      <Toast
        action={<button {...stylex.props(storyStyles.actionButton)}>Undo</button>}
        onDismiss={() => {}}
      >
        Item deleted.
      </Toast>
    </div>
  ),
}
