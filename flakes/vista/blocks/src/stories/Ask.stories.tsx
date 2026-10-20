import type { Meta, StoryObj } from '@storybook/react'

import { Ask } from '../blocks/doctrine.tsx'
import { openQuestions, recommendations } from './_fixtures.ts'

const meta = {
  title: 'Vista/Blocks/Doctrine/Ask',
  component: Ask,
  args: { recommendations, openQuestions },
} satisfies Meta<typeof Ask>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Story that renders the Ask block with its default fixture arguments, showing both
 * recommendations and open questions.
 */
export const Default: Story = {}

/**
 * Story that renders an informational-only Ask with no recommendations or open questions,
 * isolating the informational framing.
 */
export const Informational: Story = {
  args: { informational: true, recommendations: [], openQuestions: [] },
}

/**
 * Story that stacks the default and informational Ask variants in a single canvas so every state
 * can be compared side by side.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Default (recommendations + open questions)</strong>
        <Ask recommendations={recommendations} openQuestions={openQuestions} />
      </div>
      <div>
        <strong>Informational (empty ask)</strong>
        <Ask informational recommendations={[]} openQuestions={[]} />
      </div>
      <div>
        <strong>Recommendations only</strong>
        <Ask recommendations={recommendations} openQuestions={[]} />
      </div>
      <div>
        <strong>Open questions only</strong>
        <Ask recommendations={[]} openQuestions={openQuestions} />
      </div>
    </div>
  ),
}
