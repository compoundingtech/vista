import * as React from 'react'

import type { VistaHostRuntime } from './host-runtime.tsx'

// Grafana runtime normally receives this object from the Grafana application shell.
// Vista embeds only the visualisation subtree, so install the same minimal standalone
// fallback before evaluating that subtree instead of letting it report a boot error.
const loadTelemetryRuntime = () => {
  if (typeof window !== 'undefined' && Reflect.get(window, 'grafanaBootData') === undefined) {
    Reflect.set(window, 'grafanaBootData', {
      assets: { dark: '', light: '' },
      settings: {},
      user: {},
      navTree: [],
    })
  }
  return import('@vista/telemetry-island')
}

/**
 * The runtimes the Vista service serves. Only `@vista/blocks/shell` (the service bootstrap and
 * Vista's Storybook) imports this module, so only those builds need the bare-specifier aliases.
 */
export const serviceHostRuntime: VistaHostRuntime = {
  telemetry: { load: loadTelemetryRuntime },
  InterviewQuestion: React.lazy(() =>
    import('@vista/interview/component').then((module) => ({ default: module.InterviewQuestion })),
  ),
}
