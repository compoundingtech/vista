import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { I18nProvider } from 'react-aria-components'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Select, SelectItem } from '../src/components/Select/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Select',
  component: Select,
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
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  stack200: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '200px',
  },
  overlayStage: {
    width: '240px',
    height: '280px',
  },
  stack160: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '160px',
  },
})

export const Default: Story = {
  args: {
    placeholder: 'Select an option',
    children: (
      <>
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
        <SelectItem id="option3">Option 3</SelectItem>
      </>
    ),
  },
}
export const DefaultPlaceholder: Story = {
  args: {
    children: null as unknown as React.ReactNode,
  },
  render: () => (
    <I18nProvider locale="de-DE">
      <Select aria-label="Default placeholder">
        <SelectItem id="option">Option</SelectItem>
      </Select>
    </I18nProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button')).toHaveTextContent('Element wählen')
  },
}

export const Sizes: Story = {
  args: {
    children: null as unknown as React.ReactNode,
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack200)}>
      <Select size="xs" placeholder="XSmall">
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
      </Select>
      <Select size="sm" placeholder="Small">
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
      </Select>
      <Select size="md" placeholder="Default">
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
      </Select>
      <Select size="lg" placeholder="Large">
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
      </Select>
    </div>
  ),
}

export const WithLabel: Story = {
  args: {
    label: 'Select a fruit',
    placeholder: 'Choose one',
    children: (
      <>
        <SelectItem id="apple">Apple</SelectItem>
        <SelectItem id="banana">Banana</SelectItem>
        <SelectItem id="cherry">Cherry</SelectItem>
      </>
    ),
  },
}

export const WithDefaultValue: Story = {
  args: {
    label: 'Favorite color',
    defaultSelectedKey: 'blue',
    children: (
      <>
        <SelectItem id="red">Red</SelectItem>
        <SelectItem id="green">Green</SelectItem>
        <SelectItem id="blue">Blue</SelectItem>
      </>
    ),
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled',
    isDisabled: true,
    children: (
      <>
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
      </>
    ),
  },
}

export const WithError: Story = {
  parameters: {
    storyGate: {
      unstable: true,
    },
  },
  args: {
    placeholder: 'Select an option',
    errorMessage: 'Please select a value.',
    children: (
      <>
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
      </>
    ),
  },
}

export const AllStates: Story = {
  args: {
    children: null as unknown as React.ReactNode,
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack200)}>
      <Select placeholder="Default">
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
      </Select>
      <Select label="With label" placeholder="Choose one">
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
      </Select>
      <Select placeholder="Disabled" isDisabled>
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
      </Select>
      <Select placeholder="With error" errorMessage="Please select a value.">
        <SelectItem id="option1">Option 1</SelectItem>
        <SelectItem id="option2">Option 2</SelectItem>
      </Select>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const triggers = within(canvasElement).getAllByRole('button')
    const invalidTrigger = triggers.at(-1)!

    invalidTrigger.focus()
    const redProbe = canvasElement.ownerDocument.createElement('span')
    redProbe.style.color = tokens['--ds-red-700']
    canvasElement.ownerDocument.body.append(redProbe)
    const invalidColor = getComputedStyle(redProbe).color
    redProbe.remove()
    await expect(invalidTrigger).toHaveFocus()
    await expect(invalidTrigger).toHaveAttribute('data-invalid', 'true')
    await expect(getComputedStyle(invalidTrigger).boxShadow).not.toBe('none')
    await expect(getComputedStyle(invalidTrigger).boxShadow).not.toContain('4px')
    await expect(getComputedStyle(invalidTrigger).boxShadow).toContain(invalidColor)
    invalidTrigger.blur()
    await expect(invalidTrigger).not.toHaveFocus()
  },
}

