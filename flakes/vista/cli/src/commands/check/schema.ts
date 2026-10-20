export {
  VistaCheckDiagnostic as CheckDiagnostic,
  VistaCheckFailed as CheckFailed,
  VistaCheckReady as CheckReady,
  VistaCheckResult as CheckState,
  type VistaCheckDiagnostic as CheckDiagnosticType,
  type VistaCheckFailed as CheckFailedType,
  type VistaCheckReady as CheckReadyType,
  type VistaCheckResult as CheckStateType,
} from '@vista/service/preflight-contract'

import type { VistaCheckResult } from '@vista/service/preflight-contract'

/** Fetch-first placeholder; never emitted before the local evaluator resolves. */
export const checkInitial: VistaCheckResult = {
  _tag: 'ready',
  path: 'app.tsx',
  title: 'Vista app',
  semanticNodes: 0,
  dataRequests: 0,
  warnings: [],
}
