import type { StyleXStylesWithout } from '@stylexjs/stylex'
import * as stylex from '@stylexjs/stylex'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  Popover,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components'

import type { ExplorerClient } from '@overeng/effect-rpc-explorer'
import { colorScheme, lightTheme } from '@vista/ui/foundations'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { humanizedDate } from '@overeng/utils'

import VISTA_LOGO_DARK from './assets/vista-icon-mono-dark.svg?url'
import VISTA_LOGO_LIGHT from './assets/vista-icon-mono-light.svg?url'
import type { AppSourceData } from './blocks/app-source.ts'
import { Icon } from './blocks/kit/icons.tsx'
import { ExplainLayer, ExplainProvider, useExplainState } from './blocks/kit/Note.tsx'
import { AppVersionPreferenceProvider } from './blocks/ResizableSplit.tsx'
import type { GrafanaTraceConfig } from './grafana-trace-url.ts'
import { decodeRouteOwner, encodeRouteOwner, isValidContributorIdentity } from './owner-identity.ts'
import { useSelfSource } from './self-inspection.ts'
import type { ShellVersionHierarchy, ShellVersionItem } from './ShellSelect.tsx'
import { ThemeProvider, getSystemTheme } from './theme.ts'

const ThemeToggle = lazy(() => import('./ShellThemeSwitcher.tsx'))
const VersionControl = lazy(() =>
  import('./ShellSelect.tsx').then(({ ShellVersionControl }) => ({
    default: ShellVersionControl,
  })),
)
const Agentation = lazy(() =>
  import('agentation').then(({ Agentation: AgentationComponent }) => ({
    default: AgentationComponent,
  })),
)
// Below the lazy boundary on purpose: @pierre touches browser globals on
// import, and the shell also renders server-side in the publish pipeline.
const SourceInspector = lazy(() =>
  import('./blocks/SourceInspector.tsx').then((module) => ({ default: module.SourceInspector })),
)
// The diagnostics UI and its Effect transport are browser-only and load on demand.
const RpcExplorerPanel = lazy(() =>
  import('./RpcExplorerPanel.tsx').then((module) => ({ default: module.RpcExplorerPanel })),
)

/**
 * A single published version of an app, pairing its version identifier with display metadata such
 * as label, title, timestamp, publisher, and change summary.
 */
export interface AppShellVersionOption {
  readonly id: string
  readonly label: string
  readonly title?: string
  readonly timestamp: string
  readonly publisher: string
  readonly changeSummary: string
}

/**
 * A navigable app entry keyed by owner and slug, exposing its latest version number, full version
 * history, and an optional retired flag.
 */
export interface AppShellAppOption {
  readonly owner: string
  readonly slug: string
  readonly title: string
  readonly latest: number | null
  readonly versions: readonly AppShellVersionOption[]
  readonly retired?: boolean
}

/**
 * Describes the shell's navigation model: the catalog of known apps plus the owner, slug, and
 * optional version identifying the currently selected document.
 */
export interface AppShellNavigation {
  readonly apps: readonly AppShellAppOption[]
  readonly currentOwner: string
  readonly currentSlug: string
  readonly currentVersion?: string
}

/** Selects the semantic heading level (H1–H3) at which the shell renders its title. */
export type AppShellHeaderVariant = 'H1' | 'H2' | 'H3'

/** Chooses whether shell content spans the full viewport width or is constrained to a contained layout. */
export type AppShellContentWidth = 'full' | 'contained'

/**
 * Immutable provenance metadata for the running build, including base version, revision, dirty
 * flag, source kind, commit timestamp, and derived machine/display version strings.
 */
export interface AppShellBuildInfo {
  readonly baseVersion: string
  readonly rev: string
  readonly dirty: boolean
  readonly sourceKind: 'local' | 'nix' | 'package'
  readonly commitTs: string
  readonly machineVersion: string
  readonly displayVersion: string
}

/** Agent identity and optional verified presentation context for a changelog entry. */
export interface VistaChangelogContributor {
  readonly agentId: string
  readonly name?: string
  readonly worktree?: string
}

/** One dated changelog entry with a stable id, title, and human-readable summary of the change. */
export interface VistaChangelogEntry {
  readonly id: string
  readonly date: string
  readonly title: string
  readonly summary: string
  readonly contributors?: readonly VistaChangelogContributor[]
}

/**
 * The schema-version-1 changelog manifest, tying a product's entry list to the machine version of
 * the build it describes.
 */
export interface VistaChangelogManifest {
  readonly schemaVersion: 1
  readonly product: string
  readonly build: {
    readonly machineVersion: string
  }
  readonly entries: readonly VistaChangelogEntry[]
}

/**
 * Discriminated union tracking the changelog fetch lifecycle through idle, loading, ready (with
 * manifest), and failed states.
 */
export type VistaChangelogState =
  | { readonly _tag: 'idle' }
  | { readonly _tag: 'loading' }
  | { readonly _tag: 'ready'; readonly manifest: VistaChangelogManifest }
  | { readonly _tag: 'failed' }

/**
 * Contract for driving the version selector: the selected key, the items to render, whether a
 * newer version exists, and an optional selection-change callback.
 */
export interface AppShellVersionControl {
  readonly selectedKey: string
  readonly items: readonly ShellVersionItem[]
  readonly newVersionAvailable?: boolean
  readonly onSelectionChange?: (key: string) => void
}

/**
 * Props for the shell header, covering title and ask display, theme and content-width controls,
 * navigation wiring, the Explain toggle, and inspector/annotation toggles.
 */
export interface AppShellHeaderProps {
  readonly title: string
  readonly asks?: readonly ShellAsk[]
  readonly owner?: string
  readonly theme: 'light' | 'dark'
  readonly onThemeChange: (theme: 'light' | 'dark') => void
  readonly contentWidth?: AppShellContentWidth
  readonly onContentWidthChange?: (contentWidth: AppShellContentWidth) => void
  readonly navigation?: AppShellNavigation
  readonly selfSourceAvailable?: boolean
  readonly inspectorOpen?: boolean
  readonly onInspectorOpenChange?: (open: boolean) => void
  readonly rpcExplorerOpen?: boolean
  readonly onRpcExplorerOpenChange?: (open: boolean) => void
  readonly annotationEnabled?: boolean
  readonly onAnnotationEnabledChange?: (enabled: boolean) => void
  /** Whether the Explain overlay is on. */
  readonly explainOn?: boolean
  /** Supplied only when the page has Notes; without it the Explain toggle is not rendered. */
  readonly onExplainChange?: (on: boolean) => void
  readonly variant?: AppShellHeaderVariant
  readonly versionControl?: AppShellVersionControl
  readonly buildInfo?: AppShellBuildInfo
  readonly changelogHref?: string
  readonly homeHref?: string
}

/**
 * Props for the AppShell root component, including title, children, controlled or initial
 * theme, navigation, build info, changelog link, and an explicit self-inspection payload.
 */
export interface AppShellProps {
  readonly title: string
  readonly owner?: string
  readonly children: ReactNode
  readonly initialTheme?: 'light' | 'dark'
  readonly theme?: 'light' | 'dark'
  readonly onThemeChange?: (theme: 'light' | 'dark') => void
  readonly navigation?: AppShellNavigation
  readonly buildInfo?: AppShellBuildInfo
  readonly changelogHref?: string
  /**
   * Explicit self-inspection payload. Stories, previews, and tests pass data
   * here; production leaves it undefined and the shell resolves the frozen
   * `vista-self.json` from the owner route instead.
   */
  readonly selfSource?: AppSourceData | undefined
  /** Optional transport injection for deterministic explorer previews. */
  readonly rpcExplorerClientFactory?: (appIdentity?: string) => ExplorerClient
  /** Grafana the RPC explorer links trace IDs to; absent leaves trace IDs unlinked. */
  readonly grafana?: GrafanaTraceConfig | undefined
  readonly style?: StyleXStylesWithout<{
    backgroundColor: string
    color: string
    fontFamily: string
    minHeight: '100vh'
    width: '100%'
  }>
}

const navigateTo = (href: string): void => {
  if (typeof window !== 'undefined') window.location.assign(href)
}

interface BrowserRoute {
  readonly owner: string
  readonly slug: string
  readonly version: string
}

const currentBrowserRoute = (): BrowserRoute | undefined => {
  if (typeof window === 'undefined') return undefined
  const match = /^\/r\/([^/]+)\/([^/]+)\/([^/]+)\/?$/.exec(window.location.pathname)
  if (match === null) return undefined
  try {
    const owner = decodeRouteOwner(match[1]!)
    if (owner === undefined) return undefined
    return {
      owner,
      slug: decodeURIComponent(match[2]!),
      version: decodeURIComponent(match[3]!),
    }
  } catch {
    return undefined
  }
}

const isVersionOption = (value: unknown): value is AppShellVersionOption =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'id') === 'string' &&
  typeof Reflect.get(value, 'label') === 'string' &&
  (Reflect.get(value, 'title') === undefined || typeof Reflect.get(value, 'title') === 'string') &&
  typeof Reflect.get(value, 'timestamp') === 'string' &&
  typeof Reflect.get(value, 'publisher') === 'string' &&
  typeof Reflect.get(value, 'changeSummary') === 'string'

