import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import {
  AppShell,
  type AppShellBuildInfo,
  type AppShellNavigation,
  type VistaChangelogManifest,
} from '../AppShell.tsx'
import { AppRoot, Ask, Decision, Evidence, Section } from '../authoring.tsx'
import { ResizableSplit } from '../blocks/ResizableSplit.tsx'

const appNavigation = (currentVersion: string): AppShellNavigation => ({
  currentOwner: 'vista.tests',
  currentSlug: 'agent-run-viewer',
  currentVersion,
  apps: [
    {
      owner: 'vista.tests',
      slug: 'agent-run-viewer',
      title: 'Agent-run viewer architecture',
      latest: 3,
      versions: [
        {
          id: 'v1',
          label: 'v1',
          title: 'Initial review',
          timestamp: '2026-09-18T09:00:00.000Z',
          publisher: 'Johannes',
          changeSummary: 'Established the owner-scoped viewer and its document outline.',
        },
        {
          id: 'v2',
          label: 'v2',
          title: 'Lineage guarantee',
          timestamp: '2026-09-19T14:30:00.000Z',
          publisher: 'agent vista-publisher-07',
          changeSummary: 'Made publication lineage visible without moving document identity.',
        },
        {
          id: 'v3',
          label: 'v3',
          title: 'Readable shell metadata',
          timestamp: '2026-09-20T08:15:00.000Z',
          publisher: 'agent vista-shell-12',
          changeSummary: 'Carries the publication title, author, time, and narrative into history.',
        },
      ],
    },
    {
      owner: 'vista.tests',
      slug: 'smalltalk-folder-contract',
      title: 'Smalltalk folder contract',
      latest: 5,
      versions: [
        {
          id: 'v5',
          label: 'v5',
          title: 'Folder ownership',
          timestamp: '2026-09-17T11:00:00.000Z',
          publisher: 'Johannes',
          changeSummary: 'Clarified folder ownership for generated conversations.',
        },
      ],
    },
  ],
})

const otherAppNavigation = (): AppShellNavigation => ({
  ...appNavigation('v5'),
  currentSlug: 'smalltalk-folder-contract',
})

const ResizePreferenceProbe = () => (
  <div style={{ blockSize: 240, inlineSize: 720, maxInlineSize: '100%' }}>
    <ResizableSplit
      id="publication-resize-probe"
      direction="horizontal"
      initialSize="260px"
      minSize="120px"
      maxSize="500px"
      first={<div>Primary viewport</div>}
      second={<div>Secondary viewport</div>}
    />
  </div>
)

/** Enough prose that the document scrolls and the rail has somewhere to point. */
const filler = (subject: string) =>
  Array.from({ length: 6 }, (_, index) => (
    <p key={index}>
      {subject} — paragraph {index + 1}. The published review carries the reading matter; the shell
      carries only platform chrome, so this text is what the outline and document-anchored header
      are measured against.
    </p>
  ))

const TITLE = 'Agent-run viewer architecture'
const LONG_TITLE =
  'Agent-run viewer architecture, lineage guarantees and the publish-time projection boundary across every owner-scoped route'

