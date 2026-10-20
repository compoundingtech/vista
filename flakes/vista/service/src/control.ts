import { BindingPolicy } from '@vista/blocks/internal/data-contract'
import { Schema } from 'effect'
import { Rpc } from 'effect/rpc'
import { RpcGroup } from 'effect/rpc'

import { NonEmptyTrimmedString, NonNegativeInt, VersionSkew, WireEnvelope } from './api-version.ts'
import { ImportDiagnostic, RuntimePolicyProjection } from './runtime-policy/index.ts'

export { DecisionAnswer, DecisionOption, DecisionQuestion } from './interview/contract.ts'
export { NonEmptyTrimmedString, VersionSkew } from './api-version.ts'
export {
  SLUG_RE,
  isValidSlug,
  Slug,
  encodeOwner,
  encodeRouteOwner,
  decodeRouteOwner,
  OwnerIdentity,
  PublishableOwnerIdentity,
  VISTA_SERVICE_AUTHORITY,
  AppResource,
  makeAppResource,
  StatusCounts,
  AppRow,
  AppVersionIdentity,
  VersionState,
  VersionSummary,
  UnknownVersion,
  VersionReadFailed,
} from './read-contract.ts'
import {
  AskInput as InterviewAskInput,
  AskResult as InterviewAskResult,
  DecisionAnswer,
} from './interview/contract.ts'
import { Slug, OwnerIdentity, AppRow, UnknownVersion, VersionReadFailed } from './read-contract.ts'

/**
 * One CLI journal entry shipped with a publish (decisions q12–q14). The CLI
 * records authoring invocations best-effort into a per-app local journal and
 * sends recent entries along; the service embeds them after the secret scan.
 * `message` is the publish `--message` only — no other free text is recorded.
 */
export const TrailEntry = Schema.Struct({
  command: NonEmptyTrimmedString,
  slug: Slug,
  version: Schema.optional(Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))),
  timestamp: NonEmptyTrimmedString,
  exit: Schema.Int,
  durationMs: NonNegativeInt,
  message: Schema.optional(Schema.String),
}).annotate({ identifier: 'Vista.TrailEntry' })
export type TrailEntry = typeof TrailEntry.Type

/**
 * Schema for a publish request, requiring owner, slug, non-empty author and change summary, and
 * accepting an optional decision trail.
 */
export const PublishInput = Schema.Struct({
  // Decode retained owners too so admission returns a useful typed PublishFailed, not a schema error.
  owner: OwnerIdentity,
  slug: Slug,
  author: NonEmptyTrimmedString,
  changeSummary: NonEmptyTrimmedString,
  trail: Schema.optional(Schema.Array(TrailEntry)),
}).annotate({ identifier: 'Vista.PublishInput' })
export type PublishInput = typeof PublishInput.Type

/** Schema identifying the app, by owner and slug, whose publish preview should be computed. */
export const PublishPreviewInput = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
}).annotate({ identifier: 'Vista.PublishPreviewInput' })
export type PublishPreviewInput = typeof PublishPreviewInput.Type
/** Schema identifying the app, by owner and slug, for which a publish plan is requested. */
export const PublishPlanInput = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
}).annotate({ identifier: 'Vista.PublishPlanInput' })
export type PublishPlanInput = typeof PublishPlanInput.Type

/** What `vista publish --dry-run` previews: derived slug/title/template + next version (AGT.CLI-R56). */
export const PublishPreviewOk = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
  nextVersion: Schema.Int,
  title: Schema.optional(Schema.String),
  template: Schema.optional(Schema.String),
}).annotate({ identifier: 'Vista.PublishPreviewOk' })
export type PublishPreviewOk = typeof PublishPreviewOk.Type

/**
 * Schema for a successful publish reply, carrying the assigned version plus the resulting frozen,
 * live, and subscription counts.
 */
export const PublishOk = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
  version: Schema.Int,
  frozen: NonNegativeInt,
  live: NonNegativeInt,
  subscription: NonNegativeInt,
}).annotate({ identifier: 'Vista.PublishOk' })
export type PublishOk = typeof PublishOk.Type

/**
 * Schema describing one provider binding block in a publish plan, including its identity, provider
 * and RPC wiring, binding policy, mount status, and optional blocking problem.
 */
