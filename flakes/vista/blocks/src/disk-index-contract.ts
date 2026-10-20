import { Effect, Result, Schema } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'

import { TreemapModelSchema } from './blocks/treemap/schema.ts'

/**
 * Schema of categorized reasons why loading a disk index can fail, such as a missing file,
 * unreadable content, invalid data, an unsupported schema version, or an unrecognized boundary.
 */
export const DiskIndexErrorReason = Schema.Literals([
  'missing',
  'unreadable',
  'unreachable',
  'invalid',
  'unsupported-schema',
  'unknown-host',
  'unknown-boundary',
])
export type DiskIndexErrorReason = typeof DiskIndexErrorReason.Type

/**
 * Tagged error type carrying a categorized reason plus a descriptive message for disk index read
 * or parse failures.
 */
export class DiskIndexError extends Schema.TaggedError<DiskIndexError>()('DiskIndexError', {
  reason: DiskIndexErrorReason,
  message: Schema.String,
}) {}

/** Every host that publishes a disk-index snapshot, in canary order after dev3 and dev4. */
export const DISK_INDEX_HOSTS = ['dev3', 'dev4', 'mbp2021', 'mini2020', 'mbp2025'] as const
/** Literal schema for a declared disk-index host; RPC payloads name a host, never a URL. */
export const DiskIndexHost = Schema.Literals(DISK_INDEX_HOSTS).annotate({
  identifier: 'Vista.DiskIndex.Host',
})
export type DiskIndexHost = typeof DiskIndexHost.Type
/**
 * Literal schema describing the overall completeness of disk index data as complete, partial, or
 * stale.
 */
export const DiskHealthStatus = Schema.Literals(['complete', 'partial', 'stale'])
export type DiskHealthStatus = typeof DiskHealthStatus.Type
/** Literal schema describing whether a disk's index information is fresh, stale, or of unknown age. */
export const DiskFreshness = Schema.Literals(['fresh', 'stale', 'unknown'])
export type DiskFreshness = typeof DiskFreshness.Type
/**
 * Literal schema describing how completely a disk row is known: fully observed, only partially
 * observed, or derived from metadata alone.
 */
export const DiskRowStatus = Schema.Literals(['observed', 'partial', 'metadata-only'])
export type DiskRowStatus = typeof DiskRowStatus.Type
/** Literal schema classifying a disk subject child as a root family, a directory, or some other entry. */
export const DiskSubjectChildKind = Schema.Literals(['root-family', 'directory', 'other'])
export type DiskSubjectChildKind = typeof DiskSubjectChildKind.Type
/**
 * Literal schema describing the outcome of a disk indexing attempt: running, complete, partial, or
 * interrupted.
 */
export const DiskAttemptStatus = Schema.Literals(['running', 'complete', 'partial', 'interrupted'])
export type DiskAttemptStatus = typeof DiskAttemptStatus.Type
/** Literal schema describing whether a disk facet refresh completed fully or only partially. */
export const DiskFacetRefreshStatus = Schema.Literals(['complete', 'partial'])
export type DiskFacetRefreshStatus = typeof DiskFacetRefreshStatus.Type

/**
 * Literal schema of claim scopes distinguishing a single physical identity from exclusive and
 * native aggregate claims.
 */
export const DiskClaimScope = Schema.Literals([
  'physical-identity',
  'exclusive-aggregate',
  'native-aggregate',
])
export type DiskClaimScope = typeof DiskClaimScope.Type

/**
 * Literal schema of reasons a disk region remains unattributed, such as ZFS pool metadata or
 * non-path allocations.
 */
export const DiskResidualReason = Schema.Literals([
  'unclassified',
  'native-pool-allocation',
  'non-path-allocation',
])
export type DiskResidualReason = typeof DiskResidualReason.Type

/**
 * Literal schema of claim domains naming the storage subsystem (ZFS, Nix, POSIX subtree, or
 * megarepo store) that owns a claim, with the empty string for none.
 */
export const DiskClaimDomain = Schema.Literals([
  '',
  'zfs',
  'nix',
  'posix-subtree',
  'megarepo-store',
])
export type DiskClaimDomain = typeof DiskClaimDomain.Type

/**
 * Literal schema of claim classes detailing how disk usage is attributed, mirroring ZFS usedby*
 * properties plus categories for rooted, unreachable, shared, dedup residue, and owner-region
 * usage.
 */
export const DiskClaimClass = Schema.Literals([
  '',
  'usedbydataset',
  'usedbysnapshots',
  'rooted-exclusive',
  'unreachable-exclusive',
  'cross-path-shared',
  'dedup-link-residue',
  'owner-region-exclusive',
  'cross-owner-shared',
])
export type DiskClaimClass = typeof DiskClaimClass.Type

const SafeNatural = Schema.Natural.check(
  Schema.makeFilter(Number.isSafeInteger, {
    message: 'disk counters must be nonnegative safe integers',
  }),
)

/**
 * Schema for a pool participant entry, recording its owner identifier, object count, and byte
 * footprint using safe natural numbers.
 */
export const DiskPoolParticipant = Schema.Struct({
  ownerId: Schema.NonEmptyString,
  objectCount: SafeNatural,
  participantBytes: SafeNatural,
})
export type DiskPoolParticipant = typeof DiskPoolParticipant.Type

/**
 * Discriminated union schema tagging each disk row as owned by a single profile or by a named pool
 * together with its listed participants.
 */
export const DiskRowOwnership = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('profile-owner'),
    profileOwner: Schema.NonEmptyString,
  }),
  Schema.Struct({
    kind: Schema.Literal('set-owned-pool'),
    poolId: Schema.NonEmptyString,
    participants: Schema.Array(DiskPoolParticipant),
  }),
])
export type DiskRowOwnership = typeof DiskRowOwnership.Type

/**
 * Closed set of the four analysis perspectives—physical plus tool, workspace, and service each
 * crossed with artifact—that determines how disk usage is grouped.
 */
export const DiskPerspective = Schema.Literals([
  'physical',
  'tool-artifact',
  'workspace-artifact',
  'service-artifact',
])
export type DiskPerspective = typeof DiskPerspective.Type

/**
 * Maps every disk perspective to its human-readable display label, such as 'Tool × Artifact', for
 * rendering in the UI.
 */
export const perspectiveLabel: Record<DiskPerspective, string> = {
  physical: 'Physical',
  'tool-artifact': 'Tool × Artifact',
  'workspace-artifact': 'Workspace × Artifact',
  'service-artifact': 'Service × Artifact',
}

/**
 * Class schema reporting the index's overall status, whether its data is complete, and any error
 * strings collected during collection.
 */
export class DiskHealth extends Schema.Class<DiskHealth>('DiskHealth')({
  status: DiskHealthStatus,
  complete: Schema.Boolean,
  errors: Schema.Array(Schema.String),
}) {}

/**
 * Class schema describing one named child allocation within a disk subject, carrying its finite
 * allocated byte count and child kind.
 */
export class DiskSubjectChild extends Schema.Class<DiskSubjectChild>('DiskSubjectChild')({
  name: Schema.String,
  allocatedBytes: Schema.Finite,
  kind: DiskSubjectChildKind,
}) {}

/**
 * Class schema for a per-object usage row that carries measured sizes, path aliases, provenance
 * fields (tool, role, workspace, service), sharing, freshness, and status.
 */