const outlineViewports = {
  mobile390: {
    name: 'Mobile — 390×844',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
  desktop1280: {
    name: 'Desktop — 1280×1000',
    styles: { width: '1280px', height: '1000px' },
    type: 'desktop',
  },
  desktop1440: {
    name: 'Desktop — 1440×1000',
    styles: { width: '1440px', height: '1000px' },
    type: 'desktop',
  },
  desktop1920: {
    name: 'Desktop — 1920×1000',
    styles: { width: '1920px', height: '1000px' },
    type: 'desktop',
  },
} as const

/** A realistic authored document: AppRoot owns the sole `h1`, sections carry labels. */
const ReviewDocument = ({
  title = TITLE,
  nested = false,
  firstLabel = 'Where this came from',
}: {
  title?: string
  nested?: boolean
  firstLabel?: string
}) => (
  <AppRoot title={title} template="architecture-review" scope="One source of truth per review">
    <Section id="context" label={firstLabel}>
      {filler('Context')}
    </Section>
    <Section id="lineage" label="Lineage guarantee">
      {filler('Lineage')}
      {nested ? (
        <>
          <h3 id="lineage-freeze">Freeze time</h3>
          {filler('Freeze time')}
          <h3 id="lineage-owner">Owner identity</h3>
          {filler('Owner identity')}
        </>
      ) : null}
    </Section>
    <Evidence id="measurements" label="Measured rail geometry">
      {filler('Measurements')}
    </Evidence>
    <Decision id="transport" status="locked" label="Transport is settled">
      {filler('Transport')}
    </Decision>
    <Section id="signoff">
      {/* No label and no heading: the rail falls back to a humanized id. */}
      {filler('Sign-off')}
    </Section>
  </AppRoot>
)

const LongOutlineDocument = () => (
  <AppRoot title={TITLE} template="architecture-review" scope="A bounded persistent outline">
    {Array.from({ length: 32 }, (_, index) => (
      <Section key={index} id={`review-section-${index + 1}`} label={`Review section ${index + 1}`}>
        <p>Content for review section {index + 1}.</p>
      </Section>
    ))}
  </AppRoot>
)

const buildInfo = {
  baseVersion: '0.8.0',
  rev: '7d5211e',
  dirty: false,
  sourceKind: 'nix',
  commitTs: '2026-09-20T08:00:00.000Z',
  machineVersion: '0.8.0-nix-7d5211e',
  displayVersion: 'Vista 0.8.0 (7d5211e)',
} satisfies AppShellBuildInfo

const changelogManifest = {
  schemaVersion: 1,
  product: 'vista',
  build: { machineVersion: buildInfo.machineVersion },
  entries: [
    {
      id: '2026-09-20-readable-shell-metadata',
      date: '2026-09-20',
      title: 'Readable shell metadata',
      summary:
        'Published versions now keep their narrative title, author, time, and change summary.',
    },
    {
      id: '2026-09-19-active-section-identity',
      date: '2026-09-19',
      title: 'Active section identity',
      summary: 'The shell follows the section being read while preserving the document title.',
    },
    {
      id: '2026-09-18-build-provenance',
      date: '2026-09-18',
      title: 'Build provenance',
      summary: 'System information distinguishes display identity from the exact machine version.',
    },
    {
      id: '2026-09-17-source-inspection',
      date: '2026-09-17',
      title: 'Source inspection',
      summary:
        'Published documents can reveal their frozen authored source without changing content.',
    },
    {
      id: '2026-09-16-persistent-outline',
      date: '2026-09-16',
      title: 'Persistent outline',
      summary: 'Wide layouts provide a compact section rail that expands for direct navigation.',
    },
  ],
} satisfies VistaChangelogManifest

/**
 * Provides the shared default arguments for AppShell stories: the title, a review document body,
 * and v3 navigation that each story spreads and selectively overrides.
 */
export const baseArgs = {
  title: TITLE,
  children: <ReviewDocument />,
  navigation: appNavigation('v3'),
}

const meta = {
  title: 'Vista/Shell/AppShell',
  component: AppShell,
  args: baseArgs,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

// Story files provide the sidebar hierarchy; this module only supplies shared fixtures and stories.
type Story = StoryObj<typeof meta>

const assertNarrowSelectorsFit = async (canvasElement: HTMLElement): Promise<void> => {
  const canvas = within(canvasElement)
  const header = canvasElement.querySelector<HTMLElement>('[data-vista-shell-header]')
  const versionTrigger = await canvas.findByRole('button', { name: 'Vista version' })
  const versionControl = canvasElement.querySelector<HTMLElement>('[data-vista-version-control]')

  await expect(header).not.toBeNull()
  await expect(versionControl).not.toBeNull()
  await expect(versionTrigger).toBeVisible()

  await waitFor(() => {
    const headerBounds = header!.getBoundingClientRect()
    const controls = [versionTrigger, versionControl].filter(
      (control): control is HTMLElement => control instanceof HTMLElement,
    )
    for (const control of controls) {
      const rootBounds = control.getBoundingClientRect()
      expect(rootBounds.width).toBeGreaterThan(0)
      expect(rootBounds.top).toBeGreaterThanOrEqual(headerBounds.top)
      expect(rootBounds.right).toBeLessThanOrEqual(headerBounds.right)
      expect(rootBounds.bottom).toBeLessThanOrEqual(headerBounds.bottom)
      expect(rootBounds.left).toBeGreaterThanOrEqual(headerBounds.left)
    }
  })
}

/**
 * Minimal AppShell story that inherits baseArgs unchanged, showing the shell pinned to the current
 * version with default content.
 */
export const PinnedCurrent: Story = {}
/**
 * AppShell story overriding navigation with the v2 appNavigation so the shell renders a pin to an
 * older, stale release.
 */
export const PinnedStale: Story = { args: { ...baseArgs, navigation: appNavigation('v2') } }
/**
 * AppShell story overriding navigation with the latest alias so the shell follows the newest
 * published version rather than a pinned one.
 */
export const FollowLatest: Story = { args: { ...baseArgs, navigation: appNavigation('latest') } }

/**
 * AppShell story that mounts the ResizePreferenceProbe content with v3 navigation to verify the
 * persisted resize preference applies for the pinned version.
 */
export const ResizePreferencePinned: Story = {
  args: { ...baseArgs, navigation: appNavigation('v3'), children: <ResizePreferenceProbe /> },
}

/**
 * AppShell story pairing the latest navigation alias with the ResizePreferenceProbe to confirm
 * following latest reuses the stored resize preference.
 */
export const ResizePreferenceLatestAlias: Story = {
  args: { ...baseArgs, navigation: appNavigation('latest'), children: <ResizePreferenceProbe /> },
}

/**
 * AppShell story combining v2 navigation with the ResizePreferenceProbe to check that resize
 * preferences are keyed per version instead of being shared.
 */
export const ResizePreferencePreviousVersion: Story = {
  args: { ...baseArgs, navigation: appNavigation('v2'), children: <ResizePreferenceProbe /> },
}

/**
 * AppShell story swapping in another application's navigation alongside the ResizePreferenceProbe
 * to verify resize preferences remain scoped per app.
 */
export const ResizePreferenceOtherApp: Story = {
  args: { ...baseArgs, navigation: otherAppNavigation(), children: <ResizePreferenceProbe /> },
}
/**
 * Interactive AppShell story whose play function asserts the version control shows v3 with its
 * description, opens the version listbox, and verifies the current option exposes the agent
 * identifier.
 */
export const RichVersionMetadata: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const control = await canvas.findByRole('button', { name: 'Vista version' })
    await expect(control).toHaveTextContent('v3')
    await expect(control).toHaveTextContent('Readable shell metadata')
    await userEvent.click(control)

    const current = await within(canvasElement.ownerDocument.body).findByRole('option', {
      name: /^v3 Readable shell metadata/u,
    })
    await expect(current).toHaveTextContent('agent vista-shell-12')
    await expect(current).toHaveTextContent(
      'Carries the publication title, author, time, and narrative into history.',
    )
  },
}

