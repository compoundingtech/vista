import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import {
  AppShell,
  AppShellHeader,
  VistaChangelogView,
  appShellContentWidthStorageKey,
  annotationUiStorageKey,
  activeOutlineId,
  activeOutlineLabel,
  askCounts,
  changelogEntriesForBuild,
  humanizeOutlineId,
  isOutlineNode,
  isVistaChangelogManifest,
  railTickOffsets,
  resolveShellOutline,
  resolveAppVersionIdentity,
  shellVersionItems,
  type AppShellNavigation,
  type ShellOutlineEntry,
  type VistaChangelogManifest,
} from './AppShell.tsx'
import { AppRoot, Decision, Section } from './authoring.tsx'
import { Note } from './blocks/kit/Note.tsx'
import {
  encodeOwner,
  isManagedAgentSubject,
  isValidContributorIdentity,
  isValidOwnerIdentity,
} from './owner-identity.ts'
import { fullCapture } from './stories/_app-source-fixtures.ts'

const navigation: AppShellNavigation = {
  currentOwner: 'vista.tests',
  currentSlug: 'agent-run-viewer',
  currentVersion: 'v3',
  apps: [
    {
      owner: 'vista.tests',
      slug: 'agent-run-viewer',
      title: 'Agent-run viewer architecture',
      latest: 3,
      versions: [
        {
          id: 'v3',
          label: 'v3',
          title: 'Readable shell metadata',
          timestamp: '2026-09-20T08:15:00.000Z',
          publisher: 'agent vista-shell-12',
          changeSummary: 'Carries persisted publication metadata into version history.',
        },
      ],
    },
  ],
}

test('owner namespaces retain exact native subjects and historical literal percent claims', () => {
  for (const owner of ['agent/author', 'agent/vista/author', 'agent/vista/team/author']) {
    expect(isManagedAgentSubject(owner)).toBe(true)
    expect(isValidOwnerIdentity(owner)).toBe(true)
    expect(isValidContributorIdentity(owner)).toBe(true)
    expect(decodeURIComponent(encodeOwner(owner))).toBe(owner)
  }
  expect(encodeOwner('agent/vista/author')).toBe('agent%2Fvista%2Fauthor')
  expect(encodeOwner('dev3.agent%2Fvista%2Fauthor')).toBe('dev3.agent%252Fvista%252Fauthor')
  expect(isValidOwnerIdentity('dev3.owner!')).toBe(true)
  expect(isValidContributorIdentity('dev3.owner!')).toBe(false)
  expect(isValidContributorIdentity('dev3.bad--agent')).toBe(false)
  for (const owner of [
    'agent/A/b',
    'agent/a/../b',
    'agent/a//b',
    'agent/a/b\n',
    ' dev3.owner',
    'dev/3.owner',
    '..',
  ]) {
    expect(isValidOwnerIdentity(owner)).toBe(false)
    expect(() => encodeOwner(owner)).toThrow()
  }
})

const changelogManifest = {
  schemaVersion: 1,
  product: 'vista',
  build: { machineVersion: '0.8.0-nix-7d5211e' },
  entries: [
    {
      id: '2026-09-20-readable-shell-metadata',
      date: '2026-09-20',
      title: 'Readable shell metadata',
      summary: 'Published versions retain their narrative metadata.',
      contributors: [
        {
          agentId: 'dev3.direct.omp.abc12345',
          name: 'Johannes Schickling',
          worktree: 'Dotfiles/2026-09-20-Vista-agent-graph',
        },
        {
          agentId: 'dev4.vista-reviewer',
          worktree: 'vista/release-review',
        },
      ],
    },
    {
      id: '2026-09-19-active-section-identity',
      date: '2026-09-19',
      title: 'Active section identity',
      summary: 'The visible shell identity follows the section being read.',
    },
    {
      id: '2026-09-18-build-provenance',
      date: '2026-09-18',
      title: 'Build provenance',
      summary: 'System information identifies the exact build.',
    },
    {
      id: '2026-09-17-persistent-outline',
      date: '2026-09-17',
      title: 'Persistent outline',
      summary: 'Wide layouts expose direct section navigation.',
    },
  ],
} satisfies VistaChangelogManifest

