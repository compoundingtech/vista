import type { Meta, StoryObj } from '@storybook/react'

import {
  AppRoot,
  Ask,
  AskBlock,
  Callout,
  Decision,
  Evidence,
  Fork,
  ForkBlock,
  PullRequestOverview,
  Ref,
  RuntimeIsland,
  Section,
  extractSemanticManifest,
} from '../index.ts'
import { forkBranches, openQuestions, recommendations } from './_fixtures.ts'

const drivers = ['survives-viewer-failure', 'clean-teardown', 'visual-tui-fidelity']

/** The original minimal review: one decision bound to provider data, one island. */
const Review = () => (
  <AppRoot title="Semantic authoring" template="architecture-review" scope="storybook">
    <Section>
      <h2>Source-first review</h2>
      <Decision id="decision" status="open" refs={['evidence']}>
        <PullRequestOverview repo="schickling/dotfiles" pr={1506} />
      </Decision>
      <Evidence id="evidence">
        <p>The rendered target and manifest share one explicit ID.</p>
      </Evidence>
      <RuntimeIsland id="runtime-chart">
        <button type="button">Runtime-only interaction</button>
      </RuntimeIsland>
    </Section>
  </AppRoot>
)

/**
 * Every authoring marker at once: a labelled structural section, a nested
 * addressable section, all three `Decision` statuses, `Ask`/`Fork`/`Evidence`
 * nodes, cross-references via `Ref` and `refs`, and a `RuntimeIsland` that
 * holds visual-only children. The doctrine BLOCKS (`AskBlock`, `ForkBlock`)
 * render inside their semantic counterparts — marker and visual are separate
 * concerns and this is what pairing them looks like.
 */
const FullComposition = () => (
  <AppRoot title="Agent-run viewer architecture" template="architecture-review" scope="storybook">
    <Section label="Framing">
      <h2>Framing</h2>
      <Ask id="ask-composition" label="What composition survives a viewer crash?">
        <AskBlock recommendations={recommendations} openQuestions={openQuestions} />
      </Ask>
    </Section>
    <Section id="analysis" label="Analysis" refs={['ask-composition']}>
      <h2>Analysis</h2>
      <Fork id="fork-composition" label="Viewer/provider composition">
        <ForkBlock
          id="fork-composition-block"
          axis="Viewer/provider composition"
          drivers={drivers}
          branches={forkBranches}
        />
      </Fork>
      <Evidence id="evidence-reap" label="Group reap proof" provenance="tmp/reap-proof.log">
        <p>
          The supervisor reaps the whole process group on exit — see{' '}
          <Ref target="fork-composition">the composition fork</Ref>.
        </p>
      </Evidence>
    </Section>
    <Section label="Decisions">
      <h2>Decisions</h2>
      <Decision
        id="decision-locked"
        status="locked"
        label="Supervised PTY"
        refs={['evidence-reap']}
      >
        <Callout
          id="decision-locked-callout"
          kind="finding"
          title="Supervised PTY + disposable viewer"
          body="A viewer crash leaves the provider running under the supervisor."
        />
      </Decision>
      <Decision id="decision-awaiting" status="awaiting-sign-off" label="Bounded shutdown">
        <p>5s grace, then SIGKILL the group.</p>
      </Decision>
      <Decision id="decision-open" status="open" label="Projection adapter">
        <p>Per-host adapter versus a single tmux implementation.</p>
      </Decision>
    </Section>
    <Section label="Runtime">
      <h2>Runtime</h2>
      <RuntimeIsland id="island-interaction" label="Runtime-only interaction">
        <button type="button">Visual-only child, never extracted</button>
      </RuntimeIsland>
    </Section>
  </AppRoot>
)

const manifest = extractSemanticManifest(<Review />)
const fullManifest = extractSemanticManifest(<FullComposition />)

const meta = {
  title: 'Vista/Authoring/Semantic React',
  component: Review,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Review>

export default meta
type Story = StoryObj<typeof meta>

/** Rendered document beside the manifest extracted from the SAME element tree. */
export const ManifestInspector: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <Review />
      <pre>{JSON.stringify(manifest, null, 2)}</pre>
    </div>
  ),
}

/** Every marker kind, every decision status, refs, and an island — as rendered. */
export const FullMarkerSet: Story = {
  render: () => <FullComposition />,
}

/** The same tree's manifest: node kinds, parents, refs, provenance, bindings. */
export const FullMarkerSetManifest: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <FullComposition />
      <pre>{JSON.stringify(fullManifest, null, 2)}</pre>
    </div>
  ),
}

/** Narrow layout: markers add no chrome, so the page must simply reflow. */
export const NarrowLayout: Story = {
  render: () => (
    <div style={{ width: '24rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <FullComposition />
    </div>
  ),
}
