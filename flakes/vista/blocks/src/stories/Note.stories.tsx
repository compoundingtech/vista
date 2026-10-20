import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { AppShell } from '../AppShell.tsx'
import { ContextHeader } from '../blocks/kit/ContextHeader.tsx'
import { Mark } from '../blocks/kit/Mark.tsx'
import { MissionGraph } from '../blocks/kit/MissionGraph.tsx'
import { Note } from '../blocks/kit/Note.tsx'
import { ProgressLanes } from '../blocks/kit/ProgressLanes.tsx'
import { sidenoteOverlay, sidenoteSteps, webfractalLanes } from './_mission-fixtures.tsx'

const MissionPage = () => (
  <article>
    <h1>Finish Sidenote</h1>
    <ContextHeader
      what="Sidenote turns spoken notes into recordings and readable notes you own."
      why="Work was interrupted; the restart plan is held for review."
      you="Review the safe restart below and reply in chat."
    />
    <p>
      <Note text="This is the reviewed plan, not live execution status.">
        <Mark tone="you">Held for review</Mark>
      </Note>
    </p>
    <h2>The path to daily use</h2>
    <Note text="Boxes are work; rounded gates are pauses for approval. Select either to see what it must prove.">
      <MissionGraph steps={sidenoteSteps} overlay={sidenoteOverlay} />
    </Note>
    <h2>Parallel work</h2>
    <Note text="One row per lane. The purple row waits on you.">
      <ProgressLanes lanes={webfractalLanes} />
    </Note>
  </article>
)

/**
 * Notes say what an element means. The shell owns the Explain toggle: it appears only when the page
 * has Notes, starts off, and Escape closes the overlay.
 */
const meta = {
  title: 'Vista/Blocks/Kit/Note',
  component: AppShell,
  args: { title: 'Finish Sidenote', children: <MissionPage /> },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

export default meta

type Story = StoryObj<typeof meta>

/** A page with Notes: the toggle is present and off. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const toggle = await within(canvasElement).findByRole('button', { name: 'Explain this page' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  },
}

/** Explain on: every note at once, the page dimmed except the noted elements. */
export const ExplainOn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Explain this page' }))
    const layer = await canvas.findByRole('region', { name: 'Page explanations' })
    await expect(within(layer).getByText(/not live execution status/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Hide explanations' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

/** Escape closes the overlay. */
export const EscapeCloses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Explain this page' }))
    await canvas.findByRole('region', { name: 'Page explanations' })
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(canvas.queryByRole('region', { name: 'Page explanations' })).toBeNull(),
    )
  },
}

/** Without Notes the shell shows no toggle. */
export const WithoutNotes: Story = {
  args: {
    children: (
      <article>
        <h1>Finish Sidenote</h1>
        <ProgressLanes lanes={webfractalLanes} />
      </article>
    ),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Serving')
    await expect(
      within(canvasElement).queryByRole('button', { name: 'Explain this page' }),
    ).toBeNull()
  },
}
