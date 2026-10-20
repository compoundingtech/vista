import { Schema } from 'effect'

import { isValidContributorIdentity } from '@vista/blocks/internal/owner-identity'

const NonEmptyTrimmedString = Schema.NonEmptyString.pipe(Schema.check(Schema.isTrimmed()))

const AgentId = NonEmptyTrimmedString.pipe(
  Schema.check(Schema.makeFilter(isValidContributorIdentity)),
).annotate({ identifier: 'Vista.Changelog.AgentId' })

const Worktree = NonEmptyTrimmedString.pipe(
  Schema.check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/u)),
).annotate({ identifier: 'Vista.Changelog.Worktree' })

export const ChangelogContributorSchema = Schema.Struct({
  agentId: AgentId,
  name: Schema.optional(NonEmptyTrimmedString),
  worktree: Schema.optional(Worktree),
}).annotate({ identifier: 'Vista.Changelog.Contributor' })
export type ChangelogContributor = typeof ChangelogContributorSchema.Type

/** Public filename copied beside every published Vista app. */
export const CHANGELOG_MANIFEST_FILENAME = 'changelog.v1.json' as const

/** Package-owned location, relative to the Vista derivation output. */
export const CHANGELOG_PACKAGE_RELATIVE_PATH = `share/vista/${CHANGELOG_MANIFEST_FILENAME}` as const

/** Authored changelog payload. Identity and date come only from its immutable filename. */
export const ChangelogEntrySourceSchema = Schema.Struct({
  title: NonEmptyTrimmedString,
  summary: NonEmptyTrimmedString,
  contributors: Schema.optional(Schema.NonEmptyArray(ChangelogContributorSchema)),
}).annotate({ identifier: 'Vista.Changelog.EntrySource' })

const STRICT_SCHEMA_OPTIONS = { onExcessProperty: 'error' } as const

/** Strict authored-source decoder; unknown fields are rejected rather than stripped. */
export const decodeChangelogEntrySource = Schema.decodeUnknownSync(
  ChangelogEntrySourceSchema,
  STRICT_SCHEMA_OPTIONS,
)
export type ChangelogEntrySource = typeof ChangelogEntrySourceSchema.Type

const ChangelogEntryId = NonEmptyTrimmedString.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/u)),
).annotate({ identifier: 'Vista.Changelog.EntryId' })

const ChangelogDate = NonEmptyTrimmedString.pipe(
  Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u)),
).annotate({ identifier: 'Vista.Changelog.Date' })

export const ChangelogEntrySchema = Schema.Struct({
  id: ChangelogEntryId,
  date: ChangelogDate,
  title: NonEmptyTrimmedString,
  summary: NonEmptyTrimmedString,
  contributors: Schema.optional(Schema.NonEmptyArray(ChangelogContributorSchema)),
}).annotate({ identifier: 'Vista.Changelog.Entry' })
export type ChangelogEntry = typeof ChangelogEntrySchema.Type

/**
 * Browser companion contract. `machineVersion` is deliberately opaque: build identity is
 * authored by the shared build-stamp implementation, not parsed or reconstructed here.
 */
export const ChangelogManifestV1Schema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  product: NonEmptyTrimmedString,
  build: Schema.Struct({ machineVersion: NonEmptyTrimmedString }),
  entries: Schema.Array(ChangelogEntrySchema),
}).annotate({ identifier: 'Vista.Changelog.ManifestV1' })

/** Strict browser-boundary decoder; unknown fields are rejected rather than stripped. */
export const decodeChangelogManifestV1 = Schema.decodeUnknownSync(
  ChangelogManifestV1Schema,
  STRICT_SCHEMA_OPTIONS,
)
export type ChangelogManifestV1 = typeof ChangelogManifestV1Schema.Type

export interface ChangelogSourceRegistration {
  readonly file: string
  readonly source: unknown
}
