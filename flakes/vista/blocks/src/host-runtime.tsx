import * as React from 'react'

import type { TelemetryRuntimeHost } from './data-feed.ts'

/**
 * Identifies, via the application id, which app's pending decision question should be fetched and
 * rendered.
 */
export interface InterviewQuestionProps {
  readonly appId: string
}

/**
 * Browser runtimes only some hosts provide. Vista's own bootstrap passes `serviceHostRuntime`
 * (`@vista/blocks/shell`), which resolves the service-aliased `@vista/telemetry-island` and
 * `@vista/interview/component` chunks. Any other host (webfractal, a Storybook) omits what it does
 * not serve and gets each block's "not available in this host" state instead of a build-time
 * unresolvable bare import from the block barrel.
 */
export interface VistaHostRuntime {
  readonly telemetry?: TelemetryRuntimeHost | undefined
  readonly InterviewQuestion?: React.ComponentType<InterviewQuestionProps> | undefined
}

const VistaHostRuntimeContext = React.createContext<VistaHostRuntime>({})

/** Provides the host's optional browser runtimes to every Vista block below it. */
export const VistaHostRuntimeProvider = VistaHostRuntimeContext.Provider

/** The host runtimes available to this subtree; empty outside a provider. */
export const useVistaHostRuntime = (): VistaHostRuntime => React.useContext(VistaHostRuntimeContext)
