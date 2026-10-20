import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Snippet } from '../src/components/Snippet/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Snippet',
  component: Snippet,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'inverted', 'success', 'warning', 'error'],
    },
  },
} satisfies Meta<typeof Snippet>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  variants: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '300px',
  },
  allStates: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    width: '350px',
  },
  label: {
    margin: 0,
    marginBottom: '0.5rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  statusStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
})

export const Default: Story = {
  args: {
    text: 'npm init next-app',
    width: 300,
  },
}

export const Inverted: Story = {
  args: {
    text: 'npm init next-app',
    variant: 'inverted',
    width: 300,
  },
}

export const MultiLine: Story = {
  args: {
    text: ['cd project', 'npm install', 'npm run dev'],
    width: 300,
  },
}

export const NoPrompt: Story = {
  args: {
    text: 'npm init next-app',
    prompt: false,
    width: 300,
  },
}

export const CustomPrompt: Story = {
  args: {
    text: 'ls -la',
    promptSymbol: '>',
    width: 300,
  },
}

export const Variants: Story = {
  args: {
    text: 'npm init next-app',
    width: 300,
  },
  render: () => (
    <div {...stylex.props(storyStyles.variants)}>
      <Snippet text="npm init next-app" variant="default" />
      <Snippet text="npm init next-app" variant="inverted" />
      <Snippet text="npm init next-app" variant="success" />
      <Snippet text="npm init next-app" variant="warning" />
      <Snippet text="npm init next-app" variant="error" />
    </div>
  ),
}

export const WithCallback: Story = {
  args: {
    text: 'npm init next-app',
    width: 300,
    onCopy: () => console.log('Copied!'),
  },
}

export const AllStates: Story = {
  args: {
    text: 'npm init next-app',
  },
  render: () => (
    <div {...stylex.props(storyStyles.allStates)}>
      <div>
        <p {...stylex.props(storyStyles.label)}>Single Line</p>
        <Snippet text="npm init next-app" />
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>Multi Line</p>
        <Snippet text={['cd my-project', 'npm install', 'npm run dev']} />
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>No Prompt</p>
        <Snippet text="npm init next-app" prompt={false} />
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>Inverted</p>
        <Snippet text="npm init next-app" variant="inverted" />
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>Status Variants</p>
        <div {...stylex.props(storyStyles.statusStack)}>
          <Snippet text="Build succeeded" variant="success" prompt={false} />
          <Snippet text="Deprecation warning" variant="warning" prompt={false} />
          <Snippet text="Build failed" variant="error" prompt={false} />
        </div>
      </div>
    </div>
  ),
}
