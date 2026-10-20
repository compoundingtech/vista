/**
 * Publish: freeze the canonical AppSource into the next immutable `vN`.
 *
 * Version allocation is an atomic `mkdir vN` claim (SVC-R19, resolves
 * OQ-PUBLISH-RACE): two concurrent publishes cannot compute the same `vN` and
 * silently drop content. The loser of the `mkdir` race gets `EEXIST` and retries
 * the next number — `mkdir` is the serialization point (a temp-dir+rename
 * approach hit `ENOTEMPTY` and dropped content in the spike).
 *
 * Publishing freezes the canonical source and builds a self-contained static
 * site into the claimed `vN`, then writes `meta.json` and swaps `latest`.
 *
 * Data freeze (decisions 0027/0031) is an AUTO-CAPTURE pass run BEFORE the
 * version dir is finalized: the app's frozen-mode block descriptors are
 * replayed through a recording core, encoded with each provider's live success
 * Schema, secret-scanned (MED.DATA-R31), and written as an immutable
 * `snapshot.json` into the claimed `vN`. Freeze is freeze-by-default with a
 * per-block `mode:'live'` override (decision 0031). A pure doctrine app (no
 * `freeze` descriptors) needs no capture and uses the plain {@link publish}.
 *
 * Harvested from the m1 service; extended to carry the index projection
 * (template + status counts + title) into `meta.json` (decision 0028) and the
 * auto-capture freeze pass (decision 0031).
 */
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  lstatSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SemanticManifest } from '@vista/blocks/contract'
import { encodeRouteOwner, isLegacyOwnerIdentity } from '@vista/blocks/internal/owner-identity'
import react from '@vitejs/plugin-react'
import { Result, Schema } from 'effect'
import { build as viteBuild, version as viteVersion, type Plugin } from 'vite'

import { createStylexVitePlugins } from '@overeng/utils/node/stylex'

import { NonEmptyTrimmedString, NonNegativeInt } from './api-version.ts'
import { resolveVistaBuildInfo } from './build-info.ts'
import { readVistaChangelogCompanion, VISTA_CHANGELOG_FILE } from './changelog-companion.ts'
import type { TrailEntry } from './control.ts'
import { PublishFailed } from './control.ts'
import { bindingsFromManifest, type SemanticCaptureBinding } from './data/app.ts'
import { captureFrozen, type BlockCaptureResult, type FreezeTraceContext } from './data/freeze.ts'
import type { ProviderRegistry, ProviderRegistryManager } from './data/mount.ts'
import {
  type AuthoredFile,
  buildSelfCapture,
  collectAuthoredFiles,
  SELF_CAPTURE_FILE,
  validateShippedTrail,
} from './data/self-capture.ts'
import type { DerivedProjection } from './derive-projection.ts'
import { VISTA_FAVICON_FILE, vistaFaviconPath } from './favicon.ts'
import { resolveVistaGrafanaConfig } from './grafana-config.ts'
import { resolveAppSource, appsDir, cacheDir, depsNodeModules } from './paths.ts'
import { preflightVistaApp, VistaPreflightError } from './preflight.ts'
import { decodePublicationSemanticManifestJson } from './publication-semantics.ts'
import { PublishableOwnerIdentity } from './read-contract.ts'
import { appDir, encodeOwner, scanApp, versionDir, type VersionMeta } from './registry.ts'
import { RenderSmokeError, type RenderSmoke } from './render-smoke.ts'
import { actorSource } from './runtime-facts.ts'
import {
  classifyVistaClientImport,
  importRoot,
  vistaRuntimePolicy,
  vistaViteResolveConfig,
} from './runtime-policy/index.ts'

/**
 * Input to a publish operation: app identity and authorship, a change summary, and an optional
 * CLI-shipped journal trail embedded verbatim into the self-capture.
 */
export interface PublishInput {
  readonly owner: string
  readonly slug: string
  readonly author: string
  readonly changeSummary: string
  /** CLI-shipped journal entries, embedded into the self-capture verbatim. */
  readonly trail?: readonly TrailEntry[] | undefined
}

/**
 * Outcome of a successful publish: the app identity, assigned version number, version metadata,
 * and the semantically authored bindings persisted alongside their capture results.
 */
export interface PublishResult {
  readonly owner: string
  readonly slug: string
  readonly version: number
  readonly meta: VersionMeta
  readonly bindings: ReadonlyArray<PublishedBinding>
}

/** One semantically authored data binding as persisted with its capture result. */
export interface PublishedBinding extends SemanticCaptureBinding {
  readonly capture?: BlockCaptureResult
}

const scopedAppDir = (owner: string, slug: string): string => appDir(owner, slug)
const scopedVersionDir = (owner: string, slug: string, version: number): string =>
  versionDir(owner, slug, version)

const scopedScanApp = (owner: string, slug: string) => scanApp(owner, slug)

const PUBLISHING_MARKER = '.publishing'

const nextCandidate = (owner: string, slug: string): number => {
  const st = scopedScanApp(owner, slug)
  const maxOnDisk = st && st.versions.length > 0 ? st.versions[st.versions.length - 1]!.version : 0
  return maxOnDisk + 1
}

/** Atomically swap the `latest` symlink to `vN` via create-temp + rename. */
const swapLatest = (owner: string, slug: string, v: number): void => {
  const dir = scopedAppDir(owner, slug)
  const tmp = join(dir, `.latest.tmp.${process.pid}.${Date.now()}`)
  symlinkSync(`v${v}`, tmp)
  // rename is atomic on the same filesystem; replaces the old symlink in place.
  renameSync(tmp, join(dir, 'latest'))
}

/**
 * Atomic mkdir-claim loop (SVC-R19). The `mkdir` is the serialization point: two
 * concurrent publishers cannot claim the same `vN`. Returns `{ v, claimed }`.
 */
const claimVersion = (owner: string, slug: string): { v: number; claimed: string } => {
  // Ensure the app dir exists before the atomic `vN` claim. AppSource lives
  // outside the service-owned version store, so publication does not otherwise
  // pre-create this directory. The per-version `mkdir vN` below stays
  // non-recursive and remains the serialization point (SVC-R19).
  mkdirSync(scopedAppDir(owner, slug), { recursive: true })
  let v = nextCandidate(owner, slug)
  for (let attempt = 0; attempt < 256; attempt++) {
    const candidate = scopedVersionDir(owner, slug, v)
    try {
      mkdirSync(candidate) // throws EEXIST if another publisher already claimed it
      writeFileSync(join(candidate, PUBLISHING_MARKER), '')
      return { v, claimed: candidate }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
        v += 1
        continue
      }
      throw e
    }
  }
  throw new Error(`could not claim a version for ${slug} after 256 attempts`)
}