/**
 * Desktop-viewport story whose play function toggles the AppShell between centered maximum width
 * and full-bleed content, asserting the heading remains reachable and the toggle button reflects
 * the active width mode.
 */
export const ContentWidthToggle: Story = {
  globals: { viewport: { value: 'desktop1920', isRotated: false } },
  parameters: { viewport: { options: outlineViewports } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const frame = canvasElement.querySelector<HTMLElement>('[data-vista-content-frame]')
    if (frame === null) throw new Error('AppShell content frame must be rendered')

    const authoredHeading = canvas.getByRole('heading', { level: 1, name: TITLE })
    const viewportWidth = canvasElement.ownerDocument.documentElement.clientWidth
    const contain = canvas.getByRole('button', {
      name: 'Switch to centered maximum width',
    })

    await expect(contain).toHaveAttribute('aria-pressed', 'false')
    await expect(contain).toHaveAttribute('data-vista-content-width-toggle', 'full')
    await expect(frame).toHaveAttribute('data-vista-content-width', 'full')
    await expect(Math.floor(frame.getBoundingClientRect().width)).toBe(viewportWidth)

    await userEvent.click(contain)

    const restore = canvas.getByRole('button', { name: 'Switch to full width' })
    await expect(restore).toHaveAttribute('aria-pressed', 'true')
    await expect(restore).toHaveAttribute('data-vista-content-width-toggle', 'contained')
    await expect(frame).toHaveAttribute('data-vista-content-width', 'contained')
    await waitFor(() => {
      const rect = frame.getBoundingClientRect()
      expect(rect.width).toBeLessThan(viewportWidth)
      expect(Math.abs(rect.left - (viewportWidth - rect.right))).toBeLessThanOrEqual(1)
    })
    await expect(canvas.getByRole('heading', { level: 1, name: TITLE })).toBe(authoredHeading)

    await userEvent.click(restore)

    await expect(
      canvas.getByRole('button', { name: 'Switch to centered maximum width' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(frame).toHaveAttribute('data-vista-content-width', 'full')
    await waitFor(() => expect(Math.floor(frame.getBoundingClientRect().width)).toBe(viewportWidth))
    await expect(canvas.getByRole('heading', { level: 1, name: TITLE })).toBe(authoredHeading)
  },
}

/** The active label must truncate on a narrow bar without changing the authored document title. */
export const LongTitle: Story = {
  args: {
    ...baseArgs,
    title: LONG_TITLE,
    children: <ReviewDocument title={LONG_TITLE} firstLabel={LONG_TITLE} />,
  },
  globals: { viewport: { value: 'mobile390', isRotated: false } },
  parameters: { viewport: { options: outlineViewports } },
  play: async ({ canvasElement }) => {
    const identity = canvasElement.querySelector<HTMLElement>('[data-vista-document-identity]')
    if (identity === null) throw new Error('AppShell document identity must be rendered')
    await waitFor(() => expect(identity).toHaveTextContent(LONG_TITLE))
    await expect(window.getComputedStyle(identity).whiteSpace).toBe('nowrap')
    await expect(window.getComputedStyle(identity).textOverflow).toBe('ellipsis')
    await expect(identity.scrollWidth).toBeGreaterThan(identity.clientWidth)
    await expect(canvasElement.ownerDocument.title).toBe(LONG_TITLE)
  },
}

/** The visible identity follows reading position without creating another h1 or changing `<title>`. */
export const DocumentAnchoredTitle: Story = {
  globals: { viewport: { value: 'desktop1920', isRotated: false } },
  parameters: { viewport: { options: outlineViewports } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const identity = canvasElement.querySelector('[data-vista-document-identity]')
    const view = canvasElement.ownerDocument.defaultView
    const lineage = canvasElement.ownerDocument.getElementById('lineage')
    if (identity === null || view === null || lineage === null) {
      throw new Error('AppShell reading identity fixtures must be rendered')
    }

    await waitFor(() => expect(identity).toHaveTextContent('Where this came from'))
    await expect(canvas.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await expect(canvasElement.ownerDocument.title).toBe(TITLE)

    view.scrollTo({
      top: lineage.getBoundingClientRect().top + view.scrollY - 64,
      behavior: 'auto',
    })
    await waitFor(() => expect(identity).toHaveTextContent('Lineage guarantee'))
    await expect(canvas.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
    await expect(canvasElement.ownerDocument.title).toBe(TITLE)

    view.scrollTo({ top: 0, behavior: 'auto' })
  },
}

/** Nested headings inside a labelled section: hierarchy reads as indentation. */
export const NestedOutline: Story = {
  args: { ...baseArgs, children: <ReviewDocument nested /> },
}

/** Rendered answer markers drive both the counter and ask tick priority. */
export const AskAnswers: Story = {
  args: {
    ...baseArgs,
    children: (
      <AppRoot title={TITLE} template="architecture-review" scope="Reader answers">
        <Ask id="direction" label="Choose the direction">
          <p id="direction-answer">Should the review use the proposed direction?</p>
        </Ask>
        <Ask id="scope" label="Confirm the scope">
          <p data-vista-answered="">The scope is confirmed.</p>
        </Ask>
      </AppRoot>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const counter = await canvas.findByRole('status', { name: 'Asks' })
    const directionTick = canvasElement.querySelector('[data-vista-outline-priority="high"]')
    const answer = canvasElement.querySelector('#direction-answer')
    if (directionTick === null || answer === null) {
      throw new Error('Ask answer fixtures must be rendered')
    }
    await expect(counter).toHaveTextContent('1 need you')
    await expect(counter).toHaveTextContent('1 answered')
    answer.setAttribute('data-vista-answered', '')
    await waitFor(() => {
      expect(counter).not.toHaveTextContent('need you')
      expect(counter).toHaveTextContent('2 answered')
      expect(directionTick).toHaveAttribute('data-vista-outline-priority', 'normal')
    })
    answer.removeAttribute('data-vista-answered')
    await waitFor(() => {
      expect(counter).toHaveTextContent('1 need you')
      expect(counter).toHaveTextContent('1 answered')
      expect(directionTick).toHaveAttribute('data-vista-outline-priority', 'high')
    })
  },
}

/** Nothing addressable in the document: no panel, outline button, or empty surface. */
export const WithoutOutline: Story = {
  args: {
    ...baseArgs,
    children: (
      <main>
        <h1>{TITLE}</h1>
        <p>A one-screen note with no sections and no headings to point at.</p>
      </main>
    ),
  },
}

/**
 * Story that overrides fetch on the story window to serve the changelog payload and verifies that
 * activating the changelog control loads and displays the fetched entries, counting each request.
 */
export const ChangelogReady: Story = {
  args: {
    ...baseArgs,
    buildInfo,
    changelogHref: './changelog.v1.json',
  },
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView
    if (view === null) throw new Error('Story window must be available')
    let requestCount = 0
    view.fetch = async () => {
      requestCount += 1
      return new Response(JSON.stringify(changelogManifest), {
        headers: { 'content-type': 'application/json' },
      })
    }

    await expect(requestCount).toBe(0)
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Vista system information' }),
    )
    const overlay = within(canvasElement.ownerDocument.body)
    const changelog = await overlay.findByRole('region', { name: 'Vista changelog' })
    await expect(changelog).toHaveTextContent('Readable shell metadata')
    await expect(changelog).toHaveTextContent(
      'Published versions now keep their narrative title, author, time, and change summary.',
    )
    await expect(changelog).not.toHaveTextContent('2026-09-20-readable-shell-metadata')
    await expect(requestCount).toBe(1)

    await userEvent.click(within(changelog).getByText('Full history · 5 entries'))
    await expect(changelog).toHaveTextContent('Persistent outline')
  },
}

/**
 * Story that replaces fetch with a never-resolving promise so the changelog control can be
 * exercised in its pending state after being opened.
 */
export const ChangelogLoading: Story = {
  args: {
    ...baseArgs,
    buildInfo,
    changelogHref: './changelog.v1.json',
  },
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView
    if (view === null) throw new Error('Story window must be available')
    view.fetch = () => new Promise<Response>(() => undefined)

    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Vista system information' }),
    )
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole('status'),
    ).toHaveTextContent('Loading release notes…')
  },
}

/**
 * Story whose fetch stub returns a 503 response to verify the changelog control surfaces a failure
 * state rather than fetched content.
 */
export const ChangelogFailed: Story = {
  args: {
    ...baseArgs,
    buildInfo,
    changelogHref: './changelog.v1.json',
  },
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView
    if (view === null) throw new Error('Story window must be available')
    view.fetch = async () => new Response(undefined, { status: 503 })

    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Vista system information' }),
    )
    const overlay = within(canvasElement.ownerDocument.body)
    await expect(await overlay.findByRole('alert')).toHaveTextContent(
      'Release notes could not be loaded for this build.',
    )
    await expect(overlay.getByRole('button', { name: 'Try again' })).toBeVisible()
  },
}