export class DiskFacetRow extends Schema.Class<DiskFacetRow>('DiskFacetRow')({
  objectId: Schema.String,
  allocatedBytes: Schema.NullOr(Schema.Finite),
  apparentBytes: Schema.NullOr(Schema.Finite),
  pathAliases: Schema.Array(Schema.String),
  producerTool: Schema.String,
  artifactRole: Schema.String,
  workspace: Schema.String,
  serviceOwner: Schema.String,
  sharing: Schema.String,
  freshness: DiskFreshness,
  status: DiskRowStatus,
  claimScope: DiskClaimScope,
  claimDomain: DiskClaimDomain,
  claimClass: DiskClaimClass,
  ownership: DiskRowOwnership,
  children: Schema.Array(DiskSubjectChild),
}) {}

/**
 * Class schema summarizing a single facet refresh by its identity and grouping dimensions,
 * wall-clock duration in milliseconds, and terminal status.
 */
export class DiskFacetRefreshSummary extends Schema.Class<DiskFacetRefreshSummary>(
  'DiskFacetRefreshSummary',
)({
  id: Schema.String,
  boundaryId: Schema.String,
  producerTool: Schema.String,
  artifactRole: Schema.String,
  workspace: Schema.String,
  serviceOwner: Schema.String,
  sharing: Schema.String,
  durationMilliseconds: Schema.Finite,
  status: DiskFacetRefreshStatus,
  timedOut: Schema.Boolean,
  stale: Schema.Boolean,
  errors: Schema.Array(Schema.String),
}) {}

/**
 * Class schema describing one mounted filesystem boundary with its total capacity and a byte-level
 * breakdown across used, available, reserved, shared, classified, and residual categories.
 */
export class DiskBoundary extends Schema.Class<DiskBoundary>('DiskBoundary')({
  id: Schema.String,
  kind: Schema.String,
  mountPath: Schema.NullOr(Schema.String),
  filesystem: Schema.String,
  totalBytes: Schema.Finite,
  usedBytes: Schema.Finite,
  availableBytes: Schema.Finite,
  reservedBytes: Schema.Finite,
  sharedBytes: Schema.Finite,
  classifiedBytes: Schema.Finite,
  residualBytes: Schema.Finite,
  residualReason: DiskResidualReason,
  facets: Schema.Array(DiskFacetRow),
}) {}

/**
 * Class schema recording one refresh attempt's start and optional finish timestamps, terminal
 * status, and any accumulated error strings.
 */
export class DiskRefreshAttempt extends Schema.Class<DiskRefreshAttempt>('DiskRefreshAttempt')({
  id: Schema.String,
  startedAtSeconds: Schema.Finite,
  finishedAtSeconds: Schema.NullOr(Schema.Finite),
  status: DiskAttemptStatus,
  errors: Schema.Array(Schema.String),
}) {}

/**
 * Class schema for the complete point-in-time disk index document, combining snapshot identity and
 * generation time with health, boundaries, facet summaries, and the bounded attempt history.
 */
export class DiskSnapshot extends Schema.Class<DiskSnapshot>('DiskSnapshot')({
  schemaVersion: Schema.Finite,
  snapshotId: Schema.String,
  generatedAtSeconds: Schema.Finite,
  health: DiskHealth,
  boundaries: Schema.Array(DiskBoundary),
  facetSummaries: Schema.Array(DiskFacetRefreshSummary),
  refreshAttempts: Schema.Array(DiskRefreshAttempt),
  lastCompleteAttempt: Schema.NullOr(DiskRefreshAttempt),
}) {}

/**
 * Class schema for one aggregated usage bucket keyed by group path, holding byte totals, row
 * count, claim classification, ownership, and the worst freshness and status across member rows.
 */
export class DiskUsageGroup extends Schema.Class<DiskUsageGroup>('DiskUsageGroup')({
  key: Schema.String,
  path: Schema.Array(Schema.String),
  allocatedBytes: Schema.Finite,
  rowCount: Schema.Finite,
  sharing: Schema.String,
  claimScope: DiskClaimScope,
  claimDomain: DiskClaimDomain,
  claimClass: DiskClaimClass,
  ownership: DiskRowOwnership,
  worstFreshness: DiskFreshness,
  worstStatus: DiskRowStatus,
}) {}

/**
 * Class schema for a perspective- and boundary-scoped view of a snapshot that restates capacity
 * totals alongside the derived usage groups.
 */
export class DiskProjection extends Schema.Class<DiskProjection>('DiskProjection')({
  snapshotId: Schema.String,
  generatedAtSeconds: Schema.Finite,
  health: DiskHealth,
  perspective: DiskPerspective,
  boundaryId: Schema.String,
  totalBytes: Schema.Finite,
  usedBytes: Schema.Finite,
  availableBytes: Schema.Finite,
  reservedBytes: Schema.Finite,
  sharedBytes: Schema.Finite,
  classifiedBytes: Schema.Finite,
  residualBytes: Schema.Finite,
  residualReason: DiskResidualReason,
  groups: Schema.Array(DiskUsageGroup),
}) {}

const PositiveFinite = Schema.Finite.check(Schema.isGreaterThan(0))
const NonEmptyTrimmedString = Schema.String.check(Schema.isTrimmed(), Schema.isMinLength(1))

/**
 * Struct schema for optional treemap display tuning—maximum nesting depth and a folding threshold
 * constrained to the inclusive 0–1 range—that rejects unknown keys.
 */
export const TreemapLens = Schema.Struct({
  maxDepth: Schema.optionalKey(PositiveFinite),
  foldBelowFraction: Schema.optionalKey(
    Schema.Finite.check(
      Schema.makeFilter((value) => value >= 0 && value <= 1, {
        message: 'foldBelowFraction must be between zero and one',
      }),
    ),
  ),
}).annotate({
  identifier: 'Vista.DiskIndex.TreemapLens',
})
export type TreemapLens = typeof TreemapLens.Type

/**
 * Struct schema for treemap request arguments requiring a perspective and boundary id plus an
 * optional lens, rejecting excess properties.
 */
export const TreemapArgs = Schema.Struct({
  host: Schema.optionalKey(DiskIndexHost),
  perspective: DiskPerspective,
  boundaryId: NonEmptyTrimmedString,
  lens: Schema.optionalKey(TreemapLens),
}).annotate({
  identifier: 'Vista.DiskIndex.TreemapArgs',
})
export type TreemapArgs = typeof TreemapArgs.Type

/**
 * Generic discriminated union over a value describing the three terminal states of a read: ready,
 * degraded (value plus reasons), or failure (reason and message).
 */
export type Outcome<TValue> =
  | { readonly _tag: 'ready'; readonly value: TValue }
  | { readonly _tag: 'degraded'; readonly value: TValue; readonly reasons: readonly string[] }
  | { readonly _tag: 'failure'; readonly reason: DiskIndexErrorReason; readonly message: string }

/**
 * Schema factory that instantiates the tagged ready/degraded/failure outcome union for any
 * supplied value schema.
 */
export const Outcome = <TValue extends Schema.Top>(value: TValue) =>
  Schema.Union([
    Schema.TaggedStruct('ready', { value }),
    Schema.TaggedStruct('degraded', { value, reasons: Schema.Array(Schema.NonEmptyString) }),
    Schema.TaggedStruct('failure', {
      reason: DiskIndexErrorReason,
      message: Schema.NonEmptyString,
    }),
  ]).annotate({
    identifier: 'Vista.DiskIndex.Outcome',
  })