test('a draft route remains selected alongside rich published version metadata', () => {
  expect(
    shellVersionItems(navigation.apps[0], 'draft', Date.parse('2026-09-20T09:15:00.000Z')),
  ).toEqual([
    { id: 'draft', number: 'Draft', alias: 'draft' },
    {
      id: 'latest',
      number: 'v3',
      title: 'Readable shell metadata',
      relativeTime: '1 hr. ago',
      publisher: 'agent vista-shell-12',
      reason: 'Carries persisted publication metadata into version history.',
      alias: 'latest',
    },
    {
      id: 'v3',
      number: 'v3',
      title: 'Readable shell metadata',
      relativeTime: '1 hr. ago',
      publisher: 'agent vista-shell-12',
      reason: 'Carries persisted publication metadata into version history.',
    },
  ])
})

test('the changelog boundary is strict and entries only apply to the exact machine version', () => {
  expect(isVistaChangelogManifest(changelogManifest)).toBe(true)
  expect(isVistaChangelogManifest({ ...changelogManifest, unexpected: true })).toBe(false)
  expect(
    isVistaChangelogManifest({
      ...changelogManifest,
      entries: [{ ...changelogManifest.entries[0], summary: undefined }],
    }),
  ).toBe(false)
  expect(changelogEntriesForBuild(changelogManifest, '0.8.0-nix-7d5211e')).toHaveLength(4)
  expect(changelogEntriesForBuild(changelogManifest, '0.8.0-nix-other')).toEqual([])
})

test('the changelog boundary strictly validates optional contributor provenance', () => {
  const entry = changelogManifest.entries[0]
  const invalidContributors = [
    [],
    [{ agentId: 'dev3.direct.omp.abc12345', unexpected: true }],
    [{ agentId: 'dev3.direct.omp.abc12345', name: ' padded ' }],
    [{ agentId: 'direct-agent-without-host' }],
    [{ agentId: 'dev3.bad--agent' }],
    [{ agentId: 'agent/a/../b' }],
    [{ agentId: 'agent/a//b' }],
    [{ agentId: 'agent/A/b' }],
    [{ agentId: 'agent%2Fvista%2Fauthor' }],
    [{ agentId: 'dev3.direct.omp.abc12345', worktree: '/srv/bulk/dotfiles/topic' }],
    [{ agentId: 'dev3.direct.omp.abc12345', worktree: 'dotfiles/schickling/topic' }],
  ]

  for (const contributors of invalidContributors) {
    expect(
      isVistaChangelogManifest({
        ...changelogManifest,
        entries: [{ ...entry, contributors }],
      }),
    ).toBe(false)
  }
})

test('the changelog boundary accepts exact native subjects without reassigning dotted contributors', () => {
  for (const agentId of ['agent/vista/author', 'agent/author', 'agent/vista/team/author']) {
    expect(
      isVistaChangelogManifest({
        ...changelogManifest,
        entries: [
          {
            ...changelogManifest.entries[0],
            contributors: [{ agentId }, { agentId: 'dev3.direct.omp.abc12345' }],
          },
        ],
      }),
    ).toBe(true)
  }
})

test('ready changelog UI keeps entries narrative and discloses cumulative history', () => {
  const ready = renderToStaticMarkup(
    <VistaChangelogView
      state={{ _tag: 'ready', manifest: changelogManifest }}
      machineVersion="0.8.0-nix-7d5211e"
      onRetry={() => undefined}
    />,
  )
  expect(ready).toContain('What’s new in Vista')
  expect(ready).toContain('Readable shell metadata')
  expect(ready).toContain('Published versions retain their narrative metadata.')
  expect(ready).toContain('Full history · 4 entries')
  expect(ready).toContain('Persistent outline')
  expect(ready).not.toContain('2026-09-20-readable-shell-metadata')

  const unmatched = renderToStaticMarkup(
    <VistaChangelogView
      state={{ _tag: 'ready', manifest: changelogManifest }}
      machineVersion="0.8.0-nix-other"
      onRetry={() => undefined}
    />,
  )
  expect(unmatched).toContain('Release notes could not be loaded for this build.')
  expect(unmatched).not.toContain('Readable shell metadata')
})

test('release entries disclose every supplied contributor without adding disclosure to old entries', () => {
  const markup = renderToStaticMarkup(
    <VistaChangelogView
      state={{
        _tag: 'ready',
        manifest: { ...changelogManifest, entries: changelogManifest.entries.slice(0, 2) },
      }}
      machineVersion="0.8.0-nix-7d5211e"
      onRetry={() => undefined}
    />,
  )

  expect(markup).toContain('>Change context</summary>')
  expect(markup.match(/<summary/g)).toHaveLength(1)
  expect(markup).toContain('Agent')
  expect(markup).toContain('dev3.direct.omp.abc12345')
  expect(markup).toContain('dev4.vista-reviewer')
  expect(markup).toContain('Name')
  expect(markup).toContain('Johannes Schickling')
  expect(markup).toContain('Worktree')
  expect(markup).toContain('Dotfiles/2026-09-20-Vista-agent-graph')
  expect(markup).toContain('vista/release-review')
})

