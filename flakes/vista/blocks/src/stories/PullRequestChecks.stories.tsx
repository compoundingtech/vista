import type { Meta, StoryObj } from '@storybook/react'

import { PullRequestChecksView } from '../blocks/PullRequestDataViews.tsx'
import type { ChecksState, WorkflowRunDetails } from '../provider-contracts.ts'
const observedAt = Date.parse('2026-09-22T12:09:00.000Z')

const pullRequest = {
  number: 2968,
  title: 'Vista pull request checks waterfall',
  url: 'https://github.com/schickling/dotfiles/pull/2968',
  state: 'open' as const,
  isDraft: false,
  mergeable: 'mergeable' as const,
  reviewDecision: 'approved' as const,
  headRef: 'schickling/2026-09-22-vista-checks-waterfall',
  headSha: '0123456789abcdef0123456789abcdef01234567',
}

const snapshotRun: WorkflowRunDetails = {
  id: 35_628_602_056,
  name: 'CI',
  attempt: 1,
  status: 'in_progress',
  conclusion: null,
  createdAt: '2026-09-22T12:00:00.000Z',
  startedAt: '2026-09-22T12:00:10.000Z',
  updatedAt: '2026-09-22T12:04:00.000Z',
  url: 'https://github.com/schickling/dotfiles/actions/runs/35628602056',
  jobs: [
    {
      id: 101,
      name: 'types / vista-blocks',
      status: 'completed',
      conclusion: 'success',
      createdAt: '2026-09-22T12:00:00.000Z',
      startedAt: '2026-09-22T12:00:20.000Z',
      completedAt: '2026-09-22T12:02:20.000Z',
      runner: 'dev3',
      url: 'https://github.com/schickling/dotfiles/actions/runs/35628602056/job/101',
      steps: [
        {
          number: 1,
          name: 'Checkout',
          status: 'completed',
          conclusion: 'success',
          startedAt: '2026-09-22T12:00:20.000Z',
          completedAt: '2026-09-22T12:00:40.000Z',
        },
        {
          number: 2,
          name: 'Typecheck Vista blocks',
          status: 'completed',
          conclusion: 'success',
          startedAt: '2026-09-22T12:00:40.000Z',
          completedAt: '2026-09-22T12:02:20.000Z',
        },
      ],
    },
    {
      id: 102,
      name: 'test / linux',
      status: 'in_progress',
      conclusion: null,
      createdAt: '2026-09-22T12:00:00.000Z',
      startedAt: '2026-09-22T12:01:10.000Z',
      completedAt: null,
      runner: 'dev4',
      url: 'https://github.com/schickling/dotfiles/actions/runs/35628602056/job/102',
      steps: [
        {
          number: 1,
          name: 'Run targeted tests',
          status: 'in_progress',
          conclusion: null,
          startedAt: '2026-09-22T12:01:10.000Z',
          completedAt: null,
        },
      ],
    },
    {
      id: 103,
      name: 'nix / mbp2025',
      status: 'queued',
      conclusion: null,
      createdAt: '2026-09-22T12:00:00.000Z',
      startedAt: null,
      completedAt: null,
      runner: '',
      url: 'https://github.com/schickling/dotfiles/actions/runs/35628602056/job/103',
      steps: [],
    },
  ],
}

const liveRun: WorkflowRunDetails = {
  ...snapshotRun,
  updatedAt: '2026-09-22T12:07:00.000Z',
  jobs: snapshotRun.jobs.map((job) => {
    if (job.id === 102) {
      return {
        ...job,
        status: 'completed' as const,
        conclusion: 'success' as const,
        completedAt: '2026-09-22T12:05:30.000Z',
        steps: job.steps.map((step) => ({
          ...step,
          status: 'completed' as const,
          conclusion: 'success' as const,
          completedAt: '2026-09-22T12:05:30.000Z',
        })),
      }
    }
    if (job.id === 103) {
      return {
        ...job,
        status: 'in_progress' as const,
        startedAt: '2026-09-22T12:06:00.000Z',
        runner: 'mbp2025',
        steps: [
          {
            number: 1,
            name: 'Build Darwin closure',
            status: 'in_progress' as const,
            conclusion: null,
            startedAt: '2026-09-22T12:06:00.000Z',
            completedAt: null,
          },
        ],
      }
    }
    return job
  }),
}

