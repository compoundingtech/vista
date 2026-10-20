import type { Meta, StoryObj } from '@storybook/react'
import { Schema } from 'effect'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { SpendByProjectView, UsageOverTimeView } from '../blocks/UsageBlocks.tsx'
import { LensChecked, LensEnvelope } from '../provider-contracts.ts'

const baseEnvelope = {
  version: 8,
  window: '7d',
  computed_at: '2026-09-20T12:00:00.000Z',
  coverage: {
    ledger_rows: 1_240,
    ledger_usd: 431.87,
    attributed_share: 0.982,
    seat_share: 1,
    seat_identity_share: 0.72,
    account_share: 0.982,
    hosts: ['dev3'],
    first_ts: '2026-09-13T12:00:00.000Z',
    last_ts: '2026-09-20T12:00:00.000Z',
  },
  coverage_gate: 0.95,
  coverage_ok: true,
  provenance: {
    pricing_source: 'omp-catalog@18.2.0',
    omp_version: '0.1.0',
    ledger_schema: 6,
  },
} as const

const projectEnvelope = Schema.decodeSync(LensEnvelope)({
  ...baseEnvelope,
  lens: 'spend_by_project',
  rows: [
    { key: 'schickling/dotfiles', rank: 1, usd: 248.73, requests: 3_840 },
    { key: 'effect-utils', rank: 2, usd: 91.42, requests: 1_204 },
    { key: 'livestore', rank: 3, usd: 47.11, requests: 730 },
  ],
})

const chronologyEnvelope = Schema.decodeSync(LensEnvelope)({
  ...baseEnvelope,
  lens: 'usage_over_time',
  filter: { bucket: null, group: null, group_by: 'worktree' },
  rows: [
    {
      bucket: 'day',
      bucket_start: '2026-09-18T00:00:00+02:00',
      group: '2026-09-19-vista-t3-providers@schickling/2026-09-19-vista-t3-providers',
      group_by: 'worktree',
      token_type: 'input',
      usd: 32.1,
    },
    {
      bucket: 'day',
      bucket_start: '2026-09-18T00:00:00+02:00',
      group: '2026-09-19-vista-rsc@schickling/2026-09-19-vista-rsc',
      group_by: 'worktree',
      token_type: 'input',
      usd: 18.4,
    },
    {
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group: '2026-09-19-vista-t3-providers@schickling/2026-09-19-vista-t3-providers',
      group_by: 'worktree',
      token_type: 'input',
      usd: 41.8,
    },
    {
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group: '2026-09-19-vista-rsc@schickling/2026-09-19-vista-rsc',
      group_by: 'worktree',
      token_type: 'input',
      usd: 24.7,
    },
    {
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group: '2026-09-18-stylex@schickling/2026-09-18-stylex',
      group_by: 'worktree',
      token_type: 'input',
      usd: 30,
    },
    {
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group: '2026-09-17-disk-index-grafana@schickling/2026-09-17-disk-index-grafana',
      group_by: 'worktree',
      token_type: 'input',
      usd: 20,
    },
    {
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group: '2026-09-20-servicehub@schickling/2026-09-20-servicehub',
      group_by: 'worktree',
      token_type: 'input',
      usd: 10,
    },
    {
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group: '2026-09-19-omp-usage@schickling/2026-09-19-omp-usage',
      group_by: 'worktree',
      token_type: 'input',
      usd: 5,
    },
    {
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group: '2026-09-12-backup@schickling/2026-09-12-backup',
      group_by: 'worktree',
      token_type: 'input',
      usd: 2,
    },
    {
      bucket: 'hour',
      bucket_start: '2026-09-19T12:00:00+02:00',
      group: '2026-09-19-vista-t3-providers@schickling/2026-09-19-vista-t3-providers',
      group_by: 'worktree',
      token_type: 'input',
      usd: 999,
    },
    {
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group: '2026-09-19-vista-t3-providers@schickling/2026-09-19-vista-t3-providers',
      group_by: 'worktree',
      token_type: 'output',
      usd: null,
    },
  ],
})