/**
 * Concrete outcome schema for treemap requests, wrapping the validated treemap model in ready or
 * degraded states or surfacing a failure with reason and message.
 */
export const TreemapOutcome = Outcome(TreemapModelSchema)
export type TreemapOutcome = typeof TreemapOutcome.Type

/**
 * Constant pinning the current wire format version of the disk index contract, to be incremented
 * on breaking payload changes.
 */
export const DISK_INDEX_SCHEMA_VERSION = 2
/**
 * RPC group defining the disk index service surface—snapshot, projection, and treemap methods—each
 * with typed payloads, success schemas, and DiskIndexError failures.
 */
export const DiskIndexApi = RpcGroup.make(
  Rpc.make('hosts', {
    payload: {},
    success: Schema.Array(DiskIndexHost),
    error: DiskIndexError,
  }),
  Rpc.make('snapshot', {
    payload: { host: Schema.optionalKey(DiskIndexHost) },
    success: DiskSnapshot,
    error: DiskIndexError,
  }),
  Rpc.make('projection', {
    payload: {
      host: Schema.optionalKey(DiskIndexHost),
      perspective: DiskPerspective,
      boundaryId: Schema.String,
    },
    success: DiskProjection,
    error: DiskIndexError,
  }),
  Rpc.make('treemap', {
    payload: TreemapArgs,
    success: TreemapOutcome,
    error: DiskIndexError,
  }),
)
/**
 * Rust publishes these counters as `u64`. Vista's public model uses JavaScript
 * numbers, so values outside the nonnegative safe-integer range are rejected
 * rather than rounded; the wire format does not define a string/BigInt encoding.
 */
const WireU64 = Schema.Natural.pipe(
  Schema.check(
    Schema.makeFilter(Number.isSafeInteger, {
      message: 'Rust u64 value must be a nonnegative safe integer',
    }),
  ),
  Schema.annotate({ identifier: 'DiskIndex.WireU64' }),
)

/**
 * Every timestamp rendered by Vista must fit JavaScript's `Date` range. Rust
 * `u64` values can exceed that range while still fitting a safe integer, so
 * the wire boundary refuses them before a component can throw.
 */
const MAX_DATE_TIMESTAMP_SECONDS = 8_640_000_000_000
const WireTimestampSeconds = WireU64.pipe(
  Schema.check(
    Schema.makeFilter((value) => value <= MAX_DATE_TIMESTAMP_SECONDS, {
      message: 'timestamp seconds must fit the JavaScript Date range',
    }),
  ),
  Schema.annotate({ identifier: 'DiskIndex.WireTimestampSeconds' }),
)

/**
 * What a published row's bytes are a claim over. The vocabulary is CLOSED: a
 * member this build does not name fails closed at decode.
 */

/**
 * Which classes each domain owns — the partition the collector enforces when a
 * claim enters durable state, mirrored here so a cross-domain class can never
 * reach a label. `''` pairs with `''` and nothing else.
 */
const CLASSES_BY_DOMAIN: Record<DiskClaimDomain, readonly DiskClaimClass[]> = {
  '': [''],
  zfs: ['usedbydataset', 'usedbysnapshots'],
  nix: ['rooted-exclusive', 'unreachable-exclusive', 'cross-path-shared', 'dedup-link-residue'],
  'posix-subtree': ['owner-region-exclusive', 'cross-owner-shared'],
  'megarepo-store': ['owner-region-exclusive', 'cross-owner-shared'],
}

/**
 * The ONE class a domain uses for a set-owned pool row. ZFS owns no shared
 * class — its sharing is reported through the boundary's `shared_bytes`, not a
 * pool claim — so a zfs pool row is unrepresentable and rejected.
 */
const POOL_CLASS_BY_DOMAIN: Record<DiskClaimDomain, DiskClaimClass | null> = {
  '': null,
  zfs: null,
  nix: 'cross-path-shared',
  'posix-subtree': 'cross-owner-shared',
  'megarepo-store': 'cross-owner-shared',
}

/**
 * WHO a row's allocated bytes belong to (frozen by the collector's ownership
 * core). The FacetRow is the ONE byte carrier: `classified_bytes` is the sum of
 * every row's allocated bytes, and no row is ever excluded from it.
 *
 * q22 ProfileOwner closure means every reachable allocated byte belongs either
 * to exactly one canonical collection region (`profile-owner`) or to a
 * set-owned pool row that carries the shared bytes ONCE (`set-owned-pool`).
 *
 * Owner subjects are JSON/query-only by contract — they are never turned into
 * metric labels anywhere downstream of this provider. Only the bounded
 * claim domain/class pair is label-safe.
 */
/**
 * WHO reaches a set-owned pool row. `participantBytes` is NON-ADDITIVE metadata
 * on that row: at most the row's own allocated bytes, never summed with another
 * participant nor with the row itself.
 */

const WirePoolParticipant = Schema.Struct({
  owner_id: Schema.NonEmptyString,
  object_count: WireU64,
  participant_bytes: WireU64,
})

const WireProfileOwner = Schema.Struct({
  kind: Schema.Literal('profile-owner'),
  profile_owner: Schema.NonEmptyString,
})
const WireSetOwnedPool = Schema.Struct({
  kind: Schema.Literal('set-owned-pool'),
  pool_id: Schema.NonEmptyString,
  participants: Schema.Array(WirePoolParticipant),
})
/** The wire twin: a row declares exactly one of the two owner kinds. */
const WireRowOwnership = Schema.Union([WireProfileOwner, WireSetOwnedPool])
type WireRowOwnership = typeof WireRowOwnership.Type

// --- wire shapes: exactly what the collector writes (serde snake_case) ---

const WireHealth = Schema.Struct({
  status: DiskHealthStatus,
  complete: Schema.Boolean,
  errors: Schema.Array(Schema.String),
})

const WireSubjectChild = Schema.Struct({
  name: Schema.String,
  allocated_bytes: WireU64,
  kind: DiskSubjectChildKind,
})

const WireFacetRowFields = {
  object_id: Schema.String,
  allocated_bytes: Schema.NullOr(WireU64),
  apparent_bytes: Schema.NullOr(WireU64),
  path_aliases: Schema.Array(Schema.String),
  producer_tool: Schema.String,
  artifact_role: Schema.String,
  workspace: Schema.String,
  service_owner: Schema.String,
  sharing: Schema.String,
  freshness: DiskFreshness,
  status: DiskRowStatus,
}

const WireBoundaryFields = {
  id: Schema.String,
  kind: Schema.String,
  mount_path: Schema.NullOr(Schema.String),
  filesystem: Schema.String,
  total_bytes: WireU64,
  used_bytes: WireU64,
  available_bytes: WireU64,
  reserved_bytes: WireU64,
  classified_bytes: WireU64,
  residual_bytes: WireU64,
}

const WireFacetRefreshSummary = Schema.Struct({
  id: Schema.String,
  boundary_id: Schema.String,
  producer_tool: Schema.String,
  artifact_role: Schema.String,
  workspace: Schema.String,
  service_owner: Schema.String,
  sharing: Schema.String,
  duration_milliseconds: WireU64,
  status: DiskFacetRefreshStatus,
  timed_out: Schema.Boolean,
  stale: Schema.Boolean,
  errors: Schema.Array(Schema.String),
})