/**
 * Story whose fetch stub returns a changelog document with no entries to verify the empty
 * changelog state renders honestly.
 */
export const ChangelogEmpty: Story = {
  args: {
    ...baseArgs,
    buildInfo,
    changelogHref: './changelog.v1.json',
  },
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView
    if (view === null) throw new Error('Story window must be available')
    view.fetch = async () =>
      new Response(
        JSON.stringify({
          ...changelogManifest,
          entries: [],
        }),
        { headers: { 'content-type': 'application/json' } },
      )

    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Vista system information' }),
    )
    const changelog = await within(canvasElement.ownerDocument.body).findByRole('region', {
      name: 'Vista changelog',
    })
    await expect(changelog).toHaveTextContent('No release notes are available for this build.')
    await expect(changelog).not.toHaveTextContent('Readable shell metadata')
  },
}

/**
 * At 1280px — above the historical 60rem boundary but below the regressed
 * 90rem boundary — the Notion-style rail is a fixed right-gutter line
 * indicator. Labels remain semantic links but stay visually clipped at rest.
 */
export const OutlineAt1280: Story = {
  globals: { viewport: { value: 'desktop1280', isRotated: false } },
  parameters: { viewport: { options: outlineViewports } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const persistent = await canvas.findByRole('navigation', { name: 'Sections' })
    const first = within(persistent).getByRole('link', { name: 'Where this came from' })
    const label = first.querySelector('span:not([aria-hidden])')
    const tick = first.querySelector('[aria-hidden="true"]')

    await expect(canvas.queryByRole('button', { name: 'Outline', hidden: true })).toBeNull()
    await expect(tick).toBeVisible()
    await waitFor(() => expect(window.getComputedStyle(label!).opacity).toBe('0'))
  },
}

