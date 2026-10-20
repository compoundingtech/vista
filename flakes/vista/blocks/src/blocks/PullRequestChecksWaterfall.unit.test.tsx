import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { WorkflowRunDetails } from '../provider-contracts.ts'
import { PullRequestChecksWaterfall } from './PullRequestChecksWaterfall.tsx'

const queuedRun: WorkflowRunDetails = {
  id: 1,
  name: 'CI',
  attempt: 1,
  status: 'queued',
  conclusion: null,
  createdAt: '2026-09-23T10:00:00.000Z',
  startedAt: null,
  updatedAt: '2026-09-23T10:01:30.000Z',
  url: 'https://github.com/example/repository/actions/runs/1',
  jobs: [
    {
      id: 10,
      name: 'build',
      status: 'queued',
      conclusion: null,
      createdAt: '2026-09-23T10:00:00.000Z',
      startedAt: '2026-09-23T10:00:00.000Z',
      completedAt: null,
      runner: '',
      url: 'https://github.com/example/repository/actions/runs/1/job/10',
      steps: [],
    },
  ],
}

describe('PullRequestChecksWaterfall queued timing', () => {
  it('grows queue time without rendering an execution bar when GitHub reports a start time', () => {
    const html = renderToStaticMarkup(
      <PullRequestChecksWaterfall run={queuedRun} provenance="Live" />,
    )

    expect(html).toContain('build: 1m 30s queue wait, 0s run time, queued')
    expect(html).toContain('queued · queue 1m 30s · run 0s')
    // One rectangle defines the queue hatch and one draws the queue segment.
    expect([...html.matchAll(/<rect\b/g)]).toHaveLength(2)
  })
})