export const PublishPlanBlock = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  providerId: Schema.String,
  rpcTag: Schema.String,
  policy: BindingPolicy,
  providerMounted: Schema.Boolean,
  problem: Schema.optional(Schema.String),
}).annotate({ identifier: 'Vista.PublishPlanBlock' })
export type PublishPlanBlock = typeof PublishPlanBlock.Type

/**
 * Schema for a complete publish plan, reporting draft existence, publishability, current and next
 * versions, and the source and freeze breakdowns.
 */
export const PublishPlan = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
  draftExists: Schema.Boolean,
  publishable: Schema.Boolean,
  latest: Schema.NullOr(Schema.Int),
  nextVersion: Schema.NullOr(Schema.Int),
  source: Schema.Struct({
    appTsx: Schema.Boolean,
  }),
  freeze: Schema.Struct({
    total: NonNegativeInt,
    frozen: NonNegativeInt,
    live: NonNegativeInt,
    subscription: NonNegativeInt,
    effectfulAcknowledged: NonNegativeInt,
    unresolved: NonNegativeInt,
    blocks: Schema.Array(PublishPlanBlock),
  }),
  providers: Schema.Struct({
    mounted: Schema.Array(Schema.String),
    missing: Schema.Array(Schema.String),
  }),
  problems: Schema.Array(Schema.String),
}).annotate({ identifier: 'Vista.PublishPlan' })
export type PublishPlan = typeof PublishPlan.Type

/** Request payload shared by control-plane RPCs that identify a single app by owner identity and slug. */
export const SlugInput = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
}).annotate({ identifier: 'Vista.SlugInput' })
export type SlugInput = typeof SlugInput.Type

/**
 * Request payload for creating a new app scaffold, where the optional dryRun flag plans and
 * reports writes without applying them.
 */
export const NewAppInput = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
  dryRun: Schema.optional(Schema.Boolean),
}).annotate({ identifier: 'Vista.NewAppInput' })
export type NewAppInput = typeof NewAppInput.Type

/**
 * Request payload for materializing a stored app into its authoring directory, defaulting to the
 * latest version when the optional version is omitted.
 */
export const RehydrateInput = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
  version: Schema.optional(Schema.Int),
}).annotate({ identifier: 'Vista.RehydrateInput' })
export type RehydrateInput = typeof RehydrateInput.Type

/**
 * Success payload reporting the app identity, resolved version, app source, and list of files
 * produced by a rehydrate operation.
 */
export const RehydrateOk = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
  version: Schema.Int,
  appSource: Schema.String,
  files: Schema.Array(NonEmptyTrimmedString),
}).annotate({ identifier: 'Vista.RehydrateOk' })
export type RehydrateOk = typeof RehydrateOk.Type

/**
 * Success payload for app creation that echoes whether it was a dry run and enumerates the planned
 * scaffold paths. The paths exist after a non-dry run.
 */
export const NewAppOk = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
  appSource: Schema.String,
  files: Schema.Array(NonEmptyTrimmedString),
  dryRun: Schema.Boolean,
  writes: Schema.Array(Schema.String),
}).annotate({ identifier: 'Vista.NewAppOk' })
export type NewAppOk = typeof NewAppOk.Type

/** Success payload confirming that the app identified by owner and slug has been retired. */
export const RetireOk = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
}).annotate({ identifier: 'Vista.RetireOk' })
export type RetireOk = typeof RetireOk.Type

/**
 * Describes the service's filesystem layout plus probe results recording whether each key
 * directory is writable or present.
 */
export const ServicePaths = Schema.Struct({
  root: Schema.String,
  apps: Schema.String,
  cache: Schema.String,
  deps: Schema.String,
  diagnostics: Schema.Struct({
    rootInNixStore: Schema.Boolean,
    rootWritable: Schema.Boolean,
    reviewsWritable: Schema.Boolean,
    cacheWritable: Schema.Boolean,
    depsExists: Schema.Boolean,
  }),
}).annotate({ identifier: 'Vista.ServicePaths' })
export type ServicePaths = typeof ServicePaths.Type

/**
 * Introspection payload exposing the control endpoint path, current app count, process uptime in
 * milliseconds, and path diagnostics.
 */
