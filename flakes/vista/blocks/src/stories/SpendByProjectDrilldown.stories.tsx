import type { Meta, StoryObj } from '@storybook/react'
import { Schema } from 'effect'
import { expect, userEvent, within } from 'storybook/test'

import { SpendByProjectView } from '../blocks/UsageBlocks.tsx'
import { type LensChecked, LensEnvelope, type ProjectDrilldown } from '../provider-contracts.ts'

const projects = ['dotfiles', 'effect-utils', 'vista', 'axe', 'megarepo', 'private-shared']
const envelope = Schema.decodeSync(LensEnvelope)({
  lens: 'spend_by_project',
  version: 8,
  window: '7d',
  computed_at: '2026-09-22T13:00:00.000Z',
  coverage: {
    ledger_rows: 120,
    ledger_usd: 84,
    attributed_share: 1,
    seat_share: 1,
    seat_identity_share: 1,
    account_share: 1,
    hosts: ['dev3'],
    first_ts: '2026-09-15T13:00:00.000Z',
    last_ts: '2026-09-22T13:00:00.000Z',
  },
  coverage_gate: 0.95,
  coverage_ok: true,
  provenance: { pricing_source: 'OMP Usage', omp_version: 'story', ledger_schema: 6 },
  rows: projects.map((key, index) => ({
    key,
    rank: index + 1,
    usd: 30 - index * 3,
    requests: 60 - index * 4,
  })),
})
const outcome: LensChecked = { _tag: 'ok', envelope }
const drilldown: ProjectDrilldown = {
  window: '7d',
  projects: projects.slice(0, 5).map((project, index) => ({
    project,
    usd: 30 - index * 3,
    requests: 60 - index * 4,
    status: 'drilled',
    worktrees: [
      {
        key: `${project}/main`,
        repo: `schickling/${project}`,
        branch: 'main',
        usd: 18 - index,
        requests: 30 - index,
      },
    ],
  })),
  unDrilled: ['private-shared'],
}

const meta = {
  title: 'Vista/Blocks/SpendByProject/Drilldown',
  component: SpendByProjectView,
  parameters: { layout: 'padded' },
  args: { outcome, drilldown, drilldownProvenance: 'Frozen' },
} satisfies Meta<typeof SpendByProjectView>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Interaction story whose play function opens a captured project, asserts the drilldown table
 * appears with aria-expanded true, and verifies Escape collapses it again.
 */
export const CapturedTopFive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const project = canvas.getByRole('button', { name: /dotfiles Captured/ })
    await userEvent.click(project)
    await expect(project).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByRole('table', { name: 'dotfiles worktrees' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(project).toHaveAttribute('aria-expanded', 'false')
  },
}

/**
 * Interaction story whose play function clicks a project outside the captured top five and asserts
 * a live status message announces the breakdown is opening rather than an inline table.
 */
export const LiveOnlyOutsideTopFive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const project = canvas.getByRole('button', {
      name: /private-shared Not captured — opens live/,
    })
    await userEvent.click(project)
    await expect(project).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Not captured — opening the live worktree breakdown…',
    )
  },
}
