import type { Meta, StoryObj } from '@storybook/react'

import {
  InterviewQuestion,
  MetricQuery,
  ProfileQuery,
  PullRequestFiles,
  PullRequestOverview,
  TraceQuery,
  TraceSearch,
} from '../index.ts'
import { ProviderHarness } from './_provider-harness.tsx'

/**
 * The provider-backed public components are mounted in the real semantic and
 * AppVersion data-runtime contexts (`DataRuntimeProvider` → `AppRoot` → `Section`).
 * The harness supplies a deterministic fixed snapshot and never falls through
 * to a mocked or ambient network client. These stories review binding, frame,
 * and typed missing-entry presentation; loaded presentation remains covered by
 * the presentation-block fixture stories.
 */
/** Every provider-backed block on one page: one frame vocabulary, one error voice. */
const ProviderBackedBlocks = () => (
  <ProviderHarness heading="Provider-backed blocks">
    <PullRequestOverview repo="schickling/dotfiles" pr={1506} />
    <PullRequestFiles repo="schickling/dotfiles" pr={1506} />
    <TraceSearch query='{ resource.service.name = "vista" }' />
    <MetricQuery id="all-metric-query" query="up" />
    <TraceQuery id="all-trace-query" traceId="4bf92f3577b34da6a3ce929d0e0e4736" />
    <ProfileQuery
      id="all-profile-query"
      profileTypeId="process_cpu:cpu:nanoseconds:cpu:nanoseconds"
      from={1_700_000_000_000}
      until={1_700_003_600_000}
    />
  </ProviderHarness>
)

const meta = {
  title: 'Vista/Blocks/Data/Provider-Backed Blocks',
  component: ProviderBackedBlocks,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ProviderBackedBlocks>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Mounts PullRequestOverview in the provider harness against a real pull request to show its
 * default provider-backed presentation.
 */
export const PullRequestOverviewDefault: Story = {
  name: 'PullRequestOverview',
  render: () => (
    <ProviderHarness heading="Pull request overview">
      <PullRequestOverview repo="schickling/dotfiles" pr={1506} />
    </ProviderHarness>
  ),
}

/** With a caller-supplied `render`: the host owns the loaded presentation. */
export const PullRequestOverviewCustomRender: Story = {
  name: 'PullRequestOverview — custom render',
  render: () => (
    <ProviderHarness heading="Pull request overview (custom render)">
      <PullRequestOverview
        repo="schickling/dotfiles"
        pr={1506}
        render={(overview) => (
          <p>
            {overview.repo}#{overview.pr}: {overview.changedFiles} files, +{overview.additions} / -
            {overview.deletions} — {overview.verdict}
          </p>
        )}
      />
    </ProviderHarness>
  ),
}

/**
 * Mounts PullRequestFiles in the provider harness to show the default provider-backed file-list
 * rendering for a real pull request.
 */
export const PullRequestFilesDefault: Story = {
  name: 'PullRequestFiles',
  render: () => (
    <ProviderHarness heading="Pull request files">
      <PullRequestFiles repo="schickling/dotfiles" pr={1506} />
    </ProviderHarness>
  ),
}

/**
 * Supplies a caller-defined render that lists each file's status with its addition and deletion
 * counts, demonstrating that the host owns the loaded presentation.
 */
export const PullRequestFilesCustomRender: Story = {
  name: 'PullRequestFiles — custom render',
  render: () => (
    <ProviderHarness heading="Pull request files (custom render)">
      <PullRequestFiles
        repo="schickling/dotfiles"
        pr={1506}
        render={(summary) => (
          <ul>
            {summary.files.map((file) => (
              <li key={file.path}>
                {file.status} {file.path} (+{file.additions} / -{file.deletions})
              </li>
            ))}
          </ul>
        )}
      />
    </ProviderHarness>
  ),
}

/**
 * Mounts TraceSearch in the provider harness with a service-name query and a limit of ten to show
 * its default provider-backed results.
 */
export const TraceSearchDefault: Story = {
  name: 'TraceSearch',
  render: () => (
    <ProviderHarness heading="Trace search">
      <TraceSearch query='{ resource.service.name = "vista" }' limit={10} />
    </ProviderHarness>
  ),
}

/**
 * Story demonstrating TraceSearch with a custom render callback that formats each returned trace
 * as a list item showing root service, root trace name, and duration.
 */
export const TraceSearchCustomRender: Story = {
  name: 'TraceSearch — custom render',
  render: () => (
    <ProviderHarness heading="Trace search (custom render)">
      <TraceSearch
        query='{ resource.service.name = "vista" }'
        render={(result) => (
          <ul>
            {result.traces.map((trace) => (
              <li key={trace.traceId}>
                {trace.rootServiceName} · {trace.rootTraceName} · {trace.durationMs}ms
              </li>
            ))}
          </ul>
        )}
      />
    </ProviderHarness>
  ),
}

/** Island-backed metric: the query binds, the telemetry frame owns presentation. */
export const MetricQueryDefault: Story = {
  name: 'MetricQuery',
  render: () => (
    <ProviderHarness heading="Metric query">
      <MetricQuery
        id="metric-query"
        query='rate(node_cpu_seconds_total{instance="dev3"}[5m])'
        stepSeconds={60}
        points={30}
        caption="CPU rate over the last 30 minutes"
      />
    </ProviderHarness>
  ),
}

/** Story showing TraceQuery fetching a single trace by its ID with a supplied title and caption. */
export const TraceQueryDefault: Story = {
  name: 'TraceQuery',
  render: () => (
    <ProviderHarness heading="Trace query">
      <TraceQuery
        id="trace-query"
        traceId="4bf92f3577b34da6a3ce929d0e0e4736"
        title="POST /v1/checkout"
        caption="single trace by id"
      />
    </ProviderHarness>
  ),
}

/**
 * Story showing ProfileQuery loading a one-hour process CPU profile selected by profile type ID
 * and service label selector.
 */
export const ProfileQueryDefault: Story = {
  name: 'ProfileQuery',
  render: () => (
    <ProviderHarness heading="Profile query">
      <ProfileQuery
        id="profile-query"
        profileTypeId="process_cpu:cpu:nanoseconds:cpu:nanoseconds"
        labelSelector='{service_name="vista"}'
        from={1_700_000_000_000}
        until={1_700_003_600_000}
        title="process CPU — one hour"
      />
    </ProviderHarness>
  ),
}

/**
 * The service-backed interview question, mounted inside a `RuntimeIsland`-style
 * host. Its chunk is the real `@vista/interview/component`; without the service
 * behind it the component shows its own loading/failure state.
 */
export const InterviewQuestionDefault: Story = {
  name: 'InterviewQuestion',
  render: () => (
    <ProviderHarness heading="Interview question">
      <InterviewQuestion appId="storybook-review" />
    </ProviderHarness>
  ),
}

/** Every provider-backed block on one page: one frame vocabulary, one error voice. */
export const AllStates: Story = {}