const failedRun: WorkflowRunDetails = {
  ...liveRun,
  status: 'completed',
  conclusion: 'failure',
  updatedAt: '2026-09-22T12:09:00.000Z',
  jobs: liveRun.jobs.map((job) =>
    job.id === 102
      ? {
          ...job,
          conclusion: 'failure' as const,
          completedAt: '2026-09-22T12:05:30.000Z',
          steps: job.steps.map((step) => ({
            ...step,
            conclusion: 'failure' as const,
          })),
        }
      : job.id === 103
        ? {
            ...job,
            status: 'completed' as const,
            conclusion: 'cancelled' as const,
            completedAt: '2026-09-22T12:08:00.000Z',
            steps: job.steps.map((step) => ({
              ...step,
              status: 'completed' as const,
              conclusion: 'cancelled' as const,
              completedAt: '2026-09-22T12:08:00.000Z',
            })),
          }
        : job,
  ),
}

const queuedRun: WorkflowRunDetails = {
  ...snapshotRun,
  status: 'queued',
  startedAt: null,
  updatedAt: '2026-09-22T12:01:30.000Z',
  jobs: snapshotRun.jobs.map((job) => ({
    ...job,
    status: 'queued' as const,
    conclusion: null,
    startedAt: null,
    completedAt: null,
    runner: '',
    steps: [],
  })),
}

const stateWithRun = (run: WorkflowRunDetails): ChecksState => ({
  pullRequest,
  checks: {},
  workflowRunCount: 1,
  latestWorkflowRun: {
    name: 'CI',
    status: run.status,
    conclusion: run.conclusion,
    url: run.url,
    headSha: pullRequest.headSha,
    createdAt: run.createdAt,
  },
  run,
  cursor: `checks-story-${run.status}-${run.updatedAt}`,
})

const frozenState = stateWithRun(snapshotRun)
const liveState = stateWithRun(liveRun)
const failedState = stateWithRun(failedRun)
const queuedState = stateWithRun(queuedRun)
const noRunState: ChecksState = {
  pullRequest,
  checks: {
    'external / review': {
      source: 'check-run',
      name: 'external / review',
      status: 'completed',
      conclusion: 'success',
      startedAt: '2026-09-22T12:00:00.000Z',
      completedAt: '2026-09-22T12:00:30.000Z',
      url: 'https://github.com/schickling/dotfiles/actions/runs/35628602056',
    },
  },
  workflowRunCount: 1,
  latestWorkflowRun: {
    name: 'Auto-request review',
    status: 'completed',
    conclusion: 'cancelled',
    url: 'https://github.com/schickling/dotfiles/actions/runs/35628500000',
    headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    createdAt: '2026-09-22T11:50:00.000Z',
  },
  run: null,
  cursor: 'checks-story-no-run',
}

const meta = {
  title: 'Vista/Blocks/PullRequestChecks',
  component: PullRequestChecksView,
  parameters: {
    layout: 'padded',
  },
  args: {
    state: frozenState,
    provenance: 'Frozen',
    observedAt,
  },
} satisfies Meta<typeof PullRequestChecksView>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Story rendering the pull request checks view in its default frozen-snapshot state with no
 * argument overrides.
 */
export const Frozen: Story = {}

/**
 * Story pairing a live checks state with a frozen snapshot under Live provenance to demonstrate
 * the snapshot-overlay presentation.
 */
export const Live: Story = {
  args: {
    state: liveState,
    snapshot: frozenState,
    provenance: 'Live',
  },
}

/** Story showing how the checks view renders a failed state under Live provenance. */
export const Failed: Story = {
  args: {
    state: failedState,
    provenance: 'Live',
  },
}

/** Story showing a queued checks state presented with CatchingUp provenance. */
export const Queued: Story = {
  args: {
    state: queuedState,
    provenance: 'CatchingUp',
  },
}

/**
 * Story showing how the checks view handles a state where no workflow run has been recorded, under
 * Live provenance.
 */
export const NoRun: Story = {
  args: {
    state: noRunState,
    provenance: 'Live',
  },
}

/**
 * Story stacking every state and provenance combination in a vertical grid so all presentations
 * can be compared side by side.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <PullRequestChecksView state={frozenState} provenance="Frozen" observedAt={observedAt} />
      <PullRequestChecksView
        state={liveState}
        snapshot={frozenState}
        provenance="Live"
        observedAt={observedAt}
      />
      <PullRequestChecksView state={failedState} provenance="Live" observedAt={observedAt} />
      <PullRequestChecksView state={queuedState} provenance="CatchingUp" observedAt={observedAt} />
      <PullRequestChecksView state={noRunState} provenance="Live" observedAt={observedAt} />
    </div>
  ),
}
