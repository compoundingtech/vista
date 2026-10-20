import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { Button } from '../src/components/Button/mod.ts'
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuItem,
  MenuSeparator,
} from '../src/components/Menu/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'
import { expectStoryCapturePointerAwayFrom, hoverForStoryCapture } from './story-interactions.ts'

const meta = {
  title: 'Components/Menu',
  component: Menu,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Menu>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  menuStage: {
    width: '240px',
    height: '280px',
  },
  separatorStage: {
    boxSizing: 'border-box',
    width: '200px',
    padding: '8px',
    backgroundColor: tokens['--ds-background-100'],
  },
  triggerRow: {
    display: 'flex',
    gap: '1rem',
  },
})

const openMenu = async (canvasElement: HTMLElement, triggerName: string) => {
  const trigger = within(canvasElement).getByRole('button', { name: triggerName })
  await userEvent.click(trigger)

  const page = within(canvasElement.ownerDocument.body)
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()

  return { page, trigger }
}

const markPlayCompleted = (canvasElement: HTMLElement) => {
  canvasElement.dataset.menuPlay = 'completed'
}

const disabledAction = fn()
const selectionChange = fn()

export const Default: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.menuStage)}>
      <MenuTrigger>
        <Button>Actions</Button>
        <MenuPopover>
          <Menu>
            <MenuItem id="edit">Edit</MenuItem>
            <MenuItem id="duplicate">Duplicate</MenuItem>
            <MenuItem id="archive">Archive</MenuItem>
            <MenuItem id="delete" variant="danger">
              Delete
            </MenuItem>
            <MenuSeparator />
          </Menu>
        </MenuPopover>
      </MenuTrigger>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { page } = await openMenu(canvasElement, 'Actions')
    const items = page.getAllByRole('menuitem')
    await expect(items).toHaveLength(4)
    await expect(items[0]).toHaveAccessibleName('Edit')
    await expect(items[1]).toHaveAccessibleName('Duplicate')
    await expect(items[2]).toHaveAccessibleName('Archive')
    await expect(items[3]).toHaveAccessibleName('Delete')
    markPlayCompleted(canvasElement)
  },
}

export const WithIcons: Story = {
  args: {},
  render: () => (
    <MenuTrigger>
      <Button>Actions</Button>
      <MenuPopover>
        <Menu>
          <MenuItem
            prefix={
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.498 5.501a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5.5 8.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
              </svg>
            }
          >
            Edit
          </MenuItem>
          <MenuItem
            prefix={
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 4h8v8H4V4Z" />
              </svg>
            }
          >
            Duplicate
          </MenuItem>
          <MenuItem
            prefix={
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 5h12v6H2V5Z" />
              </svg>
            }
          >
            Archive
          </MenuItem>
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  ),
}

export const WithShortcuts: Story = {
  args: {},
  render: () => (
    <MenuTrigger>
      <Button>Edit</Button>
      <MenuPopover>
        <Menu>
          <MenuItem suffix="⌘X">Cut</MenuItem>
          <MenuItem suffix="⌘C">Copy</MenuItem>
          <MenuItem suffix="⌘V">Paste</MenuItem>
          <MenuSeparator />
          <MenuItem suffix="⌘A">Select All</MenuItem>
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  ),
}

export const DisabledItems: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.menuStage)}>
      <MenuTrigger>
        <Button>Actions</Button>
        <MenuPopover>
          <Menu onAction={disabledAction}>
            <MenuItem id="edit">Edit</MenuItem>
            <MenuItem id="duplicate" isDisabled>
              Duplicate
            </MenuItem>
            <MenuItem id="archive">Archive</MenuItem>
            <MenuSeparator />
            <MenuItem id="delete" variant="danger" isDisabled>
              Delete
            </MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>
    </div>
  ),
  play: async ({ canvasElement }) => {
    disabledAction.mockClear()
    const { page } = await openMenu(canvasElement, 'Actions')
    const disabledItem = page.getByRole('menuitem', { name: 'Duplicate' })

    await expect(disabledItem).toHaveAttribute('data-disabled', 'true')
    await userEvent.click(disabledItem)
    await expect(disabledAction).not.toHaveBeenCalled()
    await expect(page.getByRole('menu')).toBeVisible()
    markPlayCompleted(canvasElement)
  },
}

export const DangerItems: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.menuStage)}>
      <MenuTrigger>
        <Button variant="error">Danger Zone</Button>
        <MenuPopover>
          <Menu>
            <MenuItem id="remove" variant="danger">
              Remove from team
            </MenuItem>
            <MenuItem id="project" variant="danger">
              Delete project
            </MenuItem>
            <MenuItem id="account" variant="danger">
              Delete account
            </MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { page } = await openMenu(canvasElement, 'Danger Zone')
    const dangerItem = page.getByRole('menuitem', { name: 'Delete project' })

    await userEvent.hover(dangerItem)
    await expect(dangerItem).toHaveAttribute('data-hovered', 'true')
    markPlayCompleted(canvasElement)
  },
}

