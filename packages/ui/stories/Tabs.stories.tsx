import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Tabs, TabList, Tab, TabPanel } from '../src/components/Tabs/mod.ts'
import { scale, tokens } from '../src/foundations/tokens.stylex.ts'
import { expectStoryCapturePointerAwayFrom, hoverForStoryCapture } from './story-interactions.ts'

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  width400: {
    width: '400px',
  },
  iconTab: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
  },
  icon: {
    display: 'block',
    width: '1rem',
    height: '1rem',
    verticalAlign: 'middle',
  },
  allStates: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space8,
    width: '400px',
  },
  sectionLabel: {
    margin: 0,
    marginBottom: scale.space2,
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
})

const markTabsPlayCompleted = (canvasElement: HTMLElement) => {
  canvasElement.dataset.tabsPlay = 'completed'
}

export const Default: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs>
        <TabList>
          <Tab id="apple">Apple</Tab>
          <Tab id="orange">Orange</Tab>
          <Tab id="mango">Mango</Tab>
        </TabList>
        <TabPanel id="apple">Apple content goes here.</TabPanel>
        <TabPanel id="orange">Orange content goes here.</TabPanel>
        <TabPanel id="mango">Mango content goes here.</TabPanel>
      </Tabs>
    </div>
  ),
}

export const WithDefaultSelected: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs defaultSelectedKey="orange">
        <TabList>
          <Tab id="apple">Apple</Tab>
          <Tab id="orange">Orange</Tab>
          <Tab id="mango">Mango</Tab>
        </TabList>
        <TabPanel id="apple">Apple content goes here.</TabPanel>
        <TabPanel id="orange">Orange content goes here.</TabPanel>
        <TabPanel id="mango">Mango content goes here.</TabPanel>
      </Tabs>
    </div>
  ),
}

export const Disabled: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs isDisabled>
        <TabList>
          <Tab id="apple">Apple</Tab>
          <Tab id="orange">Orange</Tab>
          <Tab id="mango">Mango</Tab>
        </TabList>
        <TabPanel id="apple">Apple content goes here.</TabPanel>
        <TabPanel id="orange">Orange content goes here.</TabPanel>
        <TabPanel id="mango">Mango content goes here.</TabPanel>
      </Tabs>
    </div>
  ),
}

export const DisabledTab: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs>
        <TabList>
          <Tab id="apple">Apple</Tab>
          <Tab id="orange">Orange</Tab>
          <Tab id="mango" isDisabled>
            Mango
          </Tab>
        </TabList>
        <TabPanel id="apple">Apple content goes here.</TabPanel>
        <TabPanel id="orange">Orange content goes here.</TabPanel>
        <TabPanel id="mango">Mango content goes here.</TabPanel>
      </Tabs>
    </div>
  ),
}

export const WithIcons: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs>
        <TabList>
          <Tab id="github" style={storyStyles.iconTab}>
            <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </Tab>
          <Tab id="gitlab" style={storyStyles.iconTab}>
            <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 14.85l2.38-7.34H5.62L8 14.85z" />
              <path d="M8 14.85l-2.38-7.34H1.72L8 14.85z" />
              <path d="M1.72 7.51l-.79 2.44c-.07.22 0 .46.19.6L8 14.85l-6.28-7.34z" />
              <path d="M1.72 7.51h3.9L4.03 3.04c-.08-.26-.45-.26-.53 0L1.72 7.51z" />
              <path d="M8 14.85l2.38-7.34h3.9L8 14.85z" />
              <path d="M14.28 7.51l.79 2.44c.07.22 0 .46-.19.6L8 14.85l6.28-7.34z" />
              <path d="M14.28 7.51h-3.9l1.59-4.47c.08-.26.45-.26.53 0l1.78 4.47z" />
            </svg>
            GitLab
          </Tab>
          <Tab id="bitbucket" style={storyStyles.iconTab}>
            <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 16 16" fill="currentColor">
              <path d="M.778 1.211a.768.768 0 00-.768.892l2.165 13.124a1.044 1.044 0 001.024.873h9.747a.77.77 0 00.768-.641L15.99 2.103a.768.768 0 00-.768-.892H.778zm8.925 9.144H6.297L5.469 5.645h5.063l-.829 4.71z" />
            </svg>
            Bitbucket
          </Tab>
        </TabList>
        <TabPanel id="github">GitHub content</TabPanel>
        <TabPanel id="gitlab">GitLab content</TabPanel>
        <TabPanel id="bitbucket">Bitbucket content</TabPanel>
      </Tabs>
    </div>
  ),
}

