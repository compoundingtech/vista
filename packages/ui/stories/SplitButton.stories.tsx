import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { SplitButton, SplitButtonMenuItem } from '../src/components/SplitButton/SplitButton.tsx'

const meta = {
  title: 'Components/SplitButton',
  component: SplitButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'error'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof SplitButton>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  variants: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
})

export const Default: Story = {
  args: {
    children: 'Deploy',
    menuItems: (
      <>
        <SplitButtonMenuItem>Deploy to Production</SplitButtonMenuItem>
        <SplitButtonMenuItem>Deploy to Staging</SplitButtonMenuItem>
        <SplitButtonMenuItem>Deploy to Preview</SplitButtonMenuItem>
      </>
    ),
  },
}

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Save',
    menuItems: (
      <>
        <SplitButtonMenuItem>Save as Draft</SplitButtonMenuItem>
        <SplitButtonMenuItem>Save and Publish</SplitButtonMenuItem>
        <SplitButtonMenuItem>Save and Close</SplitButtonMenuItem>
      </>
    ),
  },
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Export',
    menuItems: (
      <>
        <SplitButtonMenuItem>Export as PDF</SplitButtonMenuItem>
        <SplitButtonMenuItem>Export as CSV</SplitButtonMenuItem>
        <SplitButtonMenuItem>Export as JSON</SplitButtonMenuItem>
      </>
    ),
  },
}

export const Tertiary: Story = {
  args: {
    variant: 'tertiary',
    children: 'Share',
    menuItems: (
      <>
        <SplitButtonMenuItem>Copy Link</SplitButtonMenuItem>
        <SplitButtonMenuItem>Email</SplitButtonMenuItem>
        <SplitButtonMenuItem>Twitter</SplitButtonMenuItem>
      </>
    ),
  },
}

export const Error: Story = {
  args: {
    variant: 'error',
    children: 'Delete',
    menuItems: (
      <>
        <SplitButtonMenuItem>Delete Selected</SplitButtonMenuItem>
        <SplitButtonMenuItem variant="danger">Delete All</SplitButtonMenuItem>
      </>
    ),
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Action',
    menuItems: (
      <>
        <SplitButtonMenuItem>Option 1</SplitButtonMenuItem>
        <SplitButtonMenuItem>Option 2</SplitButtonMenuItem>
      </>
    ),
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Action',
    menuItems: (
      <>
        <SplitButtonMenuItem>Option 1</SplitButtonMenuItem>
        <SplitButtonMenuItem>Option 2</SplitButtonMenuItem>
      </>
    ),
  },
}

export const WithSuffixes: Story = {
  args: {
    children: 'Create',
    menuItems: (
      <>
        <SplitButtonMenuItem suffix="⌘N">New Project</SplitButtonMenuItem>
        <SplitButtonMenuItem suffix="⌘⇧N">New Folder</SplitButtonMenuItem>
        <SplitButtonMenuItem suffix="⌘I">Import</SplitButtonMenuItem>
      </>
    ),
  },
}

export const WithDangerItem: Story = {
  args: {
    children: 'Actions',
    menuItems: (
      <>
        <SplitButtonMenuItem>Edit</SplitButtonMenuItem>
        <SplitButtonMenuItem>Duplicate</SplitButtonMenuItem>
        <SplitButtonMenuItem variant="danger">Delete</SplitButtonMenuItem>
      </>
    ),
  },
}

export const Disabled: Story = {
  args: {
    children: 'Deploy',
    isPrimaryDisabled: true,
    isDropdownDisabled: true,
    menuItems: (
      <>
        <SplitButtonMenuItem>Deploy to Production</SplitButtonMenuItem>
        <SplitButtonMenuItem>Deploy to Staging</SplitButtonMenuItem>
      </>
    ),
  },
}

export const AllVariants: Story = {
  args: {
    children: null,
    menuItems: null,
  },
  render: () => (
    <div {...stylex.props(storyStyles.variants)}>
      <SplitButton
        variant="primary"
        menuItems={
          <>
            <SplitButtonMenuItem>Option 1</SplitButtonMenuItem>
            <SplitButtonMenuItem>Option 2</SplitButtonMenuItem>
          </>
        }
      >
        Primary
      </SplitButton>
      <SplitButton
        variant="secondary"
        menuItems={
          <>
            <SplitButtonMenuItem>Option 1</SplitButtonMenuItem>
            <SplitButtonMenuItem>Option 2</SplitButtonMenuItem>
          </>
        }
      >
        Secondary
      </SplitButton>
      <SplitButton
        variant="tertiary"
        menuItems={
          <>
            <SplitButtonMenuItem>Option 1</SplitButtonMenuItem>
            <SplitButtonMenuItem>Option 2</SplitButtonMenuItem>
          </>
        }
      >
        Tertiary
      </SplitButton>
      <SplitButton
        variant="error"
        menuItems={
          <>
            <SplitButtonMenuItem>Option 1</SplitButtonMenuItem>
            <SplitButtonMenuItem>Option 2</SplitButtonMenuItem>
          </>
        }
      >
        Error
      </SplitButton>
    </div>
  ),
}
