import type { Meta, StoryObj } from '@storybook/react'

import { Callout } from '../blocks/content.tsx'
import { longCalloutBody } from './_coverage-fixtures.ts'

const meta = {
  title: 'Vista/Blocks/Content/Callout',
  component: Callout,
  args: {
    id: 'callout-finding',
    kind: 'finding',
    title: 'Viewer crashes are non-fatal',
    body: 'Under the supervised composition a viewer crash leaves the provider running.',
  },
} satisfies Meta<typeof Callout>

export default meta

type Story = StoryObj<typeof meta>

/** The default kind: a finding. */
export const Default: Story = {}

/**
 * Story that renders a callout of the tradeoff kind with a title and body to demonstrate its
 * marker and prose treatment.
 */
export const Tradeoff: Story = {
  args: {
    id: 'callout-tradeoff',
    kind: 'tradeoff',
    title: 'One extra supervision layer',
    body: 'Supervision adds a layer in exchange for clean teardown and crash tolerance.',
  },
}

/**
 * Story that renders a callout of the constraint kind to show how hard-constraint content is
 * marked and styled.
 */
export const Constraint: Story = {
  args: {
    id: 'callout-constraint',
    kind: 'constraint',
    title: 'Visual TUIs need a real terminal',
    body: 'A pipe-only path cannot drive the post-launch visual TUI; a PTY is required.',
  },
}

/**
 * Story that renders a callout of the open-question kind to demonstrate its marker, title, and
 * body layout.
 */
export const OpenQuestion: Story = {
  args: {
    id: 'callout-open-question',
    kind: 'open-question',
    title: 'Projection is an adapter',
    body: 'The outer-environment projection is pluggable so non-tmux hosts slot in.',
  },
}

/** Long prose: the body must wrap without breaking the marker column. */
export const LongBody: Story = {
  args: {
    id: 'callout-long',
    kind: 'tradeoff',
    title:
      'Bounded graceful shutdown with an operator-visible reap counter, escalating after the grace window',
    body: longCalloutBody,
  },
}

/** Narrow column: title, marker, and body must stay readable at ~18rem. */
export const NarrowContainer: Story = {
  render: () => (
    <div style={{ width: '18rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <Callout
        id="callout-narrow"
        kind="constraint"
        title="Visual TUIs need a real terminal"
        body={longCalloutBody}
      />
    </div>
  ),
}

/**
 * Story that renders one callout of every kind in a single column so the full set of visual
 * variants can be reviewed together.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Callout
        id="all-finding"
        kind="finding"
        title="Viewer crashes are non-fatal"
        body="The provider survives a viewer crash."
      />
      <Callout
        id="all-tradeoff"
        kind="tradeoff"
        title="One extra supervision layer"
        body="Supervision buys crash tolerance at the cost of a layer."
      />
      <Callout
        id="all-constraint"
        kind="constraint"
        title="Visual TUIs need a real terminal"
        body="A PTY is required for the post-launch visual path."
      />
      <Callout
        id="all-open-question"
        kind="open-question"
        title="Projection is an adapter"
        body="Pluggable per host so non-tmux hosts slot in."
      />
      <Callout id="all-long" kind="tradeoff" title="Long body" body={longCalloutBody} />
    </div>
  ),
}