/** Long outlines densify at rest, then scroll inside the focused expanded rail. */
export const LongPersistentOutline: Story = {
  args: { ...baseArgs, children: <LongOutlineDocument /> },
  globals: { viewport: { value: 'desktop1440', isRotated: false } },
  parameters: { viewport: { options: outlineViewports } },
  play: async ({ canvasElement }) => {
    const persistent = await within(canvasElement).findByRole('navigation', { name: 'Sections' })
    const first = within(persistent).getByRole('link', { name: 'Review section 1' })
    const label = first.querySelector('span:not([aria-hidden])')

    first.focus()
    await waitFor(() => expect(window.getComputedStyle(label!).opacity).toBe('1'))
    await expect(persistent.scrollHeight).toBeGreaterThan(persistent.clientHeight)
    await expect(persistent.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      canvasElement.ownerDocument.defaultView!.innerHeight,
    )
  },
}

/** At 1920px the same sole rail expands on hover; no header fallback is mounted. */
export const PersistentOutlineAt1920: Story = {
  globals: { viewport: { value: 'desktop1920', isRotated: false } },
  parameters: { viewport: { options: outlineViewports } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const persistent = await canvas.findByRole('navigation', { name: 'Sections' })
    const first = within(persistent).getByRole('link', { name: 'Where this came from' })
    const label = first.querySelector('span:not([aria-hidden])')

    await expect(canvas.queryByRole('button', { name: 'Outline', hidden: true })).toBeNull()
    await waitFor(() => expect(window.getComputedStyle(label!).opacity).toBe('0'))
    await userEvent.hover(persistent)
    await waitFor(() => expect(window.getComputedStyle(label!).opacity).toBe('1'))

    const frame = canvasElement.querySelector<HTMLElement>('[data-vista-content-frame]')
    if (frame === null) throw new Error('AppShell content frame must be rendered')
    const viewportWidth = canvasElement.ownerDocument.documentElement.clientWidth
    const frameRect = frame.getBoundingClientRect()
    const railRect = persistent.getBoundingClientRect()
    await expect(Math.floor(frameRect.left)).toBe(0)
    await expect(Math.ceil(frameRect.right)).toBeLessThanOrEqual(viewportWidth)
    await expect(Math.floor(frameRect.width)).toBe(viewportWidth)
    await expect(Math.ceil(railRect.right)).toBeLessThanOrEqual(viewportWidth)
    await expect(railRect.left).toBeGreaterThan(viewportWidth / 2)
  },
}

