import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { AppSourceData, AppSourceTrailStep, SemanticManifest } from '@vista/blocks'

import type { TrailEntry } from '../control.ts'
import { assertNoSecrets } from './secrets.ts'

/**
 * Publish-time self-capture (decisions q1/q2/q5, trail q12–q14): freeze the
 * authored AppSource — every authored file, the derived semantic manifest, a
 * receipt projection, and the CLI-shipped journal trail — into `vista-self.json`.
 *
 * The inventory is collected from the claimed immutable version snapshot right
 * after `populateVersion`, before generated artifacts (meta.json,
 * snapshot.json, bootstrap, semantics, site/, vista-self.json itself) are
 * written — so no generated-artifact exclusion list is needed, and an author
 * edit landing mid-build cannot leak into the capture while the built site
 * reflects earlier contents. The walk additionally skips dependency trees,
 * dotfiles/dot-dirs (private by convention: .env, .git, the .publishing claim
 * marker), build caches, and symlinks at every depth, on top of
 * `populateVersion`'s top-level exclusions. The receipt projection carries no
 * inventory (a capture cannot contain the receipt whose inventory covers the
 * capture itself). The encoded payload is secret-scanned like provider
 * snapshots (MED.DATA-R31) and the publish fails closed on findings or on
 * malformed shipped entries. There is no file fallback: the journal is the
 * single trail source.
 */

/** Version-dir file carrying the frozen self-capture, mirrored into `site/`. */
export const SELF_CAPTURE_FILE = 'vista-self.json'

/**
 * Self-capture failed — nothing is published. Explicit fields (not TS
 * parameter properties): the packaged service runs under node strip-types,
 * which rejects parameter properties.
 */
export class SelfCaptureError extends Error {
  readonly _tag = 'Vista.SelfCapture'
  readonly slug: string
  readonly reason: string
  constructor(slug: string, reason: string) {
    super(`cannot capture self-inspection payload for ${slug}: ${reason}`)
    this.slug = slug
    this.reason = reason
  }
}

/** Directory names never treated as authored source, at any depth. */
const CAPTURE_SKIP_DIRS: Record<string, true> = { node_modules: true, '.vite': true }

/** One captured file: posix-relative path plus exact bytes. */
export interface AuthoredFile {
  readonly path: string
  readonly contents: string
}

/**
 * Collect authored files under a snapshot root as posix-relative paths.
 * Collect from the claimed immutable version right after `populateVersion`,
 * before generated artifacts are written.
 */
export const collectAuthoredFiles = (snapshot: string): ReadonlyArray<AuthoredFile> => {
  const files: Array<AuthoredFile> = []
  const walk = (relative: string): void => {
    for (const name of readdirSync(join(snapshot, relative)).toSorted()) {
      // Dot entries are private by convention (.env, .git, the .publishing
      // claim marker) and never authored source for the inspector.
      if (name.startsWith('.')) continue
      const rel = relative === '' ? name : `${relative}/${name}`
      const stat = lstatSync(join(snapshot, rel))
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) {
        if (name in CAPTURE_SKIP_DIRS) continue
        walk(rel)
      } else if (stat.isFile()) {
        files.push({ path: rel, contents: readFileSync(join(snapshot, rel), 'utf8') })
      }
    }
  }
  walk('')
  return files
}

/**
 * Map CLI-shipped journal entries onto trail steps, failing closed with
 * reasons (q14 strict capture). The RPC schema already constrains types;
 * this step enforces content (non-empty command) and derives the human
 * detail: the publish message where the entry has one, otherwise a compact
 * outcome line from the recorded exit and duration.
 */
const decodeTrail = (
  slug: string,
  shipped: readonly TrailEntry[],
): ReadonlyArray<AppSourceTrailStep> =>
  shipped.map((step, index) => {
    const where = `trail[${index}]`
    if (step.command.trim() === '') {
      throw new SelfCaptureError(slug, `${where}.command must be a non-empty string`)
    }
    const qualified = step.slug === slug ? step.command : `${step.command} ${step.slug}`
    const detail =
      step.message !== undefined && step.message.trim() !== ''
        ? step.message
        : `${qualified} — exit ${step.exit}, ${step.durationMs}ms, ${step.timestamp}`
    return { command: qualified, detail }
  })
/**
 * Boundary validation for CLI-shipped entries, run before publish claims a
 * version or builds anything: strict decode plus secret scan of the steps.
 * The full-payload scan at finalize remains the backstop.
 */
export const validateShippedTrail = (
  slug: string,
  shipped: readonly TrailEntry[] | undefined,
): void => {
  if (shipped === undefined || shipped.length === 0) return
  const steps = decodeTrail(slug, shipped)
  const findings = assertNoSecrets(steps)
  if (findings.length > 0) {
    throw new SelfCaptureError(
      slug,
      `secret scan blocked the trail (${findings.map((finding) => `${finding.path}: ${finding.pattern}`).join('; ')})`,
    )
  }
}

/**
 * Builds a self-capture from an authored inventory frozen before the build ran (so mid-build
 * author edits cannot leak into the capture), together with a display-only source dir and
 * owner/slug/version identity.
 */
export const buildSelfCapture = (input: {
  /** Canonical AppSource dir, display only (the inspector's source-dir path). */
  readonly sourceDir: string
  /**
   * Authored inventory frozen from the claimed immutable version snapshot
   * before the build runs — never re-walked here, so a mid-build author edit
   * cannot leak into the capture.
   */
  readonly files: ReadonlyArray<AuthoredFile>
  readonly owner: string
  readonly slug: string
  readonly version: number
  readonly basePath: string
  readonly semantics: SemanticManifest
  readonly encodedSemantics: string
  readonly sha256: (value: string) => string
  /** CLI-shipped journal entries; the single trail source (no file fallback). */
  readonly trail?: readonly TrailEntry[] | undefined
}): AppSourceData => {
  const {
    sourceDir,
    files,
    owner,
    slug,
    version,
    basePath,
    semantics,
    encodedSemantics,
    sha256,
    trail: shipped,
  } = input

  const trail =
    shipped === undefined || shipped.length === 0 ? undefined : decodeTrail(slug, shipped)
  const byteTotal = files.reduce((total, file) => total + file.contents.length, 0)
  const payload: AppSourceData = {
    owner,
    slug,
    version,
    sourceDir,
    files: files.map((file) => ({ path: file.path, contents: file.contents })),
    semantics,
    receipt: {
      version,
      basePath,
      semanticsSha256: sha256(encodedSemantics),
      fileCount: files.length,
      byteTotal,
    },
    ...(trail === undefined ? {} : { trail }),
  }

  const findings = assertNoSecrets(payload)
  if (findings.length > 0) {
    throw new SelfCaptureError(
      slug,
      `secret scan blocked the capture (${findings.map((finding) => `${finding.path}: ${finding.pattern}`).join('; ')})`,
    )
  }
  return payload
}
