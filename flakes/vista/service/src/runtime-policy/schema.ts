import { Schema } from 'effect'

import { NonEmptyTrimmedString, VISTA_API_VERSION } from '../api-version.ts'

/**
 * Schema requiring a non-empty, trimmed package specifier string, annotated as part of the Vista
 * runtime-policy contract and used for import roots and package names.
 */
export const PackageSpecifier = NonEmptyTrimmedString.pipe(
  Schema.annotate({ identifier: 'Vista.RuntimePolicy.PackageSpecifier' }),
)
export type PackageSpecifier = typeof PackageSpecifier.Type

/**
 * Schema requiring a non-empty, trimmed directory path that identifies a directory belonging to
 * the workspace closure consumed by the runtime policy.
 */
export const WorkspaceDir = NonEmptyTrimmedString.pipe(
  Schema.annotate({ identifier: 'Vista.RuntimePolicy.WorkspaceDir' }),
)
export type WorkspaceDir = typeof WorkspaceDir.Type

/**
 * Schema for a resolved runtime alias that maps a package specifier to a target path and records
 * whether the aliased specifier is publicly importable.
 */
export const RuntimeAlias = Schema.Struct({
  specifier: PackageSpecifier,
  target: NonEmptyTrimmedString,
  public: Schema.Boolean,
}).annotate({ identifier: 'Vista.RuntimePolicy.RuntimeAlias' })
export type RuntimeAlias = typeof RuntimeAlias.Type

/**
 * Schema for an alias target pairing a resolution kind (root-relative, service-src, blocks, or
 * island) with a non-empty relative path, deferring the kind to a specific directory base.
 */
export const RuntimeAliasTarget = Schema.Struct({
  kind: Schema.Literals(['root-relative', 'service-src', 'blocks', 'island']),
  path: NonEmptyTrimmedString,
}).annotate({ identifier: 'Vista.RuntimePolicy.RuntimeAliasTarget' })
export type RuntimeAliasTarget = typeof RuntimeAliasTarget.Type

/**
 * Schema for a package-contributed alias that pairs a specifier with a kind-tagged target and a
 * public flag, later resolved into a concrete RuntimeAlias.
 */
export const RuntimeAliasContribution = Schema.Struct({
  specifier: PackageSpecifier,
  target: RuntimeAliasTarget,
  public: Schema.Boolean,
}).annotate({ identifier: 'Vista.RuntimePolicy.RuntimeAliasContribution' })
export type RuntimeAliasContribution = typeof RuntimeAliasContribution.Type

/**
 * Schema describing a permitted remote import as a named regular-expression pattern with a
 * human-readable explanation, used to validate external ESM imports.
 */
export const RemoteImportRule = Schema.Struct({
  name: NonEmptyTrimmedString,
  pattern: NonEmptyTrimmedString,
  description: Schema.String,
}).annotate({ identifier: 'Vista.RuntimePolicy.RemoteImportRule' })
export type RemoteImportRule = typeof RemoteImportRule.Type

/**
 * Schema for the merged runtime policy source: a version pinned to the Vista API version plus
 * deduplicated import roots, optimize includes, CSS imports, aliases, remote-import rules, SSR
 * externals, and dedupe lists.
 */
export const RuntimePolicySource = Schema.Struct({
  // One source of the version number: fold into the global vista contract version
  // (decision 0061 / VST-R66) rather than a bespoke per-schema literal.
  schemaVersion: Schema.Literal(VISTA_API_VERSION),
  publicImportRoots: Schema.Array(PackageSpecifier),
  serviceOwnedImportRoots: Schema.Array(PackageSpecifier),
  optimizeInclude: Schema.Array(PackageSpecifier),
  cssImports: Schema.Array(PackageSpecifier),
  aliases: Schema.Array(RuntimeAlias),
  remoteImports: Schema.Array(RemoteImportRule),
  ssrExternal: Schema.Array(PackageSpecifier),
  dedupe: Schema.Array(PackageSpecifier),
}).annotate({ identifier: 'Vista.RuntimePolicy.Source' })
export type RuntimePolicySource = typeof RuntimePolicySource.Type

const RuntimePolicyContributionFields = {
  publicImportRoots: Schema.optional(Schema.Array(PackageSpecifier)),
  serviceOwnedImportRoots: Schema.optional(Schema.Array(PackageSpecifier)),
  optimizeInclude: Schema.optional(Schema.Array(PackageSpecifier)),
  optimizeExcludeRoots: Schema.optional(Schema.Array(PackageSpecifier)),
  cssImports: Schema.optional(Schema.Array(PackageSpecifier)),
  aliases: Schema.optional(Schema.Array(RuntimeAliasContribution)),
  remoteImports: Schema.optional(Schema.Array(RemoteImportRule)),
  ssrExternal: Schema.optional(Schema.Array(PackageSpecifier)),
  dedupe: Schema.optional(Schema.Array(PackageSpecifier)),
}

/**
 * Schema for a named sub-policy that reuses the runtime-policy contribution fields, allowing a
 * single package to declare several independently addressed policy slices.
 */
export const RuntimePolicySlice = Schema.Struct({
  name: NonEmptyTrimmedString,
  ...RuntimePolicyContributionFields,
}).annotate({ identifier: 'Vista.RuntimePolicy.Slice' })
export type RuntimePolicySlice = typeof RuntimePolicySlice.Type