const WireRefreshAttempt = Schema.Struct({
  id: Schema.String,
  started_at_seconds: WireTimestampSeconds,
  finished_at_seconds: Schema.NullOr(WireTimestampSeconds),
  status: DiskAttemptStatus,
  errors: Schema.Array(Schema.String),
})

/**
 * A row states its ownership explicitly — the closure is per row, since the row
 * is the only byte carrier — plus the bounded claim domain/class pair that
 * classifies the charge (`''` on a physical row). Only that bounded pair is ever
 * safe as a metric label; the owner subjects beside it stay JSON/query-only.
 */
const WireFacetRow = Schema.Struct({
  ...WireFacetRowFields,
  claim_scope: DiskClaimScope,
  claim_domain: DiskClaimDomain,
  claim_class: DiskClaimClass,
  ownership: WireRowOwnership,
  // Optional in schema 2: omission means this authority publishes no refinement.
  children: Schema.optional(Schema.Array(WireSubjectChild)),
})

/**
 * A boundary: `shared_bytes` and the typed residual reason are REQUIRED (never
 * defaulted), and every row declares what its bytes are a claim over. There is
 * no second byte carrier beside the rows.
 */
const WireBoundary = Schema.Struct({
  ...WireBoundaryFields,
  shared_bytes: WireU64,
  residual_reason: DiskResidualReason,
  facets: Schema.Array(WireFacetRow),
})

/** The DOCUMENT (`model.rs::Snapshot`), exactly as the collector writes it. */
const WireSnapshot = Schema.Struct({
  schema_version: Schema.Finite,
  snapshot_id: Schema.String,
  generated_at_seconds: WireTimestampSeconds,
  health: WireHealth,
  boundaries: Schema.Array(WireBoundary),
  facet_summaries: Schema.Array(WireFacetRefreshSummary),
  /** The newest attempts only — bounded, so one document cannot grow with history. */
  refresh_attempts: Schema.Array(WireRefreshAttempt),
  /**
   * The newest attempt that COMPLETED, resolved by the collector against the
   * WHOLE retained history: because `refresh_attempts` is bounded, a failure run
   * longer than that bound must not make the last success look like it never
   * happened. REQUIRED and nullable — `null` is the STATEMENT that nothing has
   * ever completed, never an absent key to guess at — and held to
   * {@link refreshAttemptViolations}, so a value contradicting the attempts the
   * same document retains fails closed.
   */
  last_complete_attempt: Schema.NullOr(WireRefreshAttempt),
})

export type WireSnapshot = typeof WireSnapshot.Type
/**
 * Type alias extracting the wire-format boundary element type from a wire snapshot's boundaries
 * array, including its nested facet rows.
 */
export type WireBoundary = WireSnapshot['boundaries'][number]
/**
 * Type alias extracting the facet row element type from a wire boundary's facets array so raw wire
 * data can be decoded into the modeled facet row.
 */
export type WireFacetRow = WireBoundary['facets'][number]

/**
 * The newest COMPLETE entry of a document's own bounded, newest-first attempt
 * list, mirroring `model.rs::latest_complete_attempt`. `null` when it retained
 * none — this is what the document's carried `last_complete_attempt` is held
 * against, never a substitute for it.
 */
const latestCompleteAttempt = (
  attempts: readonly (typeof WireRefreshAttempt.Type)[],
): typeof WireRefreshAttempt.Type | null =>
  attempts.find((attempt) => attempt.status === 'complete') ?? null

// --- public RPC shapes (camelCase; what the browser decodes) ---

// --- wire → public projection ---

/** The one place the wire ownership union becomes the public one. */
const toRowOwnership = (ownership: WireRowOwnership): DiskRowOwnership => {
  switch (ownership.kind) {
    case 'profile-owner':
      return { kind: 'profile-owner', profileOwner: ownership.profile_owner }
    case 'set-owned-pool':
      return {
        kind: 'set-owned-pool',
        poolId: ownership.pool_id,
        participants: ownership.participants.map((participant) => ({
          ownerId: participant.owner_id,
          objectCount: participant.object_count,
          participantBytes: participant.participant_bytes,
        })),
      }
  }
}

const toFacetRow = (row: WireFacetRow): DiskFacetRow =>
  new DiskFacetRow({
    objectId: row.object_id,
    allocatedBytes: row.allocated_bytes,
    apparentBytes: row.apparent_bytes,
    pathAliases: row.path_aliases,
    producerTool: row.producer_tool,
    artifactRole: row.artifact_role,
    workspace: row.workspace,
    serviceOwner: row.service_owner,
    sharing: row.sharing,
    freshness: row.freshness,
    status: row.status,
    claimScope: row.claim_scope,
    claimDomain: row.claim_domain,
    claimClass: row.claim_class,
    children: (row.children ?? []).map(
      (child) =>
        new DiskSubjectChild({
          name: child.name,
          allocatedBytes: child.allocated_bytes,
          kind: child.kind,
        }),
    ),
    ownership: toRowOwnership(row.ownership),
  })

const toFacetRefreshSummary = (
  summary: typeof WireFacetRefreshSummary.Type,
): DiskFacetRefreshSummary =>
  new DiskFacetRefreshSummary({
    id: summary.id,
    boundaryId: summary.boundary_id,
    producerTool: summary.producer_tool,
    artifactRole: summary.artifact_role,
    workspace: summary.workspace,
    serviceOwner: summary.service_owner,
    sharing: summary.sharing,
    durationMilliseconds: summary.duration_milliseconds,
    status: summary.status,
    timedOut: summary.timed_out,
    stale: summary.stale,
    errors: summary.errors,
  })

const toBoundary = (b: WireBoundary): DiskBoundary =>
  new DiskBoundary({
    id: b.id,
    kind: b.kind,
    mountPath: b.mount_path,
    filesystem: b.filesystem,
    totalBytes: b.total_bytes,
    usedBytes: b.used_bytes,
    availableBytes: b.available_bytes,
    reservedBytes: b.reserved_bytes,
    sharedBytes: b.shared_bytes,
    classifiedBytes: b.classified_bytes,
    residualBytes: b.residual_bytes,
    residualReason: b.residual_reason,
    facets: b.facets.map(toFacetRow),
  })

const toRefreshAttempt = (attempt: typeof WireRefreshAttempt.Type): DiskRefreshAttempt =>
  new DiskRefreshAttempt({
    id: attempt.id,
    startedAtSeconds: attempt.started_at_seconds,
    finishedAtSeconds: attempt.finished_at_seconds,
    status: attempt.status,
    errors: attempt.errors,
  })

const toSnapshot = (wire: WireSnapshot): DiskSnapshot =>
  new DiskSnapshot({
    schemaVersion: wire.schema_version,
    snapshotId: wire.snapshot_id,
    generatedAtSeconds: wire.generated_at_seconds,
    health: new DiskHealth(wire.health),
    boundaries: wire.boundaries.map(toBoundary),
    facetSummaries: wire.facet_summaries.map(toFacetRefreshSummary),
    refreshAttempts: wire.refresh_attempts.map(toRefreshAttempt),
    // Carried through as decoded: the collector already resolved it against the
    // whole retained history, and nothing here re-derives it from the bounded list.
    lastCompleteAttempt:
      wire.last_complete_attempt === null ? null : toRefreshAttempt(wire.last_complete_attempt),
  })