/** Copy the canonical AppSource into the claimed immutable version. */
const populateVersion = (appSource: string, claimed: string): void => {
  for (const entry of readdirSync(appSource)) {
    if (entry === 'node_modules' || entry === 'meta.json') continue
    cpSync(join(appSource, entry), join(claimed, entry), { recursive: true })
  }
}

const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex')

const RemoteModuleCacheEntry = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  requestedUrl: NonEmptyTrimmedString,
  resolvedUrl: NonEmptyTrimmedString,
  contentSha256: Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
})

interface RemoteModuleFetchResponse {
  readonly ok: boolean
  readonly status: number
  readonly statusText: string
  readonly url: string
  text: () => Promise<string>
}

/**
 * A remote ESM module pinned by its requested and resolved URLs, a SHA-256 hash verifying the
 * fetched content, and the code text itself.
 */
export interface PinnedRemoteModuleSource {
  readonly requestedUrl: string
  readonly resolvedUrl: string
  readonly contentSha256: string
  readonly code: string
}

const assertEsmShUrl = (value: string, label: string): URL => {
  let url: URL
  try {
    url = new URL(value)
  } catch (cause) {
    throw new Error(`${label} is not a valid URL: ${value}`, { cause })
  }
  if (url.protocol !== 'https:' || url.hostname !== 'esm.sh') {
    throw new Error(`${label} must stay on https://esm.sh: ${value}`)
  }
  return url
}

let remoteCacheWriteSerial = 0

const writeCacheFileIfAbsent = (path: string, contents: string): void => {
  const temporary = `${path}.tmp-${process.pid}-${remoteCacheWriteSerial++}`
  writeFileSync(temporary, contents)
  try {
    try {
      linkSync(temporary, path)
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause
    }
  } finally {
    rmSync(temporary, { force: true })
  }
}

/** Materialize pinned esm.sh modules into a verified content-addressed cache. */
export const makePinnedRemoteModuleLoader = ({
  cacheRoot,
  fetchModule = (url) => fetch(url),
}: {
  readonly cacheRoot: string
  readonly fetchModule?: (url: string) => Promise<RemoteModuleFetchResponse>
}) => {
  const indexDir = join(cacheRoot, 'index')
  const objectsDir = join(cacheRoot, 'objects')
  mkdirSync(indexDir, { recursive: true })
  mkdirSync(objectsDir, { recursive: true })

  const readCached = (requestedUrl: string): PinnedRemoteModuleSource | undefined => {
    const indexPath = join(indexDir, `${sha256(requestedUrl)}.json`)
    if (!existsSync(indexPath)) return undefined
    let entry: typeof RemoteModuleCacheEntry.Type
    try {
      entry = Schema.decodeSync(Schema.fromJsonString(RemoteModuleCacheEntry))(
        readFileSync(indexPath, 'utf8'),
      )
    } catch (cause) {
      throw new Error(`pinned remote module cache index is invalid: ${requestedUrl}`, { cause })
    }
    if (entry.requestedUrl !== requestedUrl) {
      throw new Error(`pinned remote module cache index identity mismatch: ${requestedUrl}`)
    }
    assertEsmShUrl(entry.resolvedUrl, 'cached remote module URL')
    const objectPath = join(objectsDir, `${entry.contentSha256}.mjs`)
    if (!existsSync(objectPath)) {
      throw new Error(`pinned remote module cache object is missing: ${entry.contentSha256}`)
    }
    const code = readFileSync(objectPath, 'utf8')
    if (sha256(code) !== entry.contentSha256) {
      throw new Error(`pinned remote module cache integrity mismatch: ${entry.contentSha256}`)
    }
    return { ...entry, code }
  }

  const load = async (requestedUrl: string): Promise<PinnedRemoteModuleSource> => {
    assertEsmShUrl(requestedUrl, 'remote module URL')
    const cached = readCached(requestedUrl)
    if (cached !== undefined) return cached

    let response: RemoteModuleFetchResponse
    try {
      response = await fetchModule(requestedUrl)
    } catch (cause) {
      throw new Error(`failed to fetch pinned remote module: ${requestedUrl}`, { cause })
    }
    if (!response.ok) {
      throw new Error(
        `failed to fetch pinned remote module: ${requestedUrl} (${response.status} ${response.statusText})`,
      )
    }
    const resolvedUrl = response.url === '' ? requestedUrl : response.url
    assertEsmShUrl(resolvedUrl, 'resolved remote module URL')
    const code = await response.text()
    const contentSha256 = sha256(code)
    const objectPath = join(objectsDir, `${contentSha256}.mjs`)
    writeCacheFileIfAbsent(objectPath, code)

    const indexPath = join(indexDir, `${sha256(requestedUrl)}.json`)
    writeCacheFileIfAbsent(
      indexPath,
      JSON.stringify({ schemaVersion: 1, requestedUrl, resolvedUrl, contentSha256 }),
    )
    const materialized = readCached(requestedUrl)
    if (materialized === undefined) {
      throw new Error(`pinned remote module cache write was not durable: ${requestedUrl}`)
    }
    return materialized
  }

  return { load }
}

const REMOTE_MODULE_ID_PREFIX = '\0vista-pinned-remote:'

const pinnedRemoteBuildPlugin = (cacheRoot: string): Plugin => {
  const loader = makePinnedRemoteModuleLoader({ cacheRoot })
  const resolvedBases = new Map<string, string>()
  const requestedUrlFromId = (id: string): string =>
    decodeURIComponent(id.slice(REMOTE_MODULE_ID_PREFIX.length))

  return {
    name: 'vista-pinned-remote-materializer',
    enforce: 'pre',
    resolveId: async (source, importer) => {
      let requestedUrl: string | undefined
      if (importer?.startsWith(REMOTE_MODULE_ID_PREFIX)) {
        const parentRequestedUrl = requestedUrlFromId(importer)
        const parentBase = resolvedBases.get(parentRequestedUrl) ?? parentRequestedUrl
        if (source.startsWith('/') || source.startsWith('./') || source.startsWith('../')) {
          requestedUrl = new URL(source, parentBase).href
        } else if (source.startsWith('https://esm.sh/')) {
          requestedUrl = source
        }
      } else if (
        source.startsWith('https://esm.sh/') &&
        classifyVistaClientImport(source)._tag === 'remote-esm'
      ) {
        requestedUrl = source
      }
      if (requestedUrl === undefined) return undefined
      const materialized = await loader.load(requestedUrl)
      resolvedBases.set(requestedUrl, materialized.resolvedUrl)
      return `${REMOTE_MODULE_ID_PREFIX}${encodeURIComponent(requestedUrl)}`
    },
    load: async (id) => {
      if (!id.startsWith(REMOTE_MODULE_ID_PREFIX)) return undefined
      const requestedUrl = requestedUrlFromId(id)
      const materialized = await loader.load(requestedUrl)
      resolvedBases.set(requestedUrl, materialized.resolvedUrl)
      return materialized.code
    },
  }
}

