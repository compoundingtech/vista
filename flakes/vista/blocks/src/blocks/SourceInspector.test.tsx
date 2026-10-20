import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import {
  draftCapture,
  emptyCapture,
  fullCapture,
  largeCapture,
} from '../stories/_app-source-fixtures.ts'
import { projectAppSource, sourceFileItemId } from './app-source.ts'
import { SourceInspector } from './SourceInspector.tsx'

test('files project onto rail entries and file items with byte totals', () => {
  const { entries, items, byteTotal } = projectAppSource('src', fullCapture)

  expect(entries.map((entry) => entry.path)).toEqual(['app.tsx', 'inspector.tsx', 'trail.json'])
  expect(items.map((item) => item.id)).toEqual(
    fullCapture.files.map((file) => sourceFileItemId('src', file.path)),
  )
  for (const item of items) expect(item.type).toBe('file')
  expect(items[0]?.file.name).toBe('app.tsx')
  expect(items[0]?.file.contents).toBe(fullCapture.files[0]?.contents)
  expect(byteTotal).toBe(fullCapture.receipt?.byteTotal)
  expect(entries[0]).toMatchObject({ id: 'src::app.tsx', path: 'app.tsx' })
})

test('line counts treat a trailing newline as a terminator, not a line', () => {
  const { entries } = projectAppSource('src', {
    ...draftCapture,
    files: [
      { path: 'empty.ts', contents: '' },
      { path: 'no-trailing.ts', contents: 'a\nb' },
      { path: 'trailing.ts', contents: 'a\nb\n' },
    ],
  })

  expect(entries.map((entry) => entry.lines)).toEqual([0, 2, 2])
})

test('an explicit lang passes through to the file item', () => {
  const { items } = projectAppSource('src', {
    ...draftCapture,
    files: [{ path: 'notes.txt', contents: 'hi', lang: 'markdown' }],
  })

  expect(items[0]?.file.lang).toBe('markdown')
})

test('an empty capture projects to empty rail, pane, and total', () => {
  const { entries, items, byteTotal } = projectAppSource('src', emptyCapture)

  expect(entries).toEqual([])
  expect(items).toEqual([])
  expect(byteTotal).toBe(0)
})

test('the inspector chrome renders capture identity and roll-up', () => {
  const html = renderToStaticMarkup(<SourceInspector id="src" source={fullCapture} />)

  expect(html).toContain('aria-label="Source of demo v3"')
  expect(html).toContain('vista.tests / demo v3')
  expect(html).toContain('3 files')
  expect(html).toContain('role="tab"')
  expect(html).toContain('aria-selected="true"')
  expect(html).toContain('app.tsx — 10 lines')
})

test('a captured source dir renders with a copy button; drafts show none', () => {
  const captured = renderToStaticMarkup(<SourceInspector id="src" source={fullCapture} />)
  expect(captured).toContain('/sources/vista/tests/demo')
  expect(captured).toContain('Copy path')

  const draft = renderToStaticMarkup(<SourceInspector id="src" source={draftCapture} />)
  expect(draft).not.toContain('Copy path')
})

test('a draft without publish sections offers only the file tab', () => {
  const html = renderToStaticMarkup(<SourceInspector id="src" source={draftCapture} />)

  expect(html).toContain('aria-label="Source of demo draft"')
  expect(html).toContain('File')
  expect(html).not.toContain('Semantics')
  expect(html).not.toContain('Receipt')
  expect(html).not.toContain('Trail')
})

test('the full capture exposes semantics, receipt, and trail tabs', () => {
  const html = renderToStaticMarkup(<SourceInspector id="src" source={fullCapture} />)

  expect(html).toContain('Semantics')
  expect(html).toContain('Receipt')
  expect(html).toContain('Trail')
  // Tab panels render on selection (covered by story play tests); the static
  // file tab already proves the details aside stands.
  expect(html).toContain('aria-label="Capture details"')
  expect(html).toContain('Files in capture')
})

test('an empty capture renders bounded empty chrome', () => {
  const html = renderToStaticMarkup(<SourceInspector id="src" source={emptyCapture} />)

  expect(html).toContain('This capture holds no files.')
  expect(html).not.toContain('Captured files')
})

test('a large capture projects every file', () => {
  const { entries, items } = projectAppSource('src', largeCapture)

  expect(entries).toHaveLength(48)
  expect(items).toHaveLength(48)
})