/**
 * Whether a row's present/absent byte fields agree with its status and claim
 * scope — guaranteed by the producer, re-checked here at the serving seam.
 */
const rowBytesConsistent = (row: WireFacetRow): boolean => {
  const allocated = row.allocated_bytes !== null
  const apparent = row.apparent_bytes !== null
  const scopeConsistent = (): boolean => {
    switch (row.claim_scope) {
      case 'physical-identity':
        return row.status === 'metadata-only' ? !allocated && !apparent : allocated && apparent
      case 'native-aggregate':
        // The filesystem reports a dataset's allocated space and never samples its
        // logical size, so an apparent size here would be a fabrication — and a
        // metadata-only aggregate charge carries no bytes to charge at all.
        return row.status !== 'metadata-only' && allocated && !apparent
      case 'exclusive-aggregate':
        // An aggregate is itself a byte charge. Both aggregate scopes therefore
        // require an allocated value and reject metadata-only rows; apparent size
        // remains optional for exclusive directory aggregates.
        return row.status !== 'metadata-only' && allocated
    }
  }
  // A set-owned-pool row carries the pool's shared bytes once, and exists only
  // because those bytes exist, so it is never metadata-only and always
  // allocated. Those are ADDITIONS to the rule of the claim scope it publishes
  // (the producer applies both), never a replacement for it — otherwise a pool
  // row could smuggle a fabricated apparent size past this seam.
  return row.ownership.kind === 'set-owned-pool'
    ? scopeConsistent() && row.status !== 'metadata-only' && allocated
    : scopeConsistent()
}

/**
 * Participant discipline on a set-owned-pool row. Participants are NON-ADDITIVE
 * metadata on the row that already carries the shared bytes: each participant
 * sees at most the whole row, at least two DISTINCT owners must participate (one
 * owner would be an ordinary profile-owner region, and q15 forbids inventing a
 * shared owner), and nothing here is ever summed.
 */
const participantViolations = (boundaryId: string, row: WireFacetRow): readonly string[] => {
  if (row.ownership.kind !== 'set-owned-pool') return []
  const where = `boundary '${boundaryId}' row '${row.object_id}' pool '${row.ownership.pool_id}'`
  const out: string[] = []
  const owners = new Set(row.ownership.participants.map((p) => p.owner_id))
  if (owners.size < 2) {
    out.push(
      `${where}: a set-owned pool needs at least two distinct participants, has ${owners.size}`,
    )
  }
  if (owners.size !== row.ownership.participants.length) {
    out.push(`${where}: duplicate participant owner`)
  }
  const carried = row.allocated_bytes ?? 0
  for (const participant of row.ownership.participants) {
    if (participant.participant_bytes > carried) {
      out.push(
        `${where}: participant '${participant.owner_id}' sees ${participant.participant_bytes} of ${carried} carried bytes`,
      )
    }
  }
  return out
}

/** Child rows refine their parent and never add another byte carrier. */
const childViolations = (boundaryId: string, row: WireFacetRow): readonly string[] => {
  const children = row.children ?? []
  const where = `boundary '${boundaryId}' row '${row.object_id}'`
  const out: string[] = []
  if (children.length > 17) out.push(`${where}: more than 16 named children plus other`)
  const names = new Set<string>()
  for (const child of children) {
    if (child.name.length === 0) out.push(`${where}: child name cannot be empty`)
    if (names.has(child.name)) out.push(`${where}: duplicate child '${child.name}'`)
    names.add(child.name)
  }
  const carried = BigInt(row.allocated_bytes ?? 0)
  const refined = children.reduce((sum, child) => sum + BigInt(child.allocated_bytes), 0n)
  if (refined > carried) {
    out.push(`${where}: children carry ${refined} bytes but parent carries ${carried}`)
  }
  return out
}

/**
 * The byte-accounting identities the collector guarantees, re-checked at the
 * serving seam so a corrupt file can never render lying denominators. Every sum
 * is ALLOCATED bytes; apparent bytes and participant bytes never enter any
 * total. Sums are formed as BigInts even though each decoded term is individually
 * safe: otherwise two safe inputs can cross Number.MAX_SAFE_INTEGER and compare
 * equal after rounding. An accepted snapshot therefore keeps every public number
 * and every aggregate identity in JavaScript's exact integer range.
 *
 * Empty result = sound.
 */
const accountingViolations = (wire: WireSnapshot): readonly string[] => {
  const out: string[] = []
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)
  for (const b of wire.boundaries) {
    const capacityParts = [b.used_bytes, b.available_bytes, b.reserved_bytes].map(BigInt)
    const capacity = capacityParts.reduce((sum, value) => sum + value, 0n)
    if (capacity > maxSafe) {
      out.push(`boundary '${b.id}': capacity sum ${capacity} exceeds the safe integer range`)
    } else if (capacity !== BigInt(b.total_bytes)) {
      out.push(
        `boundary '${b.id}': total ${b.total_bytes} != used ${b.used_bytes} + available ${b.available_bytes} + reserved ${b.reserved_bytes}`,
      )
    }

    // Shared bytes are stored once and charged to several claims, so the
    // attributable total a boundary must explain is used + shared.
    const attributable = BigInt(b.used_bytes) + BigInt(b.shared_bytes)
    const explained = BigInt(b.classified_bytes) + BigInt(b.residual_bytes)
    if (attributable > maxSafe || explained > maxSafe) {
      out.push(
        `boundary '${b.id}': charge identity exceeds the safe integer range (attributable ${attributable}, explained ${explained})`,
      )
    } else if (explained !== attributable) {
      out.push(
        `boundary '${b.id}': used ${b.used_bytes} + shared ${b.shared_bytes} != classified ${b.classified_bytes} + residual ${b.residual_bytes}`,
      )
    }

    // The FacetRow is the ONE byte carrier: every row counts exactly once,
    // including a set-owned-pool row, which carries its shared bytes once.
    const rows = b.facets.reduce((sum, row) => sum + BigInt(row.allocated_bytes ?? 0), 0n)
    if (rows > maxSafe) {
      out.push(`boundary '${b.id}': facet row sum ${rows} exceeds the safe integer range`)
    } else if (rows !== BigInt(b.classified_bytes)) {
      out.push(`boundary '${b.id}': classified ${b.classified_bytes} != facet rows ${rows}`)
    }
    for (const row of b.facets) {
      out.push(...participantViolations(b.id, row), ...childViolations(b.id, row))
    }
    for (const row of b.facets) {
      if (!rowBytesConsistent(row)) {
        out.push(
          `boundary '${b.id}' row '${row.object_id}': bytes inconsistent with status '${row.status}' and claim scope '${row.claim_scope}'`,
        )
      }
    }
  }
  return out
}

const facetSummaryViolations = (wire: WireSnapshot): readonly string[] => {
  const boundaryIds = new Set(wire.boundaries.map((boundary) => boundary.id))
  const summaryIds = new Set<string>()
  const out: string[] = []
  for (const summary of wire.facet_summaries) {
    if (summary.id.length === 0) out.push('facet summary id cannot be empty')
    if (!boundaryIds.has(summary.boundary_id)) {
      out.push(`facet summary '${summary.id}' references unknown boundary '${summary.boundary_id}'`)
    }
    const key = `${summary.boundary_id}\u0000${summary.id}`
    if (summaryIds.has(key)) {
      out.push(`duplicate facet summary id '${summary.id}' for boundary '${summary.boundary_id}'`)
    }
    summaryIds.add(key)
    if (
      summary.status === 'complete' &&
      (summary.stale || summary.timed_out || summary.errors.length > 0)
    ) {
      out.push(`complete facet summary '${summary.id}' contains failure state`)
    }
    if (summary.status === 'partial' && summary.errors.length === 0) {
      out.push(`partial facet summary '${summary.id}' has no errors`)
    }
  }
  return out
}

