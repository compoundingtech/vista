import {
  AppRoot,
  DiskTreemap,
  Evidence,
  MetricQuery,
  PullRequestChecks,
  PullRequestReviewBlock,
  Section,
  SpendByProject,
} from '@vista/blocks'

export default function VistaApp() {
  return (
    <AppRoot
      title="Provider review"
      template="architecture-review"
      scope="Snapshot-first review with live checks, telemetry, and usage"
    >
      <Section id="code" label="Code review">
        <Evidence id="pull-request-review">
          <PullRequestReviewBlock repo="schickling/dotfiles" pr={2910} viewportHeight="32rem" />
        </Evidence>
        <Evidence id="pull-request-checks">
          <PullRequestChecks repo="schickling/dotfiles" pr={2935} />
        </Evidence>
      </Section>
      <Section id="operations" label="Operations">
        <Evidence id="metric-query">
          <MetricQuery
            query="rate(http_requests_total[5m])"
            range={{ kind: 'relative', last: '1h' }}
            mode="live"
            refreshEvery={10_000}
          />
        </Evidence>
        <Evidence id="spend-by-project">
          <SpendByProject window="7d" refreshEvery={10_000} />
        </Evidence>
        <Evidence id="disk-treemap">
          <DiskTreemap host="dev3" perspective="tool-artifact" boundaryId="bulk" />
        </Evidence>
      </Section>
    </AppRoot>
  )
}