test('ask counts come only from the current rendered answer states', () => {
  expect(askCounts([])).toEqual({ needed: 0, answered: 0 })
  expect(askCounts([{ answered: false }, { answered: false }])).toEqual({
    needed: 2,
    answered: 0,
  })
  expect(askCounts([{ answered: true }, { answered: false }, { answered: true }])).toEqual({
    needed: 1,
    answered: 2,
  })
  expect(askCounts([{ answered: true }])).toEqual({ needed: 0, answered: 1 })
})

test('the ask counter hides empty counts and meters every ask', () => {
  const render = (asks: readonly { readonly answered: boolean }[]) =>
    renderToStaticMarkup(
      <AppShellHeader title="Review" theme="light" onThemeChange={() => undefined} asks={asks} />,
    )

  expect(render([])).not.toContain('aria-label="Asks"')
  const unanswered = render([{ answered: false }, { answered: false }])
  expect(unanswered).toContain('role="status" aria-label="Asks"')
  expect(unanswered).toContain('2 need you')
  expect(unanswered).not.toContain('0 answered')
  expect(unanswered.match(/data-vista-ask-answered="false"/g)).toHaveLength(2)
  const mixed = render([{ answered: false }, { answered: true }])
  expect(mixed).toContain('1 need you')
  expect(mixed).toContain('1 answered')
  expect(mixed).toContain('data-vista-ask-answered="true"')
  const answered = render([{ answered: true }])
  expect(answered).toContain('1 answered')
  expect(answered).not.toContain('need you')
})

test('only unanswered ask destinations receive high-priority ticks', () => {
  const entries: readonly ShellOutlineEntry[] = [
    { id: 'context', label: 'Context', rawDepth: 0, top: 100, kind: 'section' },
    { id: 'ask', label: 'Direction', rawDepth: 2, top: 200, kind: 'ask', answered: false },
    { id: 'answered', label: 'Confirmed', rawDepth: 0, top: 300, kind: 'ask', answered: true },
    { id: 'decision', label: 'Open decision', rawDepth: 0, top: 400, kind: 'decision' },
  ]

  expect(resolveShellOutline(entries, 1000).map(({ priority }) => priority)).toEqual([
    'normal',
    'high',
    'normal',
    'normal',
  ])
  expect(
    resolveShellOutline(
      entries.map((entry) => Object.assign({}, entry, { answered: true })),
      1000,
    ).map(({ priority }) => priority),
  ).toEqual(['normal', 'normal', 'normal', 'normal'])
})

test('an outline entry and the heading that titles it collapse into one place', () => {
  const entries: readonly ShellOutlineEntry[] = [
    { id: 'context', label: 'Context', rawDepth: 0, top: 200 },
    // The `h2` the section renders — same place, deeper, same words.
    { id: 'context-heading', label: 'context ', rawDepth: 1, top: 200 },
    { id: 'lineage', label: 'Lineage', rawDepth: 0, top: 600 },
    // A genuinely nested heading keeps its own entry.
    { id: 'lineage-proof', label: 'Proof', rawDepth: 2, top: 700 },
    { id: 'signoff', label: 'Sign-off', rawDepth: 0, top: 1000 },
  ]

  const outline = resolveShellOutline(entries, 2000)

  expect(outline.map((item) => item.id)).toEqual(['context', 'lineage', 'lineage-proof', 'signoff'])
  // Hierarchy is gap-free even though the raw depths jump 0 -> 2.
  expect(outline.map((item) => item.depth)).toEqual([0, 0, 1, 0])
  expect(outline.map((item) => item.position)).toEqual([0.1, 0.3, 0.35, 0.5])
})

test('active outline labels fall back only within an existing outline', () => {
  const outline = resolveShellOutline(
    [
      { id: 'context', label: 'Where this came from', rawDepth: 0, top: 200 },
      { id: 'lineage', label: 'Lineage guarantee', rawDepth: 0, top: 600 },
    ],
    1000,
  )

  expect(activeOutlineLabel([], undefined)).toBeUndefined()
  expect(activeOutlineLabel(outline, undefined)).toBe('Where this came from')
  expect(activeOutlineLabel(outline, 'lineage')).toBe('Lineage guarantee')
  expect(activeOutlineLabel(outline, 'removed-section')).toBe('Where this came from')
})