const ok = Schema.decodeSync(LensChecked)({ _tag: 'ok', envelope: projectEnvelope })
const belowGate = Schema.decodeSync(LensChecked)({
  _tag: 'below-gate',
  envelope: Schema.decodeSync(LensEnvelope)({
    ...projectEnvelope,
    coverage: { ...projectEnvelope.coverage, account_share: 0.82 },
    coverage_ok: false,
  }),
  accountShare: 0.82,
})
const stale = Schema.decodeSync(LensChecked)({
  _tag: 'stale',
  envelope: projectEnvelope,
  computedAt: '2026-09-01T12:00:00.000Z',
  window: '7d',
})
const unmaterialized = Schema.decodeSync(LensChecked)({
  _tag: 'unmaterialized',
  lens: 'spend_by_project',
  window: '7d',
})
const chronology = Schema.decodeSync(LensChecked)({ _tag: 'ok', envelope: chronologyEnvelope })

const meta = {
  title: 'Vista/Blocks/Data/OMP Usage',
  component: SpendByProjectView,
  args: { outcome: ok },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SpendByProjectView>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Storybook story rendering the spend-by-project view with the default story args, exercising the
 * typical populated outcome.
 */
export const SpendByProject: Story = {}

/**
 * Storybook story feeding the below-gate outcome fixture so the view can be reviewed in its
 * below-coverage-gate state.
 */
export const BelowCoverageGate: Story = {
  args: { outcome: belowGate },
}

/**
 * Storybook story feeding the stale outcome fixture to preview how the block renders when its
 * usage data is out of date.
 */
export const Stale: Story = {
  args: { outcome: stale },
}

/**
 * Storybook story feeding the unmaterialized outcome fixture to preview the view's state before
 * usage data has been materialized.
 */
export const Unmaterialized: Story = {
  args: { outcome: unmaterialized },
}

/**
 * Interactive story rendering the usage-over-time view with a chronology fixture, whose play
 * function asserts the top-5 series plus Other aggregation, the cost-vs-spend disclaimer, and
 * chart behavior.
 */
export const Chronology: Story = {
  render: () => <UsageOverTimeView id="story-usage-over-time" outcome={chronology} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(
        /Top 5 series by total API-equivalent cost; 2 remaining series are combined as Other/,
      ),
    ).toBeVisible()
    await expect(canvas.getAllByText('Other (2)')[0]).toBeVisible()
    await expect(canvas.getByText(/API-equivalent cost, not billed spend/)).toBeVisible()
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('.recharts-line-curve')).toHaveLength(6)
    })
    const linePaths = [...canvasElement.querySelectorAll<SVGPathElement>('.recharts-line-curve')]
    const colors = new Set(linePaths.map((path) => path.getAttribute('stroke')))
    const dashes = new Set(
      linePaths.map((path) => path.getAttribute('stroke-dasharray') ?? 'solid'),
    )
    expect(colors.size).toBe(6)
    expect(dashes.size).toBe(6)
    const axisLabels = [...canvasElement.querySelectorAll('.recharts-label')].map(
      (element) => element.textContent,
    )
    expect(axisLabels).toContain('Day')
    expect(axisLabels).toContain('API-equivalent USD')
    await userEvent.click(canvas.getByText('Chart data · 2 observations'))
    await expect(canvas.getByRole('table', { name: 'Usage over time data' })).toBeVisible()
  },
}

/**
 * Gallery story rendering every spend-by-project and usage view state in a labeled grid so all
 * outcomes can be compared side by side.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <section>
        <h2>Spend by project</h2>
        <SpendByProjectView outcome={ok} />
      </section>
      <section>
        <h2>Below gate</h2>
        <SpendByProjectView outcome={belowGate} />
      </section>
      <section>
        <h2>Stale</h2>
        <SpendByProjectView outcome={stale} />
      </section>
      <section>
        <h2>Unmaterialized</h2>
        <SpendByProjectView outcome={unmaterialized} />
      </section>
      <section>
        <h2>Usage over time</h2>
        <UsageOverTimeView id="story-all-usage-over-time" outcome={chronology} />
      </section>
    </div>
  ),
}
