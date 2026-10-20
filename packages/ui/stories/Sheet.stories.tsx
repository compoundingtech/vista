import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Button } from '../src/components/Button/Button.tsx'
import {
  Sheet,
  SheetTrigger,
  SheetDialog,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetContent,
  SheetFooter,
} from '../src/components/Sheet/Sheet.tsx'
import { styled } from '../src/foundations/props.ts'
import { scale, tokens } from '../src/foundations/tokens.stylex.ts'

const storyStyles = stylex.create({
  paragraphReset: {
    margin: 0,
  },
  paragraph: {
    margin: 0,
    marginBottom: scale.space4,
  },
  settings: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space6,
  },
  settingHeading: {
    margin: 0,
    marginBottom: scale.space2,
    fontSize: 'inherit',
    lineHeight: 'inherit',
    fontWeight: 500,
  },
  settingDescription: {
    margin: 0,
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
})

const meta = {
  title: 'Components/Sheet',
  component: Sheet,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    position: {
      control: 'select',
      options: ['left', 'right'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'full'],
    },
  },
} satisfies Meta<typeof Sheet>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <SheetTrigger>
      <Button>Open Sheet</Button>
      <Sheet {...args}>
        <SheetDialog>
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetDescription>This is a description of the sheet content.</SheetDescription>
          </SheetHeader>
          <SheetContent>
            <p {...styled(undefined, storyStyles.paragraphReset)}>
              Sheet content goes here. This is where you put your main content.
            </p>
          </SheetContent>
          <SheetFooter>
            <Button variant="secondary">Cancel</Button>
            <Button>Save</Button>
          </SheetFooter>
        </SheetDialog>
      </Sheet>
    </SheetTrigger>
  ),
  args: {
    children: null,
    position: 'right',
    size: 'md',
  },
}

export const LeftPosition: Story = {
  render: (args) => (
    <SheetTrigger>
      <Button>Open Left Sheet</Button>
      <Sheet {...args}>
        <SheetDialog>
          <SheetHeader>
            <SheetTitle>Left Sheet</SheetTitle>
          </SheetHeader>
          <SheetContent>
            <p {...styled(undefined, storyStyles.paragraphReset)}>
              This sheet slides in from the left side.
            </p>
          </SheetContent>
        </SheetDialog>
      </Sheet>
    </SheetTrigger>
  ),
  args: {
    children: null,
    position: 'left',
    size: 'md',
  },
}

export const SmallSize: Story = {
  render: (args) => (
    <SheetTrigger>
      <Button>Open Small Sheet</Button>
      <Sheet {...args}>
        <SheetDialog>
          <SheetHeader>
            <SheetTitle>Small Sheet</SheetTitle>
          </SheetHeader>
          <SheetContent>
            <p {...styled(undefined, storyStyles.paragraphReset)}>
              This is a small 320px wide sheet.
            </p>
          </SheetContent>
        </SheetDialog>
      </Sheet>
    </SheetTrigger>
  ),
  args: {
    children: null,
    position: 'right',
    size: 'sm',
  },
}

export const LargeSize: Story = {
  render: (args) => (
    <SheetTrigger>
      <Button>Open Large Sheet</Button>
      <Sheet {...args}>
        <SheetDialog>
          <SheetHeader>
            <SheetTitle>Large Sheet</SheetTitle>
          </SheetHeader>
          <SheetContent>
            <p {...styled(undefined, storyStyles.paragraphReset)}>
              This is a large 640px wide sheet, suitable for more complex content.
            </p>
          </SheetContent>
        </SheetDialog>
      </Sheet>
    </SheetTrigger>
  ),
  args: {
    children: null,
    position: 'right',
    size: 'lg',
  },
}

export const FullWidth: Story = {
  render: (args) => (
    <SheetTrigger>
      <Button>Open Full Width Sheet</Button>
      <Sheet {...args}>
        <SheetDialog>
          <SheetHeader>
            <SheetTitle>Full Width Sheet</SheetTitle>
          </SheetHeader>
          <SheetContent>
            <p {...styled(undefined, storyStyles.paragraphReset)}>
              This sheet takes up the full width of the screen.
            </p>
          </SheetContent>
        </SheetDialog>
      </Sheet>
    </SheetTrigger>
  ),
  args: {
    children: null,
    position: 'right',
    size: 'full',
  },
}

export const WithLongContent: Story = {
  render: (args) => (
    <SheetTrigger>
      <Button>Open Sheet with Long Content</Button>
      <Sheet {...args}>
        <SheetDialog>
          <SheetHeader>
            <SheetTitle>Scrollable Content</SheetTitle>
            <SheetDescription>The content area scrolls when it overflows.</SheetDescription>
          </SheetHeader>
          <SheetContent>
            {Array.from({ length: 20 }).map((_, i) => (
              <p key={i} {...styled(undefined, storyStyles.paragraph)}>
                Paragraph {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
            ))}
          </SheetContent>
          <SheetFooter>
            <Button variant="secondary">Cancel</Button>
            <Button>Save Changes</Button>
          </SheetFooter>
        </SheetDialog>
      </Sheet>
    </SheetTrigger>
  ),
  args: {
    children: null,
    position: 'right',
    size: 'md',
  },
}

export const SettingsPanel: Story = {
  render: (args) => (
    <SheetTrigger>
      <Button>Open Settings</Button>
      <Sheet {...args}>
        <SheetDialog>
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>Manage your account settings and preferences.</SheetDescription>
          </SheetHeader>
          <SheetContent>
            <div {...styled(undefined, storyStyles.settings)}>
              <div>
                <h3 {...styled(undefined, storyStyles.settingHeading)}>Notifications</h3>
                <p {...styled(undefined, storyStyles.settingDescription)}>
                  Configure how you receive notifications.
                </p>
              </div>
              <div>
                <h3 {...styled(undefined, storyStyles.settingHeading)}>Privacy</h3>
                <p {...styled(undefined, storyStyles.settingDescription)}>
                  Control your privacy settings.
                </p>
              </div>
              <div>
                <h3 {...styled(undefined, storyStyles.settingHeading)}>Appearance</h3>
                <p {...styled(undefined, storyStyles.settingDescription)}>
                  Customize the look and feel.
                </p>
              </div>
            </div>
          </SheetContent>
          <SheetFooter>
            <Button variant="secondary">Reset</Button>
            <Button>Save Settings</Button>
          </SheetFooter>
        </SheetDialog>
      </Sheet>
    </SheetTrigger>
  ),
  args: {
    children: null,
    position: 'right',
    size: 'md',
  },
}
