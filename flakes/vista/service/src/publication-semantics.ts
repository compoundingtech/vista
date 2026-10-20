import {
  DecisionStatusSchema,
  SemanticManifestSchema,
  type SemanticManifest,
} from '@vista/blocks/contract'
import { Result, Schema } from 'effect'

// Immutable publications are authoritative bytes, not rebuildable projections.
// Keep this reader while any retained receipt-backed manifest has schemaVersion 1
// (issue #3009); authoring and new publications still use only the current schema.
const FrozenBindingV1 = Schema.Struct({
  provider: Schema.NonEmptyString,
  operation: Schema.NonEmptyString,
  args: Schema.Unknown,
  requestedMode: Schema.Literal('frozen'),
  freezeEffectful: Schema.optionalKey(Schema.Boolean),
})
const nodeFieldsV1 = {
  id: Schema.NonEmptyString,
  parentId: Schema.optionalKey(Schema.NonEmptyString),
  label: Schema.optionalKey(Schema.NonEmptyString),
  refs: Schema.Array(Schema.NonEmptyString),
  bindings: Schema.Array(FrozenBindingV1),
  provenance: Schema.optionalKey(Schema.NonEmptyString),
}
const SemanticManifestV1 = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  app: SemanticManifestSchema.fields.app,
  nodes: Schema.Array(
    Schema.Union([
      Schema.Struct({
        ...nodeFieldsV1,
        kind: Schema.Literals(['app', 'section', 'ask', 'fork', 'evidence', 'island']),
      }),
      Schema.Struct({
        ...nodeFieldsV1,
        kind: Schema.Literal('decision'),
        status: DecisionStatusSchema,
      }),
    ]),
  ),
}).annotate({ identifier: 'Vista.PublicationSemanticManifestV1' })

const decodePublicationManifest = Schema.decodeUnknownResult(
  Schema.fromJsonString(Schema.Union([SemanticManifestSchema, SemanticManifestV1])),
  { onExcessProperty: 'error' },
)

/** Decode retained publication formats without changing their receipt-covered bytes. */
export const decodePublicationSemanticManifestJson = (
  encoded: string,
): Result.Result<SemanticManifest, Schema.SchemaError> =>
  Result.map(decodePublicationManifest(encoded), (manifest): SemanticManifest => {
    if (manifest.schemaVersion === 2) return manifest
    return {
      ...manifest,
      schemaVersion: 2,
      nodes: manifest.nodes.map(({ bindings, ...node }) => ({
        ...node,
        bindings: bindings.map(({ requestedMode, freezeEffectful, ...binding }) => ({
          ...binding,
          policy: {
            mode: requestedMode,
            ...(freezeEffectful === true ? { effectfulCapture: 'acknowledged' as const } : {}),
          },
        })),
      })),
    }
  })
