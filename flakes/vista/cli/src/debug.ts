import {
  VistaControlApi,
  VistaDebugCommandDescriptors,
  VistaDebuggableControlRpcTags,
} from '@vista/service/control'

/**
 * Exposes the canonical descriptor list for Vista debug subcommands, consumed for routing and for
 * validating debug RPC tag coverage.
 */
export const DEBUG_COMMANDS = VistaDebugCommandDescriptors
/**
 * Enumerates the control RPC tags that are allowed to be exercised by debug tooling, serving as
 * the gate for debuggable control calls.
 */
export const DEBUGGABLE_CONTROL_RPC_TAGS = VistaDebuggableControlRpcTags

/**
 * Element type of the debug command descriptor tuple, giving typed access to each debug
 * subcommand's metadata such as its rpcTags.
 */
export type DebugCommandDescriptor = (typeof DEBUG_COMMANDS)[number]

/**
 * Returns the sorted names of every RPC request registered on the VistaControlApi group, exposing
 * the control surface for parity checks.
 */
export const controlRpcTags = (): readonly string[] =>
  Array.from(
    (VistaControlApi.requests as unknown as ReadonlyMap<string, unknown>).keys(),
  ).toSorted()

/**
 * Collects the deduplicated set of RPC tags referenced by built-in debug command descriptors and
 * returns them in sorted order.
 */
export const debugDescriptorRpcTags = (): readonly string[] =>
  [...new Set(DEBUG_COMMANDS.flatMap((descriptor) => descriptor.rpcTags))].toSorted()

/**
 * Returns the debug command RPC tags that are absent from the control API, surfacing descriptors
 * whose tags would fail to resolve.
 */
export const missingDebugRpcTags = (): readonly string[] => {
  const controlTags = new Set(controlRpcTags())
  return debugDescriptorRpcTags().filter((tag) => !controlTags.has(tag))
}