test('outline positions stay in range for an unmeasured or overlong document', () => {
  const entries: readonly ShellOutlineEntry[] = [
    { id: 'a', label: 'A', rawDepth: 0, top: -40 },
    { id: 'b', label: 'B', rawDepth: 0, top: 9000 },
  ]
  expect(resolveShellOutline(entries, 1000).map((item) => item.position)).toEqual([0, 1])
  expect(resolveShellOutline(entries, 0).map((item) => item.position)).toEqual([0, 0])
})

test('the active entry is the last one the reading edge has passed', () => {
  const outline = resolveShellOutline(
    [
      { id: 'one', label: 'One', rawDepth: 0, top: 100 },
      { id: 'two', label: 'Two', rawDepth: 0, top: 500 },
      { id: 'three', label: 'Three', rawDepth: 0, top: 900 },
    ],
    1000,
  )

  // Above the first entry the first one still reads as active.
  expect(activeOutlineId(outline, 0)).toBe('one')
  expect(activeOutlineId(outline, 499)).toBe('one')
  expect(activeOutlineId(outline, 500)).toBe('two')
  expect(activeOutlineId(outline, 100_000)).toBe('three')
  expect(activeOutlineId([], 0)).toBeUndefined()
})

test('live viewport tops select the reading label after content moves without scrolling', () => {
  const cachedOutline = resolveShellOutline(
    [
      { id: 'context', label: 'Context', rawDepth: 0, top: 100 },
      { id: 'direction', label: 'Direction', rawDepth: 0, top: 500 },
    ],
    1000,
  )
  const liveTops = [
    { id: 'context', top: -200 },
    { id: 'direction', top: 60 },
  ]

  expect(activeOutlineId(cachedOutline, 65)).toBe('context')
  expect(activeOutlineId(liveTops, 65)).toBe('direction')
  expect(activeOutlineLabel(cachedOutline, activeOutlineId(liveTops, 65))).toBe('Direction')
  expect(
    activeOutlineId(
      [
        { id: 'context', top: -200 },
        { id: 'direction', top: 180 },
      ],
      65,
    ),
  ).toBe('context')
})

test('the last entry is what is being read once the document bottom is reached', () => {
  const outline = resolveShellOutline(
    [
      { id: 'one', label: 'One', rawDepth: 0, top: 100 },
      { id: 'two', label: 'Two', rawDepth: 0, top: 500 },
      // A final section far shorter than a viewport: its top never passes the
      // reading edge, so only the bottom clamp can reach it.
      { id: 'coda', label: 'Coda', rawDepth: 0, top: 2400 },
    ],
    2500,
  )

  expect(activeOutlineId(outline, 600, true)).toBe('coda')
  // Not at the bottom, the reading edge still decides on its own.
  expect(activeOutlineId(outline, 600, false)).toBe('two')
  expect(activeOutlineId(outline, 600)).toBe('two')
  expect(activeOutlineId([], 0, true)).toBeUndefined()
})

test('an unlabelled id degrades to a readable phrase', () => {
  expect(humanizeOutlineId('agent-run_viewer')).toBe('Agent run viewer')
  expect(humanizeOutlineId('---')).toBe('---')
})

test('runtime islands and the document root are not places to navigate to', () => {
  const candidates = [
    { id: 'app', kind: 'app', hidden: false },
    { id: 'sec-lineage', kind: 'section', hidden: false },
    { id: 'isl-lineage', kind: 'island', hidden: false },
    { id: 'ev-lineage', kind: 'evidence', hidden: false },
    { id: 'hidden-branch', kind: 'section', hidden: true },
    { id: '', kind: 'section', hidden: false },
  ]

  expect(candidates.filter(isOutlineNode).map(({ id }) => id)).toEqual([
    'sec-lineage',
    'ev-lineage',
  ])
})

test('collapsed ticks use a compact fixed pitch regardless of document spacing', () => {
  const outline = resolveShellOutline(
    [
      { id: 'top', label: 'Top', rawDepth: 0, top: 0 },
      { id: 'late', label: 'Late', rawDepth: 0, top: 750 },
      { id: 'end', label: 'End', rawDepth: 0, top: 1000 },
    ],
    1000,
  )

  expect(railTickOffsets(outline, 300)).toEqual([0, 14, 28])
})