export const Secondary: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs>
        <TabList variant="secondary">
          <Tab variant="secondary" id="github">
            GitHub
          </Tab>
          <Tab variant="secondary" id="gitlab">
            GitLab
          </Tab>
          <Tab variant="secondary" id="bitbucket" isDisabled>
            Bitbucket
          </Tab>
        </TabList>
        <TabPanel id="github">GitHub content</TabPanel>
        <TabPanel id="gitlab">GitLab content</TabPanel>
        <TabPanel id="bitbucket">Bitbucket content</TabPanel>
      </Tabs>
    </div>
  ),
}

export const AllStates: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.allStates)}>
      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Default</p>
        <Tabs>
          <TabList>
            <Tab id="apple">Apple</Tab>
            <Tab id="orange">Orange</Tab>
            <Tab id="mango">Mango</Tab>
          </TabList>
          <TabPanel id="apple">Apple content</TabPanel>
          <TabPanel id="orange">Orange content</TabPanel>
          <TabPanel id="mango">Mango content</TabPanel>
        </Tabs>
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Disabled tab</p>
        <Tabs>
          <TabList>
            <Tab id="apple">Apple</Tab>
            <Tab id="orange">Orange</Tab>
            <Tab id="mango" isDisabled>
              Mango
            </Tab>
          </TabList>
          <TabPanel id="apple">Apple content</TabPanel>
          <TabPanel id="orange">Orange content</TabPanel>
          <TabPanel id="mango">Mango content</TabPanel>
        </Tabs>
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Secondary variant</p>
        <Tabs>
          <TabList variant="secondary">
            <Tab variant="secondary" id="apple">
              Apple
            </Tab>
            <Tab variant="secondary" id="orange">
              Orange
            </Tab>
            <Tab variant="secondary" id="mango">
              Mango
            </Tab>
          </TabList>
          <TabPanel id="apple">Apple content</TabPanel>
          <TabPanel id="orange">Orange content</TabPanel>
          <TabPanel id="mango">Mango content</TabPanel>
        </Tabs>
      </div>
    </div>
  ),
}

export const HoveredTab: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs>
        <TabList>
          <Tab id="apple">Apple</Tab>
          <Tab id="orange">Orange</Tab>
          <Tab id="mango">Mango</Tab>
        </TabList>
        <TabPanel id="apple">Apple content goes here.</TabPanel>
        <TabPanel id="orange">Orange content goes here.</TabPanel>
        <TabPanel id="mango">Mango content goes here.</TabPanel>
      </Tabs>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const orange = await canvas.findByRole('tab', { name: 'Orange' })

    await expect(orange).not.toHaveAttribute('data-hovered')
    await hoverForStoryCapture(orange)
    await waitFor(() => expect(orange).toHaveAttribute('data-hovered', 'true'))
    await expect(orange).toHaveAttribute('aria-selected', 'false')
    markTabsPlayCompleted(canvasElement)
  },
}

