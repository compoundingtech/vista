import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import {
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuSeparator,
} from '../src/components/ContextMenu/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/ContextMenu',
  component: ContextMenuTrigger,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ContextMenuTrigger>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  trigger: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '200px',
    height: '100px',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-400'],
    borderRadius: '0.5rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  icon: {
    display: 'block',
    width: '1rem',
    height: '1rem',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  label: {
    margin: 0,
    marginBottom: '0.5rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
})

const DemoTrigger = ({ children }: { children: ReactNode }) => (
  <div {...stylex.props(storyStyles.trigger)}>{children}</div>
)

export const Default: Story = {
  args: {
    children: <DemoTrigger>Right click here</DemoTrigger>,
    menu: (
      <>
        <ContextMenuItem>Item one</ContextMenuItem>
        <ContextMenuItem>Item two</ContextMenuItem>
        <ContextMenuItem>Item three</ContextMenuItem>
        <ContextMenuItem>Item four</ContextMenuItem>
      </>
    ),
  },
}

export const DisabledItems: Story = {
  args: {
    children: <DemoTrigger>Right click here</DemoTrigger>,
    menu: (
      <>
        <ContextMenuItem>Edit</ContextMenuItem>
        <ContextMenuItem isDisabled>Copy</ContextMenuItem>
        <ContextMenuItem isDisabled>Paste</ContextMenuItem>
        <ContextMenuItem>Delete</ContextMenuItem>
      </>
    ),
  },
}

export const WithSeparator: Story = {
  args: {
    children: <DemoTrigger>Right click here</DemoTrigger>,
    menu: (
      <>
        <ContextMenuItem>Edit</ContextMenuItem>
        <ContextMenuItem>Duplicate</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>Archive</ContextMenuItem>
        <ContextMenuItem variant="danger">Delete</ContextMenuItem>
      </>
    ),
  },
}

export const WithPrefixAndSuffix: Story = {
  args: {
    children: <DemoTrigger>Right click here</DemoTrigger>,
    menu: (
      <>
        <ContextMenuItem
          prefix={
            <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5ZM6 1.5v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z" />
            </svg>
          }
          suffix="⌘D"
        >
          Delete
        </ContextMenuItem>
        <ContextMenuItem
          prefix={
            <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1Z" />
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3Zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3Z" />
            </svg>
          }
          suffix="⌘C"
        >
          Copy
        </ContextMenuItem>
        <ContextMenuItem
          prefix={
            <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.854 2.146a.5.5 0 0 1 0 .708l-11 11a.5.5 0 0 1-.708-.708l11-11a.5.5 0 0 1 .708 0Z" />
              <path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v1a.5.5 0 0 1-1 0v-1A3.5 3.5 0 0 1 4.5 1h1a.5.5 0 0 1 0 1h-1Zm6.5-.5a.5.5 0 0 1 .5-.5h1A3.5 3.5 0 0 1 16 4.5v1a.5.5 0 0 1-1 0v-1A2.5 2.5 0 0 0 12.5 2h-1a.5.5 0 0 1-.5-.5ZM1 10.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1A2.5 2.5 0 0 0 4 13.5h1a.5.5 0 0 1 0 1h-1A3.5 3.5 0 0 1 1 11v-.5Zm13 .5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a2.5 2.5 0 0 1-2.5 2.5h-1a.5.5 0 0 1 0-1h1a1.5 1.5 0 0 0 1.5-1.5v-.5Z" />
            </svg>
          }
        >
          Share
        </ContextMenuItem>
      </>
    ),
  },
}

export const Disabled: Story = {
  args: {
    children: <DemoTrigger>Right click here (disabled)</DemoTrigger>,
    menu: (
      <>
        <ContextMenuItem>Item one</ContextMenuItem>
        <ContextMenuItem>Item two</ContextMenuItem>
      </>
    ),
    isDisabled: true,
  },
}

export const AllStates: Story = {
  args: {
    children: <DemoTrigger>Right click here</DemoTrigger>,
    menu: <></>,
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack)}>
      <div>
        <p {...stylex.props(storyStyles.label)}>Default</p>
        <ContextMenuTrigger
          menu={
            <>
              <ContextMenuItem>Item one</ContextMenuItem>
              <ContextMenuItem>Item two</ContextMenuItem>
              <ContextMenuItem>Item three</ContextMenuItem>
            </>
          }
        >
          <DemoTrigger>Right click here</DemoTrigger>
        </ContextMenuTrigger>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>With Separator</p>
        <ContextMenuTrigger
          menu={
            <>
              <ContextMenuItem>Edit</ContextMenuItem>
              <ContextMenuItem>Duplicate</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="danger">Delete</ContextMenuItem>
            </>
          }
        >
          <DemoTrigger>Right click here</DemoTrigger>
        </ContextMenuTrigger>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>With Disabled Items</p>
        <ContextMenuTrigger
          menu={
            <>
              <ContextMenuItem>Edit</ContextMenuItem>
              <ContextMenuItem isDisabled>Copy</ContextMenuItem>
              <ContextMenuItem isDisabled>Paste</ContextMenuItem>
            </>
          }
        >
          <DemoTrigger>Right click here</DemoTrigger>
        </ContextMenuTrigger>
      </div>
    </div>
  ),
}
