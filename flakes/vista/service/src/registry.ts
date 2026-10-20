/**
 * The AppIndex, rebuilt from the owned storage namespace on restart. Disk is
 * the source of truth: each `apps/_owned/<encoded-owner>/<slug>/vN/meta.json`
 * plus the `latest` symlink and an optional `RETIRED` marker are authoritative.
 *
 * Harvested from the m1 service (proven); extended with the index projection
 * (template + status-line counts + last-updated; decision 0028) read from each
 * version's `meta.json`.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { Effect, Result, Schema } from 'effect'

import { Snapshot } from '@vista/blocks/internal/data-contract'
import { VISTA_API_VERSION } from './api-version.ts'
import { encodeOwner, OwnerIdentity, Slug, StatusCounts } from './control.ts'
import { appsDir } from './paths.ts'

// Status-line counts (doctrine status buckets, 0019) have ONE source: the
// node-free control contract, where `StatusCounts` decodes `NonNegativeInt`
// (counts are non-negative ints, read fail-closed). Re-exported here because the
// meta.json `VersionMeta` embeds it and `index-page` reads it via this module.
// Previously a divergent `Schema.Number` copy lived here that could silently
// drift from the contract (Track C coupling closeout, #1242).
export { StatusCounts }

/**
 * A published version's authored identity. Owner, slug, and version are strict:
 * AppIndex state is never synthesized from directory names or malformed
 * metadata. The remaining authored fields retain decoding defaults because they
 * do not determine app identity.
 */
export const VersionIdentity = Schema.Struct({
  owner: OwnerIdentity,
  slug: Slug,
  version: Schema.Int,
  author: Schema.String.pipe(
    Schema.withDecodingDefaultType(Effect.succeed('')),
    Schema.withConstructorDefault(Effect.succeed('')),
  ),
  timestamp: Schema.String.pipe(
    Schema.withDecodingDefaultType(Effect.succeed('')),
    Schema.withConstructorDefault(Effect.succeed('')),
  ),
  changeSummary: Schema.String.pipe(
    Schema.withDecodingDefaultType(Effect.succeed('')),
    Schema.withConstructorDefault(Effect.succeed('')),
  ),
  parent: Schema.NullOr(Schema.Int).pipe(
    Schema.withDecodingDefaultType(Effect.succeed(null)),
    Schema.withConstructorDefault(Effect.succeed(null)),
  ),
}).annotate({ identifier: 'Vista.VersionIdentity' })
export type VersionIdentity = typeof VersionIdentity.Type

/**
 * One published version's full `meta.json` — the durable per-version record scanned
 * from disk (B2): {@link VersionIdentity} plus the OPTIONAL doctrine projection
 * captured at publish for the index (0028). The projection (title/template/status)
 * is fully re-derivable, so it stays droppable (`Schema.optional`), unlike identity;
 * a corrupt projection field falls away without taking identity down ({@link readMeta},
 * decision 0071). Decoded through this schema, not force-cast, so a malformed file is
 * rejected at the seam instead of leaking `unknown` downstream.
 */
export const VersionMeta = Schema.Struct({
  ...VersionIdentity.fields,
  template: Schema.optional(Schema.String),
  status: Schema.optional(StatusCounts),
  title: Schema.optional(Schema.String),
}).annotate({ identifier: 'Vista.VersionMeta' })
export type VersionMeta = typeof VersionMeta.Type

/**
 * Registry-level projection of one app: its owner identity, slug, ordered version metadata, latest
 * version number (null when none), and retired flag.
 */
export interface AppState {
  readonly owner: OwnerIdentity
  readonly slug: Slug
  readonly versions: readonly VersionMeta[]
  readonly latest: number | null
  readonly retired: boolean
}

const versionDirRe = /^v(\d+)$/
const OWNED_APPS_DIR = '_owned'

export { encodeOwner }

/**
 * Computes the on-disk directory for an owned app by nesting the slug beneath the safety-encoded
 * owner directory.
 */
