import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Kbd, KeySymbols } from '../src/components/Kbd/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Kbd',
  component: Kbd,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'default'],
    },
  },
} satisfies Meta<typeof Kbd>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  row: {
    display: 'flex',
    gap: '0.5rem',
  },
  centeredRow: {
    alignItems: 'center',
  },
  tightRow: {
    display: 'flex',
    gap: '0.25rem',
  },
  stack: {
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
  shortcutStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  shortcutLabel: {
    marginLeft: '0.5rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  mutedText: {
    color: tokens['--ds-gray-900'],
  },
})

export const Default: Story = {
  args: {
    children: 'K',
  },
}

export const Modifiers: Story = {
  args: {
    children: KeySymbols.command,
  },
  render: () => (
    <div {...stylex.props(storyStyles.row)}>
      <Kbd>{KeySymbols.command}</Kbd>
      <Kbd>{KeySymbols.shift}</Kbd>
      <Kbd>{KeySymbols.option}</Kbd>
      <Kbd>{KeySymbols.control}</Kbd>
    </div>
  ),
}

export const Combination: Story = {
  args: {
    children: `${KeySymbols.command}K`,
  },
  render: () => (
    <div {...stylex.props(storyStyles.row, storyStyles.centeredRow)}>
      <Kbd>{KeySymbols.command}</Kbd>
      <span {...stylex.props(storyStyles.mutedText)}>+</span>
      <Kbd>K</Kbd>
    </div>
  ),
}

export const SingleKey: Story = {
  args: {
    children: '/',
  },
}

export const Small: Story = {
  args: {
    children: '/',
    size: 'small',
  },
}

export const SmallModifiers: Story = {
  args: {
    children: KeySymbols.command,
    size: 'small',
  },
  render: () => (
    <div {...stylex.props(storyStyles.tightRow)}>
      <Kbd size="small">{KeySymbols.command}</Kbd>
      <Kbd size="small">K</Kbd>
    </div>
  ),
}

export const ArrowKeys: Story = {
  args: {
    children: KeySymbols.up,
  },
  render: () => (
    <div {...stylex.props(storyStyles.row)}>
      <Kbd>{KeySymbols.up}</Kbd>
      <Kbd>{KeySymbols.down}</Kbd>
      <Kbd>{KeySymbols.left}</Kbd>
      <Kbd>{KeySymbols.right}</Kbd>
    </div>
  ),
}

export const SpecialKeys: Story = {
  args: {
    children: KeySymbols.enter,
  },
  render: () => (
    <div {...stylex.props(storyStyles.row)}>
      <Kbd>{KeySymbols.enter}</Kbd>
      <Kbd>{KeySymbols.backspace}</Kbd>
      <Kbd>{KeySymbols.escape}</Kbd>
      <Kbd>{KeySymbols.tab}</Kbd>
    </div>
  ),
}

export const AllStates: Story = {
  args: {
    children: 'K',
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Default Size</p>
        <div {...stylex.props(storyStyles.row)}>
          <Kbd>{KeySymbols.command}</Kbd>
          <Kbd>{KeySymbols.shift}</Kbd>
          <Kbd>{KeySymbols.option}</Kbd>
          <Kbd>{KeySymbols.control}</Kbd>
          <Kbd>K</Kbd>
        </div>
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Small Size</p>
        <div {...stylex.props(storyStyles.tightRow)}>
          <Kbd size="small">{KeySymbols.command}</Kbd>
          <Kbd size="small">{KeySymbols.shift}</Kbd>
          <Kbd size="small">{KeySymbols.option}</Kbd>
          <Kbd size="small">{KeySymbols.control}</Kbd>
          <Kbd size="small">K</Kbd>
        </div>
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Common Shortcuts</p>
        <div {...stylex.props(storyStyles.shortcutStack)}>
          <div {...stylex.props(storyStyles.row, storyStyles.centeredRow)}>
            <Kbd>{KeySymbols.command}</Kbd>
            <Kbd>C</Kbd>
            <span {...stylex.props(storyStyles.shortcutLabel)}>Copy</span>
          </div>
          <div {...stylex.props(storyStyles.row, storyStyles.centeredRow)}>
            <Kbd>{KeySymbols.command}</Kbd>
            <Kbd>V</Kbd>
            <span {...stylex.props(storyStyles.shortcutLabel)}>Paste</span>
          </div>
          <div {...stylex.props(storyStyles.row, storyStyles.centeredRow)}>
            <Kbd>{KeySymbols.command}</Kbd>
            <Kbd>{KeySymbols.shift}</Kbd>
            <Kbd>P</Kbd>
            <span {...stylex.props(storyStyles.shortcutLabel)}>Command Palette</span>
          </div>
        </div>
      </div>
    </div>
  ),
}
