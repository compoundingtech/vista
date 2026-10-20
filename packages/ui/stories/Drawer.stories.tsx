import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Button } from '../src/components/Button/mod.ts'
import {
  Drawer,
  DrawerTrigger,
  DrawerDialog,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerContent,
} from '../src/components/Drawer/mod.ts'
import { styled } from '../src/foundations/props.ts'
import { scale, tokens } from '../src/foundations/tokens.stylex.ts'

const storyStyles = stylex.create({
  actionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space2,
  },
  paragraph: {
    margin: 0,
  },
  actionButton: {
    width: '100%',
  },
  actionButtonStart: {
    justifyContent: 'flex-start',
  },
  navigation: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
  },
  navigationLink: {
    boxSizing: 'border-box',
    display: 'block',
    paddingInline: scale.space4,
    paddingBlock: scale.space3,
    borderRadius: scale.radiusLg,
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: 'transparent',
        '@media (hover: hover)': tokens['--ds-gray-alpha-100'],
      },
    },
    color: 'inherit',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    textDecoration: 'none',
  },
  storyActions: {
    display: 'flex',
    gap: scale.space4,
  },
})

const meta = {
  title: 'Components/Drawer',
  component: Drawer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Drawer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <DrawerTrigger>
      <Button>Open Drawer</Button>
      <Drawer>
        <DrawerDialog>
          <DrawerHeader>
            <DrawerTitle>Drawer Title</DrawerTitle>
            <DrawerDescription>This is a drawer that slides up from the bottom.</DrawerDescription>
          </DrawerHeader>
          <DrawerContent>
            <p {...styled(undefined, storyStyles.paragraph)}>
              Drawer content goes here. This is typically used for mobile navigation or quick
              actions.
            </p>
          </DrawerContent>
        </DrawerDialog>
      </Drawer>
    </DrawerTrigger>
  ),
}

export const WithActions: Story = {
  args: {
    children: null,
  },
  render: () => (
    <DrawerTrigger>
      <Button>Share</Button>
      <Drawer>
        <DrawerDialog>
          <DrawerHeader>
            <DrawerTitle>Share this page</DrawerTitle>
          </DrawerHeader>
          <DrawerContent>
            <div {...styled(undefined, storyStyles.actionList)}>
              <Button
                variant="secondary"
                {...styled(undefined, storyStyles.actionButton, storyStyles.actionButtonStart)}
              >
                Copy link
              </Button>
              <Button
                variant="secondary"
                {...styled(undefined, storyStyles.actionButton, storyStyles.actionButtonStart)}
              >
                Share to Twitter
              </Button>
              <Button
                variant="secondary"
                {...styled(undefined, storyStyles.actionButton, storyStyles.actionButtonStart)}
              >
                Share to LinkedIn
              </Button>
              <Button
                variant="secondary"
                {...styled(undefined, storyStyles.actionButton, storyStyles.actionButtonStart)}
              >
                Share via Email
              </Button>
            </div>
          </DrawerContent>
        </DrawerDialog>
      </Drawer>
    </DrawerTrigger>
  ),
}

export const Navigation: Story = {
  args: {
    children: null,
  },
  render: () => (
    <DrawerTrigger>
      <Button>Menu</Button>
      <Drawer>
        <DrawerDialog>
          <DrawerContent>
            <nav {...styled(undefined, storyStyles.navigation)}>
              <a href="#" {...styled(undefined, storyStyles.navigationLink)}>
                Home
              </a>
              <a href="#" {...styled(undefined, storyStyles.navigationLink)}>
                Products
              </a>
              <a href="#" {...styled(undefined, storyStyles.navigationLink)}>
                About
              </a>
              <a href="#" {...styled(undefined, storyStyles.navigationLink)}>
                Contact
              </a>
            </nav>
          </DrawerContent>
        </DrawerDialog>
      </Drawer>
    </DrawerTrigger>
  ),
}

export const AllStates: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div {...styled(undefined, storyStyles.storyActions)}>
      <DrawerTrigger>
        <Button>Default</Button>
        <Drawer>
          <DrawerDialog>
            <DrawerHeader>
              <DrawerTitle>Default Drawer</DrawerTitle>
              <DrawerDescription>A simple drawer with title and description.</DrawerDescription>
            </DrawerHeader>
            <DrawerContent>
              <p {...styled(undefined, storyStyles.paragraph)}>Content inside the drawer.</p>
            </DrawerContent>
          </DrawerDialog>
        </Drawer>
      </DrawerTrigger>

      <DrawerTrigger>
        <Button>Actions</Button>
        <Drawer>
          <DrawerDialog>
            <DrawerHeader>
              <DrawerTitle>Quick Actions</DrawerTitle>
            </DrawerHeader>
            <DrawerContent>
              <div {...styled(undefined, storyStyles.actionList)}>
                <Button variant="secondary" {...styled(undefined, storyStyles.actionButton)}>
                  Action 1
                </Button>
                <Button variant="secondary" {...styled(undefined, storyStyles.actionButton)}>
                  Action 2
                </Button>
              </div>
            </DrawerContent>
          </DrawerDialog>
        </Drawer>
      </DrawerTrigger>
    </div>
  ),
}
