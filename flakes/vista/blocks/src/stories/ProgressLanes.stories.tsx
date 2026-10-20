import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from 'storybook/test'

import { ProgressLanes } from '../blocks/kit/ProgressLanes.tsx'
import { webfractalLanes } from './_mission-fixtures.tsx'

/** Parallel work state: one row per lane; a lane waiting on the reader carries the you tone. */
const meta = {
  title: 'Vista/Blocks/Kit/ProgressLanes',
  component: ProgressLanes,
  args: { lanes: webfractalLanes },
} satisfies Meta<typeof ProgressLanes>

export default meta

type Story = StoryObj<typeof meta>

/** Every state once: waiting on you, in progress, to do, done. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Waiting on you' })).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(webfractalLanes.length)
  },
}

/** Nothing waits on the reader: no lane carries the you tone. */
export const NothingForYou: Story = {
  args: { lanes: webfractalLanes.filter((lane) => lane.state !== 'you') },
}
