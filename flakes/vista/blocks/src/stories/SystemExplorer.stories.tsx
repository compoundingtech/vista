import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { SystemExplorer } from '../blocks/system-explorer/SystemExplorer.tsx'
import {
  incidentSystemLenses,
  incidentSystemModel,
  systemLenses,
  systemModel,
} from './_fixtures.ts'

/**
 * The React Flow + elk system canvas — ONE component, so every scenario lives
 * here rather than under a second root. Review axes: model (agent-run subsystem
 * vs incident graph), lens (aspects, semantic-zoom floor, per-node drill,
 * focus+context, attribute mute, layout direction), and the live controls
 * (aspect toggles, expand-all, clear-focus, node click to focus).
 */
const meta = {
  title: 'Vista/Blocks/Diagrams/System Explorer',
  component: SystemExplorer,
  args: {
    id: 'sx-default',
    model: systemModel,
    lenses: systemLenses,
    caption: 'Toggle aspects, click a node to focus, expand to drill.',
  },
  argTypes: {
    defaultLensId: { control: 'text' },
    caption: { control: 'text' },
    id: { control: false },
    model: { control: false },
    lenses: { control: false },
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SystemExplorer>

export default meta
type Story = StoryObj<typeof meta>

/** The zero-interaction overview lens: dataflow + controlflow at container level. */
export const Default: Story = {}

/**
 * Boots the explorer with the all-aspects lens preselected so the full, unfiltered system view is
 * shown initially.
 */
export const AllAspects: Story = { args: { id: 'sx-all', defaultLensId: 'all-aspects' } }

/**
 * Opens the explorer focused on the drill-supervisor lens to preview a domain-specific slice of
 * the default system model.
 */
export const DrillSupervisor: Story = {
  args: { id: 'sx-drill', defaultLensId: 'drill-supervisor' },
}

// --- incident graph: the same component over a second domain model ---

/**
 * Reuses the same explorer component over the incident-graph model, defaulting to the blast-radius
 * lens with a focus+context caption.
 */
export const IncidentBlastRadius: Story = {
  args: {
    id: 'sx-incident',
    model: incidentSystemModel,
    lenses: incidentSystemLenses,
    defaultLensId: 'incident-blast-radius',
    caption: 'Incident canvas: blast radius under focus+context.',
  },
}

/**
 * Views the incident model through the pipeline-run lens to demonstrate layered control-flow
 * rendering of the same graph.
 */
export const PipelineRun: Story = {
  args: {
    id: 'sx-pipeline',
    model: incidentSystemModel,
    lenses: incidentSystemLenses,
    defaultLensId: 'pipeline-run',
    caption: 'Pipeline run: control flow, layered down.',
  },
}

/**
 * Applies the telemetry-overlay lens to the shared incident graph so the telemetry aspect is drawn
 * on top of the existing structure.
 */
export const TelemetryOverlay: Story = {
  args: {
    id: 'sx-telemetry',
    model: incidentSystemModel,
    lenses: incidentSystemLenses,
    defaultLensId: 'telemetry-overlay',
    caption: 'Telemetry aspect overlaid on the same graph.',
  },
}

/** Narrow layout: the control row wraps and the canvas keeps its fit-view padding. */
export const NarrowLayout: Story = {
  render: () => (
    <div style={{ width: '30rem', height: '26rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <SystemExplorer id="sx-narrow" model={systemModel} lenses={systemLenses} />
    </div>
  ),
}

/** The lens axis side by side: same model, four different questions. */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {systemLenses.map((lens) => (
        <div key={lens.id} style={{ height: '22rem' }}>
          <strong>{lens.id}</strong>
          <SystemExplorer
            id={`sx-all-${lens.id}`}
            model={systemModel}
            lenses={systemLenses}
            defaultLensId={lens.id}
          />
        </div>
      ))}
      <div style={{ height: '22rem' }}>
        <strong>incident-blast-radius</strong>
        <SystemExplorer
          id="sx-all-incident"
          model={incidentSystemModel}
          lenses={incidentSystemLenses}
          defaultLensId="incident-blast-radius"
        />
      </div>
    </div>
  ),
}

/** Aspect toggles are real edge filters, and each is an independent two-state control. */
export const ToggleAspects: Story = {
  args: { id: 'sx-play-aspects' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const hideDataflow = canvas.getByRole('button', { name: 'Hide dataflow aspect' })
    await expect(hideDataflow).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(hideDataflow)
    const showDataflow = await canvas.findByRole('button', { name: 'Show dataflow aspect' })
    await expect(showDataflow).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(showDataflow)
    await expect(
      await canvas.findByRole('button', { name: 'Hide dataflow aspect' }),
    ).toHaveAttribute('aria-pressed', 'true')
  },
}

/** Focus is set by clicking a node and cleared by the action that only exists while focused. */
export const FocusAndClear: Story = {
  args: { id: 'sx-play-focus' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Clear focused node' })).toBeNull()

    const node = await canvas.findByText('Supervisor')
    await userEvent.click(node)

    const clear = await canvas.findByRole('button', { name: 'Clear focused node' })
    await userEvent.click(clear)
    await expect(canvas.queryByRole('button', { name: 'Clear focused node' })).toBeNull()
  },
}

/** Per-node drill: expand-all is a single control that flips to collapse-all. */
export const ExpandAll: Story = {
  args: { id: 'sx-play-expand' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const expand = canvas.getByRole('button', { name: 'Expand all child nodes' })
    await userEvent.click(expand)
    await expect(
      await canvas.findByRole('button', { name: 'Collapse all child nodes' }),
    ).toBeVisible()
  },
}