const isAppOption = (value: unknown): value is AppShellAppOption => {
  if (typeof value !== 'object' || value === null) return false
  const latest = Reflect.get(value, 'latest')
  const retired = Reflect.get(value, 'retired')
  const versions = Reflect.get(value, 'versions')
  return (
    typeof Reflect.get(value, 'owner') === 'string' &&
    typeof Reflect.get(value, 'slug') === 'string' &&
    typeof Reflect.get(value, 'title') === 'string' &&
    ((typeof latest === 'number' && Number.isFinite(latest)) || latest === null) &&
    (retired === undefined || retired === true) &&
    Array.isArray(versions) &&
    versions.every(isVersionOption)
  )
}

const hasExactlyKeys = (value: object, keys: readonly string[]): boolean => {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => actual.includes(key))
}

const isNonEmptyTrimmedString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value

const CHANGELOG_WORKTREE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/u

const isChangelogContributor = (value: unknown): value is VistaChangelogContributor => {
  if (typeof value !== 'object' || value === null) return false
  const agentId = Reflect.get(value, 'agentId')
  const name = Reflect.get(value, 'name')
  const worktree = Reflect.get(value, 'worktree')
  if (
    !hasExactlyKeys(value, [
      'agentId',
      ...(name === undefined ? [] : ['name']),
      ...(worktree === undefined ? [] : ['worktree']),
    ])
  ) {
    return false
  }
  return (
    isNonEmptyTrimmedString(agentId) &&
    isValidContributorIdentity(agentId) &&
    (name === undefined || isNonEmptyTrimmedString(name)) &&
    (worktree === undefined ||
      (isNonEmptyTrimmedString(worktree) && CHANGELOG_WORKTREE_PATTERN.test(worktree)))
  )
}

const isChangelogEntry = (value: unknown): value is VistaChangelogEntry => {
  if (typeof value !== 'object' || value === null) return false
  const contributors = Reflect.get(value, 'contributors')
  if (
    !hasExactlyKeys(value, [
      'id',
      'date',
      'title',
      'summary',
      ...(contributors === undefined ? [] : ['contributors']),
    ])
  ) {
    return false
  }
  const id = Reflect.get(value, 'id')
  const date = Reflect.get(value, 'date')
  if (
    typeof id !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) ||
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
    !id.startsWith(`${date}-`)
  ) {
    return false
  }
  const parsedDate = new Date(`${date}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsedDate.valueOf()) &&
    parsedDate.toISOString().slice(0, 10) === date &&
    isNonEmptyTrimmedString(Reflect.get(value, 'title')) &&
    isNonEmptyTrimmedString(Reflect.get(value, 'summary')) &&
    (contributors === undefined ||
      (Array.isArray(contributors) &&
        contributors.length > 0 &&
        contributors.every(isChangelogContributor)))
  )
}

/**
 * Type guard that verifies an unknown value has exactly the manifest's keys with schemaVersion 1
 * and well-formed build and entries, narrowing it to VistaChangelogManifest.
 */
export const isVistaChangelogManifest = (value: unknown): value is VistaChangelogManifest => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !hasExactlyKeys(value, ['schemaVersion', 'product', 'build', 'entries'])
  ) {
    return false
  }
  const build = Reflect.get(value, 'build')
  const entries = Reflect.get(value, 'entries')
  if (
    Reflect.get(value, 'schemaVersion') !== 1 ||
    Reflect.get(value, 'product') !== 'vista' ||
    typeof build !== 'object' ||
    build === null ||
    !hasExactlyKeys(build, ['machineVersion']) ||
    !isNonEmptyTrimmedString(Reflect.get(build, 'machineVersion')) ||
    !Array.isArray(entries) ||
    !entries.every(isChangelogEntry)
  ) {
    return false
  }
  return new Set(entries.map((entry) => entry.id)).size === entries.length
}

/**
 * Returns the manifest's entries only when its machineVersion matches the given build version, and
 * an empty array otherwise.
 */
export const changelogEntriesForBuild = (
  manifest: VistaChangelogManifest,
  machineVersion: string,
): readonly VistaChangelogEntry[] =>
  manifest.build.machineVersion === machineVersion ? manifest.entries : []

let discoveredNavigation: AppShellNavigation | undefined
let navigationLoadStarted = false
const navigationListeners = new Set<() => void>()

const loadNavigation = (): void => {
  if (navigationLoadStarted) return
  const route = currentBrowserRoute()
  if (route === undefined) return
  navigationLoadStarted = true

  void fetch('/_vista/apps')
    .then((response) => (response.ok ? response.json() : undefined))
    .then((value: unknown) => {
      if (typeof value !== 'object' || value === null) return
      const apps = Reflect.get(value, 'apps')
      if (!Array.isArray(apps) || !apps.every(isAppOption)) return
      discoveredNavigation = {
        apps,
        currentOwner: route.owner,
        currentSlug: route.slug,
        currentVersion: route.version,
      }
      for (const listener of navigationListeners) listener()
    })
    .catch(() => undefined)
}

const subscribeToNavigation = (listener: () => void): (() => void) => {
  navigationListeners.add(listener)
  loadNavigation()
  return () => navigationListeners.delete(listener)
}

const navigationSnapshot = (): AppShellNavigation | undefined => discoveredNavigation

const encodeRouteSegment = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.codePointAt(0)!.toString(16).toUpperCase()}`,
  )

const encodedAppPath = (app: Pick<AppShellAppOption, 'owner' | 'slug'>): string =>
  `${encodeRouteOwner(app.owner)}/${encodeRouteSegment(app.slug)}`

/**
 * Fully qualified pointer to one app version, combining owner and slug with a version string of
 * the literal form vN.
 */
export interface ResolvedAppVersionIdentity {
  readonly owner: string
  readonly slug: string
  readonly version: `v${number}`
}

const selectedNavigationApp = (
  navigation: AppShellNavigation | undefined,
): AppShellAppOption | undefined =>
  navigation?.apps.find(
    (app) => app.owner === navigation.currentOwner && app.slug === navigation.currentSlug,
  )

const isImmutableVersionId = (value: string): value is `v${number}` => /^v\d+$/u.test(value)

/** Resolve route aliases to the immutable publication they currently name. */
export const resolveAppVersionIdentity = (
  navigation: AppShellNavigation | undefined,
): ResolvedAppVersionIdentity | undefined => {
  const app = selectedNavigationApp(navigation)
  if (app === undefined) return undefined
  const selectedVersion = navigation?.currentVersion ?? 'latest'
  let version: `v${number}` | undefined
  if (selectedVersion === 'latest') {
    version = app.latest === null ? undefined : `v${app.latest}`
  } else {
    version = isImmutableVersionId(selectedVersion) ? selectedVersion : undefined
  }
  if (version === undefined || !app.versions.some((candidate) => candidate.id === version)) {
    return undefined
  }
  return { owner: app.owner, slug: app.slug, version }
}

const preferenceKeyPart = (value: string): string => encodeURIComponent(value)

/** Browser-local width preference for one canonical App, shared by all its versions. */
export const appShellContentWidthStorageKey = ({
  owner,
  slug,
}: Pick<AppShellAppOption, 'owner' | 'slug'>): string =>
  `vista.blocks.v1/content-width/${preferenceKeyPart(owner)}/${preferenceKeyPart(slug)}`

const readContentWidthPreference = (storageKey: string | undefined): AppShellContentWidth => {
  if (storageKey === undefined || typeof window === 'undefined') return 'full'
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null')
    if (
      typeof value === 'object' &&
      value !== null &&
      Reflect.get(value, 'version') === 1 &&
      (Reflect.get(value, 'value') === 'full' || Reflect.get(value, 'value') === 'contained')
    ) {
      return Reflect.get(value, 'value') === 'contained' ? 'contained' : 'full'
    }
  } catch {
    // Preferences are best-effort: blocked, malformed, or unavailable storage is the default.
  }
  return 'full'
}

const writeContentWidthPreference = (
  storageKey: string | undefined,
  value: AppShellContentWidth,
): void => {
  if (storageKey === undefined || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, value }))
  } catch {
    // Rendering and the in-memory preference remain usable when storage rejects the write.
  }
}

const shellVersionItem = (version: AppShellVersionOption, now: number): ShellVersionItem => ({
  id: version.id,
  number: version.label,
  ...(version.title === undefined ? {} : { title: version.title }),
  relativeTime: humanizedDate({ timestamp: Date.parse(version.timestamp), nowMs: now }),
  publisher: version.publisher,
  reason: version.changeSummary,
})

/**
 * Builds the selector item list for an app by resolving its latest version and decorating each
 * entry, falling back to a single item for the selected version when no app data is available.
 */
export const shellVersionItems = (
  app: Pick<AppShellAppOption, 'latest' | 'versions'> | undefined,
  selectedVersion: string,
  now: number = Date.now(),
): readonly ShellVersionItem[] => {
  const latestVersion =
    app?.latest === null
      ? undefined
      : (app?.versions.find((version) => version.id === `v${app?.latest}`) ?? app?.versions[0])
  const versions =
    app === undefined || latestVersion === undefined
      ? [{ id: selectedVersion, number: selectedVersion }]
      : [
          {
            ...shellVersionItem(latestVersion, now),
            id: 'latest',
            alias: 'latest' as const,
          },
          ...app.versions.map((version) => shellVersionItem(version, now)),
        ]
  return selectedVersion === 'draft'
    ? [
        { id: 'draft', number: 'Draft', alias: 'draft' },
        ...versions.filter((version) => version.id !== 'draft'),
      ]
    : versions
}

