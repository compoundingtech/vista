/**
 * `vista debug runtime-policy` output state (decision 0063 / AGT.CLI-R68): the
 * projected client-import and Vite runtime policy. The state IS the
 * machine-output wire schema (`RuntimePolicyInfo`), so `--output json` stays
 * byte-identical.
 */
import { RuntimePolicyInfo } from '@vista/service/control'

/** The `vista debug runtime-policy` machine-output schema (the `--output json` wire anchor). */
export const RuntimePolicyState = RuntimePolicyInfo

export type RuntimePolicyStateType = typeof RuntimePolicyState.Type

/** Pre-fetch placeholder (never rendered: fetch precedes render). */
export const runtimePolicyInitial: RuntimePolicyStateType = {
  schemaVersion: 2,
  publicImportRoots: [],
  serviceOwnedImportRoots: [],
  optimizeInclude: [],
  cssImports: [],
  aliases: [],
  remoteImports: [],
  ssrExternal: [],
  dedupe: [],
  installed: { packageNames: [], workspaceClosureDirs: [] },
}
