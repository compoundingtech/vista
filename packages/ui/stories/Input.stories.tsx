import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { expect, userEvent, within } from 'storybook/test'

import { Input } from '../src/components/Input/mod.ts'

const meta = {
  title: 'Components/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg'],
    },
    isDisabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>
const focusInput = async (canvasElement: HTMLElement): Promise<void> => {
  await userEvent.tab()
  await expect(within(canvasElement).getByRole('textbox')).toHaveFocus()
}

const storyStyles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '300px',
  },
  icon: {
    display: 'block',
    width: '1rem',
    height: '1rem',
  },
})

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
}

export const Sizes: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Input size="xs" placeholder="Extra small" />
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Default" />
      <Input size="lg" placeholder="Large" />
    </div>
  ),
}

export const WithLabel: Story = {
  args: {
    label: 'Email',
    placeholder: 'Enter your email',
  },
}

export const WithPrefixText: Story = {
  args: {
    prefix: 'https://',
    placeholder: 'example.com',
  },
}

export const WithSuffixText: Story = {
  args: {
    suffix: '.com',
    placeholder: 'domain',
  },
}

export const WithPrefixAndSuffix: Story = {
  args: {
    prefix: 'https://',
    suffix: '.com',
    placeholder: 'example',
  },
}

/** Search icon */
const SearchIcon = () => (
  <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 16 16" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.5 7C11.5 9.48528 9.48528 11.5 7 11.5C4.51472 11.5 2.5 9.48528 2.5 7C2.5 4.51472 4.51472 2.5 7 2.5C9.48528 2.5 11.5 4.51472 11.5 7ZM10.6777 11.7849C9.6159 12.5772 8.3624 13 7 13C3.68629 13 1 10.3137 1 7C1 3.68629 3.68629 1 7 1C10.3137 1 13 3.68629 13 7C13 8.3624 12.5772 9.6159 11.7849 10.6777L14.8536 13.7464L13.7929 14.8071L10.6777 11.7849Z"
    />
  </svg>
)

export const WithPrefixIcon: Story = {
  args: {
    prefixIcon: <SearchIcon />,
    placeholder: 'Search...',
  },
}

/** Close icon */
const CloseIcon = () => (
  <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 16 16" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.4697 3.53033L8.70711 7.29289L12.4697 11.0555L11.409 12.1161L7.64645 8.35355L3.88388 12.1161L2.82322 11.0555L6.58579 7.29289L2.82322 3.53033L3.88388 2.46967L7.64645 6.23223L11.409 2.46967L12.4697 3.53033Z"
    />
  </svg>
)

export const WithSuffixIcon: Story = {
  args: {
    suffixIcon: <CloseIcon />,
    placeholder: 'Enter text...',
  },
}

export const WithBothIcons: Story = {
  args: {
    prefixIcon: <SearchIcon />,
    suffixIcon: <CloseIcon />,
    placeholder: 'Search...',
  },
}
export const TextTakesPrecedenceOverIcons: Story = {
  args: {
    prefix: 'https://',
    prefixIcon: <SearchIcon />,
    suffix: '.com',
    suffixIcon: <CloseIcon />,
    placeholder: 'example',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    isDisabled: true,
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox')
    await expect(input).toBeDisabled()
    await userEvent.tab()
    await expect(input).not.toHaveFocus()
  },
}

export const DisabledWithValue: Story = {
  args: {
    defaultValue: 'Disabled with value',
    isDisabled: true,
  },
}

export const WithError: Story = {
  args: {
    placeholder: 'Email',
    defaultValue: 'invalid-email',
    errorMessage: 'Please enter a valid email address.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox')
    await focusInput(canvasElement)
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByText('Please enter a valid email address.')).toBeVisible()
  },
}

export const Focused: Story = {
  args: {
    placeholder: 'Focused input',
  },
  play: async ({ canvasElement }) => {
    await focusInput(canvasElement)
  },
}

export const LabelWithError: Story = {
  args: {
    label: 'Email',
    defaultValue: 'invalid-email',
    errorMessage: 'Please enter a valid email address.',
  },
}

export const DisabledWithError: Story = {
  args: {
    defaultValue: 'invalid-email',
    errorMessage: 'Please enter a valid email address.',
    isDisabled: true,
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox')
    await expect(input).toBeDisabled()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
  },
}
export const AllStates: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <Input placeholder="Default" />
      <Input placeholder="With label" label="Label" />
      <Input placeholder="Disabled" isDisabled />
      <Input defaultValue="invalid@" errorMessage="Invalid email format" />
      <Input prefix="https://" suffix=".com" placeholder="domain" />
      <Input prefixIcon={<SearchIcon />} placeholder="Search..." />
    </div>
  ),
}
