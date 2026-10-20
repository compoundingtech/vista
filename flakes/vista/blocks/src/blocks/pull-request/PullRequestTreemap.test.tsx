import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import { pullRequest } from '../../stories/_pull-request-fixtures.ts'
import { PullRequestTreemap } from './PullRequestTreemap.tsx'
import { PullRequestReview } from './review.tsx'

test('compact PR treemap exposes the shared depth control at depth 4', () => {
  const html = renderToStaticMarkup(
    <PullRequestReview id="pr-depth" pullRequests={[pullRequest]}>
      <PullRequestTreemap />
    </PullRequestReview>,
  )

  expect(html).toContain('role="group" aria-label="Render depth"')
  expect(html).toContain('aria-label="Decrease depth"')
  expect(html).toContain('>depth 4</span>')
  expect(html).toContain('aria-label="Increase depth"')
})
