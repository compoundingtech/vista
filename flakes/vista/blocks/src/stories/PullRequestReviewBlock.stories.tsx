import type { Meta, StoryObj } from '@storybook/react'
import { Effect, Schema } from 'effect'

import { AppRoot, Evidence, Section } from '../authoring.tsx'
import { PullRequestReviewBlock } from '../blocks/PullRequestDataBlocks.tsx'
import { bind, encodeBinding, type Snapshot } from '../data-contract.ts'
import { DataRuntimeProvider } from '../data-query.tsx'
import { gh, PullRequestData } from '../provider-contracts.ts'
import { pullRequest } from './_pull-request-fixtures.ts'

const capturedAt = '2026-09-19T12:00:00.000Z'
const binding = bind(
  gh.ops.pullRequest,
  { repo: 'schickling/axe', pr: 482 },
  {
    mode: 'frozen',
    effectfulCapture: 'acknowledged',
  },
)
const encoded = Effect.runSync(encodeBinding(binding))
const snapshot: Snapshot = {
  apiVersion: 2,
  frozenAt: capturedAt,
  entries: {
    [encoded.key]: {
      provider: gh.id,
      operation: gh.ops.pullRequest.tag,
      encodedArgs: encoded.encodedArgs,
      encodedValue: Schema.encodeSync(PullRequestData)(pullRequest),
      capturedAt,
    },
  },
}

const StoryRuntime = ({ children }: { readonly children: React.ReactNode }) => (
  <DataRuntimeProvider
    appVersionId="storybook/pull-request-review/v1"
    snapshot={snapshot}
    dataBaseUrl="http://127.0.0.1/_data/"
  >
    <AppRoot title="Pull request review" template="architecture-review" scope="storybook">
      <Section id="review" label="Review">
        <Evidence id="pull-request-review">{children}</Evidence>
      </Section>
    </AppRoot>
  </DataRuntimeProvider>
)

const meta = {
  title: 'Vista/Blocks/PullRequestReviewBlock',
  component: PullRequestReviewBlock,
  decorators: [
    (Story) => (
      <StoryRuntime>
        <Story />
      </StoryRuntime>
    ),
  ],
  args: {
    repo: 'schickling/axe',
    pr: 482,
    viewportHeight: '34rem',
  },
} satisfies Meta<typeof PullRequestReviewBlock>

export default meta
type Story = StoryObj<typeof meta>

/** Story rendering the pull request review block from its default fixed snapshot with no overrides. */
export const FixedSnapshot: Story = {}

/** Story disabling the treemap and constraining the viewport height to demonstrate the compact layout. */
export const CompactDiff: Story = {
  args: {
    treemap: 'none',
    viewportHeight: '26rem',
  },
}

/**
 * Story rendering the review block twice in a grid — once with a treemap above and once without —
 * plus a non-collapsible body, to compare configurations.
 */
export const AllStates: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <PullRequestReviewBlock {...args} treemap="above" />
      <PullRequestReviewBlock {...args} id="review-no-map" treemap="none" bodyCollapsible={false} />
    </div>
  ),
}
