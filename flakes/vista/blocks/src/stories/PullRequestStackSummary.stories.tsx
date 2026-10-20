import type { Meta, StoryObj } from '@storybook/react'
import { Effect, Schema } from 'effect'
import * as React from 'react'
import { expect, userEvent, within } from 'storybook/test'

import { AppRoot, Section } from '../authoring.tsx'
import { PullRequestStackSummary } from '../blocks/PullRequestDataBlocks.tsx'
import { bind, encodeBinding, type Snapshot } from '../data-contract.ts'
import { DataRuntimeProvider } from '../data-query.tsx'
import { ChecksState, gh, type ChecksState as ChecksStateValue } from '../provider-contracts.ts'

const repo = 'schickling/dotfiles'
const prs = [2932, 2933, 2959, 2960, 2968, 2982] as const
const capturedAt = '2026-09-22T13:00:00.000Z'
const titles = [
  'Vista server components',
  'Vista data runtime',
  'Provider contract boundary',
  'VRS alignment',
  'Live PTY block',
  'Checks waterfall',
] as const

const states: readonly ChecksStateValue[] = prs.map((pr, index) => {
  const status = index === 4 ? ('in_progress' as const) : ('completed' as const)
  const conclusion = index === 4 ? null : index === 1 ? ('failure' as const) : ('success' as const)
  const headSha = `${String(pr).padEnd(40, String(index))}`.slice(0, 40)
  const workflowHeadSha = index === 0 ? 'fedcba9876543210fedcba9876543210fedcba98' : headSha
  return {
    pullRequest: {
      number: pr,
      title: titles[index] ?? `Pull request ${String(pr)}`,
      url: `https://github.com/${repo}/pull/${String(pr)}`,
      state:
        index === 3 ? ('merged' as const) : index === 1 ? ('closed' as const) : ('open' as const),
      isDraft: index === 5,
      mergeable:
        index === 1
          ? ('conflicting' as const)
          : index === 4
            ? ('unknown' as const)
            : ('mergeable' as const),
      reviewDecision: index === 2 ? ('changes_requested' as const) : ('approved' as const),
      headRef: `schickling/vista-stack-${String(pr)}`,
      headSha,
    },
    checks: {},
    workflowRunCount: 1,
    latestWorkflowRun: {
      name: 'CI',
      status,
      conclusion,
      url: `https://github.com/${repo}/actions/runs/${String(35_000 + index)}`,
      headSha: workflowHeadSha,
      createdAt: capturedAt,
    },
    run: null,
    cursor: `stack-${String(pr)}`,
  }
})

const entries = Object.fromEntries(
  states.map((state) => {
    const binding = bind(
      gh.ops.checksStream,
      { repo, pr: state.pullRequest.number },
      { mode: 'frozen', effectfulCapture: 'acknowledged' },
    )
    const encoded = Effect.runSync(encodeBinding(binding))
    return [
      encoded.key,
      {
        provider: gh.id,
        operation: gh.ops.checksStream.tag,
        encodedArgs: encoded.encodedArgs,
        encodedValue: Schema.encodeSync(ChecksState)(state),
        capturedAt,
      },
    ]
  }),
)
const snapshot: Snapshot = { apiVersion: 2, frozenAt: capturedAt, entries }

const StoryRuntime = ({ children }: { readonly children: React.ReactNode }) => (
  <DataRuntimeProvider
    appVersionId="storybook/pull-request-stack/v1"
    snapshot={snapshot}
    dataBaseUrl="http://127.0.0.1/_data/"
  >
    <AppRoot title="Pull request stack" template="architecture-review" scope="storybook">
      <Section id="stack" label="The stack">
        {children}
      </Section>
    </AppRoot>
  </DataRuntimeProvider>
)

const meta = {
  title: 'Vista/Blocks/PullRequestStackSummary',
  component: PullRequestStackSummary,
  decorators: [
    (Story) => (
      <StoryRuntime>
        <Story />
      </StoryRuntime>
    ),
  ],
  parameters: { layout: 'padded' },
  args: {
    repo,
    prs,
    tierLabels: {
      2932: 'T1',
      2933: 'T2',
      2959: 'T3',
      2960: 'VRS',
      2968: 'T4',
      2982: 'Checks',
    },
  },
} satisfies Meta<typeof PullRequestStackSummary>

export default meta
type Story = StoryObj<typeof meta>

/** Story rendering the stack summary with its default set of six pull requests. */
export const SixPullRequests: Story = {}

/**
 * Story narrowing the summary to PR 2959 and asserting via play function that the mergeable,
 * checks-successful, and changes-requested badges are all visible.
 */
export const ChangesRequested: Story = {
  args: { prs: [2959] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByLabelText('Mergeable')).toBeVisible()
    await expect(canvas.getByLabelText('Checks successful')).toBeVisible()
    await expect(canvas.getByLabelText('Changes requested')).toBeVisible()
  },
}

/**
 * Story for PR 2932 verifying that a successful workflow run older than the current head is
 * reported as stale rather than successful.
 */
export const StaleSuccessfulWorkflow: Story = {
  args: { prs: [2932] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const stale = await canvas.findByLabelText('Checks stale: run fedcba9, current head 2932000')
    await expect(canvas.getByLabelText('Mergeable')).toBeVisible()
    await expect(canvas.getByLabelText('Review approved')).toBeVisible()
    await expect(stale).toBeVisible()
    await expect(stale).toHaveTextContent('Stale fedcba9')
    await expect(canvas.queryByLabelText('Checks successful')).not.toBeInTheDocument()
  },
}

/**
 * Interaction story verifying that selecting a PR toggles its aria-pressed state and that
 * arrow-key navigation moves focus between pull request rows.
 */
export const Selection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = await canvas.findByRole('button', { name: /Select pull request #2932/ })
    const third = canvas.getByRole('button', { name: /Select pull request #2959/ })
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(third)
    await expect(third).toHaveAttribute('aria-pressed', 'true')
    third.focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('button', { name: /Select pull request #2960/ })).toHaveFocus()
  },
}

/**
 * Story passing an empty PR list and asserting that the status region renders the no-pull-requests
 * message.
 */
export const Empty: Story = {
  args: { prs: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'No pull requests are in this stack.',
    )
  },
}