export const OpenPopover: Story = {
  args: {
    children: null as unknown as React.ReactNode,
  },
  render: () => (
    <div {...stylex.props(storyStyles.overlayStage)}>
      <Select label="Environment" placeholder="Select an environment">
        <SelectItem id="production">Production</SelectItem>
        <SelectItem id="preview">Preview</SelectItem>
        <SelectItem id="development">Development</SelectItem>
      </Select>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('button')

    await userEvent.click(trigger)
    const listbox = page.getByRole('listbox')
    const icon = trigger.querySelector('span[data-open]')
    await expect(listbox).toBeVisible()
    await expect(page.getAllByRole('option')).toHaveLength(3)
    await expect(icon).toHaveAttribute('data-open', 'true')
    await expect(getComputedStyle(icon! as Element).transform).not.toBe('none')

    // The baseline build emits no animation rules for its entering/exiting utilities.
    await expect(getComputedStyle(listbox.parentElement!).animationName).toBe('none')
  },
}

export const KeyboardSelection: Story = {
  args: {
    children: null as unknown as React.ReactNode,
  },
  render: () => (
    <div {...stylex.props(storyStyles.overlayStage)}>
      <Select label="Region" placeholder="Select a region">
        <SelectItem id="iad1">Washington, D.C.</SelectItem>
        <SelectItem id="fra1">Frankfurt</SelectItem>
        <SelectItem id="sfo1">San Francisco</SelectItem>
      </Select>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('button')

    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(page.getByRole('listbox')).toBeVisible()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(trigger).toHaveTextContent('Frankfurt')
    await waitFor(() => expect(trigger).toHaveFocus())

    await userEvent.keyboard('{ArrowDown}')
    await expect(page.getByRole('listbox')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

export const FocusVisibleTrigger: Story = {
  args: {
    'aria-label': 'Keyboard focused select',
    placeholder: 'Keyboard focused',
    children: (
      <>
        <SelectItem id="one">One</SelectItem>
        <SelectItem id="two">Two</SelectItem>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button')

    await userEvent.tab()
    await expect(trigger).toHaveFocus()
  },
}

export const SelectionAndDisabledOptions: Story = {
  args: {
    children: null as unknown as React.ReactNode,
  },
  render: () => (
    <div {...stylex.props(storyStyles.overlayStage)}>
      <Select label="Deployment target" defaultSelectedKey="preview" defaultOpen>
        <SelectItem id="production">Production</SelectItem>
        <SelectItem id="preview">Preview</SelectItem>
        <SelectItem id="development" isDisabled>
          Development
        </SelectItem>
      </Select>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)

    await expect(page.getByRole('listbox')).toBeVisible()
    await expect(page.getByRole('option', { name: 'Preview' })).toHaveAttribute(
      'data-selected',
      'true',
    )
    await expect(page.getByRole('option', { name: 'Development' })).toHaveAttribute(
      'data-disabled',
      'true',
    )
  },
}

export const EmptyAndTruncated: Story = {
  args: {
    children: null as unknown as React.ReactNode,
  },
  render: () => (
    <div {...stylex.props(storyStyles.stack160)}>
      <Select aria-label="Empty select" placeholder="No options available">
        {null}
      </Select>
      <Select aria-label="Long value select" defaultSelectedKey="long">
        <SelectItem id="long">A deliberately long option that must truncate</SelectItem>
      </Select>
    </div>
  ),
}

/** Canonical two-line option rendering added with the public `description` API. */
export const WithItemDescriptions: Story = {
  args: {
    children: null as unknown as React.ReactNode,
  },
  render: () => (
    <div {...stylex.props(storyStyles.overlayStage)}>
      <Select label="Project" defaultSelectedKey="geist" defaultOpen>
        <SelectItem id="geist" description="overengineeringstudio/geist">
          Geist
        </SelectItem>
        <SelectItem id="vista" description="schickling/vista">
          Vista
        </SelectItem>
        <SelectItem id="livestore" description="livestorejs/livestore">
          LiveStore
        </SelectItem>
      </Select>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()
    await expect(within(listbox).getByText('overengineeringstudio/geist')).toBeVisible()
  },
}
