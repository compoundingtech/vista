import type { Meta, StoryObj } from '@storybook/react'

import { MermaidDiagram } from '../blocks/MermaidDiagram.tsx'
import { mermaidSource } from './_fixtures.ts'

const invalidSource = 'this is not valid mermaid {{{'

const emptySource = ''

/** A wide graph: 12 nodes in two ranks, so panning/zoom and overflow are reviewable. */
const largeSource = `flowchart LR
${Array.from({ length: 12 }, (_unused, i) => `  n${String(i)}[Service ${String(i)}]`).join('\n')}
${Array.from({ length: 11 }, (_unused, i) => `  n${String(i)} --> n${String(i + 1)}`).join('\n')}
  n0 --> n6
  n2 --> n9`

const sequenceSource = `sequenceDiagram
  participant Viewer
  participant Supervisor
  participant Provider
  Viewer->>Supervisor: attach(runId)
  Supervisor->>Provider: spawn
  Provider-->>Supervisor: pid
  Supervisor-->>Viewer: stream`

/**
 * The Mermaid block. Review axes: diagram grammar (flowchart / sequence),
 * source size, the zoom-pan affordance, and the failure path (invalid or empty
 * source must fall back to the raw text, never a blank frame).
 */
const meta = {
  title: 'Vista/Blocks/Diagrams/Mermaid Diagram',
  component: MermaidDiagram,
  args: {
    id: 'diagram-default',
    source: mermaidSource,
    caption: 'Supervisor roots the provider; the viewer is an attachable leaf.',
  },
  argTypes: {
    zoomPan: { control: 'boolean' },
    caption: { control: 'text' },
    id: { control: false },
    source: { control: false },
  },
} satisfies Meta<typeof MermaidDiagram>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Renders the default mermaid flowchart to document the block's standard appearance without zoom
 * or pan interaction.
 */
export const Default: Story = {}

/** Enables the zoomPan flag so the diagram can be scaled and panned by pointer or wheel input. */
export const ZoomPan: Story = {
  args: { id: 'diagram-zoompan', zoomPan: true },
}

/** A different grammar entirely: the block must not assume flowcharts. */
export const Sequence: Story = {
  args: {
    id: 'diagram-sequence',
    source: sequenceSource,
    caption: 'attach handshake',
  },
}

/** 12 nodes: overflow handling, and the case where zoom/pan earns its keep. */
export const LargeGraph: Story = {
  args: { id: 'diagram-large', source: largeSource, zoomPan: true, caption: '12-node service map' },
}

/** Invalid source exercises the try/catch raw-source `<pre>` fallback (no caption). */
export const ErrorFallback: Story = {
  render: () => <MermaidDiagram id="diagram-error" source={invalidSource} />,
}

/** Empty source: nothing to render, and nothing to pretend about. */
export const EmptySource: Story = {
  render: () => <MermaidDiagram id="diagram-empty" source={emptySource} />,
}

/** Narrow column: a wide graph must scroll or scale rather than clip silently. */
export const NarrowColumn: Story = {
  render: () => (
    <div style={{ width: '20rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <MermaidDiagram id="diagram-narrow" source={largeSource} caption="12-node map at 20rem" />
    </div>
  ),
}

/**
 * Stacks the captioned default diagram with the other variants vertically so every rendering mode
 * is reviewable in one story.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Default (with caption)</strong>
        <MermaidDiagram
          id="all-default"
          source={mermaidSource}
          caption="Supervisor roots the provider; the viewer is an attachable leaf."
        />
      </div>
      <div>
        <strong>Sequence grammar</strong>
        <MermaidDiagram id="all-sequence" source={sequenceSource} />
      </div>
      <div>
        <strong>Zoom / pan</strong>
        <MermaidDiagram id="all-zoompan" source={mermaidSource} zoomPan />
      </div>
      <div>
        <strong>Error fallback (raw source)</strong>
        <MermaidDiagram id="all-error" source={invalidSource} />
      </div>
      <div>
        <strong>Empty source</strong>
        <MermaidDiagram id="all-empty" source={emptySource} />
      </div>
    </div>
  ),
}
