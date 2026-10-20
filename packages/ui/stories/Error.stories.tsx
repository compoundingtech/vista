import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Error } from '../src/components/Error/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Error',
  component: Error,
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
} satisfies Meta<typeof Error>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  link: {
    color: 'inherit',
    textDecorationLine: {
      default: 'underline',
      ':hover': {
        default: 'underline',
        '@media (hover: hover)': 'none',
      },
    },
  },
  sizes: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  states: {
    display: 'flex',
    flexDirection: 'column',
    width: '350px',
    gap: '2rem',
  },
  label: {
    margin: 0,
    marginBottom: '1rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  sizeStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
})

export const Default: Story = {
  args: {
    children: 'This email address is already in use.',
  },
}

export const WithLabel: Story = {
  args: {
    label: 'Email Error:',
    children: 'This email address is already in use.',
  },
}

export const NoIcon: Story = {
  args: {
    children: 'This email address is already in use.',
    hideIcon: true,
  },
}

export const WithLink: Story = {
  args: {
    children: (
      <>
        The request failed.{' '}
        <a href="https://vercel.com/contact" {...stylex.props(storyStyles.link)}>
          Contact Us
        </a>
      </>
    ),
  },
}

export const Sizes: Story = {
  args: {
    children: 'This email is in use.',
  },
  render: () => (
    <div {...stylex.props(storyStyles.sizes)}>
      <Error size="small">This email is in use.</Error>
      <Error size="default">This email is in use.</Error>
      <Error size="large">This email is in use.</Error>
    </div>
  ),
}

export const AllStates: Story = {
  args: {
    children: 'This email address is already in use.',
  },
  render: () => (
    <div {...stylex.props(storyStyles.states)}>
      <div>
        <p {...stylex.props(storyStyles.label)}>Default</p>
        <Error>This email address is already in use.</Error>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>With Custom Label</p>
        <Error label="Email Error:">This email address is already in use.</Error>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>Without Icon</p>
        <Error hideIcon>This email address is already in use.</Error>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>With Link</p>
        <Error>
          The request failed.{' '}
          <a href="#" {...stylex.props(storyStyles.link)}>
            Contact Us
          </a>
        </Error>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>Sizes</p>
        <div {...stylex.props(storyStyles.sizeStack)}>
          <Error size="small">Small error message</Error>
          <Error size="default">Default error message</Error>
          <Error size="large">Large error message</Error>
        </div>
      </div>
    </div>
  ),
}
