/**
 * Runtime Schema for validating a directly supplied treemap hierarchy.
 *
 * `TreemapNode` is self-referential via `children`, so the node schema is defined
 * with `Schema.suspend` + an explicit interface annotation to break the circular
 * type inference — the flat `Schema.Struct` idiom system-explorer uses does not
 * compile for a recursive shape.
 */
import { Schema } from 'effect'

import type { TreemapModel, TreemapNode } from '../../model.ts'

// Optional keys decode to missing properties, matching `model.ts` under
// `exactOptionalPropertyTypes` (see system-explorer/schema.ts).
const TreemapNodeSchema: Schema.Codec<TreemapNode> = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  value: Schema.optionalKey(Schema.Finite),
  children: Schema.optionalKey(
    Schema.Array(Schema.suspend((): Schema.Codec<TreemapNode> => TreemapNodeSchema)),
  ),
  metrics: Schema.optionalKey(Schema.Record(Schema.String, Schema.Finite)),
  // Categorical twin of `metrics` (decision 0068). Must be in the schema or the decode
  // boundary would strip it (Schema.Struct drops excess keys), losing facet-based hiding.
  facets: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
})

/** The decode boundary for a treemap model (KR08, decision 0055). */
export const TreemapModelSchema: Schema.Codec<TreemapModel> = Schema.Struct({
  root: TreemapNodeSchema,
  unit: Schema.optionalKey(Schema.String),
  valueNoun: Schema.optionalKey(Schema.String),
})

/** Decode unknown data into a typed `TreemapModel`. */
export const decodeTreemapModel = Schema.decodeUnknownResult(TreemapModelSchema)
