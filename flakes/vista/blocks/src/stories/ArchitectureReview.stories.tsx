import type { Meta, StoryObj } from '@storybook/react'

import { AppShell } from '../AppShell.tsx'
import { ChartBlock } from '../blocks/ChartBlock.tsx'
import { Callout, DecisionLog, InterfacesTable, OptionsGrid } from '../blocks/content.tsx'
import { Diff } from '../blocks/Diff.tsx'
import { Ask, Fork, Settled, StatusLine } from '../blocks/doctrine.tsx'
import { FileTree } from '../blocks/FileTree.tsx'
import { MermaidDiagram } from '../blocks/MermaidDiagram.tsx'
import {
  decisionLogEntries,
  fileTreeEntries,
  forkBranches,
  interfaceRows,
  latencyChart,
  mermaidSource,
  openQuestions,
  optionCards,
  recommendations,
  samplePatch,
  settledDecisions,
} from './_fixtures.ts'

const drivers = ['survives-viewer-failure', 'clean-teardown', 'visual-tui-fidelity']

/**
 * A whole architecture review assembled from the public kit blocks inside the
 * shell — the composition-level review surface. Individual blocks are reviewed
 * under `Vista/Blocks/*`; what this story exists to catch is everything that
 * only shows up when the blocks are stacked: vertical rhythm, heading
 * hierarchy, surface/border adjacency between neighbouring blocks, and whether
 * one theme or viewport breaks the page rather than a single block.
 */
const Review = () => (
  <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem' }}>
    <StatusLine locked={3} open={1} awaiting={0} />
    <Ask recommendations={recommendations} openQuestions={openQuestions} />
    <Callout
      id="review-constraint"
      kind="constraint"
      title="Visual TUIs need a real terminal"
      body="A pipe-only path cannot drive the post-launch visual TUI; a PTY is required."
    />
    <MermaidDiagram
      id="review-diagram"
      source={mermaidSource}
      caption="Supervisor roots the provider; the viewer is an attachable leaf."
    />
    <Fork
      id="review-fork"
      axis="Viewer/provider composition"
      drivers={drivers}
      branches={forkBranches}
    />
    <OptionsGrid id="review-options" options={optionCards} />
    <InterfacesTable id="review-interfaces" rows={interfaceRows} />
    <ChartBlock id="review-chart" chart={latencyChart} caption="Attach latency" />
    <FileTree id="review-tree" entries={fileTreeEntries} caption="Changed files" />
    <Diff
      id="review-diff"
      source={{ _tag: 'patch', patch: samplePatch }}
      caption="src/supervisor.ts"
    />
    <DecisionLog id="review-log" entries={decisionLogEntries} />
    <Settled id="review-settled" decisions={settledDecisions} />
  </main>
)

const meta = {
  title: 'Vista/Compositions/Architecture Review',
  component: AppShell,
  args: {
    title: 'Agent-run viewer architecture',
    children: <Review />,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

/** The full page: every kit family in one review, in the shell. */
export const Default: Story = {}

/** The blocks with no shell chrome — the page rhythm on its own. */
export const BlocksOnly: Story = {
  render: () => <Review />,
}

/** A minimal review: shell plus plain typed content, no kit blocks. */
export const PlainContent: Story = {
  args: {
    children: (
      <main style={{ padding: '1.5rem' }}>
        <h1>Architecture review</h1>
        <p>Ordinary typed React content with no custom renderer.</p>
      </main>
    ),
  },
}

/** Narrow viewport rehearsal: the stacked page must not overflow at ~24rem. */
export const NarrowLayout: Story = {
  render: () => (
    <div style={{ width: '24rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <Review />
    </div>
  ),
}
