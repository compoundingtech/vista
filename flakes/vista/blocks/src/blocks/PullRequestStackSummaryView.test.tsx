import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import type { ChecksState } from '../provider-contracts.ts'
import {
  PullRequestStackSummaryFrame,
  PullRequestStackSummaryRowView,
} from './PullRequestStackSummaryView.tsx'

const state: ChecksState = {
  pullRequest: {
    number: 2982,
    title: 'Vista checks waterfall',
    url: 'https://github.com/schickling/dotfiles/pull/2982',
    state: 'open',
    isDraft: false,
    mergeable: 'conflicting',
    reviewDecision: 'changes_requested',
    headRef: 'schickling/2026-09-22-vista-checks-waterfall',
    headSha: '0123456789abcdef0123456789abcdef01234567',
  },
  checks: {},
  workflowRunCount: 1,
  latestWorkflowRun: {
    name: 'CI',
    status: 'completed',
    conclusion: 'failure',
    url: 'https://github.com/schickling/dotfiles/actions/runs/1',
    headSha: '0123456789abcdef0123456789abcdef01234567',
    createdAt: '2026-09-22T12:00:00.000Z',
  },
  run: null,
  cursor: 'summary-test',
}

test('summary row exposes selection, status semantics, links, and head branch', () => {
  const html = renderToStaticMarkup(
    <PullRequestStackSummaryFrame>
      <PullRequestStackSummaryRowView
        state={state}
        tier="Checks"
        selected
        orderedPrs={[2982]}
        onSelect={() => undefined}
      />
    </PullRequestStackSummaryFrame>,
  )

  expect(html).toContain('aria-label="Pull request stack summary"')
  expect(html).toContain('aria-pressed="true"')
  expect(html).toContain('aria-label="Conflicting"')
  expect(html).toContain('aria-label="Checks failure"')
  expect(html).toContain('schickling/2026-09-22-vista-checks-waterfall')
  expect(html).toContain('href="https://github.com/schickling/dotfiles/pull/2982"')
  expect(html).toContain('href="https://github.com/schickling/dotfiles/actions/runs/1"')
})

test('summary row exposes a changes-requested review decision', () => {
  const changesRequestedState: ChecksState = {
    ...state,
    pullRequest: {
      ...state.pullRequest,
      mergeable: 'mergeable',
    },
    latestWorkflowRun: {
      name: 'CI',
      status: 'completed',
      conclusion: 'success',
      url: 'https://github.com/schickling/dotfiles/actions/runs/1',
      headSha: '0123456789abcdef0123456789abcdef01234567',
      createdAt: '2026-09-22T12:00:00.000Z',
    },
  }
  const html = renderToStaticMarkup(
    <PullRequestStackSummaryFrame>
      <PullRequestStackSummaryRowView
        state={changesRequestedState}
        tier="Checks"
        selected
        orderedPrs={[2982]}
        onSelect={() => undefined}
      />
    </PullRequestStackSummaryFrame>,
  )

  expect(html).toContain('>Review</th>')
  expect(html).toContain('aria-label="Changes requested"')
  expect(html).toContain('aria-label="Mergeable"')
  expect(html).toContain('aria-label="Checks successful"')
})

test('summary row marks a successful workflow from another head as stale', () => {
  const staleRunState: ChecksState = {
    ...state,
    latestWorkflowRun: {
      name: 'CI',
      status: 'completed',
      conclusion: 'success',
      url: 'https://github.com/schickling/dotfiles/actions/runs/2',
      headSha: 'fedcba9876543210fedcba9876543210fedcba98',
      createdAt: '2026-09-22T12:00:00.000Z',
    },
  }
  const html = renderToStaticMarkup(
    <PullRequestStackSummaryFrame>
      <PullRequestStackSummaryRowView
        state={staleRunState}
        tier="Checks"
        selected
        orderedPrs={[2982]}
        onSelect={() => undefined}
      />
    </PullRequestStackSummaryFrame>,
  )

  expect(html).toContain('aria-label="Checks stale: run fedcba9, current head 0123456"')
  expect(html).toContain('Stale fedcba9')
  expect(html).not.toContain('Checks successful')
})
