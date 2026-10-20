import { Schema } from 'effect'

import { BindingPolicy, FlatMapManifestEdge } from './data-contract.ts'

import type { DecisionStatus, Template } from './model.ts'

const OptionalString = Schema.optionalKey(Schema.NonEmptyString)

/**
 * Schema enumerating the closed set of semantic node kinds — app, section, ask, decision, fork,
 * evidence, and island — used to discriminate manifest nodes.
 */
export const SemanticKindSchema = Schema.Literals([
  'app',
  'section',
  'ask',
  'decision',
  'fork',
  'evidence',
  'island',
])
export type SemanticKind = typeof SemanticKindSchema.Type

/** Schema restricting a decision's lifecycle state to locked, open, or awaiting-sign-off. */
export const DecisionStatusSchema = Schema.Literals(['locked', 'open', 'awaiting-sign-off'])

/** Internal transport emitted only by typed domain components. */
export const dataBindingSchema = Schema.Struct({
  provider: Schema.NonEmptyString,
  operation: Schema.NonEmptyString,
  args: Schema.Unknown,
  policy: BindingPolicy,
  dependency: Schema.optionalKey(FlatMapManifestEdge),
}).annotate({
  identifier: 'Vista.SemanticDataBinding',
})
export type SemanticDataBinding = typeof dataBindingSchema.Type

const commonNodeFields = {
  parentId: OptionalString,
  /**
   * Human-facing name for this node, used by the shell outline. Optional and
   * additive: manifests written before it existed stay valid at schemaVersion 1,
   * and a node without one falls back to its nearest descendant heading and
   * then to a humanized id.
   */
  label: OptionalString,
  refs: Schema.Array(Schema.NonEmptyString),
  bindings: Schema.Array(dataBindingSchema),
  provenance: OptionalString,
} as const

const ordinaryNodeFor = <TKind extends Exclude<SemanticKind, 'decision'>>(kind: TKind) =>
  Schema.Struct({ id: Schema.NonEmptyString, kind: Schema.Literal(kind), ...commonNodeFields })

const DecisionNodeSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  kind: Schema.Literal('decision'),
  ...commonNodeFields,
  status: DecisionStatusSchema,
})

/**
 * Union schema describing every legal semantic manifest node, delegating all kinds except decision
 * to the shared ordinary-node shape.
 */
export const SemanticNodeSchema = Schema.Union([
  ordinaryNodeFor('app'),
  ordinaryNodeFor('section'),
  ordinaryNodeFor('ask'),
  DecisionNodeSchema,
  ordinaryNodeFor('fork'),
  ordinaryNodeFor('evidence'),
  ordinaryNodeFor('island'),
])
export type SemanticManifestNode = typeof SemanticNodeSchema.Type

/**
 * Schema for decision status rollups holding non-negative counts of locked, open, and
 * awaiting-sign-off decisions.
 */
export const SemanticStatusSchema = Schema.Struct({
  locked: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  open: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  awaiting: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})
export type SemanticStatus = typeof SemanticStatusSchema.Type

/**
 * Schema for the version-2 semantic manifest, pinning app identity, the review template choice,
 * and the node collection that later validation checks.
 */
export const SemanticManifestSchema = Schema.Struct({
  schemaVersion: Schema.Literal(2),
  app: Schema.Struct({
    id: Schema.Literal('app'),
    title: Schema.NonEmptyString,
    template: Schema.Literals([
      'architecture-review',
      'options-comparison',
      'plan-signoff',
      'telemetry-exploration',
      'code-recap',
    ] satisfies readonly Template[]),
    scope: Schema.NonEmptyString,
    status: SemanticStatusSchema,
  }),
  nodes: Schema.Array(SemanticNodeSchema),
}).annotate({ identifier: 'Vista.SemanticManifest' })
export type SemanticManifest = typeof SemanticManifestSchema.Type

/**
 * Decodes an arbitrary unknown value into a SemanticManifest, returning a Result instead of
 * throwing on invalid input.
 */
export const decodeSemanticManifest = Schema.decodeUnknownResult(SemanticManifestSchema, {
  onExcessProperty: 'error',
})
/**
 * Parses a JSON string and validates it against the manifest schema in one step, surfacing
 * malformed input as a Result failure rather than an exception.
 */
export const decodeSemanticManifestJson = Schema.decodeUnknownResult(
  Schema.fromJsonString(SemanticManifestSchema),
  { onExcessProperty: 'error' },
)

/**
 * Discriminated union of structural manifest defects — duplicate ids, dangling refs or parents,
 * DOM mismatches, island nesting, containment cycles, disconnection, or a bad root — each carrying
 * the offending ids and a message.
 */
export type SemanticManifestProblem =
  | { readonly _tag: 'duplicate-id'; readonly id: string; readonly message: string }
  | { readonly _tag: 'dangling-ref'; readonly id: string; readonly ref: string; readonly message: string }
  | { readonly _tag: 'dangling-parent'; readonly id: string; readonly parentId: string; readonly message: string }
  | { readonly _tag: 'dom-correspondence'; readonly id: string; readonly message: string }
  | { readonly _tag: 'island-descendant'; readonly id: string; readonly islandId: string; readonly message: string }
  | { readonly _tag: 'containment-cycle'; readonly ids: readonly string[]; readonly message: string }
  | { readonly _tag: 'disconnected-containment'; readonly id: string; readonly message: string }
  | { readonly _tag: 'invalid-root'; readonly message: string }

/**
 * Runs structural integrity checks over the manifest and returns every problem found, so an empty
 * array certifies a well-formed containment tree.
 */
