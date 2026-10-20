import { Schema } from 'effect'

import {
  decodeRouteOwner,
  encodeOwner,
  encodeRouteOwner,
  isManagedAgentSubject,
  isValidOwnerIdentity,
} from '@vista/blocks/internal/owner-identity'

import { NonEmptyTrimmedString, NonNegativeInt } from './api-version.ts'

/**
 * The app-slug format (decisions 0034/0053): lowercase alphanumerics joined by
 * single hyphens — no dots, slashes, or leading/trailing/double hyphen. The slug
 * becomes a directory segment under the apps tree AND (0053) is derived from the
 * app-dir basename, so both the scaffold and the CLI's slug-derivation validate
 * against this one source.
 */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Reports whether a candidate string satisfies the slug grammar that the Slug schema also enforces. */
export const isValidSlug = (slug: string): boolean => SLUG_RE.test(slug)
/**
 * Schema accepting non-empty trimmed strings that match the slug pattern, exposing the validated
 * slug as its Type.
 */
export const Slug = NonEmptyTrimmedString.pipe(Schema.check(Schema.isPattern(SLUG_RE))).annotate({
  identifier: 'Vista.Slug',
})
export type Slug = typeof Slug.Type

export { decodeRouteOwner, encodeOwner, encodeRouteOwner }

/** Servable identity: native managed subjects and retained historical dotted owners verbatim. */
export const OwnerIdentity = NonEmptyTrimmedString.pipe(
  Schema.check(Schema.makeFilter(isValidOwnerIdentity)),
).annotate({ identifier: 'Vista.OwnerIdentity' })
export type OwnerIdentity = typeof OwnerIdentity.Type

/** New publications belong only to exact st v3 managed seat subjects. */
export const PublishableOwnerIdentity = NonEmptyTrimmedString.pipe(
  Schema.check(Schema.makeFilter(isManagedAgentSubject)),
).annotate({ identifier: 'Vista.PublishableOwnerIdentity' })
export type PublishableOwnerIdentity = typeof PublishableOwnerIdentity.Type

/** The authority component embedded in every Vista app resource URI. */
export const VISTA_SERVICE_AUTHORITY = 'primary'

/** Tagged schema representing a reference to a Vista app solely by its non-empty URI string. */
export const AppResource = Schema.TaggedStruct('vista-app', {
  uri: NonEmptyTrimmedString,
}).annotate({ identifier: 'Vista.AppResource' })
export type AppResource = typeof AppResource.Type

/**
 * Builds a vista-app resource whose URI encodes the RFC 3986-safe owner segment and slug under the
 * primary authority.
 */
export const makeAppResource = (owner: string, slug: string): AppResource => ({
  _tag: 'vista-app',
  uri: `dev.schickling.vista-app://${VISTA_SERVICE_AUTHORITY}/${encodeOwner(owner)}/${slug}`,
})

/** Schema tallying an app's interview questions as non-negative locked, open, and awaiting counts. */
export const StatusCounts = Schema.Struct({
  locked: NonNegativeInt,
  open: NonNegativeInt,
  awaiting: NonNegativeInt,
}).annotate({ identifier: 'Vista.StatusCounts' })
export type StatusCounts = typeof StatusCounts.Type

/**
 * Shared read/control summary row for one app, pairing identity and resource with latest
 * version, retirement flag, and optional presentation and status metadata.
 */
export const AppRow = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
  resource: AppResource,
  latest: Schema.NullOr(Schema.Int),
  retired: Schema.Boolean,
  title: Schema.optional(Schema.String),
  template: Schema.optional(Schema.String),
  status: Schema.optional(StatusCounts),
  updated: Schema.optional(Schema.String),
}).annotate({ identifier: 'Vista.AppRow' })
export type AppRow = typeof AppRow.Type

/**
 * Schema that uniquely pins one published version via owner, slug, and a positive integer version
 * number.
 */
export const AppVersionIdentity = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
  version: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
}).annotate({ identifier: 'Vista.AppVersionIdentity' })
export type AppVersionIdentity = typeof AppVersionIdentity.Type

/** Literal schema constraining a version's lifecycle to ready, failed, or expired. */
export const VersionState = Schema.Literals(['ready', 'failed', 'expired']).annotate({
  identifier: 'Vista.VersionState',
})
export type VersionState = typeof VersionState.Type

/**
 * The content-free, immutable control-plane projection for one published Vista
 * version. Rendered bytes, authored source, and service filesystem paths are
 * deliberately absent.
 */
export const VersionSummary = Schema.Struct({
  owner: OwnerIdentity,
  schemaVersion: Schema.Literal(1),
  uri: NonEmptyTrimmedString,
  slug: Slug,
  version: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  author: Schema.String,
  timestamp: Schema.String,
  changeSummary: Schema.String,
  parent: Schema.NullOr(Schema.Int),
  retired: Schema.Boolean,
  state: VersionState,
  canonicalUrl: NonEmptyTrimmedString,
  title: Schema.optional(Schema.String),
  template: Schema.optional(Schema.String),
  status: Schema.optional(StatusCounts),
}).annotate({ identifier: 'Vista.VersionSummary' })
export type VersionSummary = typeof VersionSummary.Type

/** Tagged error raised when the requested integer version does not exist for the identified app. */
export class UnknownVersion extends Schema.TaggedError<UnknownVersion>()('Vista.UnknownVersion', {
  owner: OwnerIdentity,
  slug: Schema.String,
  version: Schema.Int,
  message: Schema.String,
}) {}

/**
 * Tagged error raised when reading a stored app version fails, carrying the version and a detail
 * message.
 */
export class VersionReadFailed extends Schema.TaggedError<VersionReadFailed>()(
  'Vista.VersionReadFailed',
  {
    owner: OwnerIdentity,
    slug: Schema.String,
    version: Schema.Int,
    message: Schema.String,
  },
) {}