/**
 * The historical responsive boundary hides the gutter rail at 60rem and below.
 * There is deliberately no header button or popover fallback.
 */
export const NarrowLayout: Story = {
  args: { ...baseArgs, theme: 'dark' },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const persistent = await canvas.findByRole('navigation', {
      name: 'Sections',
      hidden: true,
    })

    await assertNarrowSelectorsFit(canvasElement)
    await expect(persistent).not.toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Outline', hidden: true })).toBeNull()
  },
}

/**
 * Mobile-viewport story on the light theme whose play function asserts the narrow selector
 * controls still fit within their container.
 */
export const NarrowLayoutLight: Story = {
  args: { ...baseArgs, theme: 'light' },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    await assertNarrowSelectorsFit(canvasElement)
  },
}

/** Story that renders the AppShell selector chrome with the light theme applied for visual review. */
export const LightTheme: Story = { args: { ...baseArgs, theme: 'light' } }
/** Story that renders the AppShell selector chrome with the dark theme applied for visual review. */
export const DarkTheme: Story = { args: { ...baseArgs, theme: 'dark' } }

/**
 * Keyboard reach expands the sole persistent rail because its ordinary links
 * keep the visually clipped labels available to focus and assistive technology.
 */
export const KeyboardOutline: Story = {
  globals: { viewport: { value: 'desktop1920', isRotated: false } },
  parameters: { viewport: { options: outlineViewports } },
  play: async ({ canvasElement }) => {
    const persistent = await within(canvasElement).findByRole('navigation', { name: 'Sections' })
    const first = within(persistent).getByRole('link', { name: 'Where this came from' })
    const label = first.querySelector('span:not([aria-hidden])')

    const links = within(persistent).getAllByRole('link')
    const last = links.at(-1)!
    window.scrollTo({ top: document.documentElement.scrollHeight })
    await waitFor(() => expect(last).toHaveAttribute('aria-current', 'true'))

    first.focus()
    await expect(first).toHaveFocus()
    await waitFor(() => expect(window.getComputedStyle(label!).opacity).toBe('1'))
    await expect(first.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      persistent.getBoundingClientRect().top,
    )
    await expect(first.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      persistent.getBoundingClientRect().bottom,
    )
  },
}
