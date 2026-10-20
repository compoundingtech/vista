import type { SemanticManifest } from '@vista/blocks/internal/authoring'
import {
  BindingPolicy,
  FlatMapManifestEdge,
  type Operation,
} from '@vista/blocks/internal/data-contract'
import { Schema } from 'effect'

/**
 * Describes one planned binding capture as the operation to invoke, the arguments to pass it, and
 * the policy governing how the result is bound.
 */
export interface CapturePlanBinding {
  readonly operation: Operation<string, unknown, unknown, unknown>
  readonly args: unknown
  readonly policy: BindingPolicy
}

/**
 * Capture plan that maps selector keys to functions deriving the binding to record for each value
 * encountered during a capture run.
 */
export interface CapturePlan {
  readonly flatMapSelectors: ReadonlyMap<string, (value: unknown) => CapturePlanBinding>
}
/** Internal serialized binding transport derived from domain components. */
export const DataBindingSchema = Schema.Struct({
  provider: Schema.NonEmptyString,
  operation: Schema.NonEmptyString,
  args: Schema.Unknown,
  policy: BindingPolicy,
  dependency: Schema.optionalKey(FlatMapManifestEdge),
}).annotate({
  identifier: 'Vista.DataBinding',
})
export type DataBinding = typeof DataBindingSchema.Type

/** A manifest binding paired with the semantic DOM target that owns it. */
export const SemanticCaptureBindingSchema = Schema.Struct({
  semanticId: Schema.NonEmptyString,
  provider: Schema.NonEmptyString,
  operation: Schema.NonEmptyString,
  args: Schema.Unknown,
  policy: BindingPolicy,
  dependency: Schema.optionalKey(FlatMapManifestEdge),
}).annotate({
  identifier: 'Vista.SemanticCaptureBinding',
})
export type SemanticCaptureBinding = typeof SemanticCaptureBindingSchema.Type

/** Flatten bindings from the validated manifest without a parallel request model. */
export const bindingsFromManifest = (
  manifest: SemanticManifest,
): readonly SemanticCaptureBinding[] =>
  manifest.nodes.flatMap((node) =>
    node.bindings.map((binding) => ({ semanticId: node.id, ...binding })),
  )