export const KeyboardNavigation: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs>
        <TabList>
          <Tab id="apple">Apple</Tab>
          <Tab id="orange">Orange</Tab>
          <Tab id="mango">Mango</Tab>
        </TabList>
        <TabPanel id="apple">Apple content goes here.</TabPanel>
        <TabPanel id="orange">Orange content goes here.</TabPanel>
        <TabPanel id="mango">Mango content goes here.</TabPanel>
      </Tabs>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const apple = canvas.getByRole('tab', { name: 'Apple' })
    const orange = canvas.getByRole('tab', { name: 'Orange' })
    const mango = canvas.getByRole('tab', { name: 'Mango' })
    await expectStoryCapturePointerAwayFrom(orange)

    await userEvent.tab()
    await expect(apple).toHaveFocus()
    await expect(apple).toHaveAttribute('aria-selected', 'true')
    await expect(apple).toHaveAttribute('data-selected', 'true')

    await userEvent.keyboard('{ArrowRight}')
    await expect(orange).toHaveFocus()
    await expect(orange).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Orange content goes here.')

    await userEvent.keyboard('{ArrowLeft}')
    await expect(apple).toHaveFocus()
    await expect(apple).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{End}')
    await expect(mango).toHaveFocus()
    await expect(mango).toHaveAttribute('data-selected', 'true')
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Mango content goes here.')

    await userEvent.keyboard('{Home}')
    await expect(apple).toHaveFocus()
    await expect(apple).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Apple content goes here.')
  },
}

export const DisabledTabSkipped: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs>
        <TabList>
          <Tab id="apple">Apple</Tab>
          <Tab id="orange" isDisabled>
            Orange
          </Tab>
          <Tab id="mango">Mango</Tab>
        </TabList>
        <TabPanel id="apple">Apple content goes here.</TabPanel>
        <TabPanel id="orange">Orange content goes here.</TabPanel>
        <TabPanel id="mango">Mango content goes here.</TabPanel>
      </Tabs>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const apple = canvas.getByRole('tab', { name: 'Apple' })
    const orange = canvas.getByRole('tab', { name: 'Orange' })
    const mango = canvas.getByRole('tab', { name: 'Mango' })

    await userEvent.tab()
    await expect(apple).toHaveFocus()
    await expect(orange).toHaveAttribute('aria-disabled', 'true')
    await expect(orange).toHaveAttribute('data-disabled', 'true')

    await userEvent.keyboard('{ArrowRight}')
    await expect(mango).toHaveFocus()
    await expect(mango).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Mango content goes here.')
  },
}

export const FocusedSelectedPrimary: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs defaultSelectedKey="orange">
        <TabList>
          <Tab id="apple">Apple</Tab>
          <Tab id="orange">Orange</Tab>
          <Tab id="mango">Mango</Tab>
        </TabList>
        <TabPanel id="apple">Apple content goes here.</TabPanel>
        <TabPanel id="orange">Orange content goes here.</TabPanel>
        <TabPanel id="mango">Mango content goes here.</TabPanel>
      </Tabs>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const orange = within(canvasElement).getByRole('tab', { name: 'Orange' })

    await userEvent.tab()
    await expect(orange).toHaveFocus()
    await expect(orange).toHaveAttribute('aria-selected', 'true')
    await expect(orange).toHaveAttribute('data-selected', 'true')
  },
}

export const FocusedSelectedSecondary: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width400)}>
      <Tabs defaultSelectedKey="orange">
        <TabList variant="secondary">
          <Tab id="apple" variant="secondary">
            Apple
          </Tab>
          <Tab id="orange" variant="secondary">
            Orange
          </Tab>
          <Tab id="mango" variant="secondary">
            Mango
          </Tab>
        </TabList>
        <TabPanel id="apple">Apple content goes here.</TabPanel>
        <TabPanel id="orange">Orange content goes here.</TabPanel>
        <TabPanel id="mango">Mango content goes here.</TabPanel>
      </Tabs>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const orange = within(canvasElement).getByRole('tab', { name: 'Orange' })

    await userEvent.tab()
    await expect(orange).toHaveFocus()
    await expect(orange).toHaveAttribute('aria-selected', 'true')
    await expect(orange).toHaveAttribute('data-selected', 'true')
  },
}
