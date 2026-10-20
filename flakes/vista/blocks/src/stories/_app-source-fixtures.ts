import type { AppSourceData } from '../blocks/app-source.ts'

const appTsx = `import { AppRoot, Section } from '@vista/blocks'
export default function VistaApp() {
  return (
    <AppRoot title="Demo" template="architecture-review" scope="test">
      <Section>
        <p>Demo.</p>
      </Section>
    </AppRoot>
  )
}
`

const inspectorTsx = `import { useState } from 'react'
export function Inspector() {
  const [open, setOpen] = useState(false)
  return <button type="button" onClick={() => setOpen(!open)}>{open ? 'hide' : 'show'}</button>
}
`

const trailJson = `[
  { "command": "vista check demo", "detail": "AppSource diagnostics before publish." },
  { "command": "vista publish demo", "detail": "Publish v1 and verify the pinned URL." }
]
`

/** Populated capture: files plus semantics, receipt, and trail. */
export const fullCapture: AppSourceData = {
  owner: 'vista.tests',
  slug: 'demo',
  version: 3,
  sourceDir: '/sources/vista/tests/demo',
  files: [
    { path: 'app.tsx', contents: appTsx },
    { path: 'inspector.tsx', contents: inspectorTsx },
    { path: 'trail.json', contents: trailJson },
  ],
  semantics: {
    schemaVersion: 2,
    app: {
      id: 'app',
      title: 'Demo',
      template: 'architecture-review',
      scope: 'test',
      status: { locked: 1, open: 1, awaiting: 0 },
    },
    nodes: [
      { id: 'app', kind: 'app', label: 'Demo', refs: [], bindings: [] },
      { id: 'direction', kind: 'ask', label: 'Direction', refs: [], bindings: [] },
      { id: 'frozen-capture', kind: 'decision', status: 'locked', refs: [], bindings: [] },
      { id: 'shell-toggle', kind: 'decision', status: 'open', refs: [], bindings: [] },
    ],
  },
  receipt: {
    version: 3,
    basePath: '/r/vista.tests/demo/v3/',
    semanticsSha256: '0'.repeat(64),
    fileCount: 3,
    byteTotal: appTsx.length + inspectorTsx.length + trailJson.length,
  },
  trail: [
    { command: 'vista check demo', detail: 'AppSource diagnostics before publish.' },
    { command: 'vista publish demo', detail: 'Publish v1 and verify the pinned URL.' },
  ],
}

/** Hand-authored draft: files only, no publish-derived sections. */
export const draftCapture: AppSourceData = {
  owner: 'vista.tests',
  slug: 'demo',
  version: 'draft',
  files: [
    { path: 'app.tsx', contents: appTsx },
    { path: 'notes.md', contents: '# Notes\n\nDraft.\n' },
  ],
}

/** A capture that holds nothing — bounded empty state, chrome intact. */
export const emptyCapture: AppSourceData = {
  owner: 'vista.tests',
  slug: 'demo',
  version: 'draft',
  files: [],
}

/** 48 files: the rail scrolls and the pane stays virtualized. */
export const largeCapture: AppSourceData = {
  owner: 'vista.tests',
  slug: 'demo',
  version: 7,
  files: Array.from({ length: 48 }, (_unused, index) => {
    const path = `src/section-${String(index + 1).padStart(2, '0')}/panel.tsx`
    return { path, contents: `// ${path}\nexport const panel${index + 1} = ${index + 1}\n` }
  }),
}