const inventoryTree = (
  root: string,
  subpath = '',
): ReadonlyArray<{ readonly path: string; readonly sha256: string; readonly size: number }> => {
  const inventory: Array<{
    readonly path: string
    readonly sha256: string
    readonly size: number
  }> = []
  for (const name of readdirSync(join(root, subpath)).toSorted()) {
    const path = subpath === '' ? name : `${subpath}/${name}`
    // Derived, image-only overview artifact; not executable publication content.
    // Keeping it outside the receipt permits backfill without changing trust roots.
    if (path === 'publication.json' || path === PUBLISHING_MARKER || path === 'thumbnail.png')
      continue
    const absolute = join(root, path)
    const stat = lstatSync(absolute)
    if (stat.isSymbolicLink()) throw new Error(`published directory contains symlink: ${path}`)
    if (stat.isDirectory()) inventory.push(...inventoryTree(root, path))
    else if (stat.isFile()) {
      const bytes = readFileSync(absolute)
      inventory.push({ path, sha256: sha256(bytes), size: bytes.byteLength })
    }
  }
  return inventory
}

const PublicationInventoryEntry = Schema.Struct({
  path: NonEmptyTrimmedString,
  sha256: Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
  size: NonNegativeInt,
})

/**
 * Version-1 schema validating a publication receipt, including owner/slug/version identity, base
 * path, toolchain version, a sha256-addressed semantics file, and the inventory entries.
 */
export const PublicationReceipt = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  owner: NonEmptyTrimmedString,
  slug: NonEmptyTrimmedString,
  version: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  basePath: NonEmptyTrimmedString,
  toolchain: Schema.Struct({ vite: NonEmptyTrimmedString }),
  semantics: Schema.Struct({
    path: Schema.Literal('vista-semantics.json'),
    sha256: Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
  }),
  inventory: Schema.Array(PublicationInventoryEntry),
})
export type PublicationReceipt = typeof PublicationReceipt.Type
type PublicationInventoryEntry = PublicationReceipt['inventory'][number]

/**
 * Immutable snapshot of a successfully verified static publication, pairing its on-disk directory
 * and receipt digest with the per-file inventory that trust checking produced.
 */
export interface VerifiedPublicationIndex {
  readonly directory: string
  readonly receipt: PublicationReceipt
  readonly receiptSha256: string
  readonly entries: ReadonlyMap<string, PublicationInventoryEntry>
}

const verifiedPublicationIndexes = new Map<string, VerifiedPublicationIndex>()

/**
 * Evicts every cached verification index whose directory equals or lives beneath the given
 * owner/slug app directory, so later lookups re-verify from disk.
 */
export const invalidateVerifiedPublications = (owner: string, slug: string): void => {
  const directory = scopedAppDir(owner, slug)
  for (const key of verifiedPublicationIndexes.keys()) {
    if (key === directory || key.startsWith(`${directory}${sep}`)) {
      verifiedPublicationIndexes.delete(key)
    }
  }
}

const PublicationTrustRoot = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  receiptSha256: Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
})

const scopedBasePath = (owner: string, slug: string, version: number): string =>
  `/r/${encodeRouteOwner(owner)}/${slug}/v${version}/`

const legacyScopedBasePath = (owner: string, slug: string, version: number): string =>
  `/r/${encodeOwner(owner)}/${slug}/v${version}/`

/**
 * Computes the path of the trusted root JSON file that pins a published version's receipt digest
 * under the owner-encoded '.publication-roots' tree.
 */
export const publicationTrustRoot = (owner: string, slug: string, version: number): string =>
  join(appsDir(), '.publication-roots', '_owned', encodeOwner(owner), slug, `v${version}.json`)

const scopedPublicationTrustRoot = (owner: string, slug: string, version: number): string =>
  publicationTrustRoot(owner, slug, version)

const cssRuntimeReferences = (content: string): string[] => [
  ...Array.from(content.matchAll(/\burl\(\s*["']?([^"')]+)["']?\s*\)/gi), (match) => match[1]!),
  ...Array.from(content.matchAll(/@import\s*["']([^"']+)["']/gi), (match) => match[1]!),
]

