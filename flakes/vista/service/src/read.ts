import { Schema } from 'effect'
import { Rpc } from 'effect/rpc'
import { RpcGroup } from 'effect/rpc'

import { VersionSkew, WireEnvelope } from './api-version.ts'
export { VersionSkew } from './api-version.ts'
import { UnknownVersion, VersionReadFailed } from './read-contract.ts'

export {
  AppRow,
  AppVersionIdentity,
  VersionSummary,
  encodeOwner,
  encodeRouteOwner,
  decodeRouteOwner,
  UnknownVersion,
  VersionReadFailed,
} from './read-contract.ts'

// The payload/success schemas are the same version-first envelope as control RPC.
// Consumers restore the typed results through wireCall after version validation.
export const VistaReadApi = RpcGroup.make(Rpc.make('vista.read.apps.list', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: VersionSkew,
}),
Rpc.make('vista.read.version.get', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([UnknownVersion, VersionReadFailed, VersionSkew]),
}),)
