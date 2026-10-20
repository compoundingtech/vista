import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { ResizableSplit } from '../blocks/ResizableSplit.tsx'

const Pane = ({ label, detail }: { readonly label: string; readonly detail: string }) => (
  <section
    style={{
      boxSizing: 'border-box',
      height: '100%',
      overflow: 'auto',
      padding: '0.75rem',
      background: 'var(--ds-background-100)',
      color: 'var(--ds-foreground)',
    }}
  >
    <strong style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
      {label}
    </strong>
    <p style={{ color: 'var(--ds-gray-900)', fontSize: '0.78rem', margin: 0 }}>{detail}</p>
  </section>
)

const meta = {
  title: 'Vista/Blocks/Layout/Resizable Split',
  component: ResizableSplit,
  args: {
    id: 'resizable-split',
    direction: 'horizontal',
    initialSize: '18rem',
    minSize: '12rem',
    maxSize: '40rem',
    first: <Pane label="Changed files" detail="Select a file to review its patch." />,
    second: <Pane label="Diff" detail="The second pane fills all remaining space." />,
  },
  argTypes: {
    id: { control: false },
    first: { control: false },
    second: { control: false },
    style: { control: false },
    onResize: { control: false },
    direction: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 'min(56rem, calc(100vw - 2rem))',
          height: '26rem',
          border: '1px solid var(--ds-gray-alpha-400)',
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ResizableSplit>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Storybook story that renders ResizableSplit with no argument overrides so the component's
 * built-in defaults are exercised.
 */
export const Default: Story = {}

/**
 * Storybook story that renders ResizableSplit in vertical orientation with preset initial,
 * minimum, and maximum pane sizes and two labeled panes that resize via the horizontal separator.
 */
export const Vertical: Story = {
  args: {
    id: 'resizable-split-vertical',
    direction: 'vertical',
    initialSize: '10rem',
    minSize: '6rem',
    maxSize: '18rem',
    first: <Pane label="Overview" detail="Drag the horizontal separator to resize this pane." />,
    second: <Pane label="Review" detail="The lower pane fills the remaining height." />,
  },
}

/** A single region with a draggable bottom edge; no fill pane is rendered below it. */
export const BottomEdge: Story = {
  render: () => (
    <ResizableSplit
      id="resizable-split-bottom-edge"
      direction="vertical"
      initialSize="18rem"
      minSize="12rem"
      maxSize="24rem"
      first={
        <Pane
          label="Rail + diff review area"
          detail="The horizontal handle resizes this whole region from its bottom edge."
        />
      }
    />
  ),
}

/**
 * Interaction story verifying that focusing the separator and pressing the right arrow three times
 * increases its aria-valuenow by 48.
 */
export const KeyboardResize: Story = {
  args: { id: 'resizable-split-keyboard' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const separator = canvas.getByRole('separator', { name: 'Resize first pane' })
    const initialValue = Number(separator.getAttribute('aria-valuenow'))

    separator.focus()
    await expect(separator).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')

    await expect(separator).toHaveAttribute('aria-valuenow', String(initialValue + 48))
  },
}