const refreshAttemptsEqual = (
  left: typeof WireRefreshAttempt.Type,
  right: typeof WireRefreshAttempt.Type,
): boolean =>
  left.id === right.id &&
  left.started_at_seconds === right.started_at_seconds &&
  left.finished_at_seconds === right.finished_at_seconds &&
  left.status === right.status &&
  left.errors.length === right.errors.length &&
  left.errors.every((error, index) => error === right.errors[index])

/**
 * The carried value must describe the newest retained success when one is
 * present. An explicit `null` fails closed if the same document retains one.
 */
const refreshAttemptViolations = (wire: WireSnapshot): readonly string[] => {
  const retained = latestCompleteAttempt(wire.refresh_attempts)
  const carried = wire.last_complete_attempt
  if (carried === null) {
    return retained === null
      ? []
      : [`last_complete_attempt is null, but retained attempt '${retained.id}' completed`]
  }
  const out: string[] = []
  const where = `last complete attempt '${carried.id}'`
  if (carried.status !== 'complete') out.push(`${where} has status '${carried.status}'`)
  if (carried.finished_at_seconds === null) out.push(`${where} never finished`)
  if (carried.errors.length > 0) {
    out.push(`${where} carries errors: ${carried.errors.join('; ')}`)
  }
  if (retained !== null && !refreshAttemptsEqual(retained, carried)) {
    out.push(`${where} contradicts the newest retained complete attempt '${retained.id}'`)
  }
  return out
}

/**
 * Structural identities are scoped exactly as the producer defines them:
 * boundary ids are snapshot-global; object ids and set-owned pool ids are
 * unique only within their boundary.
 */
const identityViolations = (wire: WireSnapshot): readonly string[] => {
  const boundaryIds = new Set<string>()
  const out: string[] = []
  for (const boundary of wire.boundaries) {
    if (boundaryIds.has(boundary.id)) {
      out.push(`duplicate boundary id '${boundary.id}'`)
    }
    boundaryIds.add(boundary.id)

    const objectIds = new Set<string>()
    const poolIds = new Set<string>()
    for (const row of boundary.facets) {
      if (objectIds.has(row.object_id)) {
        out.push(`duplicate row object id '${row.object_id}' in boundary '${boundary.id}'`)
      }
      objectIds.add(row.object_id)
      if (row.ownership.kind !== 'set-owned-pool') continue
      if (poolIds.has(row.ownership.pool_id)) {
        out.push(`duplicate pool id '${row.ownership.pool_id}' in boundary '${boundary.id}'`)
      }
      poolIds.add(row.ownership.pool_id)
    }
  }
  return out
}

/**
 * Claim-taxonomy discipline:
 *   - a physical-identity row has NO domain/class (identity is not a domain
 *     claim) and every aggregate charge names BOTH — a half-filled pair would
 *     either lose the label or leak the subject beside it;
 *   - the class belongs to its domain, so a cross-domain pair can never reach a
 *     label;
 *   - a set-owned-pool row carries its domain's single shared class. ZFS owns
 *     none — its sharing is the boundary's `shared_bytes` — so a zfs pool row is
 *     unrepresentable.
 *
 * The owner itself needs no check here: both wire unions are closed and the
 * field is required, so a row without exactly one owner never survives decode,
 * and a set-owned-pool row's participants are checked by
 * {@link participantViolations}.
 */
const claimTaxonomyViolations = (wire: WireSnapshot): readonly string[] => {
  const out: string[] = []
  for (const boundary of wire.boundaries) {
    for (const row of boundary.facets) {
      const where = `boundary '${boundary.id}' row '${row.object_id}'`
      const pair = `domain '${row.claim_domain}' / class '${row.claim_class}'`
      const physical = row.claim_scope === 'physical-identity'
      if (physical !== (row.claim_domain === '')) {
        out.push(`${where}: claim scope '${row.claim_scope}' disagrees with ${pair}`)
        continue
      }
      if (!CLASSES_BY_DOMAIN[row.claim_domain].includes(row.claim_class)) {
        out.push(`${where}: ${pair} is not a class of that domain`)
        continue
      }
      if (row.ownership.kind !== 'set-owned-pool') continue
      const poolClass = POOL_CLASS_BY_DOMAIN[row.claim_domain]
      if (poolClass === null) {
        out.push(`${where}: domain '${row.claim_domain}' owns no shared class, so it has no pools`)
      } else if (row.claim_class !== poolClass) {
        out.push(`${where}: a '${row.claim_domain}' pool row must be class '${poolClass}'`)
      }
    }
  }
  return out
}

const LEGACY_NIX_CLAIM_CLASS = 'path-exclusive'
/** DELETION TRIGGER (disk-index decision 0022): no admitted host's published snapshot holds a `zfs` row of this class. */
const RETIRED_ZFS_CLAIM_CLASS = 'usedbyrefreservation'

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Carries the one superseded stored class through the snapshot boundary. Exact
 * rows retain their subject inside object_id, so the reachability split is
 * recovered without admitting the old literal to the canonical schema.
 */
const decodeStoredClaimClasses = (raw: unknown): unknown => {
  if (!isUnknownRecord(raw) || !Array.isArray(raw.boundaries)) return raw
  return {
    ...raw,
    boundaries: raw.boundaries.map((boundary) => {
      if (!isUnknownRecord(boundary) || !Array.isArray(boundary.facets)) return boundary
      return {
        ...boundary,
        facets: boundary.facets.map((row) => {
          if (
            !isUnknownRecord(row) ||
            row.claim_domain !== 'nix' ||
            row.claim_class !== LEGACY_NIX_CLAIM_CLASS ||
            typeof row.object_id !== 'string'
          ) {
            return row
          }
          const suffix = `#${LEGACY_NIX_CLAIM_CLASS}`
          if (!row.object_id.endsWith(suffix)) return row
          const prefix = row.object_id.slice(0, -suffix.length)
          const claimClass = prefix.endsWith(':unreachable')
            ? 'unreachable-exclusive'
            : 'rooted-exclusive'
          return {
            ...row,
            object_id: `${prefix}#${claimClass}`,
            claim_class: claimClass,
          }
        }),
      }
    }),
  }
}

/**
 * Drops stored `zfs` rows of the retired reservation class that carry 0 bytes,
 * which changes no sum. A non-zero row is kept and fails the schema decode.
 */
const dropEmptyRetiredClaimRows = (raw: unknown): unknown => {
  if (!isUnknownRecord(raw) || !Array.isArray(raw.boundaries)) return raw
  return {
    ...raw,
    boundaries: raw.boundaries.map((boundary) =>
      !isUnknownRecord(boundary) || !Array.isArray(boundary.facets)
        ? boundary
        : {
            ...boundary,
            facets: boundary.facets.filter(
              (row) =>
                !(
                  isUnknownRecord(row) &&
                  row.claim_domain === 'zfs' &&
                  row.claim_class === RETIRED_ZFS_CLAIM_CLASS &&
                  row.allocated_bytes === 0
                ),
            ),
          },
    ),
  }
}