export const ServiceInfo = Schema.Struct({
  urlPath: Schema.Literal('/_rpc/control'),
  apps: NonNegativeInt,
  uptimeMs: NonNegativeInt,
  paths: ServicePaths,
}).annotate({ identifier: 'Vista.ServiceInfo' })
export type ServiceInfo = typeof ServiceInfo.Type

/**
 * Projection of the runtime policy surfaced over the control endpoint for inspection by tooling
 * and diagnostics.
 */
export const RuntimePolicyInfo = RuntimePolicyProjection
export type RuntimePolicyInfo = typeof RuntimePolicyInfo.Type

/** Request payload carrying the module specifier for which import diagnostics should be produced. */
export const ImportDiagnosticInput = Schema.Struct({
  specifier: NonEmptyTrimmedString,
}).annotate({ identifier: 'Vista.ImportDiagnosticInput' })
export type ImportDiagnosticInput = typeof ImportDiagnosticInput.Type

/**
 * Response shape that aliases the shared ImportDiagnostic schema so diagnostics are returned
 * unchanged over the control RPC.
 */
export const ImportDiagnosticInfo = ImportDiagnostic
export type ImportDiagnosticInfo = typeof ImportDiagnosticInfo.Type

/**
 * Request payload extending the interview ask fields with the owner identity and app slug the
 * question applies to.
 */
export const AskInput = Schema.Struct({
  ...InterviewAskInput.fields,
  owner: OwnerIdentity,
  appId: Slug,
}).annotate({ identifier: 'Vista.AskInput' })
export type AskInput = typeof AskInput.Type

/**
 * Success payload extending the interview ask result fields with owner and app slug so responses
 * stay traceable to their app.
 */
export const AskResult = Schema.Struct({
  ...InterviewAskResult.fields,
  owner: OwnerIdentity,
  appId: Slug,
}).annotate({ identifier: 'Vista.AskResult' })
export type AskResult = typeof AskResult.Type

/**
 * Request payload identifying one pending interview question by owner, app slug, and question id
 * for awaiting its resolution.
 */
export const AwaitInterviewInput = Schema.Struct({
  owner: OwnerIdentity,
  appId: Slug,
  questionId: NonEmptyTrimmedString,
}).annotate({ identifier: 'Vista.AwaitInterviewInput' })
export type AwaitInterviewInput = typeof AwaitInterviewInput.Type

/**
 * Discriminated union reporting the outcome of awaiting an interview question, either the recorded
 * decision answer or that it remains pending.
 */
export const AwaitResult = Schema.Union([
  Schema.TaggedStruct('answered', {
    owner: OwnerIdentity,
    appId: Slug,
    questionId: NonEmptyTrimmedString,
    answer: DecisionAnswer,
  }),
  Schema.TaggedStruct('pending', {
    owner: OwnerIdentity,
    appId: Slug,
    questionId: NonEmptyTrimmedString,
  }),
]).annotate({ identifier: 'Vista.AwaitResult' })
export type AwaitResult = typeof AwaitResult.Type

/** Tagged error raised when the source backing an app cannot be resolved from its owner and slug. */
export class AppSourceUnresolved extends Schema.TaggedError<AppSourceUnresolved>()(
  'Vista.AppSourceUnresolved',
  {
    owner: OwnerIdentity,
    slug: Slug,
    message: Schema.String,
  },
) {}

/** Tagged error raised when no app exists for the given owner and slug. */
export class UnknownApp extends Schema.TaggedError<UnknownApp>()('Vista.UnknownApp', {
  owner: OwnerIdentity,
  slug: Schema.String,
  message: Schema.String,
}) {}

