import {
  overview,
  Overview,
  OverviewApi,
  OverviewError,
} from '@vista/blocks/internal/provider-contracts'
import { Effect, Layer } from 'effect'

import { implement, mountProvider } from '../provider.ts'

export { Overview, OverviewApi, OverviewError }

/**
 * Pure stub implementation of the overview capability that deterministically derives changed-file
 * counts, additions, deletions, and a size-based verdict from the PR number without any external
 * I/O.
 */
export const overviewImplementation = implement(overview, {
  purity: 'pure',
  handlers: {
    get: ({ repo, pr }) =>
      Effect.sync(() => {
        const changedFiles = (pr % 17) + 1
        const additions = changedFiles * 23
        const deletions = changedFiles * 7
        const verdict =
          additions + deletions > 500
            ? 'large change — app carefully'
            : 'small change — looks routine'
        return new Overview({ repo, pr, changedFiles, additions, deletions, verdict })
      }),
  },
})

export default mountProvider(overviewImplementation, Layer.empty)
