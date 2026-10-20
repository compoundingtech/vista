import { composeStories } from '@storybook/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import * as stories from './PullRequestChecks.stories.tsx'

const { Failed, Frozen, Live, NoRun, Queued } = composeStories(stories)

describe('PullRequestChecks stories', () => {
  it('renders the frozen GitHub timing waterfall and summary', () => {
    const html = renderToStaticMarkup(<Frozen />)

    expect(html).toContain('Longest elapsed lane (queue + run)')
    expect(html).toContain('Wall / job time')
    expect(html).toContain('queue wait')
    expect(html).toContain('Workflow jobs. Use arrow keys')
    expect(html).toContain('aria-label="Ready for review"')
    expect(html).toContain('aria-label="Mergeable"')
    expect(html).toContain('aria-label="Review approved"')
    expect(html).not.toContain('Latest branch workflow:')
  })

  it('marks jobs that changed since capture without hiding their textual status', () => {
    const html = renderToStaticMarkup(<Live />)

    expect(html).toContain('data-changed="true"')
    expect(html).toContain('aria-label="Changed since capture"')
    expect(html).toContain('nix / mbp2025')
    expect(html).toContain('in progress')
    expect(html).toContain('updated 2m ago')
  })

  it('names the first failing step and keeps a linkable failed job', () => {
    const html = renderToStaticMarkup(<Failed />)

    expect(html).toContain('test / linux › Run targeted tests')
    expect(html).toContain('failure')
    expect(html).toContain('actions/runs/35628602056')
  })

  it('renders a growing queued run from the provider update time', () => {
    const html = renderToStaticMarkup(<Queued />)

    expect(html).toContain('title="2026-09-22T12:01:30.000Z"')
    expect(html).toContain('aria-label="queued workflow run"')
    expect(html).toContain('queue 1m 30s')
  })

  it('preserves the existing check-row fallback when there is no run', () => {
    const html = renderToStaticMarkup(<NoRun />)

    expect(html).toContain('external / review')
    expect(html).toContain('Latest branch workflow:')
    expect(html).toContain('Auto-request review')
    expect(html).not.toContain('Longest elapsed lane (queue + run)')
  })
})
