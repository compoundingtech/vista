import type { Meta, StoryObj } from '@storybook/react'
import { Effect, Schema } from 'effect'

import { AppRoot, Evidence } from '../authoring.tsx'
import { DiskTreemap } from '../data-components.tsx'
import { bind, DataRuntimeProvider, encodeBinding, type Snapshot } from '../data-query.tsx'
import { diskIndex, TreemapOutcome } from '../provider-contracts.ts'
import { diskModel } from './_treemap-fixtures.ts'

const frozenAt = '2026-09-20T10:00:00.000Z'
const args = { host: 'dev3' as const, perspective: 'tool-artifact' as const, boundaryId: 'bulk' }
const binding = bind(diskIndex.ops.treemap, args)
const encoded = Effect.runSync(encodeBinding(binding))

const snapshotFor = (degraded: boolean): Snapshot => ({
  apiVersion: 2,
  frozenAt,
  entries: {
    [encoded.key]: {
      provider: 'disk-index',
      operation: 'treemap',
      encodedArgs: encoded.encodedArgs,
      encodedValue: Schema.encodeSync(TreemapOutcome)(
        degraded
          ? {
              _tag: 'degraded',
              value: diskModel,
              reasons: ['snapshot health is partial', 'one facet refresh timed out'],
            }
          : { _tag: 'ready', value: diskModel },
      ),
      capturedAt: frozenAt,
    },
  },
})

const DiskStory = ({ degraded }: { readonly degraded: boolean }) => (
  <DataRuntimeProvider
    appVersionId={`storybook/disk-treemap/${degraded ? 'degraded' : 'ready'}`}
    snapshot={snapshotFor(degraded)}
    dataBaseUrl="http://vista.test/story/"
  >
    <AppRoot title="Disk treemap" template="telemetry-exploration" scope="story">
      <Evidence id="disk-treemap">
        <DiskTreemap {...args} />
      </Evidence>
    </AppRoot>
  </DataRuntimeProvider>
)

const meta = {
  title: 'Vista/Blocks/Treemap/DiskTreemap',
  component: DiskTreemap,
  args,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DiskTreemap>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Renders the shared DiskStory fixture with degraded mode off, showing the treemap in its fully
 * resolved state.
 */
export const Ready: Story = { render: () => <DiskStory degraded={false} /> }
/**
 * Renders the shared DiskStory fixture with degraded mode on, verifying the treemap remains
 * legible when the data source is degraded.
 */
export const Degraded: Story = { render: () => <DiskStory degraded /> }
/**
 * Grids the ready and degraded renders together so both data-quality states can be compared side
 * by side.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 24 }}>
      <DiskStory degraded={false} />
      <DiskStory degraded />
    </div>
  ),
}
