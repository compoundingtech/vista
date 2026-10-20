import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  GhCommandLive,
  makeGhProvider,
} from './data/providers/gh.provider.ts'

const liveIt = process.env.VISTA_LIVE_SMOKE === '1' ? it : it.skip

describe('rich provider live smoke', () => {
  liveIt('loads the immutable public pull request through gh', async () => {
    const provider = makeGhProvider(GhCommandLive)
    const pullRequest = await Effect.runPromise(
      provider.core.pullRequest({ repo: 'schickling/dotfiles', pr: 2910 }).pipe(
        Effect.provide(GhCommandLive),
      ),
    )

    expect(pullRequest.files).toHaveLength(4)
    expect(pullRequest.commits).toHaveLength(2)
  }, 120_000)
})
