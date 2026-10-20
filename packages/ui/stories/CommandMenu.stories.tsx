import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { Button } from '../src/components/Button/Button.tsx'
import {
  CommandMenu,
  type CommandGroup,
  type CommandMenuProps,
} from '../src/components/CommandMenu/CommandMenu.tsx'

const meta = {
  title: 'Components/CommandMenu',
  component: CommandMenu,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CommandMenu>

export default meta
type Story = StoryObj<typeof meta>

const sampleGroups: CommandGroup[] = [
  {
    id: 'navigation',
    label: 'Navigation',
    items: [
      { id: 'home', label: 'Go to Home', shortcut: ['Cmd', 'H'], keywords: ['main', 'start'] },
      {
        id: 'settings',
        label: 'Open Settings',
        shortcut: ['Cmd', ','],
        keywords: ['preferences', 'config'],
      },
      { id: 'profile', label: 'View Profile', keywords: ['user', 'account'] },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    items: [
      { id: 'new', label: 'Create New', shortcut: ['Cmd', 'N'], keywords: ['add', 'create'] },
      {
        id: 'save',
        label: 'Save Changes',
        shortcut: ['Cmd', 'S'],
        keywords: ['update', 'persist'],
      },
      {
        id: 'delete',
        label: 'Delete Item',
        shortcut: ['Cmd', 'Backspace'],
        keywords: ['remove', 'trash'],
      },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { id: 'docs', label: 'Documentation', keywords: ['help', 'guide'] },
      { id: 'support', label: 'Contact Support', keywords: ['help', 'contact'] },
    ],
  },
]

const CommandMenuDemo = ({
  groups,
  ...props
}: Omit<CommandMenuProps, 'isOpen' | 'onOpenChange'>) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onPress={() => setIsOpen(true)}>Open Command Menu (Cmd+K)</Button>
      <CommandMenu groups={groups} isOpen={isOpen} onOpenChange={setIsOpen} {...props} />
    </>
  )
}

const openCommandMenu = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  const document = canvasElement.ownerDocument

  await userEvent.click(canvas.getByRole('button', { name: 'Open Command Menu (Cmd+K)' }))

  const dialog = await within(document.body).findByRole('dialog', { name: 'Command menu' })
  const search = within(dialog).getByRole('textbox')
  // This guard prevents the visual baseline from silently becoming an
  // unfocused palette if React Aria's modal autofocus regresses.
  await expect(document.activeElement).toBe(search)
  await expect(search).toHaveFocus()

  return { dialog, search }
}

const expectDecorativeGraphicsHidden = async (dialog: HTMLElement, expectedCount: number) => {
  const graphics = dialog.querySelectorAll('svg')

  await expect(graphics).toHaveLength(expectedCount)
  for (const graphic of graphics) {
    await expect(graphic).toHaveAttribute('aria-hidden', 'true')
  }
}

export const Default: Story = {
  render: (args) => <CommandMenuDemo {...args} />,
  args: {
    groups: sampleGroups,
  },
  play: async ({ canvasElement }) => {
    const { dialog, search } = await openCommandMenu(canvasElement)

    await userEvent.type(search, 'user')

    const palette = within(dialog)
    await expectDecorativeGraphicsHidden(dialog, 1)
    await expect(palette.getByRole('option', { name: 'View Profile' })).toBeVisible()
    await expect(palette.queryByRole('option', { name: 'Go to Home' })).not.toBeInTheDocument()
    await expect(palette.getAllByRole('option')).toHaveLength(1)
  },
}

export const WithCustomPlaceholder: Story = {
  render: (args) => <CommandMenuDemo {...args} />,
  args: {
    groups: sampleGroups,
    placeholder: 'Type a command or search...',
  },
  play: async ({ canvasElement }) => {
    const { search } = await openCommandMenu(canvasElement)
    await expect(search).toHaveAttribute('placeholder', 'Type a command or search...')
  },
}

export const WithoutFooter: Story = {
  render: (args) => <CommandMenuDemo {...args} />,
  args: {
    groups: sampleGroups,
    showFooter: false,
  },
}

export const CustomEmptyState: Story = {
  render: (args) => <CommandMenuDemo {...args} />,
  args: {
    groups: sampleGroups,
    emptyTitle: 'Nothing found',
    emptyDescription: 'Try searching for something else',
  },
  play: async ({ canvasElement }) => {
    const { dialog, search } = await openCommandMenu(canvasElement)

    await userEvent.type(search, 'no possible command')

    const palette = within(dialog)
    await expectDecorativeGraphicsHidden(dialog, 2)
    await expect(palette.getByText('Nothing found')).toBeVisible()
    await expect(palette.getByText('Try searching for something else')).toBeVisible()
    await expect(palette.queryByRole('listbox', { name: 'Commands' })).not.toBeInTheDocument()
  },
}

export const WithDisabledItems: Story = {
  render: (args) => <CommandMenuDemo {...args} />,
  args: {
    groups: [
      {
        id: 'actions',
        label: 'Actions',
        items: [
          { id: 'enabled', label: 'Enabled Action' },
          { id: 'disabled', label: 'Disabled Action', disabled: true },
          { id: 'also-enabled', label: 'Also Enabled' },
        ],
      },
    ],
    onSelect: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const { dialog } = await openCommandMenu(canvasElement)
    const palette = within(dialog)
    const enabled = palette.getByRole('option', { name: 'Enabled Action' })
    const disabled = palette.getByRole('option', { name: 'Disabled Action' })
    const alsoEnabled = palette.getByRole('option', { name: 'Also Enabled' })

    await userEvent.tab()
    await expect(enabled).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(alsoEnabled).toHaveFocus()
    await expect(disabled).not.toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    await expect(enabled).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{Enter}')

    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'also-enabled', label: 'Also Enabled' }),
    )
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole('dialog', { name: 'Command menu' }),
    ).not.toBeInTheDocument()
  },
}

export const SingleGroup: Story = {
  render: (args) => <CommandMenuDemo {...args} />,
  args: {
    groups: [
      {
        id: 'quick-actions',
        label: 'Quick Actions',
        items: [
          { id: 'copy', label: 'Copy', shortcut: ['Cmd', 'C'] },
          { id: 'paste', label: 'Paste', shortcut: ['Cmd', 'V'] },
          { id: 'cut', label: 'Cut', shortcut: ['Cmd', 'X'] },
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await openCommandMenu(canvasElement)
    await userEvent.keyboard('{Escape}')
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole('dialog', { name: 'Command menu' }),
    ).not.toBeInTheDocument()
  },
}