/** Excess keys are an error — the collector's structs are `deny_unknown_fields`. */
const STRICT_WIRE = { onExcessProperty: 'error' } as const

/**
 * Decode raw file text into a validated {@link DiskSnapshot}. Every failure is a
 * typed {@link DiskIndexError}; the version gate runs BEFORE the shape decode so
 * an unreadable generation reports `unsupported-schema`, not a misleading shape
 * error. Exported for tests (pure, node-free).
 */
export const decodeSnapshotText = (
  text: string,
  path: string,
): Effect.Effect<DiskSnapshot, DiskIndexError> =>
  Effect.suspend(() => {
    const parsed = Schema.decodeResult(Schema.fromJsonString(Schema.Unknown))(text)
    if (Result.isFailure(parsed)) {
      return new DiskIndexError({
        reason: 'invalid',
        message: `snapshot at ${path} is not JSON: ${String(parsed.failure)}`,
      })
    }
    const raw = parsed.success
    const declared = (raw as { schema_version?: unknown } | null)?.schema_version
    // A document that states no NUMBER at all is corrupt — truncated, empty, or
    // simply the wrong file. Calling that `unsupported-schema` would point the
    // operator (and any client branching on `reason`) at a collector-newer-than
    // -Vista skew that does not exist.
    if (typeof declared !== 'number') {
      return new DiskIndexError({
        reason: 'invalid',
        message: `snapshot at ${path} declares no numeric schema_version`,
      })
    }
    if (declared !== DISK_INDEX_SCHEMA_VERSION) {
      return new DiskIndexError({
        reason: 'unsupported-schema',
        message: `snapshot at ${path} declares schema_version ${declared}; this build reads only ${DISK_INDEX_SCHEMA_VERSION}`,
      })
    }
    const decoded = Schema.decodeUnknownResult(
      WireSnapshot,
      STRICT_WIRE,
    )(decodeStoredClaimClasses(dropEmptyRetiredClaimRows(raw)))
    if (Result.isFailure(decoded)) {
      return new DiskIndexError({
        reason: 'invalid',
        message: `snapshot at ${path} failed schema-${DISK_INDEX_SCHEMA_VERSION} decode: ${String(decoded.failure)}`,
      })
    }
    const wire = decoded.success
    const violations = accountingViolations(wire)
    if (violations.length > 0) {
      return new DiskIndexError({
        reason: 'invalid',
        message: `snapshot at ${path} violates byte accounting: ${violations.join('; ')}`,
      })
    }
    const summaryViolations = facetSummaryViolations(wire)
    if (summaryViolations.length > 0) {
      return new DiskIndexError({
        reason: 'invalid',
        message: `snapshot at ${path} violates facet summary invariants: ${summaryViolations.join('; ')}`,
      })
    }
    const identityErrors = identityViolations(wire)
    if (identityErrors.length > 0) {
      return new DiskIndexError({
        reason: 'invalid',
        message: `snapshot at ${path} violates identity invariants: ${identityErrors.join('; ')}`,
      })
    }
    const taxonomyViolations = claimTaxonomyViolations(wire)
    if (taxonomyViolations.length > 0) {
      return new DiskIndexError({
        reason: 'invalid',
        message: `snapshot at ${path} violates claim taxonomy: ${taxonomyViolations.join('; ')}`,
      })
    }
    const attemptProblems = refreshAttemptViolations(wire)
    if (attemptProblems.length > 0) {
      return new DiskIndexError({
        reason: 'invalid',
        message: `snapshot at ${path} violates refresh attempt invariants: ${attemptProblems.join('; ')}`,
      })
    }
    return Effect.succeed(toSnapshot(wire))
  })

// --- perspective regrouping (pure; the denominator-preservation contract) ---

const freshnessRank: Record<DiskFreshness, number> = { fresh: 0, stale: 1, unknown: 2 }
const statusRank: Record<DiskRowStatus, number> = { observed: 0, partial: 1, 'metadata-only': 2 }

/**
 * The lens LABEL of one classified row: the perspective's dimensions read as
 * text. This is what a UI shows on the axis — never a grouping identity on its
 * own, since two different owners can read identically. Use
 * {@link groupIdentityFor} to decide what shares a bucket.
 */
export const groupKeyFor = (perspective: DiskPerspective, row: DiskFacetRow): string => {
  switch (perspective) {
    case 'physical':
      return row.pathAliases[0] ?? row.objectId
    case 'tool-artifact':
      return `${row.producerTool} × ${row.artifactRole}`
    case 'workspace-artifact':
      return `${row.workspace} × ${row.artifactRole}`
    case 'service-artifact':
      return `${row.serviceOwner} × ${row.artifactRole}`
  }
}

/**
 * The raw dimensions Rust selects for a perspective. Keep these separate from
 * {@link groupKeyFor}: a display separator may also occur inside either value,
 * so the rendered label cannot identify a tuple.
 */
const perspectiveDimensionsFor = (
  perspective: DiskPerspective,
  row: DiskFacetRow,
): readonly string[] => {
  switch (perspective) {
    // Rust does not aggregate the physical perspective at all. The object id is
    // boundary-unique, so it preserves one bucket per published row while the
    // primary path remains the human label.
    case 'physical':
      return [row.objectId]
    case 'tool-artifact':
      return [row.producerTool, row.artifactRole]
    case 'workspace-artifact':
      return [row.workspace, row.artifactRole]
    case 'service-artifact':
      return [row.serviceOwner, row.artifactRole]
  }
}

/**
 * Lossless physical hierarchy relative to the selected boundary. A path is a
 * container; the measured object/claim is the leaf. Keeping that final leaf
 * avoids dropping a parent dataset's own bytes when it also has child datasets.
 */
const physicalPathFor = (boundary: DiskBoundary, row: DiskFacetRow): readonly string[] => {
  const alias = row.pathAliases[0]
  let relative = alias ?? ''
  const nativeRoot = row.claimDomain === '' ? undefined : `${row.claimDomain}://${boundary.id}`
  if (nativeRoot !== undefined && relative === nativeRoot) relative = ''
  else if (nativeRoot !== undefined && relative.startsWith(`${nativeRoot}/`)) {
    relative = relative.slice(nativeRoot.length + 1)
  } else if (boundary.mountPath === '/') {
    if (relative.startsWith('/')) relative = relative.slice(1)
  } else if (boundary.mountPath !== null && relative === boundary.mountPath) relative = ''
  else if (boundary.mountPath !== null && relative.startsWith(`${boundary.mountPath}/`)) {
    relative = relative.slice(boundary.mountPath.length + 1)
  }
  const containers = relative.split('/').filter(Boolean)
  return [
    ...(containers.length === 0 ? ['(boundary)'] : containers),
    row.claimClass === '' ? row.objectId : row.claimClass,
  ]
}

/**
 * Display hierarchy for a projected bucket. Categorical perspectives keep
 * their dimensions as separate segments so hierarchical consumers never need
 * to parse the human-readable `key`.
 */
const perspectivePathFor = (
  boundary: DiskBoundary,
  perspective: DiskPerspective,
  row: DiskFacetRow,
): readonly string[] =>
  perspective === 'physical'
    ? physicalPathFor(boundary, row)
    : perspectiveDimensionsFor(perspective, row)