export const KeyboardNavigation: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.menuStage)}>
      <MenuTrigger>
        <Button>Navigate</Button>
        <MenuPopover>
          <Menu>
            <MenuItem id="first">First</MenuItem>
            <MenuItem id="second">Second</MenuItem>
            <MenuItem id="third">Third</MenuItem>
            <MenuItem id="last" variant="danger">
              Last
            </MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { page } = await openMenu(canvasElement, 'Navigate')
    const menu = page.getByRole('menu')
    const first = page.getByRole('menuitem', { name: 'First' })
    const second = page.getByRole('menuitem', { name: 'Second' })
    const last = page.getByRole('menuitem', { name: 'Last' })

    await expect(menu).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(first).toHaveAttribute('data-focused', 'true')
    await userEvent.keyboard('{ArrowDown}')
    await expect(second).toHaveAttribute('data-focused', 'true')
    await userEvent.keyboard('{End}')
    await expect(last).toHaveAttribute('data-focused', 'true')
    await userEvent.keyboard('{Home}')
    await expect(first).toHaveAttribute('data-focused', 'true')
    await userEvent.keyboard('{ArrowUp}')
    await expect(last).toHaveAttribute('data-focused', 'true')
    markPlayCompleted(canvasElement)
  },
}

export const HoveredItem: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.menuStage)}>
      <MenuTrigger>
        <Button>Hover state</Button>
        <MenuPopover>
          <Menu>
            <MenuItem id="edit">Edit</MenuItem>
            <MenuItem id="duplicate">Duplicate</MenuItem>
            <MenuItem id="archive">Archive</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { page } = await openMenu(canvasElement, 'Hover state')
    const hoveredItem = page.getByRole('menuitem', { name: 'Archive' })

    await expect(hoveredItem).not.toHaveAttribute('data-hovered')
    await hoverForStoryCapture(hoveredItem)
    await waitFor(() => expect(hoveredItem).toHaveAttribute('data-hovered', 'true'))
    markPlayCompleted(canvasElement)
  },
}

export const KeyboardSelection: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.menuStage)}>
      <MenuTrigger>
        <Button>Choose action</Button>
        <MenuPopover>
          <Menu selectionMode="single" onSelectionChange={selectionChange}>
            <MenuItem id="edit">Edit</MenuItem>
            <MenuItem id="duplicate">Duplicate</MenuItem>
            <MenuItem id="archive">Archive</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>
    </div>
  ),
  play: async ({ canvasElement }) => {
    selectionChange.mockClear()
    const open = await openMenu(canvasElement, 'Choose action')
    const menu = open.page.getByRole('menu')
    const first = open.page.getByRole('menuitemradio', { name: 'Edit' })
    const last = open.page.getByRole('menuitemradio', { name: 'Archive' })
    await expectStoryCapturePointerAwayFrom(last)

    await expect(menu).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(first).toHaveAttribute('data-focused', 'true')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(open.page.queryByRole('menu')).not.toBeInTheDocument())
    const selectedKeys = selectionChange.mock.calls.at(-1)?.[0]
    await expect(selectedKeys?.has('duplicate')).toBe(true)
    markPlayCompleted(canvasElement)
  },
}

export const EscapeDismissal: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.menuStage)}>
      <MenuTrigger>
        <Button>Dismiss menu</Button>
        <MenuPopover>
          <Menu>
            <MenuItem id="edit">Edit</MenuItem>
            <MenuItem id="duplicate">Duplicate</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { page, trigger } = await openMenu(canvasElement, 'Dismiss menu')
    const menu = page.getByRole('menu')

    await expect(menu).toHaveFocus()
    await expect(trigger).not.toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page.queryByRole('menu')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    markPlayCompleted(canvasElement)
  },
}

export const SeparatorGeometry: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.separatorStage)}>
      <MenuSeparator />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('separator')).toBeVisible()
    markPlayCompleted(canvasElement)
  },
}

export const AllStates: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.triggerRow)}>
      <MenuTrigger>
        <Button>Default</Button>
        <MenuPopover>
          <Menu>
            <MenuItem>Item One</MenuItem>
            <MenuItem>Item Two</MenuItem>
            <MenuItem>Item Three</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>

      <MenuTrigger>
        <Button>With Separator</Button>
        <MenuPopover>
          <Menu>
            <MenuItem>Edit</MenuItem>
            <MenuItem>Duplicate</MenuItem>
            <MenuSeparator />
            <MenuItem variant="danger">Delete</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>

      <MenuTrigger>
        <Button>With Shortcuts</Button>
        <MenuPopover>
          <Menu>
            <MenuItem suffix="⌘C">Copy</MenuItem>
            <MenuItem suffix="⌘V">Paste</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>
    </div>
  ),
}