/** Tagged error raised when the referenced interview question does not exist for the given app. */
export class UnknownQuestion extends Schema.TaggedError<UnknownQuestion>()(
  'Vista.UnknownQuestion',
  {
    owner: OwnerIdentity,
    appId: Schema.String,
    questionId: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Tagged error raised when a supplied slug fails validation, with the message explaining the
 * violation.
 */
export class InvalidSlug extends Schema.TaggedError<InvalidSlug>()('Vista.InvalidSlug', {
  owner: OwnerIdentity,
  slug: Schema.String,
  message: Schema.String,
}) {}

/**
 * Tagged error raised when app creation cannot proceed because a scaffold already exists at the
 * target path.
 */
export class ScaffoldExists extends Schema.TaggedError<ScaffoldExists>()('Vista.ScaffoldExists', {
  owner: OwnerIdentity,
  slug: Schema.String,
  path: Schema.String,
  message: Schema.String,
}) {}

/** Tagged error raised when publishing an app fails, optionally including the underlying cause message. */
export class PublishFailed extends Schema.TaggedError<PublishFailed>()('Vista.PublishFailed', {
  owner: OwnerIdentity,
  slug: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

/** Tagged error raised when retiring an app fails, optionally including the underlying cause message. */
export class RetireFailed extends Schema.TaggedError<RetireFailed>()('Vista.RetireFailed', {
  owner: OwnerIdentity,
  slug: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

/** Rehydrate refused because the target authoring dir already holds WIP (0053 #3). */
export class RehydrateBlocked extends Schema.TaggedError<RehydrateBlocked>()(
  'Vista.RehydrateBlocked',
  {
    owner: OwnerIdentity,
    slug: Schema.String,
    path: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Tagged error raised when rehydrating a version into the authoring directory fails, optionally
 * including the underlying cause message.
 */
export class RehydrateFailed extends Schema.TaggedError<RehydrateFailed>()(
  'Vista.RehydrateFailed',
  {
    owner: OwnerIdentity,
    slug: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

// Every RPC travels as the versioned `WireEnvelope` in BOTH directions (Track C
// wire / decision 0061 / VST-R66). The REAL per-RPC payload/success Schema is
// applied inside the server handler (`wireHandler`) and the client wrapper
// (`wireCall`) via the two-phase, version-first `decodeEnveloped`, so a skewed
// call fails closed as a typed `VersionSkew` — which each RPC therefore adds to
// its `error` channel. The `// real:` note records the wrapped payload→success
// contract the handler/client restore.

// real: () → Array(AppRow)
/**
 * RPC client for the vista.apps.list method that fetches every app registered with the Vista
 * service, failing only on protocol version skew.
 */
export const ListApps = Rpc.make('vista.apps.list', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: VersionSkew,
})

// real: SlugInput → AppRow
/**
 * RPC client for vista.app.get that resolves a single app's row from its slug, returning
 * UnknownApp or VersionSkew in the error channel.
 */
export const GetApp = Rpc.make('vista.app.get', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([UnknownApp, VersionSkew]),
})

// real: AppVersionIdentity → VersionSummary
/**
 * RPC client for vista.version.get that returns a summary for one specific app version,
 * distinguishing unknown versions, read failures, and version skew in its errors.
 */
export const GetVersion = Rpc.make('vista.version.get', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([UnknownVersion, VersionReadFailed, VersionSkew]),
})

// real: NewAppInput → NewAppOk
/**
 * RPC client for vista.app.new that scaffolds a new app from its source and chosen slug, failing
 * when the source is unresolved, the slug is invalid, a scaffold already exists, or versions skew.
 */
export const NewApp = Rpc.make('vista.app.new', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([AppSourceUnresolved, InvalidSlug, ScaffoldExists, VersionSkew]),
})

// real: PublishInput → PublishOk
/**
 * RPC client for vista.publish that executes an app publish, surfacing unresolved source, publish
 * failure, or version skew errors.
 */
export const PublishApp = Rpc.make('vista.publish', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([AppSourceUnresolved, PublishFailed, VersionSkew]),
})

// real: PublishPreviewInput → PublishPreviewOk
/**
 * RPC client for vista.publish.preview that performs a dry-run of a publish without applying its
 * effects, sharing the same error surface as the real publish.
 */
export const PreviewPublish = Rpc.make('vista.publish.preview', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([AppSourceUnresolved, PublishFailed, VersionSkew]),
})

// real: PublishPlanInput → PublishPlan
/**
 * RPC client for vista.publish.plan that computes and returns the plan describing the steps a
 * publish would take, without executing them.
 */
export const GetPublishPlan = Rpc.make('vista.publish.plan', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([AppSourceUnresolved, PublishFailed, VersionSkew]),
})

// real: RehydrateInput → RehydrateOk
/**
 * RPC client for vista.rehydrate that rebuilds an app's state from its persisted data, failing on
 * unresolved source, unknown app, a blocked or failed rehydration, or version skew.
 */
export const RehydrateApp = Rpc.make('vista.rehydrate', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([
    AppSourceUnresolved,
    UnknownApp,
    RehydrateBlocked,
    RehydrateFailed,
    VersionSkew,
  ]),
})

// real: SlugInput → RetireOk
/**
 * RPC client for vista.app.retire that retires an existing app, reporting UnknownApp,
 * RetireFailed, or VersionSkew when it cannot.
 */
export const RetireApp = Rpc.make('vista.app.retire', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([UnknownApp, RetireFailed, VersionSkew]),
})

// real: () → ServiceInfo
/**
 * RPC client for vista.service.info that reports metadata about the running Vista service, needing
 * no meaningful request payload and failing only on version skew.
 */
export const GetServiceInfo = Rpc.make('vista.service.info', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: VersionSkew,
})