/**
 * Derives the namespaced persistence key (vista:ui:<owner>/<slug>:annotate) used to store
 * annotation UI state for a given app.
 */
export const annotationUiStorageKey = (owner: string, slug: string): string =>
  `vista:ui:${owner}/${slug}:annotate`

// ---------------------------------------------------------------------------
// Outline model
// ---------------------------------------------------------------------------

/** Height of the sticky bar, in px. Also the anchor offset and reading edge base. */
const HEADER_HEIGHT = 48
/** Reading edge: a heading counts as "being read" once it passes just under the bar. */
const READING_EDGE = HEADER_HEIGHT + 16
/** Tolerate subpixel scroll rounding at the reading edge after anchor navigation. */
const READING_EDGE_TOLERANCE = 1

/**
 * Collapsed tick column: a fixed 14px pitch (2px tick + 12px gap, the row
 * rhythm Notion spaces its ticks by), sized to its content. The 320px canvas
 * is only a cap for very long outlines, where the pitch densifies instead of
 * clipping. The expanded panel goes back to ordinary ordered rows.
 */
const RAIL_TICK_PITCH = 14
const RAIL_TRACK_HEIGHT = 320
/** Usable run inside the capped canvas: minus the room tick rounding occupies. */
const RAIL_TICK_TRACK = RAIL_TRACK_HEIGHT - 12

/** Answer state discovered from each rendered ask, independent of outline eligibility. */
export interface ShellAsk {
  readonly answered: boolean
}

const EMPTY_SHELL_ASKS: readonly ShellAsk[] = []

/** Counts only rendered asks; semantic decision status does not participate. */
export const askCounts = (
  asks: readonly ShellAsk[],
): { readonly needed: number; readonly answered: number } => {
  let answered = 0
  for (const ask of asks) if (ask.answered) answered += 1
  return { needed: asks.length - answered, answered }
}

/** One discovered outline candidate, before deduplication and hierarchy derivation. */
export interface ShellOutlineEntry {
  readonly id: string
  readonly label: string
  /** Containment nesting plus heading level — comparable across both sources. */
  readonly rawDepth: number
  /** Absolute document offset of the entry's target, in px. */
  readonly top: number
  readonly kind?: string | null
  readonly answered?: boolean
}

/** A resolved rail entry: hierarchy derived, position proportional to the document. */
export interface ShellOutlineItem {
  readonly id: string
  readonly label: string
  /** 0-based, gap-free nesting level. */
  readonly depth: number
  readonly top: number
  /** `top` as a 0..1 fraction of the scrollable document. */
  readonly position: number
  readonly priority: 'normal' | 'high'
}

/** Compares two labels the way a reader would: whitespace and case ignored. */
const sameLabel = (left: string, right: string): boolean =>
  left.replace(/\s+/g, ' ').trim().toLowerCase() === right.replace(/\s+/g, ' ').trim().toLowerCase()

/** `agent-run-viewer` reads as `Agent run viewer` when nothing better is available. */
export const humanizeOutlineId = (id: string): string => {
  const phrase = id
    .split(/[-_/.]+/)
    .filter((word) => word !== '')
    .join(' ')
  if (phrase === '') return id
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

/**
 * Deduplicates nested equivalents, derives a gap-free hierarchy and turns each
 * entry's document offset into a proportional position.
 *
 * A semantic node and the heading that titles it are one outline place, not
 * two: the heading rides immediately inside the node and carries the same
 * label, so only the outer entry survives.
 */
export const resolveShellOutline = (
  entries: readonly ShellOutlineEntry[],
  documentHeight: number,
): readonly ShellOutlineItem[] => {
  const kept: ShellOutlineEntry[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    if (entry.id === '' || entry.label === '' || seen.has(entry.id)) continue
    const previous = kept.at(-1)
    if (
      previous !== undefined &&
      entry.rawDepth > previous.rawDepth &&
      sameLabel(previous.label, entry.label)
    ) {
      continue
    }
    seen.add(entry.id)
    kept.push(entry)
  }

  const openDepths: number[] = []
  return kept.map((entry) => {
    while (openDepths.length > 0 && openDepths[openDepths.length - 1]! >= entry.rawDepth) {
      openDepths.pop()
    }
    const depth = openDepths.length
    openDepths.push(entry.rawDepth)
    return {
      id: entry.id,
      label: entry.label,
      depth,
      top: entry.top,
      priority: entry.kind === 'ask' && entry.answered !== true ? 'high' : 'normal',
      position: documentHeight > 0 ? Math.min(1, Math.max(0, entry.top / documentHeight)) : 0,
    }
  })
}

/**
 * The last entry whose target has passed the reading edge — the one being read.
 * At the document bottom the last entry wins outright: a final section shorter
 * than a viewport can never push its own top past the edge.
 */
export const activeOutlineId = (
  items: readonly Pick<ShellOutlineItem, 'id' | 'top'>[],
  readingEdge: number,
  atBottom: boolean = false,
): string | undefined => {
  if (atBottom) return items.at(-1)?.id
  let active = items[0]?.id
  for (const item of items) {
    if (item.top > readingEdge) break
    active = item.id
  }
  return active
}

/** The visible reading identity: active item, then the first item while discovery settles. */
export const activeOutlineLabel = (
  items: readonly ShellOutlineItem[],
  activeId: string | undefined,
): string | undefined =>
  (activeId === undefined ? undefined : items.find((item) => item.id === activeId)?.label) ??
  items[0]?.label

/**
 * Lays ticks down the collapsed column at a fixed pitch. Long outlines can
 * compress down to the tick height, but never overlap; overflow stays a
 * compact preview because pointer/focus expansion exposes the complete
 * scrollable list.
 */
export const railTickOffsets = (
  items: readonly ShellOutlineItem[],
  maxTrackHeight: number = RAIL_TICK_TRACK,
): readonly number[] => {
  if (items.length < 2) return items.map(() => 0)
  const pitch = Math.max(2, Math.min(RAIL_TICK_PITCH, maxTrackHeight / (items.length - 1)))
  return items.map((_, index) => index * pitch)
}

const OUTLINE_QUERY =
  '[data-vista-id],[data-vista-outline],[data-vista-kind="ask"],h2[id],h3[id],h4[id],h5[id],h6[id]'
const NESTED_HEADING_QUERY = 'h2,h3,h4,h5,h6'

const textOf = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim()

/** The heading that titles this node — not one belonging to a node nested inside it. */
const owningHeading = (element: Element): string | undefined => {
  for (const heading of element.querySelectorAll(NESTED_HEADING_QUERY)) {
    if (heading.closest('[data-vista-id]') !== element) continue
    const text = textOf(heading)
    if (text !== '') return text
  }
  return undefined
}

const containmentDepth = (element: Element, root: Element): number => {
  let depth = 0
  let parent = element.parentElement
  while (parent !== null && parent !== root && root.contains(parent)) {
    if (parent.hasAttribute('data-vista-id')) depth += 1
    parent = parent.parentElement
  }
  return depth
}

/** The node shape the outline filter reads, independent of the DOM. */
export interface OutlineCandidate {
  readonly id: string
  readonly kind: string | null
  readonly hidden: boolean
}

/**
 * A place a reader navigates to. `app` is the document itself; `island` is a
 * rendering boundary the author drew around a runtime block, not a destination,
 * and its machine id has no business becoming a rail label.
 */
export const isOutlineNode = ({ id, kind, hidden }: OutlineCandidate): boolean =>
  id !== '' && !hidden && kind !== 'app' && kind !== 'island'

/** Discovers asks and outline destinations together from the rendered content. */
const collectShellContent = (
  root: HTMLElement,
): { readonly entries: readonly ShellOutlineEntry[]; readonly asks: readonly ShellAsk[] } => {
  const scrolled = window.scrollY
  const entries: ShellOutlineEntry[] = []
  const asks: ShellAsk[] = []
  for (const element of root.querySelectorAll(OUTLINE_QUERY)) {
    const kind = element.getAttribute('data-vista-kind')
    const answered = kind === 'ask' && element.querySelector('[data-vista-answered]') !== null
    if (kind === 'ask') asks.push({ answered })
    const heading = /^H[1-6]$/.test(element.tagName)
    const id = element.getAttribute('data-vista-id') ?? element.id
    const candidate: OutlineCandidate = {
      id,
      kind,
      hidden: element.closest('[hidden]') !== null,
    }
    if (!isOutlineNode(candidate)) continue
    const explicit = element.getAttribute('data-vista-label')
    const label =
      explicit !== null && explicit !== ''
        ? explicit
        : ((heading ? textOf(element) : owningHeading(element)) ?? humanizeOutlineId(id))
    // Heading level extends containment depth so both sources sort into one
    // hierarchy: an `h3` inside a section is deeper than the section itself.
    const level = heading ? Number(element.tagName.slice(1)) - 1 : 0
    entries.push({
      id,
      label,
      rawDepth: containmentDepth(element, root) + level,
      top: element.getBoundingClientRect().top + scrolled,
      kind,
      answered,
    })
  }
  return { entries, asks }
}

const sameOutline = (
  left: readonly ShellOutlineItem[],
  right: readonly ShellOutlineItem[],
): boolean =>
  left.length === right.length &&
  left.every((item, index) => {
    const other = right[index]!
    return (
      item.id === other.id &&
      item.label === other.label &&
      item.depth === other.depth &&
      item.priority === other.priority &&
      item.top === other.top
    )
  })

const scrollToOutlineTarget = (target: HTMLElement, behavior: 'auto' | 'smooth'): void => {
  window.scrollTo({
    top: target.getBoundingClientRect().top + window.scrollY - READING_EDGE,
    behavior,
  })
}

const sourceIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <path
      d="M1.5 8s2.25-4 6.5-4 6.5 4 6.5 4-2.25 4-6.5 4S1.5 8 1.5 8Z"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.25" />
  </svg>
)
const rpcIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <path
      d="M2.5 4.25h4m3 0h4M2.5 8h11m-11 3.75h4m3 0h4"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
    <circle cx="8" cy="4.25" r="1.25" stroke="currentColor" strokeWidth="1.25" />
    <circle cx="8" cy="11.75" r="1.25" stroke="currentColor" strokeWidth="1.25" />
  </svg>
)

const systemInfoIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.25" />
    <path d="M8 7.25v3.5M8 5.1v.15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const contentWidthIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <path
      d="M2.25 3.25v9.5M13.75 3.25v9.5M5 4.75h6v6.5H5v-6.5Z"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const annotationIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <path
      d="M3.25 2.75h9.5v7H7l-3.75 3v-10ZM6 5.25h4M6 7.25h2.5"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const RECENT_CHANGELOG_ENTRY_COUNT = 3

/**
 * Renders the changelog section for a machine version, showing a placeholder while idle or
 * loading, the manifest entries when ready, and a retry affordance when the fetch failed.
 */
export const VistaChangelogView = ({
  state,
  machineVersion,
  onRetry,
}: {
  readonly state: VistaChangelogState
  readonly machineVersion: string
  readonly onRetry: () => void
}) => {
  if (state._tag === 'idle' || state._tag === 'loading') {
    return (
      <section {...stylex.props(styles.changelog)} aria-label="Vista changelog">
        <span {...stylex.props(styles.changelogTitle)}>What’s new</span>
        <p {...stylex.props(styles.changelogMessage)} role="status">
          {state._tag === 'idle' ? 'Open to load release notes.' : 'Loading release notes…'}
        </p>
      </section>
    )
  }
  if (
    state._tag === 'failed' ||
    (state._tag === 'ready' && state.manifest.build.machineVersion !== machineVersion)
  ) {
    return (
      <section {...stylex.props(styles.changelog)} aria-label="Vista changelog">
        <span {...stylex.props(styles.changelogTitle)}>What’s new</span>
        <p {...stylex.props(styles.changelogMessage)} role="alert">
          Release notes could not be loaded for this build.
        </p>
        <Button {...stylex.props(styles.changelogRetry)} onPress={onRetry}>
          Try again
        </Button>
      </section>
    )
  }

  const entries = changelogEntriesForBuild(state.manifest, machineVersion)
  if (entries.length === 0) {
    return (
      <section {...stylex.props(styles.changelog)} aria-label="Vista changelog">
        <span {...stylex.props(styles.changelogTitle)}>What’s new in Vista</span>
        <p {...stylex.props(styles.changelogMessage)}>
          No release notes are available for this build.
        </p>
      </section>
    )
  }

  const entryList = (items: readonly VistaChangelogEntry[]) => (
    <ol {...stylex.props(styles.changelogList)}>
      {items.map((entry) => (
        <li key={entry.id} {...stylex.props(styles.changelogEntry)}>
          <div {...stylex.props(styles.changelogEntryHeading)}>
            <strong>{entry.title}</strong>
            <time dateTime={entry.date}>
              {humanizedDate({ timestamp: Date.parse(entry.date), nowMs: Date.now() })}
            </time>
          </div>
          <p {...stylex.props(styles.changelogSummary)}>{entry.summary}</p>
          {entry.contributors === undefined ? null : (
            <details {...stylex.props(styles.changelogContext)}>
              <summary {...stylex.props(styles.changelogContextSummary)}>Change context</summary>
              <ul {...stylex.props(styles.changelogContributors)}>
                {entry.contributors.map((contributor, index) => (
                  <li
                    key={`${contributor.agentId}-${String(index)}`}
                    {...stylex.props(styles.changelogContributor)}
                  >
                    <dl {...stylex.props(styles.changelogContributorList)}>
                      <div {...stylex.props(styles.changelogContributorRow)}>
                        <dt {...stylex.props(styles.changelogContributorTerm)}>Agent</dt>
                        <dd {...stylex.props(styles.changelogContributorValue)}>
                          <code {...stylex.props(styles.changelogContributorCode)}>
                            {contributor.agentId}
                          </code>
                        </dd>
                      </div>
                      {contributor.name === undefined ? null : (
                        <div {...stylex.props(styles.changelogContributorRow)}>
                          <dt {...stylex.props(styles.changelogContributorTerm)}>Name</dt>
                          <dd {...stylex.props(styles.changelogContributorValue)}>
                            {contributor.name}
                          </dd>
                        </div>
                      )}
                      {contributor.worktree === undefined ? null : (
                        <div {...stylex.props(styles.changelogContributorRow)}>
                          <dt {...stylex.props(styles.changelogContributorTerm)}>Worktree</dt>
                          <dd {...stylex.props(styles.changelogContributorValue)}>
                            <code {...stylex.props(styles.changelogContributorCode)}>
                              {contributor.worktree}
                            </code>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </li>
      ))}
    </ol>
  )

  return (
    <section {...stylex.props(styles.changelog)} aria-label="Vista changelog">
      <span {...stylex.props(styles.changelogTitle)}>What’s new in Vista</span>
      {entryList(entries.slice(0, RECENT_CHANGELOG_ENTRY_COUNT))}
      {entries.length > RECENT_CHANGELOG_ENTRY_COUNT ? (
        <details {...stylex.props(styles.changelogHistory)}>
          <summary {...stylex.props(styles.changelogHistorySummary)}>
            Full history · {entries.length} entries
          </summary>
          {entryList(entries)}
        </details>
      ) : null}
    </section>
  )
}

/** The real 48px production header boundary shared by H1 and its Storybook alternatives. */
export const AppShellHeader = ({
  title,
  asks = EMPTY_SHELL_ASKS,
  owner,
  theme,
  onThemeChange,
  contentWidth = 'full',
  onContentWidthChange,
  navigation,
  selfSourceAvailable = false,
  inspectorOpen = false,
  onInspectorOpenChange,
  rpcExplorerOpen = false,
  onRpcExplorerOpenChange,
  annotationEnabled = false,
  onAnnotationEnabledChange,
  explainOn = false,
  onExplainChange,
  variant = 'H1',
  versionControl,
  buildInfo,
  changelogHref,
  homeHref = '/',
}: AppShellHeaderProps) => {
  const [changelogState, setChangelogState] = useState<VistaChangelogState>({ _tag: 'idle' })
  const [ownerTooltipOpen, setOwnerTooltipOpen] = useState(false)
  const changelogMachineVersion =
    changelogState._tag === 'ready' ? changelogState.manifest.build.machineVersion : undefined
  const loadChangelog = useCallback(() => {
    const readyForBuild =
      changelogState._tag === 'ready' && changelogMachineVersion === buildInfo?.machineVersion
    if (
      changelogHref === undefined ||
      buildInfo === undefined ||
      changelogState._tag === 'loading' ||
      readyForBuild
    ) {
      return
    }
    setChangelogState({ _tag: 'loading' })
    void fetch(changelogHref)
      .then(async (response): Promise<unknown> => {
        if (!response.ok) return undefined
        try {
          return await response.json()
        } catch {
          return undefined
        }
      })
      .then(
        (value) =>
          setChangelogState(
            isVistaChangelogManifest(value)
              ? { _tag: 'ready', manifest: value }
              : { _tag: 'failed' },
          ),
        () => setChangelogState({ _tag: 'failed' }),
      )
  }, [buildInfo, changelogHref, changelogMachineVersion, changelogState._tag])

  const selected = navigation?.apps.find(
    (app) => app.owner === navigation.currentOwner && app.slug === navigation.currentSlug,
  )
  const selectedAppPath = selected === undefined ? undefined : encodedAppPath(selected)
  const selectedVersion = navigation?.currentVersion ?? 'latest'
  const versions = shellVersionItems(selected, selectedVersion)
  const resolvedVersionControl: AppShellVersionControl | undefined =
    versionControl ??
    (selectedAppPath === undefined
      ? undefined
      : {
          selectedKey: selectedVersion,
          items: versions,
          onSelectionChange: (key: string) => navigateTo(`/r/${selectedAppPath}/${key}`),
        })
  const counts = askCounts(asks)
  const askCounter =
    asks.length === 0 ? null : (
      <div {...stylex.props(styles.askCounter)} role="status" aria-label="Asks">
        <span {...stylex.props(styles.askMeter)} aria-hidden="true">
          {asks.map((ask, index) => (
            <span
              key={index}
              {...stylex.props(styles.askSegment, ask.answered && styles.askSegmentAnswered)}
              data-vista-ask-answered={ask.answered}
            />
          ))}
        </span>
        {counts.needed > 0 ? (
          <span {...stylex.props(styles.askNeeded)}>{counts.needed} need you</span>
        ) : null}
        {counts.answered > 0 ? <span>{counts.answered} answered</span> : null}
      </div>
    )

  const hierarchy: ShellVersionHierarchy =
    variant === 'H1' ? 'document' : variant === 'H2' ? 'version' : 'provenance'
  const resolvedOwner = owner ?? navigation?.currentOwner
  const ownerLabel =
    resolvedOwner === undefined
      ? undefined
      : resolvedOwner.startsWith('agent/')
        ? resolvedOwner.split('/').at(-1)!.replaceAll('-', ' ').replace(/^ui\b/u, 'UI')
        : 'legacy session'
  const documentIdentity = (
    <span
      {...stylex.props(
        styles.headerDocument,
        variant === 'H2' && styles.headerDocumentSecondary,
        variant === 'H3' && styles.headerDocumentCompact,
      )}
      title={title}
      data-vista-document-identity=""
    >
      {title}
      {ownerLabel === undefined ? null : (
        <TooltipTrigger delay={300} isOpen={ownerTooltipOpen} onOpenChange={setOwnerTooltipOpen}>
          <Button
            {...stylex.props(styles.ownerByline)}
            aria-label={`Owner: ${resolvedOwner}`}
            onPress={() => setOwnerTooltipOpen(true)}
            data-vista-owner-byline=""
          >
            {ownerLabel}
          </Button>
          <Tooltip
            placement="bottom start"
            {...stylex.props(
              styles.ownerTooltip,
              theme === 'light' && lightTheme,
              colorScheme[theme],
            )}
          >
            {resolvedOwner}
          </Tooltip>
        </TooltipTrigger>
      )}
    </span>
  )
  const unifiedVersion =
    resolvedVersionControl === undefined ? null : (
      <Suspense fallback={null}>
        <VersionControl
          selectedKey={resolvedVersionControl.selectedKey}
          onSelectionChange={(key) => resolvedVersionControl.onSelectionChange?.(key)}
          items={resolvedVersionControl.items}
          theme={theme}
          hierarchy={hierarchy}
          {...(resolvedVersionControl.newVersionAvailable === undefined
            ? {}
            : { newVersionAvailable: resolvedVersionControl.newVersionAvailable })}
          style={styles.unifiedVersion}
        />
      </Suspense>
    )
  const contentWidthAction =
    contentWidth === 'full' ? 'Switch to centered maximum width' : 'Switch to full width'

  return (
    <header
      {...stylex.props(styles.header, theme === 'light' && lightTheme, colorScheme[theme])}
      data-vista-shell-header=""
      data-vista-header-variant={variant}
    >
      <div {...stylex.props(styles.bar, styles.documentBar)}>
        <a
          href={homeHref}
          {...stylex.props(styles.logoLink)}
          aria-label="Vista home"
          title="Vista home"
        >
          <img
            src={theme === 'dark' ? VISTA_LOGO_LIGHT : VISTA_LOGO_DARK}
            {...stylex.props(styles.logo)}
            alt=""
          />
        </a>
        {variant === 'H1' ? (
          <>
            {documentIdentity}
            <span {...stylex.props(styles.spacer)} />
            {unifiedVersion}
          </>
        ) : variant === 'H2' ? (
          <>
            {unifiedVersion}
            {documentIdentity}
            <span {...stylex.props(styles.spacer)} />
          </>
        ) : (
          <>
            {documentIdentity}
            {unifiedVersion}
            <span {...stylex.props(styles.spacer)} />
          </>
        )}
        {askCounter}
        {onExplainChange === undefined ? null : (
          <Button
            {...stylex.props(styles.headerIconButton, explainOn && styles.headerIconButtonActive)}
            aria-label={explainOn ? 'Hide explanations' : 'Explain this page'}
            aria-pressed={explainOn}
            data-vista-explain-toggle=""
            onPress={() => onExplainChange(!explainOn)}
          >
            <Icon name={explainOn ? 'x' : 'circle-help'} size={15} />
          </Button>
        )}
        {onContentWidthChange === undefined ? null : (
          <Button
            {...stylex.props(
              styles.headerIconButton,
              contentWidth === 'contained' && styles.headerIconButtonActive,
            )}
            aria-label={contentWidthAction}
            aria-pressed={contentWidth === 'contained'}
            data-vista-content-width-toggle={contentWidth}
            onPress={() => onContentWidthChange(contentWidth === 'full' ? 'contained' : 'full')}
          >
            {contentWidthIcon}
          </Button>
        )}
        {selfSourceAvailable ? (
          <Button
            {...stylex.props(
              styles.headerIconButton,
              inspectorOpen && styles.headerIconButtonActive,
            )}
            aria-label="Inspect source"
            aria-expanded={inspectorOpen}
            aria-pressed={inspectorOpen}
            onPress={() => onInspectorOpenChange?.(!inspectorOpen)}
          >
            {sourceIcon}
          </Button>
        ) : null}
        {onRpcExplorerOpenChange === undefined ? null : (
          <Button
            {...stylex.props(
              styles.headerIconButton,
              rpcExplorerOpen && styles.headerIconButtonActive,
            )}
            aria-label="Inspect RPC activity"
            aria-expanded={rpcExplorerOpen}
            aria-pressed={rpcExplorerOpen}
            onPress={() => onRpcExplorerOpenChange(!rpcExplorerOpen)}
          >
            {rpcIcon}
          </Button>
        )}
        {onAnnotationEnabledChange === undefined ? null : (
          <Button
            {...stylex.props(
              styles.headerIconButton,
              annotationEnabled && styles.headerIconButtonActive,
            )}
            aria-label="Annotate"
            aria-pressed={annotationEnabled}
            onPress={() => onAnnotationEnabledChange(!annotationEnabled)}
          >
            {annotationIcon}
          </Button>
        )}
        <Suspense fallback={null}>
          <ThemeToggle value={theme} onChange={onThemeChange} compact />
        </Suspense>
        {buildInfo === undefined ? null : (
          <DialogTrigger
            onOpenChange={(open) => {
              if (open) loadChangelog()
            }}
          >
            <Button
              {...stylex.props(styles.headerIconButton)}
              aria-label="Vista system information"
            >
              {systemInfoIcon}
            </Button>
            <Popover
              {...stylex.props(
                styles.systemPopover,
                theme === 'light' && lightTheme,
                colorScheme[theme],
              )}
              placement="bottom end"
            >
              <Dialog {...stylex.props(styles.systemDialog)} aria-label="Vista system information">
                <span {...stylex.props(styles.systemTitle)}>Vista build</span>
                <dl {...stylex.props(styles.systemList)}>
                  <div {...stylex.props(styles.systemRow)}>
                    <dt {...stylex.props(styles.systemTerm)}>Display version</dt>
                    <dd {...stylex.props(styles.systemValue)}>{buildInfo.displayVersion}</dd>
                  </div>
                  <div {...stylex.props(styles.systemRow)}>
                    <dt {...stylex.props(styles.systemTerm)}>Machine version</dt>
                    <dd {...stylex.props(styles.systemValue)}>
                      <code>{buildInfo.machineVersion}</code>
                    </dd>
                  </div>
                  <div {...stylex.props(styles.systemRow)}>
                    <dt {...stylex.props(styles.systemTerm)}>Base version</dt>
                    <dd {...stylex.props(styles.systemValue)}>{buildInfo.baseVersion}</dd>
                  </div>
                  <div {...stylex.props(styles.systemRow)}>
                    <dt {...stylex.props(styles.systemTerm)}>Revision</dt>
                    <dd {...stylex.props(styles.systemValue)}>
                      <code>{buildInfo.rev}</code>
                      {buildInfo.dirty ? ' · dirty' : ''}
                    </dd>
                  </div>
                  <div {...stylex.props(styles.systemRow)}>
                    <dt {...stylex.props(styles.systemTerm)}>Source</dt>
                    <dd {...stylex.props(styles.systemValue)}>{buildInfo.sourceKind}</dd>
                  </div>
                  <div {...stylex.props(styles.systemRow)}>
                    <dt {...stylex.props(styles.systemTerm)}>Commit timestamp</dt>
                    <dd {...stylex.props(styles.systemValue)}>
                      <time dateTime={buildInfo.commitTs}>
                        {humanizedDate({
                          timestamp: Date.parse(buildInfo.commitTs),
                          nowMs: Date.now(),
                        })}
                      </time>
                    </dd>
                  </div>
                </dl>
                {changelogHref === undefined ? null : (
                  <VistaChangelogView
                    state={changelogState}
                    machineVersion={buildInfo.machineVersion}
                    onRetry={loadChangelog}
                  />
                )}
              </Dialog>
            </Popover>
          </DialogTrigger>
        )}
      </div>
    </header>
  )
}

/** Platform chrome around ordinary React content; it never interprets an authored UI tree. */
export const AppShell = ({
  title,
  owner,
  children,
  initialTheme,
  theme: controlledTheme,
  onThemeChange,
  navigation,
  buildInfo,
  changelogHref,
  selfSource: selfSourceOverride,
  rpcExplorerClientFactory,
  grafana,
  style,
}: AppShellProps) => {
  const [uncontrolledTheme, setUncontrolledTheme] = useState(() => initialTheme ?? getSystemTheme())
  const navigationSnapshotValue = useSyncExternalStore(
    subscribeToNavigation,
    navigationSnapshot,
    navigationSnapshot,
  )
  const resolvedNavigation = navigation ?? navigationSnapshotValue
  const selectedApp = selectedNavigationApp(resolvedNavigation)
  const contentWidthStorageKey =
    selectedApp === undefined ? undefined : appShellContentWidthStorageKey(selectedApp)
  const publicationIdentity = resolveAppVersionIdentity(resolvedNavigation)
  const theme = controlledTheme ?? uncontrolledTheme
  const setTheme = (nextTheme: 'light' | 'dark') => {
    if (controlledTheme === undefined) setUncontrolledTheme(nextTheme)
    onThemeChange?.(nextTheme)
  }
  const selected = selectedNavigationApp(resolvedNavigation)
  const browserRoute = currentBrowserRoute()
  const resolvedOwner = owner ?? resolvedNavigation?.currentOwner ?? browserRoute?.owner
  const rpcAppIdentity =
    resolvedNavigation !== undefined
      ? `${resolvedNavigation.currentOwner}/${resolvedNavigation.currentSlug}/${resolvedNavigation.currentVersion ?? 'latest'}`
      : browserRoute !== undefined
        ? `${browserRoute.owner}/${browserRoute.slug}/${browserRoute.version}`
        : undefined
  const annotationKey = annotationUiStorageKey(
    selected?.owner ?? browserRoute?.owner ?? 'embedded',
    selected?.slug ?? browserRoute?.slug ?? 'app',
  )
  const agentationEndpoint = import.meta.env?.VITE_VISTA_AGENTATION_ENDPOINT

  const contentRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const [asks, setAsks] = useState<readonly ShellAsk[]>([])
  const [outline, setOutline] = useState<readonly ShellOutlineItem[]>([])
  const [activeId, setActiveId] = useState<string | undefined>(undefined)
  const [railOpen, setRailOpen] = useState(false)
  const [contentWidthPreference, setContentWidthPreference] = useState<{
    readonly storageKey: string | undefined
    readonly value: AppShellContentWidth
  }>({ storageKey: undefined, value: 'full' })
  const contentWidth =
    contentWidthPreference.storageKey === contentWidthStorageKey
      ? contentWidthPreference.value
      : 'full'
  const setContentWidth = (value: AppShellContentWidth): void => {
    setContentWidthPreference({ storageKey: contentWidthStorageKey, value })
    writeContentWidthPreference(contentWidthStorageKey, value)
  }
  useEffect(() => {
    setContentWidthPreference({
      storageKey: contentWidthStorageKey,
      value: readContentWidthPreference(contentWidthStorageKey),
    })
  }, [contentWidthStorageKey])
  // Self-inspection (q6 prepend): presentation state only, no SemanticNode.
  // The toggle renders only once the frozen payload resolves; old versions
  // without `vista-self.json` settle `absent` and show nothing.
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [rpcExplorerOpen, setRpcExplorerOpen] = useState(false)
  const [annotationEnabled, setAnnotationEnabled] = useState(false)
  const explain = useExplainState()
  const selfSourceState = useSelfSource(selfSourceOverride)
  // The active row, so opening the panel can bring it into view.
  const activeRowRef = useRef<HTMLAnchorElement | null>(null)
  const railRef = useRef<HTMLElement | null>(null)
  const initialLocationPath = useRef(
    typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`,
  )
  const initialLocationHash = useRef(typeof window === 'undefined' ? '' : window.location.hash)
  const initialHashCleared = useRef(false)
  const restoredInitialHash = useRef(false)

  useLayoutEffect(() => {
    const hash = initialLocationHash.current
    if (hash === '' || initialHashCleared.current || window.location.hash !== hash) return
    const encodedId = hash.slice(1)
    let id = encodedId
    try {
      id = decodeURIComponent(encodedId)
    } catch {
      // Keep the raw hash as a possible authored id when it is malformed.
    }
    const target = document.getElementById(id)
    if (
      target === null ||
      contentRef.current?.contains(target) !== true ||
      !target.matches(OUTLINE_QUERY) ||
      !isOutlineNode({
        id,
        kind: target.getAttribute('data-vista-kind'),
        hidden: target.closest('[hidden]') !== null,
      })
    )
      return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    scrollToOutlineTarget(target, 'auto')
    initialHashCleared.current = true
  }, [])

  useEffect(() => {
    setAnnotationEnabled(false)
    try {
      setAnnotationEnabled(window.localStorage.getItem(annotationKey) === 'true')
    } catch {
      // The opt-in control stays usable when storage is unavailable.
    }
  }, [annotationKey])

  // Pointer expansion lands on the section being read. Keyboard expansion
  // preserves the already-focused link instead of scrolling focus off-screen.
  useEffect(() => {
    if (!railOpen || railRef.current?.contains(document.activeElement)) return
    activeRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [railOpen, activeId])

  // Interaction state must not survive either way the persistent rail can
  // disappear: dynamic outline removal or crossing the 60rem breakpoint.
  useEffect(() => {
    if (outline.length === 0) setRailOpen(false)
    const narrow = window.matchMedia?.('(max-width: 60rem)')
    const closeWhenNarrow = () => {
      if (narrow?.matches === true) setRailOpen(false)
    }
    closeWhenNarrow()
    narrow?.addEventListener('change', closeWhenNarrow)
    return () => narrow?.removeEventListener('change', closeWhenNarrow)
  }, [outline.length])

  // Discover asks and the outline from what actually rendered, and re-measure
  // whenever content, answer markers, or layout changes.
  useEffect(() => {
    const content = contentRef.current
    if (content === null) return
    const measure = () => {
      const discovered = collectShellContent(content)
      const next = resolveShellOutline(discovered.entries, document.documentElement.scrollHeight)
      setAsks((current) =>
        current.length === discovered.asks.length &&
        current.every((ask, index) => ask.answered === discovered.asks[index]!.answered)
          ? current
          : discovered.asks,
      )
      setOutline((current) => (sameOutline(current, next) ? current : next))
    }
    measure()
    const mutations = new MutationObserver(measure)
    mutations.observe(content, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-vista-answered',
        'data-vista-kind',
        'data-vista-id',
        'data-vista-label',
        'data-vista-outline',
        'id',
        'hidden',
      ],
    })
    const resizes = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    resizes?.observe(content)
    window.addEventListener('resize', measure)
    return () => {
      mutations.disconnect()
      resizes?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [children])

  // A deep link can be restored only after discovery has a matching target.
  // Unlike outline clicks this is the browser's initial navigation, so it
  // must not mutate history or animate the first paint.
  useEffect(() => {
    if (restoredInitialHash.current || outline.length === 0) return
    const encodedHash = initialLocationHash.current
    if (encodedHash === '') {
      restoredInitialHash.current = true
      return
    }
    const currentPath = `${window.location.pathname}${window.location.search}`
    if (
      currentPath !== initialLocationPath.current ||
      (window.location.hash !== '' && window.location.hash !== encodedHash)
    ) {
      restoredInitialHash.current = true
      return
    }
    const encodedId = encodedHash.slice(1)
    let id = encodedId
    try {
      id = decodeURIComponent(encodedId)
    } catch {
      // Keep the raw hash as a possible authored id when it is malformed.
    }
    if (!outline.some((item) => item.id === id)) return
    const target = document.getElementById(id)
    if (target === null) return
    restoredInitialHash.current = true
    scrollToOutlineTarget(target, 'auto')
    setActiveId(id)
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    if (window.location.hash !== encodedHash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}${encodedHash}`,
      )
    }
  }, [outline])

  // Observe the reading edge, but select from live rects rather than cached
  // document offsets: expanding content must not leave the header behind.
  useEffect(() => {
    if (outline.length === 0) {
      setActiveId(undefined)
      return
    }
    const targets = outline.flatMap((item) => {
      const element = document.getElementById(item.id)
      return element === null ? [] : [{ id: item.id, element }]
    })
    const sync = () => {
      setActiveId(
        activeOutlineId(
          targets.map(({ id, element }) => ({ id, top: element.getBoundingClientRect().top })),
          READING_EDGE + READING_EDGE_TOLERANCE,
          window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2,
        ),
      )
    }
    let observer: IntersectionObserver | undefined
    const observeReadingEdge = () => {
      observer?.disconnect()
      const edge = Math.min(READING_EDGE, Math.max(0, window.innerHeight - 1))
      observer = new IntersectionObserver(sync, {
        rootMargin: `-${edge}px 0px -${Math.max(0, window.innerHeight - edge - 1)}px 0px`,
      })
      for (const { element } of targets) observer.observe(element)
      sync()
    }
    observeReadingEdge()
    // The final target may never reach the reading edge. A viewport sentinel
    // supplies the bottom transition; scrollend also catches skipped bands.
    const bottomObserver = new IntersectionObserver(sync)
    if (bottomRef.current !== null) bottomObserver.observe(bottomRef.current)
    window.addEventListener('resize', observeReadingEdge)
    window.addEventListener('scrollend', sync)
    return () => {
      observer?.disconnect()
      bottomObserver.disconnect()
      window.removeEventListener('resize', observeReadingEdge)
      window.removeEventListener('scrollend', sync)
    }
  }, [outline])

  const goToOutlineItem = useCallback((event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)
    // No element to land on: leave the plain `#id` navigation to the browser.
    if (target === null) return
    event.preventDefault()
    scrollToOutlineTarget(
      target,
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ? 'auto' : 'smooth',
    )
    setActiveId(id)
    // Move the reading position too, not just the viewport, so a keyboard or
    // screen-reader user continues from the section they picked.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    window.history.replaceState(null, '', `#${id}`)
  }, [])

  const tickOffsets = railTickOffsets(outline)
  const collapsedContentHeight = (tickOffsets.at(-1) ?? 0) + 12
  const collapsedHeight = Math.min(collapsedContentHeight, RAIL_TRACK_HEIGHT)

  const outlineRows = () =>
    outline.map((item, index) => {
      const active = item.id === activeId
      return (
        <a
          key={item.id}
          href={`#${item.id}`}
          ref={active ? activeRowRef : undefined}
          {...stylex.props(
            styles.row,
            !railOpen && styles.railTick,
            !railOpen && styles.railTickAt(tickOffsets[index] ?? 0),
            railOpen && styles.rowExpanded,
            railOpen && item.depth === 0 && index !== 0 && styles.rowSection,
            railOpen && active && styles.rowActive,
          )}
          aria-current={active ? 'true' : undefined}
          data-vista-outline-position={item.position.toFixed(4)}
          data-vista-outline-depth={item.depth}
          data-vista-outline-priority={item.priority}
          onClick={(event) => goToOutlineItem(event, item.id)}
        >
          <span
            {...stylex.props(
              styles.rowLabel,
              !railOpen && styles.rowLabelClipped,
              railOpen && styles.rowLabelRevealed,
              railOpen && styles.rowLabelWrapped,
              item.depth === 1 && styles.rowLabelNested,
              item.depth > 1 && styles.rowLabelDeep,
            )}
          >
            {item.label}
          </span>
          {!railOpen ? (
            <span
              {...stylex.props(
                styles.tick,
                item.depth === 0 && styles.tickTop,
                item.depth === 1 && styles.tickNested,
                item.depth > 1 && styles.tickDeep,
                item.priority === 'high' && styles.tickAsk,
                active && styles.tickActive,
                active && item.priority === 'high' && styles.tickAskActive,
              )}
              aria-hidden="true"
            />
          ) : null}
        </a>
      )
    })

  return (
    <AppVersionPreferenceProvider identity={publicationIdentity}>
      <ThemeProvider value={theme}>
        <title>{title}</title>
        <div
          {...stylex.props(
            styles.shell,
            theme === 'light' && lightTheme,
            colorScheme[theme],
            style,
          )}
          data-theme={theme}
        >
          {/*
          The authored document keeps the sole semantic `h1`; the selected H1
          shell hierarchy repeats its identity as non-heading navigation chrome.
        */}
          <AppShellHeader
            title={activeOutlineLabel(outline, activeId) ?? title}
            {...(resolvedOwner === undefined ? {} : { owner: resolvedOwner })}
            theme={theme}
            onThemeChange={setTheme}
            contentWidth={contentWidth}
            onContentWidthChange={setContentWidth}
            selfSourceAvailable={selfSourceState._tag === 'ready'}
            inspectorOpen={inspectorOpen}
            onInspectorOpenChange={setInspectorOpen}
            rpcExplorerOpen={rpcExplorerOpen}
            onRpcExplorerOpenChange={setRpcExplorerOpen}
            annotationEnabled={annotationEnabled}
            onAnnotationEnabledChange={(enabled) => {
              setAnnotationEnabled(enabled)
              try {
                if (enabled) window.localStorage.setItem(annotationKey, 'true')
                else window.localStorage.removeItem(annotationKey)
              } catch {
                // The in-memory toggle remains usable when storage is unavailable.
              }
            }}
            explainOn={explain.on}
            {...(explain.notes.length === 0 ? {} : { onExplainChange: explain.setOn })}
            variant="H1"
            asks={asks}
            {...(resolvedNavigation === undefined ? {} : { navigation: resolvedNavigation })}
            {...(buildInfo === undefined ? {} : { buildInfo })}
            {...(changelogHref === undefined ? {} : { changelogHref })}
          />
          {/*
          Rendered before the frame so keyboard users reach the section links
          right after the header controls instead of after the whole document.
          The gutter is `position: fixed`, so document order costs no layout.
        */}
          {outline.length > 0 && !rpcExplorerOpen ? (
            <div {...stylex.props(styles.railGutter)} data-vista-outline-persistent="">
              {/*
              Notion's floating table of contents: ticks at rest whose length
              encodes depth and ask priority, opening into a labelled panel while
              the pointer is in the gutter or a link inside holds focus. Labels stay mounted
              and merely clipped, so the outline reads the same either way.
            */}
              <nav
                {...stylex.props(
                  styles.rail,
                  railOpen && styles.railOpen,
                  !railOpen && styles.railCollapsedAt(collapsedHeight),
                )}
                aria-label="Sections"
                ref={railRef}
                data-vista-outline-mode="persistent"
                onPointerEnter={() => setRailOpen(true)}
                onPointerLeave={(event) => {
                  if (!event.currentTarget.contains(document.activeElement)) setRailOpen(false)
                }}
                onFocus={() => setRailOpen(true)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setRailOpen(false)
                }}
              >
                {outlineRows()}
              </nav>
            </div>
          ) : null}
          {/*
          Self-inspection (q6 prepend): when the header toggle is on, the
          SourceInspector renders full frame width above the authored
          document. Toggle state is presentation-only and the inspector
          carries no headings or data-vista markers, so the shell outline
          never picks up inspector chrome. The lazy boundary keeps @pierre
          out of the eager graph (browser globals on import).
        */}
          {inspectorOpen && selfSourceState._tag === 'ready' ? (
            <div {...stylex.props(styles.frame)}>
              <Suspense fallback={null}>
                <SourceInspector id="vista-self" source={selfSourceState.source} />
              </Suspense>
            </div>
          ) : null}
          {rpcExplorerOpen ? (
            <div {...stylex.props(styles.frame)} data-vista-rpc-explorer="">
              <Suspense fallback={<div role="status">Loading RPC activity…</div>}>
                <RpcExplorerPanel
                  appIdentity={rpcAppIdentity}
                  clientFactory={rpcExplorerClientFactory}
                  grafana={grafana}
                />
              </Suspense>
            </div>
          ) : null}
          <div
            {...stylex.props(styles.frame, contentWidth === 'contained' && styles.frameContained)}
            data-vista-content-frame=""
            data-vista-content-width={contentWidth}
          >
            <div {...stylex.props(styles.content)} ref={contentRef}>
              <ExplainProvider value={explain}>
                {children}
                <ExplainLayer hostRef={contentRef} />
              </ExplainProvider>
            </div>
          </div>
          <div {...stylex.props(styles.bottomSentinel)} ref={bottomRef} aria-hidden="true" />
          {annotationEnabled ? (
            <div data-vista-agentation-overlay="">
              <Suspense fallback={null}>
                <Agentation {...(agentationEndpoint ? { endpoint: agentationEndpoint } : {})} />
              </Suspense>
            </div>
          ) : null}
        </div>
      </ThemeProvider>
    </AppVersionPreferenceProvider>
  )
}

const styles = stylex.create({
  shell: {
    width: '100%',
    minHeight: '100vh',
    margin: 0,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    fontFamily:
      "'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: '0.9375rem',
    lineHeight: 1.5,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    backgroundColor: tokens['--ds-background-100'],
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    width: 'min(100%, 72rem)',
    height: '3rem',
    marginInline: 'auto',
    paddingInline: {
      default: '1.5rem',
      '@media (max-width: 42rem)': '1rem',
    },
  },
  spacer: {
    flex: '1 1 auto',
  },
  askCounter: {
    display: 'flex',
    alignItems: 'center',
    flex: 'none',
    gap: '0.45rem',
    color: tokens['--ds-gray-800'],
    fontSize: '0.72rem',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  askNeeded: {
    color: `color-mix(in oklab, ${tokens['--ds-purple-700']} 78%, ${tokens['--ds-gray-1000']})`,
  },
  askMeter: {
    display: 'flex',
    alignItems: 'center',
    maxWidth: '3rem',
  },
  askSegment: {
    width: '3px',
    minWidth: 0,
    height: '0.6rem',
    borderRadius: '1px',
    borderInlineColor: tokens['--ds-background-100'],
    borderInlineStyle: 'solid',
    borderInlineWidth: '0.5px',
    backgroundColor: `color-mix(in oklab, ${tokens['--ds-purple-700']} 28%, ${tokens['--ds-background-100']})`,
  },
  askSegmentAnswered: {
    backgroundColor: tokens['--ds-gray-1000'],
  },
  bottomSentinel: {
    height: '1px',
  },
  documentBar: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: 'none',
    paddingInline: {
      default: scale.space4,
      '@media (max-width: 42rem)': scale.space3,
    },
  },
  logoLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
    width: '2rem',
    height: '2rem',
    borderRadius: scale.radiusSm,
    color: tokens['--ds-foreground'],
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  logo: {
    display: 'block',
    width: '1.5rem',
    height: '1.5rem',
  },
  headerDocument: {
    display: 'block',
    flex: '0 1 auto',
    minWidth: 0,
    maxWidth: 'none',
    color: tokens['--ds-foreground'],
    fontSize: '0.8rem',
    fontWeight: 600,
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ownerByline: {
    display: 'block',
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    fontFamily: 'inherit',
    textAlign: 'start',
    cursor: 'help',
    color: tokens['--ds-gray-700'],
    fontSize: '0.65rem',
    fontWeight: 400,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ownerTooltip: {
    maxWidth: 'min(28rem, calc(100vw - 2rem))',
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
    borderRadius: scale.radiusSm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    fontSize: '0.75rem',
    overflowWrap: 'anywhere',
    zIndex: 50,
  },
  headerDocumentSecondary: {
    color: tokens['--ds-gray-800'],
    fontSize: '0.72rem',
    fontWeight: 500,
    maxWidth: 'none',
  },
  headerDocumentCompact: {
    maxWidth: {
      default: 'none',
      '@media (max-width: 42rem)': '8rem',
    },
  },
  unifiedVersion: {
    flex: '0 1 auto',
  },
  headerIconButton: {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
    width: '2rem',
    height: '2rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '0.375rem',
    backgroundColor: {
      default: 'transparent',
      ':hover': tokens['--ds-gray-alpha-100'],
      ':active': tokens['--ds-gray-alpha-200'],
    },
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    padding: 0,
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  headerIconButtonActive: {
    borderColor: tokens['--ds-gray-alpha-500'],
    backgroundColor: tokens['--ds-gray-alpha-200'],
    color: tokens['--ds-foreground'],
  },
  systemPopover: {
    width: 'min(25rem, calc(100vw - 2rem))',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '0.5rem',
    backgroundColor: tokens['--ds-background-200'],
    boxShadow: tokens['--ds-shadow-medium'],
  },
  systemDialog: {
    padding: scale.space4,
    outline: 'none',
  },
  systemTitle: {
    display: 'block',
    color: tokens['--ds-foreground'],
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: scale.space3,
  },
  systemList: {
    display: 'grid',
    gap: scale.space2,
    margin: 0,
  },
  systemRow: {
    display: 'grid',
    gridTemplateColumns: '7rem minmax(0, 1fr)',
    gap: scale.space3,
    alignItems: 'baseline',
    fontSize: '0.7rem',
    lineHeight: 1.35,
  },
  systemTerm: {
    color: tokens['--ds-gray-800'],
  },
  systemValue: {
    minWidth: 0,
    margin: 0,
    color: tokens['--ds-foreground'],
    textAlign: 'right',
    overflowWrap: 'anywhere',
  },
  changelog: {
    marginTop: scale.space4,
    paddingTop: scale.space4,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
  },
  changelogTitle: {
    display: 'block',
    marginBottom: scale.space3,
    color: tokens['--ds-foreground'],
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  changelogMessage: {
    margin: 0,
    color: tokens['--ds-gray-800'],
    fontSize: '0.72rem',
    lineHeight: 1.45,
  },
  changelogRetry: {
    marginTop: scale.space3,
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    cursor: 'pointer',
    fontSize: '0.7rem',
  },
  changelogList: {
    display: 'grid',
    gap: scale.space3,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  changelogEntry: {
    minWidth: 0,
  },
  changelogEntryHeading: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: scale.space3,
    color: tokens['--ds-foreground'],
    fontSize: '0.72rem',
    lineHeight: 1.35,
  },
  changelogSummary: {
    marginBlock: `${scale.space1} 0`,
    color: tokens['--ds-gray-800'],
    fontSize: '0.7rem',
    lineHeight: 1.45,
  },
  changelogContext: {
    marginTop: scale.space2,
  },
  changelogContextSummary: {
    width: 'fit-content',
    borderRadius: scale.radiusSm,
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    fontSize: '0.7rem',
    fontWeight: 500,
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  changelogContributors: {
    display: 'grid',
    gap: scale.space2,
    marginBlock: `${scale.space2} 0`,
    padding: 0,
    listStyle: 'none',
  },
  changelogContributor: {
    minWidth: 0,
    paddingLeft: scale.space2,
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: tokens['--ds-gray-alpha-400'],
  },
  changelogContributorList: {
    display: 'grid',
    gap: scale.space1,
    margin: 0,
  },
  changelogContributorRow: {
    display: 'grid',
    gridTemplateColumns: '4rem minmax(0, 1fr)',
    gap: scale.space2,
    alignItems: 'baseline',
    fontSize: '0.7rem',
    lineHeight: 1.35,
  },
  changelogContributorTerm: {
    color: tokens['--ds-gray-800'],
  },
  changelogContributorValue: {
    minWidth: 0,
    margin: 0,
    color: tokens['--ds-foreground'],
    overflowWrap: 'anywhere',
  },
  changelogContributorCode: {
    fontFamily: scale.fontMono,
    fontSize: 'inherit',
  },
  changelogHistory: {
    marginTop: scale.space3,
    paddingTop: scale.space3,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-300'],
  },
  changelogHistorySummary: {
    marginBottom: scale.space3,
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    fontSize: '0.7rem',
    fontWeight: 500,
  },
  frame: {
    boxSizing: 'border-box',
    width: '100%',
    containerType: 'inline-size',
    marginInline: 'auto',
    paddingBlock: scale.space12,
    paddingInline: {
      default: scale.space6,
      '@container (max-width: 42rem)': scale.space4,
    },
  },
  frameContained: {
    maxWidth: '72rem',
  },
  /**
   * The frame spans the responsive page; semantic prose keeps its own shared
   * reading measure while full-bleed blocks can use the remaining canvas.
   */
  content: {
    position: 'relative',
    minWidth: 0,
  },
  /**
   * The gutter is a pointer-transparent strip; only the rail inside it reacts.
   * Its width follows the space the centred frame leaves over, so the hover
   * target never covers the text column on a merely-wide-enough viewport.
   */
  railGutter: {
    display: {
      default: 'flex',
      '@media (max-width: 60rem)': 'none',
    },
    position: 'fixed',
    top: `${HEADER_HEIGHT}px`,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 'clamp(3.5rem, calc((100vw - 72rem) / 2 + 3.5rem), 17.5rem)',
    paddingBlock: '1rem',
    pointerEvents: 'none',
    zIndex: 15,
  },
  rail: {
    position: 'relative',
    flex: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    height: `${RAIL_TRACK_HEIGHT}px`,
    borderRadius: '0.5rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    boxShadow: 'none',
    paddingBlock: '0.35rem',
    paddingInline: '1.25rem 0.5rem',
    overflowX: 'hidden',
    overflowY: 'hidden',
    pointerEvents: 'auto',
    transitionProperty: 'background-color, border-color, box-shadow',
    transitionDuration: {
      default: '0.2s',
      '@media (prefers-reduced-motion: reduce)': '0.001s',
    },
  },
  railOpen: {
    alignItems: 'stretch',
    width: '15rem',
    height: 'auto',
    maxHeight: 'min(60vh, 30rem)',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-100'],
    boxShadow: tokens['--ds-shadow-medium'],
    paddingInline: '0.4rem',
    overflowY: 'auto',
  },
  railCollapsedAt: (height: number) => ({ height: `${height}px` }),
  railTick: {
    position: 'absolute',
    right: '0.5rem',
    minHeight: 0,
  },
  railTickAt: (offset: number) => ({ top: `${offset}px` }),
  row: {
    display: 'flex',
    flex: 'none',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: '0.4rem',
    minHeight: '0.875rem',
    borderRadius: '0.3rem',
    color: tokens['--ds-gray-800'],
    textAlign: 'left',
    textDecoration: 'none',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: -1,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  rowExpanded: {
    minHeight: '1.6rem',
    paddingBlock: '0.3rem',
    paddingInline: '0.45rem',
    backgroundColor: {
      default: 'transparent',
      ':hover': tokens['--ds-gray-alpha-100'],
    },
  },
  rowSection: {
    marginTop: '0.55rem',
  },
  rowActive: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
    color: tokens['--ds-foreground'],
  },
  rowLabel: {
    color: 'currentColor',
    fontSize: '0.7rem',
    fontWeight: 500,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowLabelWrapped: {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'visible',
    fontSize: '0.72rem',
    textOverflow: 'clip',
    whiteSpace: 'normal',
    overflowWrap: 'break-word',
    textWrap: 'pretty',
  },
  rowLabelClipped: {
    display: 'block',
    minWidth: 0,
    maxWidth: 0,
    opacity: 0,
    transitionProperty: 'max-width, opacity',
    transitionDuration: {
      default: '0.2s',
      '@media (prefers-reduced-motion: reduce)': '0.001s',
    },
  },
  rowLabelRevealed: {
    minWidth: 0,
    maxWidth: '13.5rem',
    opacity: 1,
  },
  rowLabelNested: {
    paddingLeft: '0.7rem',
  },
  rowLabelDeep: {
    paddingLeft: '1.5rem',
  },
  tick: {
    display: 'block',
    flex: 'none',
    height: '2px',
    borderRadius: '2px',
    backgroundColor: tokens['--ds-gray-alpha-400'],
    transitionProperty: 'width, background-color, opacity',
    transitionDuration: {
      default: '0.2s',
      '@media (prefers-reduced-motion: reduce)': '0.001s',
    },
  },
  tickTop: {
    width: '1rem',
  },
  tickNested: {
    width: '0.75rem',
  },
  tickDeep: {
    width: '0.625rem',
  },
  tickAsk: {
    width: '1.25rem',
    backgroundColor: tokens['--ds-purple-700'],
  },
  tickAskActive: {
    backgroundColor: `color-mix(in oklab, ${tokens['--ds-purple-700']} 78%, ${tokens['--ds-gray-1000']})`,
  },
  tickActive: {
    backgroundColor: tokens['--ds-gray-1000'],
  },
})