const jsRuntimeReferences = (content: string): string[] => [
  ...Array.from(
    content.matchAll(/\bimport\s*(?:\(|[^;]*?\bfrom\s*)["']([^"']+)["']/g),
    (match) => match[1]!,
  ),
  ...Array.from(content.matchAll(/\bfetch\s*\(\s*["'`]([^"'`]+)["'`]/g), (match) => match[1]!),
  ...Array.from(
    content.matchAll(/\bnew\s+Image\s*\(\s*\)\s*\.\s*src\s*=\s*["'`]([^"'`]+)["'`]/g),
    (match) => match[1]!,
  ),
]

const buildPublishResult = (
  owner: string,
  slug: string,
  version: number,
  meta: VersionMeta,
  bindings: ReadonlyArray<PublishedBinding>,
): PublishResult => ({
  owner,
  slug,
  version,
  meta,
  bindings,
})

const decodeHtmlUrlAttribute = (value: string): string =>
  value
    .replace(/&#(?:x([a-f0-9]+)|([0-9]+));?/gi, (reference, hex, decimal) => {
      const codePoint = Number.parseInt(hex ?? decimal, hex === undefined ? 10 : 16)
      return codePoint > 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : reference
    })
    .replace(/&(colon|sol|tab|newline);?/gi, (_reference, name: string) => {
      const named = { colon: ':', sol: '/', tab: '\t', newline: '\n' } as const
      return named[name.toLowerCase() as keyof typeof named]
    })
    .trim()

const parseHtmlStartElement = (
  tag: string,
):
  | {
      readonly name: string
      readonly attributes: ReadonlyArray<readonly [name: string, value: string | undefined]>
    }
  | undefined => {
  const elementMatch = /^<([a-z][^\t\n\f\r />]*)([\s\S]*)>$/i.exec(tag)
  if (elementMatch === null) return undefined
  return {
    name: elementMatch[1]!.toLowerCase(),
    attributes: Array.from(
      elementMatch[2]!.matchAll(
        /(?:^|[\t\n\f\r ])([^\t\n\f\r />=]+)(?:[\t\n\f\r ]*=[\t\n\f\r ]*(?:"([^"]*)"|'([^']*)'|([^\t\n\f\r "'=<>`]+)))?/g,
      ),
      (match) => {
        const value = match[2] ?? match[3] ?? match[4]
        return [
          match[1]!.toLowerCase(),
          value === undefined ? undefined : decodeHtmlUrlAttribute(value),
        ] as const
      },
    ),
  }
}

const javaScriptMimeTypes = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
])

const isExecutableScript = (
  attributes: ReadonlyArray<readonly [name: string, value: string | undefined]>,
): boolean => {
  const type = attributes.find(([name]) => name === 'type')
  if (type !== undefined) {
    const value = type[1]?.trim().toLowerCase() ?? ''
    return value === '' || value === 'module' || javaScriptMimeTypes.has(value)
  }
  const language = attributes
    .find(([name]) => name === 'language')?.[1]
    ?.trim()
    .toLowerCase()
  return language === undefined || language === '' || javaScriptMimeTypes.has(`text/${language}`)
}

const assertSelfContainedStaticOutput = (site: string): void => {
  const references: string[] = []
  for (const entry of inventoryTree(site)) {
    const content = readFileSync(join(site, entry.path), 'utf8')
    if (entry.path.endsWith('.html')) {
      const activeContent = content.replaceAll(/<!--[\s\S]*?-->/g, '')
      references.push(
        ...Array.from(activeContent.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi), (match) =>
          cssRuntimeReferences(match[1]!),
        ).flat(),
      )
      for (const scriptMatch of activeContent.matchAll(
        /<script\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\s*>/gi,
      )) {
        const script = parseHtmlStartElement(`<script${scriptMatch[1]!}>`)
        if (script !== undefined && isExecutableScript(script.attributes)) {
          references.push(...jsRuntimeReferences(scriptMatch[2]!))
        }
      }
      const elementContent = activeContent.replace(
        /<(script|style|textarea|title|xmp|iframe|noembed|noframes)\b([^>]*)>[\s\S]*?<\/\1\s*>/gi,
        (_match, name, attributes) => `<${name}${attributes}>`,
      )
      for (const elementMatch of elementContent.matchAll(/<[a-z](?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
        const tag = parseHtmlStartElement(elementMatch[0])
        if (tag === undefined) continue
        for (const [name, value] of tag.attributes) {
          const isUrlAttribute =
            value !== undefined &&
            (name === 'src' ||
              name === 'srcset' ||
              name === 'poster' ||
              (name === 'href' && ['base', 'image', 'link'].includes(tag.name)) ||
              (name === 'xlink:href' && tag.name === 'image') ||
              (name === 'data' && tag.name === 'object'))
          if (!isUrlAttribute && name !== 'style') continue
          if (value === undefined) continue
          if (name === 'srcset') {
            references.push(
              ...value
                .split(',')
                .map((candidate) => candidate.trim().split(/\s+/, 1)[0]!)
                .filter((candidate) => candidate !== ''),
            )
          } else if (name === 'style') {
            references.push(...cssRuntimeReferences(value))
          } else {
            references.push(value)
          }
        }
        if (
          tag.name === 'meta' &&
          tag.attributes.some(
            ([name, value]) => name === 'http-equiv' && value?.toLowerCase() === 'refresh',
          )
        ) {
          for (const [name, value] of tag.attributes) {
            if (name !== 'content' || value === undefined) continue
            const refreshUrl = /(?:^|;)\s*url\s*=\s*(.+)$/i.exec(value)?.[1]
            if (refreshUrl !== undefined) references.push(refreshUrl)
          }
        }
      }
    } else if (entry.path.endsWith('.js')) {
      references.push(...jsRuntimeReferences(content))
    } else if (entry.path.endsWith('.css')) {
      references.push(...cssRuntimeReferences(content))
    }
  }
  const ambient = references
    .map((reference) => reference.trim())
    .find((reference) =>
      /^(?:\/@fs\/|.*(?:^|\/)node_modules(?:\/|$)|(?:https?:)?\/\/)/i.test(reference),
    )
  if (ambient !== undefined) throw new Error(`static build leaked an ambient reference: ${ambient}`)
}

const stylexBuildEntries = (claimed: string): ReadonlyArray<string> => {
  const indexPath = join(claimed, 'index.html')
  const html = readFileSync(indexPath, 'utf8').replaceAll(/<!--[\s\S]*?-->/g, '')
  const entries = new Set<string>()
  for (const match of html.matchAll(/<script\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
    const tag = parseHtmlStartElement(match[0])
    const source = tag?.attributes.find(([name]) => name === 'src')?.[1]
    const type = tag?.attributes.find(([name]) => name === 'type')?.[1]?.toLowerCase()
    if (source === undefined) {
      if (type === 'module') entries.add(indexPath)
      continue
    }
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(source) || source.split('/').includes('..')) {
      continue
    }
    const path = join(claimed, source.replace(/^(?:\.\/|\/)/, '').split(/[?#]/, 1)[0]!)
    if (existsSync(path)) entries.add(path)
  }
  return [...entries]
}

const chooseVitePublicationBase = (claimed: string): string => {
  const source = inventoryTree(claimed).map((entry) => ({
    path: entry.path,
    content: readFileSync(join(claimed, entry.path)),
  }))
  const sourceHash = createHash('sha256')
  for (const entry of source) {
    sourceHash.update(entry.path).update('\0').update(entry.content).update('\0')
  }
  let digest = sourceHash.digest('hex')
  while (true) {
    const candidate = `/__vista_publication_base_${digest}__/`
    if (source.every((entry) => !entry.content.includes(candidate))) return candidate
    digest = createHash('sha256').update(digest).digest('hex')
  }
}

const stampPublicationBase = (site: string, viteBasePath: string, basePath: string): void => {
  for (const entry of inventoryTree(site)) {
    if (!/\.(?:css|html|js)$/.test(entry.path)) continue
    const path = join(site, entry.path)
    const content = readFileSync(path, 'utf8')
    if (!content.includes(viteBasePath)) continue
    writeFileSync(path, content.replaceAll(viteBasePath, basePath))
  }
}
const finalizeStaticPublication = async (
  claimed: string,
  sourceDir: string,
  files: ReadonlyArray<AuthoredFile>,
  owner: string,
  slug: string,
  version: number,
  semantics: SemanticManifest,
  trail: readonly TrailEntry[] | undefined,
  changelogCompanion: Uint8Array,
) => {
  const basePath = scopedBasePath(owner, slug, version)
  /**
   * Build against one transport-safe placeholder, then stamp the canonical HTTP
   * route into emitted text assets before hashing the receipt inventory. The
   * source/storage owner encoding remains an independent filesystem concern.
   */
  const viteBasePath = chooseVitePublicationBase(claimed)
  const publishCache = join(
    cacheDir(),
    'publish',
    join('_owned', encodeOwner(owner)),
    slug,
    `v${version}`,
  )
  const staticPublicDir = join(publishCache, 'public')
  mkdirSync(staticPublicDir, { recursive: true })
  cpSync(vistaFaviconPath(), join(staticPublicDir, VISTA_FAVICON_FILE))
  const encodedSemantics = JSON.stringify(semantics)
  writeFileSync(join(claimed, 'vista-semantics.json'), encodedSemantics)
  const buildEntries = stylexBuildEntries(claimed)
  const runtimeResolve = vistaViteResolveConfig()
  const runtimePolicy = vistaRuntimePolicy()
  const installedPackageNames = new Set(runtimePolicy.installed.packageNames)
  const serviceOwnedImportRoots = new Set(runtimePolicy.serviceOwnedImportRoots)
  const staticAliases = Object.fromEntries(
    Object.entries(runtimeResolve.alias).filter(([specifier]) => {
      const root = importRoot(specifier)
      return serviceOwnedImportRoots.has(root) || !installedPackageNames.has(root)
    }),
  )
  const buildNodeModules = join(claimed, 'node_modules')
  const installedDependencies = join(
    fileURLToPath(new URL('.', import.meta.url)),
    '..',
    'node_modules',
  )
  const buildDependencies = existsSync(installedDependencies)
    ? installedDependencies
    : depsNodeModules()
  symlinkSync(buildDependencies, buildNodeModules)
  const site = join(claimed, 'site')
  try {
    await viteBuild({
      root: claimed,
      base: viteBasePath,
      logLevel: 'silent',
      configFile: false,
      publicDir: staticPublicDir,
      plugins: [
        pinnedRemoteBuildPlugin(join(cacheDir(), 'remote-modules')),
        ...(buildEntries.length === 0
          ? []
          : createStylexVitePlugins({
              externalPackages: [
                '@vista/blocks',
                '@vista/ui',
                '@overeng/agent-timeline',
                '@overeng/devbar',
                '@overeng/effect-rpc-explorer-react',
                '@overeng/stylex-tokens',
              ],
              entries: buildEntries,
            })),
        react(),
      ],
      resolve: { dedupe: [...runtimeResolve.dedupe], alias: staticAliases },
      cacheDir: publishCache,
      build: {
        outDir: site,
        emptyOutDir: true,
        assetsDir: 'assets',
        assetsInlineLimit: 0,
        sourcemap: false,
      },
    })
    stampPublicationBase(site, viteBasePath, basePath)
  } finally {
    rmSync(buildNodeModules, { force: true })
    rmSync(publishCache, { recursive: true, force: true })
  }
  const snapshot = join(claimed, 'snapshot.json')
  if (existsSync(snapshot)) {
    // The browser can only resolve files from the verified static tree.
    cpSync(snapshot, join(site, 'snapshot.json'))
  }
  // Freeze the package-owned companion as exact bytes inside the immutable
  // static tree before the publication inventory is computed.
  writeFileSync(join(site, VISTA_CHANGELOG_FILE), changelogCompanion)
  // Self-inspection payload (decisions q1/q2/q5): assemble the inventory
  // frozen from the immutable snapshot before the build ran, then write it
  // into the version dir and mirror it into the static tree beside the site.
  const selfCapture = buildSelfCapture({
    sourceDir,
    files,
    owner,
    slug,
    version,
    basePath,
    semantics,
    encodedSemantics,
    sha256,
    ...(trail === undefined ? {} : { trail }),
  })
  writeFileSync(join(claimed, SELF_CAPTURE_FILE), JSON.stringify(selfCapture))
  cpSync(join(claimed, SELF_CAPTURE_FILE), join(site, SELF_CAPTURE_FILE))
  assertSelfContainedStaticOutput(site)
  const receipt: PublicationReceipt = {
    schemaVersion: 1,
    owner,
    slug,
    version,
    basePath,
    toolchain: { vite: viteVersion },
    semantics: {
      path: 'vista-semantics.json',
      sha256: sha256(encodedSemantics),
    },
    inventory: inventoryTree(claimed),
  }
  const encoded = JSON.stringify(receipt)
  const trustRoot = scopedPublicationTrustRoot(owner, slug, version)
  mkdirSync(join(trustRoot, '..'), { recursive: true })
  const trustRootTemp = `${trustRoot}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(trustRootTemp, JSON.stringify({ schemaVersion: 1, receiptSha256: sha256(encoded) }))
  renameSync(trustRootTemp, trustRoot)
  // Publish the immutable receipt only after every artifact it covers is durable.
  const receiptPath = join(claimed, 'publication.json')
  const receiptTemp = `${receiptPath}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(receiptTemp, encoded)
  renameSync(receiptTemp, receiptPath)
}

/**
 * Re-verifies a claimed published version against its trust root and receipt, returning the
 * trusted receipt or null when no publication.json exists (unverifiable content surfaces as an
 * error).
 */
export const verifyStaticPublication = (
  owner: string,
  slug: string,
  version: number,
): PublicationReceipt | null => {
  const claimed = scopedVersionDir(owner, slug, version)
  const receiptPath = join(claimed, 'publication.json')
  if (!existsSync(receiptPath)) return null
  const encoded = readFileSync(receiptPath, 'utf8')
  const root = Schema.decodeSync(Schema.fromJsonString(PublicationTrustRoot))(
    readFileSync(scopedPublicationTrustRoot(owner, slug, version), 'utf8'),
  )
  if (root.receiptSha256 !== sha256(encoded)) throw new Error('publication receipt is untrusted')
  const receipt = Schema.decodeSync(Schema.fromJsonString(PublicationReceipt))(encoded)
  if (
    receipt.schemaVersion !== 1 ||
    receipt.owner !== owner ||
    receipt.slug !== slug ||
    receipt.version !== version ||
    (receipt.basePath !== scopedBasePath(owner, slug, version) &&
      receipt.basePath !== legacyScopedBasePath(owner, slug, version))
  ) {
    throw new Error('publication receipt identity is invalid')
  }
  const encodedSemantics = readFileSync(join(claimed, receipt.semantics.path), 'utf8')
  if (sha256(encodedSemantics) !== receipt.semantics.sha256) {
    throw new Error('published semantic manifest integrity mismatch')
  }
  const decodedSemantics = decodePublicationSemanticManifestJson(encodedSemantics)
  if (Result.isFailure(decodedSemantics)) {
    throw new Error(`published semantic manifest is invalid: ${String(decodedSemantics.failure)}`)
  }
  const actual = inventoryTree(claimed)
  if (JSON.stringify(actual) !== JSON.stringify(receipt.inventory)) {
    throw new Error('published directory integrity mismatch')
  }
  return receipt
}
/**
 * Discriminated union describing how a static publication inspection ended: trusted with receipt
 * and index, present but without a receipt, or rejected with an explanatory reason.
 */
export type StaticPublicationVerification =
  | {
      readonly _tag: 'verified'
      readonly receipt: PublicationReceipt
      readonly index: VerifiedPublicationIndex
    }
  | { readonly _tag: 'receiptless' }
  | { readonly _tag: 'untrusted'; readonly reason: string }
/**
 * Inspects a published version without throwing on distrust, returning a verified index (reused
 * via cache), 'receiptless' when no receipt exists, or 'untrusted' with the failure reason.
 */
export const inspectStaticPublication = (
  owner: string,
  slug: string,
  version: number,
): StaticPublicationVerification => {
  const claimed = scopedVersionDir(owner, slug, version)
  if (!existsSync(join(claimed, 'publication.json'))) return { _tag: 'receiptless' }
  try {
    const encoded = readFileSync(join(claimed, 'publication.json'), 'utf8')
    const root = Schema.decodeSync(Schema.fromJsonString(PublicationTrustRoot))(
      readFileSync(scopedPublicationTrustRoot(owner, slug, version), 'utf8'),
    )
    if (root.receiptSha256 !== sha256(encoded)) {
      throw new Error('publication receipt is untrusted')
    }
    const cached = verifiedPublicationIndexes.get(claimed)
    if (cached !== undefined && cached.receiptSha256 === root.receiptSha256) {
      return { _tag: 'verified', receipt: cached.receipt, index: cached }
    }
    const receipt = verifyStaticPublication(owner, slug, version)
    if (receipt === null) return { _tag: 'receiptless' }
    const index: VerifiedPublicationIndex = {
      directory: claimed,
      receipt,
      receiptSha256: root.receiptSha256,
      entries: new Map(receipt.inventory.map((entry) => [entry.path, entry])),
    }
    verifiedPublicationIndexes.set(claimed, index)
    return { _tag: 'verified', receipt, index }
  } catch (cause) {
    return {
      _tag: 'untrusted',
      reason: cause instanceof Error ? cause.message : String(cause),
    }
  }
}

/**
 * Maps a URL request path to an indexed publication file's absolute path, rejecting anything
 * outside the receipt's inventory (null) and throwing on undecodable percent-encoding.
 */
export const resolveVerifiedStaticPublicationFile = (
  receipt: PublicationReceipt,
  requestPath: string,
): string | null => {
  const { owner, slug, version } = receipt
  let decoded: string
  try {
    decoded = decodeURIComponent(requestPath.split('?')[0] ?? '')
  } catch {
    throw new Error('malformed static path encoding')
  }
  const segments = decoded.split('/').filter((segment) => segment !== '')
  if (
    decoded.includes('\\') ||
    decoded.includes('\0') ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('static path traversal refused')
  }
  const staticPath = segments.length === 0 ? 'index.html' : segments.join('/')
  const inventoryPath = `site/${staticPath}`
  if (!receipt.inventory.some((entry) => entry.path === inventoryPath)) return null
  return join(scopedVersionDir(owner, slug, version), inventoryPath)
}

/**
 * An indexed publication file together with its verified contents, produced when a request
 * resolves successfully against a verified index.
 */
export interface VerifiedPublicationFile {
  readonly path: string
  readonly bytes: Buffer
}

/** Read and verify one indexed publication file without rescanning its siblings. */
export const readVerifiedPublicationFile = (
  index: VerifiedPublicationIndex,
  path: string,
): VerifiedPublicationFile | null => {
  const relativePath = relative(index.directory, path)
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    relativePath.includes('\0')
  ) {
    throw new Error('published path is outside the verified version')
  }
  const inventoryPath = relativePath.split(sep).join('/')
  const entry = index.entries.get(inventoryPath)
  if (entry === undefined) return null
  const bytes = readFileSync(path)
  if (bytes.byteLength !== entry.size || sha256(bytes) !== entry.sha256) {
    throw new Error(`published file integrity mismatch: ${inventoryPath}`)
  }
  return { path, bytes }
}

/**
 * Present already integrity-checked publication bytes at their canonical route.
 * Only trusted legacy text assets are projected; receipts, inventory entries,
 * authored identity and every on-disk byte remain unchanged. Call this only
 * with a file returned by readVerifiedPublicationFile (or its request resolver).
 */
export const projectVerifiedPublicationFile = (
  index: VerifiedPublicationIndex,
  file: VerifiedPublicationFile,
): Buffer => {
  const { owner, slug, version, basePath } = index.receipt
  const canonicalBasePath = scopedBasePath(owner, slug, version)
  if (basePath === canonicalBasePath || !/\.(?:css|html|js)$/.test(file.path)) return file.bytes
  if (basePath !== legacyScopedBasePath(owner, slug, version)) {
    throw new Error('publication receipt identity is invalid')
  }
  const content = file.bytes.toString('utf8')
  // The bootstrap also embeds appVersionId without the /r/ prefix. Limit
  // that repair to its named field; authored identities/evidence and unrelated
  // storage/resource keys are not route keys.
  let projected = content.replaceAll(basePath, canonicalBasePath)
  projected = projected.replace(
    /(\bappVersionId\s*[:=]\s*)(["'])([^"']*)\2/g,
    (match, field: string, quote: string, value: string) =>
      value === basePath.slice(3, -1)
        ? `${field}${quote}${canonicalBasePath.slice(3, -1)}${quote}`
        : match,
  )
  if (file.path.endsWith('.js')) {
    // Immutable pre-codec AppShell bundles decode the captured route owner
    // with decodeURIComponent. Match its owner field, including minified
    // identifiers, rather than changing the browser's global decoder.
    projected = projected.replace(
      /\bowner:\s*decodeURIComponent\(([A-Za-z_$][\w$]*)\[1\]\)(?=,\s*slug:\s*decodeURIComponent\(\1\[2\]\),\s*version:\s*decodeURIComponent\(\1\[3\]\))/g,
      () => `owner:${JSON.stringify(owner)}`,
    )
    // Its navigation helper interpolates encoded owner/slug in one template.
    // Keep the existing slug encoder and project only that owner expression.
    projected = projected.replace(
      /\$\{[A-Za-z_$][\w$]*\(([A-Za-z_$][\w$]*)\.owner\)\}(?=\/\$\{[A-Za-z_$][\w$]*\(\1\.slug\)\})/g,
      (_match, app: string) =>
        '${"o-"+Array.from(new TextEncoder().encode(' +
        `${app}.owner),byte=>byte.toString(16).padStart(2,"0")).join("")}`,
    )
  }
  return projected === content ? file.bytes : Buffer.from(projected)
}

/**
 * Verify every publication-owned file beside a provider before loading any
 * module. Vite evaluates a provider's local dependency graph recursively, so
 * checking only `*.provider.ts` and `*.query.ts` would allow a tampered helper
 * module to execute before its bytes ever crossed the trust boundary.
 */
export const verifyPublishedProviderModule = (
  index: VerifiedPublicationIndex,
  providerPath: string,
): void => {
  const providerInventoryPath = relative(index.directory, providerPath).split(sep).join('/')
  if (!index.entries.has(providerInventoryPath)) {
    throw new Error(`provider source is absent from publication inventory: ${providerPath}`)
  }
  const separator = providerInventoryPath.lastIndexOf('/')
  const providerDirectory = separator === -1 ? '' : providerInventoryPath.slice(0, separator + 1)
  for (const inventoryPath of index.entries.keys()) {
    if (!inventoryPath.startsWith(providerDirectory)) continue
    const dependencyPath = join(index.directory, inventoryPath)
    if (readVerifiedPublicationFile(index, dependencyPath) === null) {
      throw new Error(`provider dependency is absent from publication inventory: ${dependencyPath}`)
    }
  }
}

/**
 * Serves a request in one step by resolving it against the index's receipt and then reading and
 * integrity-checking the matched file, yielding null when nothing indexed matches.
 */
export const resolveVerifiedStaticPublicationRequest = (
  index: VerifiedPublicationIndex,
  requestPath: string,
): VerifiedPublicationFile | null => {
  const path = resolveVerifiedStaticPublicationFile(index.receipt, requestPath)
  return path === null ? null : readVerifiedPublicationFile(index, path)
}

/**
 * Verifies a published version on demand and resolves a request path to a file within it,
 * returning null when receiptless and throwing when the publication is untrusted.
 */
export const resolveStaticPublicationFile = (
  owner: string,
  slug: string,
  version: number,
  requestPath: string,
): string | null => {
  const verification = inspectStaticPublication(owner, slug, version)
  if (verification._tag === 'receiptless') return null
  if (verification._tag === 'untrusted') throw new Error(verification.reason)
  return resolveVerifiedStaticPublicationRequest(verification.index, requestPath)?.path ?? null
}

const buildMeta = (input: PublishInput, v: number, proj: DerivedProjection): VersionMeta => ({
  owner: input.owner,
  slug: input.slug,
  version: v,
  author: input.author,
  timestamp: new Date().toISOString(),
  changeSummary: input.changeSummary,
  parent: v > 1 ? v - 1 : null,
  title: proj.title,
  template: proj.template,
  status: proj.status,
})

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** Generate Vista's private browser bootstrap inside the claimed AppVersion. */
const writeVistaBootstrap = (
  claimed: string,
  title: string,
  appVersionId: string,
  dataBaseUrl: string,
  owner: string,
): void => {
  const buildInfo = resolveVistaBuildInfo()
  const grafana = resolveVistaGrafanaConfig()
  writeFileSync(
    join(claimed, 'index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/${VISTA_FAVICON_FILE}" type="image/svg+xml" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./.vista-main.tsx"></script>
  </body>
</html>
`,
  )
  writeFileSync(
    join(claimed, '.vista-main.tsx'),
    `import '@vista/ui/document.css'
import '@overeng/effect-rpc-explorer-react/styles.css'
import { AppShell, serviceHostRuntime, VistaHostRuntimeProvider } from '@vista/blocks/shell'
import { PublishedDataRuntime } from '@vista/blocks/query'
import { createRoot } from 'react-dom/client'
import AuthoredApp from './app.tsx'

// Embedding hosts (webfractal iframes) hand their scheme over as \`?theme=light|dark\`;
// without it the shell keeps its OS-scheme default.
const embedTheme = new URLSearchParams(window.location.search).get('theme')

createRoot(document.getElementById('root')!).render(
  <VistaHostRuntimeProvider value={serviceHostRuntime}>
  <AppShell
    title=${JSON.stringify(title)}
    owner={${JSON.stringify(owner)}}
    buildInfo={${JSON.stringify(buildInfo)}}
    {...(embedTheme === 'light' || embedTheme === 'dark' ? { initialTheme: embedTheme } : {})}
    changelogHref=${JSON.stringify(`./${VISTA_CHANGELOG_FILE}`)}${grafana === undefined ? '' : `\n    grafana={${JSON.stringify(grafana)}}`}
  >
    <PublishedDataRuntime
      actorSource=${JSON.stringify(actorSource())}
      appVersionId=${JSON.stringify(appVersionId)}
      dataBaseUrl=${JSON.stringify(dataBaseUrl)}
      snapshotUrl="./snapshot.json"
    >
      <AuthoredApp />
    </PublishedDataRuntime>
  </AppShell>
  </VistaHostRuntimeProvider>,
)
`,
  )
}

/** Shared admission for publication and preflight, before source or immutable state access. */
export const publishOwnerRefusal = (owner: string, slug: string): PublishFailed | undefined => {
  if (Schema.is(PublishableOwnerIdentity)(owner)) return undefined
  const reason = isLegacyOwnerIdentity(owner)
    ? 'is a legacy dotted identity'
    : 'is not a managed seat identity'
  return new PublishFailed({
    owner,
    slug,
    message: `Vista owner "${owner}" ${reason}; publish from a managed seat (ST_AGENT=agent/...).`,
  })
}

/**
 * Publish one immutable version as one all-or-nothing transaction. Semantic
 * extraction is the sole source of metadata and data capture bindings.
 */
export const publish = async (
  input: PublishInput,
  providers: ProviderRegistryManager,
  renderSmoke?: RenderSmoke,
  trace?: FreezeTraceContext,
): Promise<PublishResult> => {
  const { owner, slug } = input
  const refusal = publishOwnerRefusal(owner, slug)
  if (refusal !== undefined) throw refusal
  invalidateVerifiedPublications(owner, slug)
  const appSource = resolveAppSource(owner, slug)
  const preflight = await preflightVistaApp(appSource)
  if (preflight._tag === 'failed') throw new VistaPreflightError(preflight.report)
  const projection = preflight.projection
  const semantics = projection.semantics
  const bindings = bindingsFromManifest(semantics)
  // Fail fast on a bad trail before claiming a version or building anything:
  // shipped entries are author-controlled input, validated and scanned here,
  // with the full-payload scan in finalize as the backstop.
  validateShippedTrail(slug, input.trail)
  // Pin the exact package companion bytes before claiming immutable state.
  // A missing advertised companion fails at this service boundary immediately.
  const changelogCompanion = readVistaChangelogCompanion()

  const { v, claimed } = claimVersion(owner, slug)
  let versionRegistry: ProviderRegistry | undefined
  try {
    populateVersion(appSource, claimed)
    versionRegistry = await providers.replaceVersion(
      { owner, slug, version: v },
      join(claimed, 'providers'),
    )
    // Freeze the authored inventory from the immutable snapshot before the
    // build runs: a mid-build author edit must not leak into vista-self.json
    // while the built site reflects earlier contents.
    const authoredFiles: ReadonlyArray<AuthoredFile> = collectAuthoredFiles(claimed)

    const report = await captureFrozen(versionRegistry, bindings, projection.capturePlan, trace)
    const snapshot = report.snapshot
    const captureResults = report.results
    const failures = report.results.filter((result) => result._tag !== 'captured')
    if (failures.length > 0) {
      const detail = failures
        .map((result) =>
          result._tag === 'effectful-refused'
            ? `${result.blockId}: effectful capture requires effectfulCapture acknowledgement`
            : result._tag === 'failed'
              ? `${result.blockId}: ${result.providerId}.${result.rpcTag}: ${result.error}`
              : `${result.blockId}: ${result._tag}`,
        )
        .join('; ')
      throw new Error(`publication data capture failed; nothing published (${detail})`)
    }

    const captureById = new Map(captureResults.map((result) => [result.blockId, result]))
    const publishedBindings: PublishedBinding[] = bindings.map((binding) => {
      const capture = captureById.get(binding.semanticId)
      return capture === undefined ? binding : Object.assign({}, binding, { capture })
    })
    const meta = buildMeta(input, v, projection)

    writeFileSync(join(claimed, 'meta.json'), JSON.stringify(meta, null, 2))
    writeFileSync(join(claimed, 'snapshot.json'), JSON.stringify(snapshot, null, 2))
    const appVersionId = `${encodeRouteOwner(owner)}/${slug}/v${v}`
    writeVistaBootstrap(
      claimed,
      semantics.app.title,
      appVersionId,
      `/r/${appVersionId}/_data/`,
      owner,
    )
    await finalizeStaticPublication(
      claimed,
      appSource,
      authoredFiles,
      owner,
      slug,
      v,
      semantics,
      input.trail,
      changelogCompanion,
    )

    if (renderSmoke !== undefined) {
      const smoke = await renderSmoke(owner, slug, v)
      if (smoke._tag === 'failed') throw new RenderSmokeError(slug, v, smoke.reason)
      if (smoke.thumbnail !== undefined) {
        try {
          writeFileSync(join(claimed, 'thumbnail.png'), smoke.thumbnail, { flag: 'wx' })
        } catch (cause) {
          console.warn(`Vista thumbnail storage skipped for ${slug} v${v}: ${String(cause)}`)
        }
      }
    }

    rmSync(join(claimed, PUBLISHING_MARKER))
    swapLatest(owner, slug, v)
    await providers.retainVersion({ owner, slug, version: v })
    invalidateVerifiedPublications(owner, slug)
    return buildPublishResult(owner, slug, v, meta, publishedBindings)
  } catch (error) {
    if (versionRegistry !== undefined) {
      await providers.closeVersion({ owner, slug, version: v })
    }
    rmSync(claimed, { recursive: true, force: true })
    rmSync(scopedPublicationTrustRoot(owner, slug, v), { force: true })
    invalidateVerifiedPublications(owner, slug)
    throw error
  }
}

/**
 * Publish-time artifacts a version dir carries that are NOT authored AppSource.
 * Rehydrate restores only authored files, never lifecycle proof, captured data,
 * generated browser bootstrap, or static output.
 */
const PUBLISH_ARTIFACTS = new Set([
  'meta.json',
  'snapshot.json',
  'publication.json',
  'thumbnail.png',
  'site',
  'vista-semantics.json',
  SELF_CAPTURE_FILE,
  'index.html',
  '.vista-main.tsx',
])

/** What `vista publish --dry-run` previews for the canonical AppSource. */
export interface PublishPreview {
  readonly owner: string
  readonly slug: string
  readonly nextVersion: number
  readonly title?: string
  readonly template?: string
  readonly bindings?: ReadonlyArray<SemanticCaptureBinding>
}

/**
 * Preview the same canonical AppSource projection publication will use, without
 * claiming a version, freezing data, or writing beneath the Vista apps tree.
 */
export const previewPublish = async (input: {
  readonly owner: string
  readonly slug: string
}): Promise<PublishPreview> => {
  const { owner, slug } = input
  const refusal = publishOwnerRefusal(owner, slug)
  if (refusal !== undefined) throw refusal
  const preflight = await preflightVistaApp(resolveAppSource(owner, slug))
  if (preflight._tag === 'failed') throw new VistaPreflightError(preflight.report)
  const projection = preflight.projection
  return {
    owner,
    slug,
    nextVersion: nextCandidate(owner, slug),
    title: projection.title,
    template: projection.template,
    bindings: bindingsFromManifest(projection.semantics),
  }
}

/**
 * Outcome of rehydrating a packaged publication back onto disk, carrying its identity, version,
 * app source, and the list of restored files.
 */
export interface RehydrateResult {
  readonly owner: string
  readonly slug: string
  readonly version: number
  readonly appSource: string
  readonly files: readonly string[]
}

/**
 * The rehydrate target already holds work-in-progress — refuse rather than
 * clobber an in-progress authoring dir (decision 0053 #3, mirrors {@link
 * ScaffoldExists}). Explicit fields (not TS parameter properties): the packaged
 * service runs under node strip-types, which rejects parameter properties.
 */
export class RehydrateTargetNotEmpty extends Error {
  readonly _tag = 'Vista.RehydrateTargetNotEmpty'
  readonly slug: string
  readonly path: string
  constructor(slug: string, path: string) {
    super(
      `cannot rehydrate ${slug}: the target dir already has files (${path}) — publish, move, or ` +
        `remove the in-progress draft first, so a rehydrate never overwrites unsaved work`,
    )
    this.slug = slug
    this.path = path
  }
}

/**
 * Copy a published version's immutable authored source back into its canonical
 * AppSource. Restores only authored source (never the lifecycle artifacts in
 * {@link PUBLISH_ARTIFACTS}); refuses (tagged {@link RehydrateTargetNotEmpty})
 * if the AppSource already holds work in progress. `version` defaults to the
 * app's `latest`.
 */
export const rehydrateSource = (input: {
  readonly owner: string
  readonly slug: string
  readonly version?: number
}): RehydrateResult => {
  const { owner, slug } = input
  const appSource = resolveAppSource(owner, slug)
  const st = scopedScanApp(owner, slug)
  if (!st || st.versions.length === 0) throw new Error(`unknown app: ${slug}`)
  const version = input.version ?? st.latest ?? st.versions[st.versions.length - 1]!.version
  const src = scopedVersionDir(owner, slug, version)
  if (!existsSync(join(src, 'app.tsx'))) {
    throw new Error(`unknown version for ${slug}: v${version}`)
  }
  if (existsSync(appSource) && readdirSync(appSource).length > 0) {
    throw new RehydrateTargetNotEmpty(slug, appSource)
  }
  mkdirSync(appSource, { recursive: true })
  const files: string[] = []
  for (const entry of readdirSync(src)) {
    if (entry === 'node_modules' || entry === PUBLISHING_MARKER || PUBLISH_ARTIFACTS.has(entry)) {
      continue
    }
    cpSync(join(src, entry), join(appSource, entry), { recursive: true })
    files.push(entry)
  }
  files.sort()
  return { owner, slug, version, appSource, files }
}
