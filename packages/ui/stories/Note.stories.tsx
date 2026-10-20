import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Note } from '../src/components/Note/mod.ts'

const meta = {
  title: 'Components/Note',
  component: Note,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'error', 'warning', 'secondary', 'violet', 'cyan'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    fill: {
      control: 'boolean',
    },
    hideIcon: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Note>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: '400px',
  },
})

export const Default: Story = {
  args: {
    children: 'A default note.',
  },
}

export const Success: Story = {
  args: {
    children: 'This note details some success information.',
    variant: 'success',
  },
}

export const Error: Story = {
  args: {
    children: 'This note details some error information.',
    variant: 'error',
  },
}

export const Warning: Story = {
  args: {
    children: 'This note details some warning information.',
    variant: 'warning',
  },
}

export const AllVariants: Story = {
  args: { children: 'Note' },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Note variant="default">A default note.</Note>
      <Note variant="success">This note details some success information.</Note>
      <Note variant="error">This note details some error information.</Note>
      <Note variant="warning">This note details some warning information.</Note>
      <Note variant="secondary">This note details some secondary information.</Note>
      <Note variant="violet">This note details some violet information.</Note>
      <Note variant="cyan">This note details some cyan information.</Note>
    </div>
  ),
}

export const FilledVariants: Story = {
  args: { children: 'Note' },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Note variant="default" fill>
        A filled default note.
      </Note>
      <Note variant="success" fill>
        This filled note details some success information.
      </Note>
      <Note variant="error" fill>
        This filled note details some error information.
      </Note>
      <Note variant="warning" fill>
        This filled note details some warning information.
      </Note>
      <Note variant="secondary" fill>
        This filled note details some secondary information.
      </Note>
      <Note variant="violet" fill>
        This filled note details some violet information.
      </Note>
      <Note variant="cyan" fill>
        This filled note details some cyan information.
      </Note>
    </div>
  ),
}

export const Sizes: Story = {
  args: { children: 'Note' },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Note size="sm">A small note.</Note>
      <Note size="md">A default note.</Note>
      <Note size="lg">A large note.</Note>
    </div>
  ),
}

export const WithoutIcon: Story = {
  args: {
    children: 'A note without an icon.',
    hideIcon: true,
  },
}

export const ComparisonOutlineVsFill: Story = {
  args: { children: 'Note' },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Note variant="success">Outline: Success note</Note>
      <Note variant="success" fill>
        Filled: Success note
      </Note>
      <Note variant="error">Outline: Error note</Note>
      <Note variant="error" fill>
        Filled: Error note
      </Note>
    </div>
  ),
}