// real: () → RuntimePolicyInfo
/**
 * RPC client for vista.runtime.policy that reports the runtime policy currently in effect for the
 * service, with version skew as its sole failure mode.
 */
export const GetRuntimePolicy = Rpc.make('vista.runtime.policy', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: VersionSkew,
})

// real: ImportDiagnosticInput → ImportDiagnosticInfo
/**
 * RPC client for vista.import.diagnose that analyzes the given import input and returns diagnostic
 * information about how it resolves.
 */
export const DiagnoseImport = Rpc.make('vista.import.diagnose', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: VersionSkew,
})

// real: AskInput → AskResult
/**
 * RPC client for vista.interview.ask that asks the next question in an app's interview flow,
 * failing if the app is unknown or versions skew.
 */
export const AskInterview = Rpc.make('vista.interview.ask', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([UnknownApp, VersionSkew]),
})

// real: AwaitInterviewInput → AwaitResult
/**
 * RPC client for vista.interview.await that waits for the answer to a previously asked interview
 * question, surfacing UnknownQuestion or VersionSkew errors.
 */
export const AwaitInterview = Rpc.make('vista.interview.await', {
  payload: WireEnvelope,
  success: WireEnvelope,
  error: Schema.Union([UnknownQuestion, VersionSkew]),
})

/**
 * Bundles every Vista control-plane RPC method into one group so clients and servers can mount the
 * entire control API together.
 */
export const VistaControlApi = RpcGroup.make(
  ListApps,
  GetApp,
  GetVersion,
  NewApp,
  PublishApp,
  PreviewPublish,
  GetPublishPlan,
  RehydrateApp,
  RetireApp,
  GetServiceInfo,
  GetRuntimePolicy,
  DiagnoseImport,
  AskInterview,
  AwaitInterview,
)

/**
 * Declares the debug commands that inspect the running Vista service over control RPC, pairing
 * each command with its description, target RPC tags, and a JSON schema for validating or
 * rendering its output.
 */
export const VistaDebugCommandDescriptors = [
  {
    command: 'service',
    description: 'Inspect the running Vista service over control RPC',
    rpcTags: ['vista.service.info'],
    jsonSchema: ServiceInfo,
  },
  {
    command: 'paths',
    description: 'Inspect Vista filesystem roots over control RPC',
    rpcTags: ['vista.service.info'],
    jsonSchema: ServicePaths,
  },
  {
    command: 'app',
    description: 'Inspect one app over control RPC',
    rpcTags: ['vista.app.get'],
    jsonSchema: AppRow,
  },
  {
    command: 'publish-plan',
    description: 'Inspect publish preflight state over control RPC',
    rpcTags: ['vista.publish.plan'],
    jsonSchema: PublishPlan,
  },
  {
    command: 'runtime-policy',
    description: 'Inspect the projected client import and Vite runtime policy',
    rpcTags: ['vista.runtime.policy'],
    jsonSchema: RuntimePolicyInfo,
  },
  {
    command: 'import',
    description: 'Classify an app import specifier against the Vista runtime policy',
    rpcTags: ['vista.import.diagnose'],
    jsonSchema: ImportDiagnosticInfo,
  },
] as const

/**
 * Const-asserted whitelist of control RPC tags that debug tooling is permitted to invoke directly
 * against the service.
 */
export const VistaDebuggableControlRpcTags = [
  'vista.service.info',
  'vista.app.get',
  'vista.publish.plan',
  'vista.runtime.policy',
  'vista.import.diagnose',
] as const