test('adjacent entries never collide even when their sections touch', () => {
  const outline = resolveShellOutline(
    [
      { id: 'a', label: 'A', rawDepth: 0, top: 990 },
      { id: 'b', label: 'B', rawDepth: 0, top: 995 },
      { id: 'c', label: 'C', rawDepth: 0, top: 1000 },
    ],
    1000,
  )

  const offsets = railTickOffsets(outline, 300)
  expect(offsets).toEqual([0, 14, 28])
  expect(offsets.every((offset, index) => index === 0 || offset > offsets[index - 1]!)).toBe(true)
})

test('a run longer than the capped canvas uses a non-overlapping tick preview', () => {
  const outline = resolveShellOutline(
    Array.from({ length: 200 }, (_, index) => ({
      id: `s${index}`,
      label: `S${index}`,
      rawDepth: 0,
      top: index * 100,
    })),
    20_000,
  )

  const offsets = railTickOffsets(outline, 300)

  expect(offsets).toHaveLength(200)
  expect(offsets[0]).toBe(0)
  expect(offsets.at(-1)).toBeGreaterThan(300)
  expect(offsets.every((offset, index) => index === 0 || offset - offsets[index - 1]! >= 2)).toBe(
    true,
  )
})

test('zero and one-entry outlines stay at the track start', () => {
  const outline = resolveShellOutline([{ id: 'only', label: 'Only', rawDepth: 0, top: 500 }], 1000)

  expect(railTickOffsets(outline, 300)).toEqual([0])
  expect(railTickOffsets([], 300)).toEqual([])
})

test('the shipped header is document-anchored and leaves the sole h1 to the document', () => {
  const html = renderToStaticMarkup(
    <AppShell title="Agent-run viewer architecture" navigation={navigation} initialTheme="light">
      <AppRoot
        title="Agent-run viewer architecture"
        template="architecture-review"
        scope="One source"
      >
        <Section id="context" label="Where this came from">
          <h2 id="context-heading">Where this came from</h2>
        </Section>
        <Decision id="transport" status="locked">
          <p>Settled</p>
        </Decision>
      </AppRoot>
    </AppShell>,
  )

  expect(html.match(/<h1[ >]/g)).toHaveLength(1)
  expect(html).toContain('data-vista-header-variant="H1"')
  expect(html).toMatch(/<a[^>]*href="\/"[^>]*aria-label="Vista home"/)
  expect(html).toContain('title="Agent-run viewer architecture"')
  expect(html).not.toContain('aria-label="Review status"')
  expect(html).not.toContain('aria-label="Asks"')
  expect(html).not.toContain('Authored by')
  expect(html).not.toContain('data-vista-title-echo')
  expect(html).not.toContain('aria-label="App"')
  expect(html).not.toContain('<footer')
  expect(html).toContain('aria-label="Switch to centered maximum width"')
  expect(html).toContain('aria-pressed="false"')
  expect(html).toContain('data-vista-content-width-toggle="full"')
  expect(html).toContain('data-vista-content-width="full"')
})

test.each([
  ['agent/dotfiles/ui-design', 'UI design'],
  ['dev3.direct.omp.historical', 'legacy session'],
  [undefined, undefined],
])('the shell quietly attributes owner %s', (owner, label) => {
  const html = renderToStaticMarkup(
    <AppShell title="Owner byline" initialTheme="light" {...(owner === undefined ? {} : { owner })}>
      <p>Document</p>
    </AppShell>,
  )

  if (label === undefined) {
    expect(html).not.toContain('data-vista-owner-byline')
  } else {
    expect(html).toContain('tabindex="0"')
    expect(html).toContain(`aria-label="Owner: ${owner}"`)
    expect(html).toContain('data-vista-owner-byline=""')
    expect(html).toContain(`>${label}</button>`)
  }
})

test('the contained-width header control exposes its active state and inverse action', () => {
  const html = renderToStaticMarkup(
    <AppShellHeader
      title="Contained review"
      theme="light"
      onThemeChange={() => undefined}
      contentWidth="contained"
      onContentWidthChange={() => undefined}
    />,
  )

  expect(html).toContain('aria-label="Switch to full width"')
  expect(html).toContain('aria-pressed="true"')
  expect(html).toContain('data-vista-content-width-toggle="contained"')
})