export const appDir = (owner: string, slug: string): string =>
  join(appsDir(), OWNED_APPS_DIR, encodeOwner(owner), slug)

/**
 * Computes the 'v<N>' version directory for a given owner, slug, and version within that app's
 * directory.
 */
export const versionDir = (owner: string, slug: string, version: number): string =>
  join(appDir(owner, slug), `v${version}`)

// `meta.json` holds authored identity plus a re-derivable index projection.
// Identity is outside the snapshot envelope version gate, but owner/slug/version
// must decode and exactly match the storage path.
const decodeVersionMeta = Schema.decodeUnknownResult(Schema.fromJsonString(VersionMeta))
const decodeVersionIdentity = Schema.decodeUnknownResult(Schema.fromJsonString(VersionIdentity))
const decodeOwnerIdentity = Schema.decodeUnknownResult(OwnerIdentity)
const decodeSlug = Schema.decodeUnknownResult(Slug)

// A corrupt projection may be dropped while preserving strictly decoded
// identity. Invalid or absent identity returns null and the version is skipped.
const readMeta = (owner: string, slug: string, v: number): VersionMeta | null => {
  const p = join(versionDir(owner, slug, v), 'meta.json')
  if (!existsSync(p)) return null
  const raw = readFileSync(p, 'utf8')
  const full = decodeVersionMeta(raw)
  if (Result.isSuccess(full)) return full.success
  const identity = decodeVersionIdentity(raw)
  return Result.isSuccess(identity) ? identity.success : null
}

/** The two ways a present frozen `snapshot.json` fails closed and goes dark. */
export type DarkReason = 'skew' | 'malformed'

// Classify one version's frozen `snapshot.json` into a DARK reason, or null when it
// is not dark. Absent (a draft, no snapshot) and a current, strictly decoded
// Snapshot are NOT dark. A numeric non-current `apiVersion` is `skew`; a
// present-but-unreadable file — non-JSON, a missing/invalid version, or a
// current-version value that fails strict Snapshot decoding — is `malformed`, a
// first-class dark outcome (decision 0069).
/**
 * Parses a version's snapshot.json and reports why it must be treated as dark (for example
 * malformed or unsupported apiVersion), or null when the file is absent or structurally
 * acceptable.
 */
export const snapshotDarkReason = (owner: string, slug: string, v: number): DarkReason | null => {
  const path = join(versionDir(owner, slug, v), 'snapshot.json')
  if (!existsSync(path)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return 'malformed'
  }
  if (typeof parsed !== 'object' || parsed === null) return 'malformed'
  const apiVersion = Reflect.get(parsed, 'apiVersion')
  if (typeof apiVersion !== 'number' || !Number.isInteger(apiVersion)) return 'malformed'
  if (apiVersion !== VISTA_API_VERSION) return 'skew'
  try {
    Schema.decodeUnknownSync(Snapshot, { onExcessProperty: 'error' })(parsed)
    return null
  } catch {
    return 'malformed'
  }
}

/** Scan one owned app dir from disk. A malformed version never crashes the scan. */
export const scanApp = (owner: OwnerIdentity, slug: Slug): AppState | null => {
  const dir = appDir(owner, slug)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null
  const entries = readdirSync(dir)
  if (
    !entries.some((entry) => entry === 'RETIRED' || entry === 'latest' || versionDirRe.test(entry))
  ) {
    return null
  }
  const retired = existsSync(join(dir, 'RETIRED'))
  const versions: VersionMeta[] = []
  for (const entry of entries) {
    const m = versionDirRe.exec(entry)
    if (!m) continue
    const n = Number(m[1])
    // New publishers create this marker at the atomic vN claim and remove it only
    // after every render gate passes. Legacy finalized versions predate the marker
    // and remain discoverable without requiring newer publication metadata.
    if (
      !existsSync(join(versionDir(owner, slug, n), 'index.html')) ||
      existsSync(join(versionDir(owner, slug, n), '.publishing'))
    ) {
      continue
    }
    const decoded = readMeta(owner, slug, n)
    if (
      decoded === null ||
      decoded.owner !== owner ||
      decoded.slug !== slug ||
      decoded.version !== n
    ) {
      continue
    }
    versions.push(decoded)
  }
  versions.sort((a, b) => a.version - b.version)

  let latest: number | null = null
  const latestLink = join(dir, 'latest')
  if (existsSync(latestLink)) {
    try {
      const target = readlinkSync(latestLink)
      const lm = versionDirRe.exec(target.replace(/\/$/, '').split('/').pop() ?? '')
      if (lm) latest = Number(lm[1])
    } catch {
      /* ignore a dangling or malformed symlink */
    }
  }
  if (latest !== null && !versions.some((version) => version.version === latest)) latest = null
  return { owner, slug, versions, latest, retired }
}

