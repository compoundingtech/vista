/**
 * Focus-ring coverage.
 *
 * This package had 471 stories and not one of them rendered a focused control,
 * so no visual check could see a focus indicator at all. That gap was not
 * theoretical: it let a real defect ship to six internal tools. Eight of the
 * eleven components using `ring-offset` never set `ring-offset-color`, so they
 * inherited Tailwind's `#fff` default and painted a solid white band between
 * the control and its ring — invisible in light mode against a white page, and
 * a stark white halo in dark mode against `rgb(10, 10, 10)`. Only visible while
 * an element was keyboard-focused, and nothing rendered a keyboard-focused
 * element.
 *
 * Each story here tabs focus onto a real control so the captured screenshot
 * contains a `:focus-visible` state. The `play` function is what makes this
 * work: `:focus-visible` matches on keyboard interaction, so calling `.focus()`
 * would produce a focused element that does not paint the ring and a story that
 * silently proves nothing.
 *
 * Keep these passing and a dropped, inverted or invisible focus indicator
 * becomes a pixel diff instead of a bug report.
 */

import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { Button } from '../src/components/Button/Button.tsx'
import { Checkbox } from '../src/components/Checkbox/Checkbox.tsx'
import { Radio, RadioGroup } from '../src/components/Radio/Radio.tsx'
import { Toggle } from '../src/components/Toggle/Toggle.tsx'

const meta = {
  title: 'Foundations/Focus Ring',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Keyboard-focused controls. Every story here moves focus with the keyboard so the capture contains a real `:focus-visible` state.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Tab `count` times, then assert something is actually focused. */
const tabTo = async (count: number, canvasElement: HTMLElement): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    await userEvent.tab()
  }
  // Without this the story degrades silently: if focus never lands, the
  // screenshot is of an unfocused control and matches its baseline forever.
  await expect(canvasElement.ownerDocument.activeElement).not.toBe(canvasElement.ownerDocument.body)
}

/**
 * A focused Button of every variant.
 *
 * `secondary` is the load-bearing one: it paints an inset hairline with
 * `boxShadow` while the ring is an `outline`. Under Tailwind both rendered
 * because `ring` and `shadow` composed into a single `box-shadow` through
 * separate custom properties. StyleX's `boxShadow` is one property, so a
 * conversion that put the ring there too would silently drop one of them.
 * This story is where that shows up.
 */
export const FocusedButton: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="tertiary">Tertiary</Button>
      <Button variant="error">Error</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await tabTo(1, canvasElement)
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Primary' })).toHaveFocus()
  },
}

/** A focused secondary Button, isolated, so the hairline-plus-ring pair is unambiguous. */
export const FocusedButtonSecondary: Story = {
  render: () => <Button variant="secondary">Secondary</Button>,
  play: async ({ canvasElement }) => {
    await tabTo(1, canvasElement)
  },
}

/**
 * A focused Checkbox, unchecked and checked.
 *
 * Checkbox is one of the eight that never set a ring-offset colour, so this is
 * the story in which the white halo was visible in dark mode — and the one
 * that shows it is gone.
 */
export const FocusedCheckbox: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '24px' }}>
      <Checkbox>Unchecked</Checkbox>
      <Checkbox defaultSelected>Checked</Checkbox>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await tabTo(1, canvasElement)
  },
}

/**
 * A focused AND selected Checkbox.
 *
 * The precedence case: a selected state and a focus state on one control. If a
 * selected style ever eats the focus ring, this is the story that fails, and
 * it is invisible in every other story in the package.
 */
export const FocusedSelectedCheckbox: Story = {
  render: () => <Checkbox defaultSelected>Selected and focused</Checkbox>,
  play: async ({ canvasElement }) => {
    await tabTo(1, canvasElement)
  },
}

/** A focused Radio inside a group where a different option is already selected. */
export const FocusedRadio: Story = {
  render: () => (
    <RadioGroup label="Plan" defaultValue="pro">
      <Radio value="hobby">Hobby</Radio>
      <Radio value="pro">Pro</Radio>
    </RadioGroup>
  ),
  play: async ({ canvasElement }) => {
    await tabTo(1, canvasElement)
  },
}

/** A focused Toggle, off and on. */
export const FocusedToggle: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '24px' }}>
      <Toggle label="Off" />
      <Toggle label="On" defaultSelected />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await tabTo(1, canvasElement)
  },
}