/**
 * What two rows must agree on to share a bucket: the raw perspective
 * dimensions, sharing/freshness/status, the claim scope, the bounded
 * domain/class pair, and the owner. This is the Vista representation of Rust's
 * structured grouping dimensions; the human {@link groupKeyFor} string is only
 * the bucket's label.
 *
 * `null` for a `set-owned-pool` row, which is not groupable: {@link
 * projectPerspective} gives each one its own bucket by position, so the
 * guarantee holds without depending on any id being unique within a boundary.
 */
export const groupIdentityFor = (
  perspective: DiskPerspective,
  row: DiskFacetRow,
): string | null => {
  if (row.ownership.kind === 'set-owned-pool') return null
  return JSON.stringify([
    perspective,
    perspectiveDimensionsFor(perspective, row),
    row.sharing,
    row.freshness,
    row.status,
    row.claimScope,
    row.claimDomain,
    row.claimClass,
    ['profile-owner', row.ownership.profileOwner],
  ])
}

/** One typed refusal for a selector that the decoded snapshot does not contain. */
export const unknownBoundaryError = (snapshot: DiskSnapshot, boundaryId: string): DiskIndexError =>
  new DiskIndexError({
    reason: 'unknown-boundary',
    message: `snapshot ${snapshot.snapshotId} has no boundary '${boundaryId}' (has: ${snapshot.boundaries.map((b) => b.id).join(', ')})`,
  })

/**
 * Regroup ONE boundary's rows under a perspective. Denominators are copied
 * verbatim from the boundary; residual and shared bytes are untouched. Buckets
 * are keyed by {@link groupIdentityFor}, so a bucket has exactly one owner and
 * one bounded claim pair. A `set-owned-pool` row is not groupable at all and
 * gets its own bucket, keyed by its position among the pool rows — it passes
 * through with its participants intact and is never folded into a single-owner
 * bucket, however its ids happen to be built.
 *
 * Every row is a byte carrier — including a `set-owned-pool` row, which carries
 * its shared bytes once — so `Σ groups.allocatedBytes = classifiedBytes`, with a
 * `null` allocation contributing 0, exactly as the collector counts. Participant
 * metadata is never summed anywhere.
 *
 * Exported for tests and for any in-process caller; the RPC handler goes through
 * this exact function.
 */
export const projectPerspective = (
  snapshot: DiskSnapshot,
  perspective: DiskPerspective,
  boundaryId: string,
): Effect.Effect<DiskProjection, DiskIndexError> =>
  Effect.suspend(() => {
    const boundary = snapshot.boundaries.find((b) => b.id === boundaryId)
    if (boundary === undefined) {
      return unknownBoundaryError(snapshot, boundaryId)
    }
    const buckets = new Map<
      string,
      {
        key: string
        path: readonly string[]
        scope: DiskClaimScope
        domain: DiskClaimDomain
        claimClass: DiskClaimClass
        sharing: string
        ownership: DiskRowOwnership
        bytes: number
        rows: number
        freshness: DiskFreshness
        status: DiskRowStatus
      }
    >()
    // Pool rows are unkeyable, so they are counted out separately: one bucket
    // each, in publication order.
    let poolBuckets = 0
    for (const row of boundary.facets) {
      const bucketKey = groupIdentityFor(perspective, row) ?? `set-owned-pool\u0000${poolBuckets++}`
      const bucket = buckets.get(bucketKey) ?? {
        key: groupKeyFor(perspective, row),
        path: perspectivePathFor(boundary, perspective, row),
        scope: row.claimScope,
        domain: row.claimDomain,
        claimClass: row.claimClass,
        sharing: row.sharing,
        // Every member of a bucket carries the same claim by construction, so
        // the first row's is the group's — participants included.
        ownership: row.ownership,
        bytes: 0,
        rows: 0,
        freshness: 'fresh' as DiskFreshness,
        status: 'observed' as DiskRowStatus,
      }
      bucket.bytes += row.allocatedBytes ?? 0
      bucket.rows += 1
      if (freshnessRank[row.freshness] > freshnessRank[bucket.freshness]) {
        bucket.freshness = row.freshness
      }
      if (statusRank[row.status] > statusRank[bucket.status]) bucket.status = row.status
      buckets.set(bucketKey, bucket)
    }
    const groups = [...buckets.entries()]
      .toSorted(([ka, a], [kb, b]) => b.bytes - a.bytes || (ka < kb ? -1 : ka > kb ? 1 : 0))
      .map(
        ([, b]) =>
          new DiskUsageGroup({
            key: b.key,
            path: b.path,
            allocatedBytes: b.bytes,
            rowCount: b.rows,
            claimScope: b.scope,
            claimDomain: b.domain,
            claimClass: b.claimClass,
            sharing: b.sharing,
            ownership: b.ownership,
            worstFreshness: b.freshness,
            worstStatus: b.status,
          }),
      )
    return Effect.succeed(
      new DiskProjection({
        snapshotId: snapshot.snapshotId,
        generatedAtSeconds: snapshot.generatedAtSeconds,
        health: snapshot.health,
        perspective,
        boundaryId: boundary.id,
        totalBytes: boundary.totalBytes,
        usedBytes: boundary.usedBytes,
        availableBytes: boundary.availableBytes,
        reservedBytes: boundary.reservedBytes,
        sharedBytes: boundary.sharedBytes,
        classifiedBytes: boundary.classifiedBytes,
        residualBytes: boundary.residualBytes,
        residualReason: boundary.residualReason,
        groups,
      }),
    )
  })

/**
 * Why this snapshot deserves a visible degraded notice (empty = healthy).
 * Shared by the app so provider tests and the rendered notice agree on the
 * evidence: health status/completeness, health errors, every facet refresh that
 * did not finish cleanly, and a latest refresh attempt that did not complete.
 *
 * Facet evidence is read in DOCUMENT order and deduplicated, so the notice is
 * deterministic and one error text repeated across facets is stated once. A
 * facet that ended partial, went stale or timed out is NEVER presented as
 * healthy: the snapshot's own health block is a claim about coverage, not a
 * licence to hide a scan the same document reports as unfinished.
 */
export const degradedReasons = (snapshot: DiskSnapshot): readonly string[] => {
  const out: string[] = []
  if (snapshot.health.status !== 'complete') {
    out.push(`snapshot health is '${snapshot.health.status}'`)
  }
  if (!snapshot.health.complete) {
    out.push('coverage incomplete: at least one facet scan did not finish')
  }
  out.push(...snapshot.health.errors)
  for (const summary of snapshot.facetSummaries) {
    const where = `facet refresh '${summary.id}' on boundary '${summary.boundaryId}'`
    if (summary.status !== 'complete') out.push(`${where} ended ${summary.status}`)
    // A complete summary can carry neither flag (the producer forbids it, and
    // `facetSummaryViolations` re-checks it), so these always describe a facet
    // that already failed to finish.
    if (summary.stale) out.push(`${where} is stale`)
    if (summary.timedOut) out.push(`${where} timed out`)
    out.push(...summary.errors)
  }
  const latest = snapshot.refreshAttempts.toSorted(
    (a, b) => b.startedAtSeconds - a.startedAtSeconds,
  )[0]
  if (latest !== undefined && (latest.status === 'interrupted' || latest.status === 'partial')) {
    out.push(`last refresh attempt '${latest.id}' ended ${latest.status}`)
    out.push(...latest.errors)
  }
  return [...new Set(out)]
}