/** Rebuild the whole AppIndex from the owned namespace on disk (SVC-R18). */
export const scanAll = (): Map<string, AppState> => {
  const ownedRoot = join(appsDir(), OWNED_APPS_DIR)
  mkdirSync(ownedRoot, { recursive: true })
  const out = new Map<string, AppState>()
  for (const encodedOwner of readdirSync(ownedRoot)) {
    const ownerDir = join(ownedRoot, encodedOwner)
    if (!statSync(ownerDir).isDirectory()) continue
    let owner: OwnerIdentity
    try {
      const rawOwner = decodeURIComponent(encodedOwner)
      if (encodeOwner(rawOwner) !== encodedOwner) continue
      const decodedOwner = decodeOwnerIdentity(rawOwner)
      if (Result.isFailure(decodedOwner)) continue
      owner = decodedOwner.success
    } catch {
      continue
    }
    for (const rawSlug of readdirSync(ownerDir)) {
      const decodedSlugResult = decodeSlug(rawSlug)
      if (Result.isFailure(decodedSlugResult)) continue
      const slug = decodedSlugResult.success
      const owned = scanApp(owner, slug)
      if (owned) out.set(`${encodedOwner}/${slug}`, owned)
    }
  }
  return out
}

/**
 * Node-pure scan for published versions that went DARK (loud half of decisions 0061,
 * 0069 / SVC-R15): every version whose frozen `snapshot.json` fails closed — `skew`
 * (a non-current `apiVersion`) or `malformed` (present but not a well-formed
 * envelope) — renders `unsupported`. A draft (no snapshot) and a current-version
 * `ok` are NOT dark, so neither is reported. Takes the ALREADY-scanned apps so the
 * `vista.apps.list` handler walks the apps dir ONCE (its rows and its skew both read
 * one {@link scanAll}); it only re-reads each version's `snapshot.json`. Sync; the
 * Effect scan seam `set`s the `vista_snapshot_skew` gauge to `1` per dark version
 * tagged slug+version+reason so an operator sees WHICH reviews went dark — identity
 * is unaffected.
 */
export const scanSkew = (
  apps: readonly AppState[],
): ReadonlyArray<{
  readonly owner: OwnerIdentity
  readonly slug: Slug
  readonly version: number
  readonly reason: DarkReason
}> => {
  const out: { owner: OwnerIdentity; slug: Slug; version: number; reason: DarkReason }[] = []
  for (const st of apps) {
    for (const { version } of st.versions) {
      const reason = snapshotDarkReason(st.owner, st.slug, version)
      if (reason !== null) {
        out.push({ owner: st.owner, slug: st.slug, version, reason })
      }
    }
  }
  return out
}

/** The metadata of a app's latest version (for the index), or null. */
export const latestMeta = (st: AppState): VersionMeta | null => {
  if (st.latest === null) return null
  return st.versions.find((v) => v.version === st.latest) ?? null
}

/** Mark an owner-scoped app retired while preserving every immutable version. */
export const retire = (owner: OwnerIdentity, slug: Slug): void => {
  const dir = appDir(owner, slug)
  if (!existsSync(dir)) throw new Error(`unknown app: ${owner}/${slug}`)
  writeFileSync(join(dir, 'RETIRED'), new Date().toISOString())
}