/**
 * Schema for a package's runtime-policy metadata carrying the shared contribution fields plus an
 * optional array of nested slices.
 */
export const RuntimePolicyContribution = Schema.Struct({
  ...RuntimePolicyContributionFields,
  slices: Schema.optional(Schema.Array(RuntimePolicySlice)),
}).annotate({ identifier: 'Vista.RuntimePolicy.Contribution' })
export type RuntimePolicyContribution = typeof RuntimePolicyContribution.Type

const decodeRuntimePolicyContribution = Schema.decodeUnknownSync(RuntimePolicyContribution)

/**
 * Validates and returns the given contribution synchronously against the RuntimePolicyContribution
 * schema, acting as a checked identity for policy declarations.
 */
export const defineRuntimePolicyContribution = (
  contribution: RuntimePolicyContribution,
): RuntimePolicyContribution => decodeRuntimePolicyContribution(contribution)

/**
 * Schema describing the actually installed closure the policy must match: the package names
 * present and the workspace closure directories backing service-owned sources.
 */
export const InstalledRuntimeClosure = Schema.Struct({
  packageNames: Schema.Array(PackageSpecifier),
  workspaceClosureDirs: Schema.Array(WorkspaceDir),
}).annotate({ identifier: 'Vista.RuntimePolicy.InstalledClosure' })
export type InstalledRuntimeClosure = typeof InstalledRuntimeClosure.Type

/**
 * Schema for the projected runtime policy: the validated source fields stamped with the Vista API
 * version together with the installed closure they were checked against.
 */
export const RuntimePolicyProjection = Schema.Struct({
  // Folded into the global vista contract version (decision 0061 / VST-R66).
  schemaVersion: Schema.Literal(VISTA_API_VERSION),
  publicImportRoots: Schema.Array(PackageSpecifier),
  serviceOwnedImportRoots: Schema.Array(PackageSpecifier),
  optimizeInclude: Schema.Array(PackageSpecifier),
  cssImports: Schema.Array(PackageSpecifier),
  aliases: Schema.Array(RuntimeAlias),
  remoteImports: Schema.Array(RemoteImportRule),
  ssrExternal: Schema.Array(PackageSpecifier),
  dedupe: Schema.Array(PackageSpecifier),
  installed: InstalledRuntimeClosure,
}).annotate({ identifier: 'Vista.RuntimePolicy.Projection' })
export type RuntimePolicyProjection = typeof RuntimePolicyProjection.Type

/**
 * Schema enumerating the classification tags assigned to imports during policy analysis,
 * distinguishing local, server, provided, remote (pinned or unpinned), node-builtin,
 * Vite-internal, and rejected imports.
 */
export const ImportClassificationTag = Schema.Literals([
  'local',
  'server-module',
  'provided',
  'remote-esm',
  'remote-unpinned',
  'node-builtin',
  'vite-internal',
  'reject',
]).annotate({ identifier: 'Vista.RuntimePolicy.ImportClassificationTag' })
export type ImportClassificationTag = typeof ImportClassificationTag.Type

/**
 * Schema (with its derived type) classifying a package import by pairing the discriminating
 * classification tag with the offending import specifier and a human-readable reason for the
 * verdict.
 */
export const ImportClassification = Schema.Struct({
  _tag: ImportClassificationTag,
  specifier: Schema.String,
  reason: Schema.String,
}).annotate({ identifier: 'Vista.RuntimePolicy.ImportClassification' })
export type ImportClassification = typeof ImportClassification.Type

/**
 * Schema (with its derived type) recording the outcome of evaluating one package specifier:
 * whether it is allowed, its classification, plus message and guidance strings for surfacing the
 * result to developers.
 */
export const ImportDiagnostic = Schema.Struct({
  specifier: PackageSpecifier,
  allowed: Schema.Boolean,
  classification: ImportClassification,
  message: Schema.String,
  guidance: Schema.String,
}).annotate({ identifier: 'Vista.RuntimePolicy.ImportDiagnostic' })
export type ImportDiagnostic = typeof ImportDiagnostic.Type

/**
 * Schema (with its derived type) attaching an import diagnostic to the specific source file that
 * violated policy, optionally identifying the importing module both as a specifier and as a path
 * relative to the source root.
 */
export const ImportPolicyProblem = Schema.Struct({
  source: PackageSpecifier,
  importer: Schema.optional(Schema.String),
  relativeImporter: Schema.optional(Schema.String),
  diagnostic: ImportDiagnostic,
}).annotate({ identifier: 'Vista.RuntimePolicy.ImportPolicyProblem' })
export type ImportPolicyProblem = typeof ImportPolicyProblem.Type

/**
 * Tagged error raised when runtime policy validation fails, carrying a summary message, flat
 * problem strings, and optionally structured ImportPolicyProblem details for import-specific
 * failures.
 */
export class RuntimePolicyError extends Schema.TaggedError<RuntimePolicyError>()(
  'Vista.RuntimePolicyError',
  {
    message: Schema.String,
    problems: Schema.Array(Schema.String),
    importProblems: Schema.optional(Schema.Array(ImportPolicyProblem)),
  },
) {}