test('an explicit self-source payload renders the header toggle, closed by default', () => {
  const html = renderToStaticMarkup(
    <AppShell title="Toggle host" initialTheme="light" selfSource={fullCapture}>
      <AppRoot title="Toggle host" template="architecture-review" scope="Shell prepend reveal">
        <Section id="context" label="Context">
          <p>Document.</p>
        </Section>
      </AppRoot>
    </AppShell>,
  )

  expect(html).toContain('Inspect source')
  expect(html).toContain('aria-expanded="false"')
  // Closed: the inspector is not prepended yet.
  expect(html).not.toContain('Source of demo v3')
  // One document heading only — the inspector adds none even when closed.
  expect(html.match(/<h1[ >]/g)).toHaveLength(1)
})

test('without a payload the shell renders no toggle', () => {
  const html = renderToStaticMarkup(
    <AppShell title="Toggle host" initialTheme="light">
      <AppRoot title="Toggle host" template="architecture-review" scope="Shell prepend reveal">
        <Section id="context" label="Context">
          <p>Document.</p>
        </Section>
      </AppRoot>
    </AppShell>,
  )

  expect(html).not.toContain('Inspect source')
})

test('the Explain toggle renders only when the shell supplies it, off by default', () => {
  const header = (explain: Partial<Parameters<typeof AppShellHeader>[0]>) =>
    renderToStaticMarkup(
      <AppShellHeader
        title="Explained"
        theme="light"
        onThemeChange={() => undefined}
        {...explain}
      />,
    )
  expect(header({})).not.toContain('data-vista-explain-toggle')
  const off = header({ onExplainChange: () => undefined })
  expect(off).toContain('aria-label="Explain this page"')
  expect(off).toMatch(/data-vista-explain-toggle[^>]*aria-pressed="false"/)
  expect(header({ explainOn: true, onExplainChange: () => undefined })).toContain(
    'aria-label="Hide explanations"',
  )
})

test('a page without registered Notes renders no Explain toggle or overlay', () => {
  const html = renderToStaticMarkup(
    <AppShell title="Explained" initialTheme="light">
      <p>
        <Note text="Means held">
          <span>Held</span>
        </Note>
      </p>
    </AppShell>,
  )
  expect(html).toContain('<span>Held</span>')
  expect(html).not.toContain('data-vista-explain-toggle')
  expect(html).not.toContain('data-vista-explain=')
})

test('latest and its pinned alias resolve to one immutable publication identity', () => {
  expect(resolveAppVersionIdentity({ ...navigation, currentVersion: 'latest' })).toEqual({
    owner: 'vista.tests',
    slug: 'agent-run-viewer',
    version: 'v3',
  })
  expect(resolveAppVersionIdentity({ ...navigation, currentVersion: 'v3' })).toEqual({
    owner: 'vista.tests',
    slug: 'agent-run-viewer',
    version: 'v3',
  })
  expect(resolveAppVersionIdentity({ ...navigation, currentVersion: 'draft' })).toBeUndefined()
  expect(resolveAppVersionIdentity({ ...navigation, currentVersion: 'v99' })).toBeUndefined()
})

test('content-width preference keys belong to the canonical App rather than a publication', () => {
  const app = navigation.apps[0]
  if (app === undefined) throw new Error('navigation fixture must contain its selected App')
  expect(appShellContentWidthStorageKey(app)).toBe(
    'vista.blocks.v1/content-width/vista.tests/agent-run-viewer',
  )
  expect(
    appShellContentWidthStorageKey({
      owner: 'other-owner',
      slug: navigation.currentSlug,
    }),
  ).not.toBe(appShellContentWidthStorageKey(app))
})

test('annotation mode is app-scoped and opt-in in server output', () => {
  const html = renderToStaticMarkup(
    <AppShell title="Annotation host" navigation={navigation} initialTheme="light">
      <AppRoot title="Annotation host" template="architecture-review" scope="Annotation review">
        <Section id="context" label="Context">
          <p>Document.</p>
        </Section>
      </AppRoot>
    </AppShell>,
  )

  expect(annotationUiStorageKey('vista.tests', 'agent-run-viewer')).toBe(
    'vista:ui:vista.tests/agent-run-viewer:annotate',
  )
  expect(annotationUiStorageKey('vista.tests', 'other-app')).not.toBe(
    annotationUiStorageKey('vista.tests', 'agent-run-viewer'),
  )
  expect(html).toContain('aria-label="Annotate"')
  expect(html).toContain('aria-pressed="false"')
  expect(html).not.toContain('data-vista-agentation-overlay')
})