export const validateSemanticManifest = (
  manifest: SemanticManifest,
): readonly SemanticManifestProblem[] => {
  const problems: SemanticManifestProblem[] = []
  const ids = new Set<string>()
  for (const node of manifest.nodes) {
    if (ids.has(node.id)) {
      problems.push({ _tag: 'duplicate-id', id: node.id, message: `duplicate semantic id "${node.id}"` })
    }
    ids.add(node.id)
  }

  const roots = manifest.nodes.filter((node) => node.kind === 'app')
  if (roots.length !== 1 || roots[0]?.id !== manifest.app.id || roots[0]?.parentId !== undefined) {
    problems.push({
      _tag: 'invalid-root',
      message: `manifest must contain exactly one root app node matching "${manifest.app.id}"`,
    })
  }

  const nodesById = new Map(manifest.nodes.map((node) => [node.id, node]))
  const reportedCycles = new Set<string>()
  for (const node of manifest.nodes) {
    if (node.parentId !== undefined && !ids.has(node.parentId)) {
      problems.push({
        _tag: 'dangling-parent', id: node.id, parentId: node.parentId,
        message: `semantic parent "${node.parentId}" from "${node.id}" does not exist`,
      })
    }
    for (const ref of node.refs) {
      if (!ids.has(ref)) {
        problems.push({
          _tag: 'dangling-ref', id: node.id, ref,
          message: `semantic ref "${ref}" from "${node.id}" does not exist`,
        })
      }
    }

    const ancestry = new Map<string, number>([[node.id, 0]])
    const path = [node.id]
    let parentId = node.parentId
    let containmentResolved = node.id === manifest.app.id
    while (parentId !== undefined) {
      const cycleStart = ancestry.get(parentId)
      if (cycleStart !== undefined) {
        const cycleIds = path.slice(cycleStart).toSorted()
        const signature = cycleIds.join('\0')
        if (!reportedCycles.has(signature)) {
          reportedCycles.add(signature)
          problems.push({
            _tag: 'containment-cycle', ids: cycleIds,
            message: `semantic containment cycle: ${cycleIds.join(' -> ')}`,
          })
        }
        containmentResolved = true
        break
      }
      const parent = nodesById.get(parentId)
      if (parent === undefined) {
        containmentResolved = true
        break
      }
      if (parent.kind === 'island') {
        problems.push({
          _tag: 'island-descendant', id: node.id, islandId: parent.id,
          message: `semantic node "${node.id}" cannot be contained beneath RuntimeIsland "${parent.id}"`,
        })
        containmentResolved = true
        break
      }
      if (parent.id === manifest.app.id) containmentResolved = true
      ancestry.set(parent.id, path.length)
      path.push(parent.id)
      parentId = parent.parentId
    }
    if (!containmentResolved) {
      problems.push({
        _tag: 'disconnected-containment', id: node.id,
        message: `semantic node "${node.id}" is not contained beneath root "${manifest.app.id}"`,
      })
    }
  }
  return problems
}

/**
 * Authoring-time semantic node whose references and data bindings remain mutable while extraction
 * collects the final manifest.
 */
export interface MutableSemanticNode {
  readonly id: string
  readonly kind: SemanticKind
  readonly parentId?: string
  readonly label?: string
  readonly status?: DecisionStatus
  readonly refs: string[]
  readonly bindings: SemanticDataBinding[]
  readonly provenance?: string
}

interface HunkHeader {
  readonly oldLen: number
  readonly newLen: number
  readonly raw: string
}

const HUNK_RE = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/
/**
 * Discriminated union of unified-diff defects: a patch containing no hunks, or a hunk whose
 * declared line count disagrees with the actual old or new side.
 */
export type PatchProblem =
  | { readonly _tag: 'no-hunks'; readonly message: string }
  | { readonly _tag: 'hunk-count-mismatch'; readonly header: string; readonly side: 'old' | 'new'; readonly declared: number; readonly actual: number; readonly message: string }

/**
 * Scans a unified diff's hunk headers and reports declared-versus-actual line count mismatches,
 * treating an empty result as well-formed.
 */
export const validatePatch = (patch: string): readonly PatchProblem[] => {
  const lines = patch.split('\n')
  if (lines.at(-1) === '') lines.pop()
  const problems: PatchProblem[] = []
  let hunkCount = 0
  let index = 0
  while (index < lines.length) {
    const match = HUNK_RE.exec(lines[index] ?? '')
    if (match === null) {
      index += 1
      continue
    }
    hunkCount += 1
    const header: HunkHeader = {
      oldLen: match[1] === undefined ? 1 : Number(match[1]),
      newLen: match[2] === undefined ? 1 : Number(match[2]),
      raw: lines[index]!,
    }
    let oldActual = 0
    let newActual = 0
    index += 1
    while (index < lines.length && !HUNK_RE.test(lines[index] ?? '')) {
      const line = lines[index] ?? ''
      if (!line.startsWith('\\')) {
        if (line.startsWith('+')) newActual += 1
        else if (line.startsWith('-')) oldActual += 1
        else {
          oldActual += 1
          newActual += 1
        }
      }
      index += 1
    }
    if (oldActual !== header.oldLen) {
      problems.push({ _tag: 'hunk-count-mismatch', header: header.raw, side: 'old', declared: header.oldLen, actual: oldActual, message: `hunk "${header.raw}" declares ${header.oldLen} old line(s) but the body has ${oldActual}` })
    }
    if (newActual !== header.newLen) {
      problems.push({ _tag: 'hunk-count-mismatch', header: header.raw, side: 'new', declared: header.newLen, actual: newActual, message: `hunk "${header.raw}" declares ${header.newLen} new line(s) but the body has ${newActual}` })
    }
  }
  if (hunkCount === 0) problems.push({ _tag: 'no-hunks', message: 'patch has no `@@` hunk header — nothing to render' })
  return problems
}
