/**
 * Schema-only, node-safe contract for hosts that read Vista documents without rendering them
 * (an st observer decoding `vista-semantics.json`, wf's `st3.resource:vista.app@1` envelope).
 * Imports neither React nor the block kit nor any stylesheet.
 */
export {
  DecisionStatusSchema,
  SemanticKindSchema,
  SemanticManifestSchema,
  SemanticNodeSchema,
  SemanticStatusSchema,
  decodeSemanticManifest,
  decodeSemanticManifestJson,
  type SemanticKind,
  type SemanticManifest,
  type SemanticManifestNode,
  type SemanticStatus,
} from './semantic.ts'
export type { DecisionStatus, Template, Theme } from './model.ts'
/** Frozen publication data shared by schema-only observers and native document hosts. */
export { Snapshot, type SnapshotEntry, type SnapshotKey } from './data-contract.ts'
