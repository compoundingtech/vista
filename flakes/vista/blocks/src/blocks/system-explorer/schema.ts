/** Runtime Schema for validating a directly supplied system graph. */
import { Schema } from 'effect'

const SystemLevel = Schema.Literals(['context', 'container', 'component'])
const SystemAspect = Schema.Literals(['dataflow', 'controlflow', 'ownership', 'telemetry'])

// Optional keys decode to missing properties (`prop?: string`), matching
// `model.ts` under `exactOptionalPropertyTypes` so the decoded `SystemModel`
// remains assignable without a cast. JSON-portable payloads (MED.AUTH-R25)
// never carry explicit `undefined`, so this is also the honest wire shape.
const OptionalString = Schema.optionalKey(Schema.String)

// Hierarchical branded id types: a node id, and (distinctly) an edge id. An edge's
// `source`/`target` reference NODE ids, so they carry the node brand. Branding is a
// type-level phantom — the wire/decoded value stays a plain `string`, and
// `string & Brand` is a subtype of `string`, so the decoded `SystemModelSchema.Type`
// remains assignable to the hand-written `SystemModel` (KR08) with no cast: every
// consumer (`SystemExplorer` `Inner`, `project`, the projection test) works over the
// plain `SystemModel`, into which the branded ids silently widen. Non-cascading.
const SystemNodeId = Schema.String.pipe(Schema.brand('Vista.SystemNodeId'))
const SystemEdgeId = Schema.String.pipe(Schema.brand('Vista.SystemEdgeId'))

const SystemNode = Schema.Struct({
  id: SystemNodeId,
  label: Schema.String,
  blurb: OptionalString,
  level: SystemLevel,
  parent: OptionalString,
  domain: OptionalString,
  lifecycle: OptionalString,
  trust: OptionalString,
}).annotate({ identifier: 'Vista.SystemNode' })

const SystemEdge = Schema.Struct({
  id: SystemEdgeId,
  source: SystemNodeId,
  target: SystemNodeId,
  aspect: SystemAspect,
  label: OptionalString,
}).annotate({ identifier: 'Vista.SystemEdge' })

/** The decode boundary for a system-explorer model (KR08, decision 0018). */
export const SystemModelSchema = Schema.Struct({
  nodes: Schema.Array(SystemNode),
  edges: Schema.Array(SystemEdge),
}).annotate({ identifier: 'Vista.SystemModel' })

/** Decode unknown data into a typed `SystemModel`. */
export const decodeSystemModel = Schema.decodeUnknownResult(SystemModelSchema)
