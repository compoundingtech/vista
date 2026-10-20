import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import type { ChecksState } from '../provider-contracts.ts'
import { PullRequestChecksView } from './PullRequestDataViews.tsx'

const emptyState: ChecksState = {
  pullRequest: {
    number: 2959,
    title: 'Rich providers',
    url: 'https://github.com/schickling/dotfiles/pull/2959',
    state: 'open',
    isDraft: false,
    mergeable: 'unknown',
    reviewDecision: null,
    headRef: 'schickling/2026-09-19-vista-t3-providers',
    headSha: 'd7ed365e1b23070f89c3f38e15676ee80e7e8ce1',
  },
  checks: {},
  workflowRunCount: 0,
  latestWorkflowRun: null,
  run: null,
  cursor: 'gh-checks:empty',
}

test('renders PR identity and an honest head-and-branch empty state', () => {
  const html = renderToStaticMarkup(<PullRequestChecksView state={emptyState} provenance="Live" />)

  expect(html).toContain('aria-label="Pull request #2959 checks"')
  expect(html).toContain('>#2959</a> Rich providers')
  expect(html).toContain('aria-label="Ready for review"')
  expect(html).toContain('aria-label="Mergeability unknown"')
  expect(html).toContain('aria-label="Review pending"')
  expect(html).toContain('<code>d7ed365</code>')
  expect(html).toContain('No check runs or commit statuses were reported on')
  expect(html).toContain('0 workflow runs were found on')
  expect(html).not.toContain('No checks were reported.')
})
