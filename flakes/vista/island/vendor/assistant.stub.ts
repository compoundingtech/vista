// STUB for `@grafana/assistant` (aliased in vite.config.ts). `@grafana/flamegraph`'s
// `FlameGraphHeader` statically imports `OpenAssistantButton` (the Grafana-Cloud
// "Analyze with Assistant" button). The real package's peer closure is heavy
// (@grafana/scenes + @grafana/runtime + rxjs) and the assistant is irrelevant for
// Vista's offline review island, so we alias it to this no-op. `showAnalyzeWithAssistant`
// still defaults true upstream, but the rendered button is inert.
import * as React from 'react'

/** No-op stand-in for the upstream assistant button — renders nothing. */
export const OpenAssistantButton = (_props: unknown): React.ReactElement | null => null
