import { MultiFileDiff, PatchDiff } from '@pierre/diffs/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'

import { Diff } from './Diff.tsx'
import { PierreDiff } from './diff/PierreDiff.tsx'

// Observe the renderer boundary without mounting Pierre's browser custom elements.
vi.mock('@pierre/diffs/react', () => ({
  MultiFileDiff: vi.fn(() => null),
  PatchDiff: vi.fn(() => null),
}))

beforeEach(() => vi.clearAllMocks())

const files = {
  _tag: 'files' as const,
  path: 'example.ts',
  oldContents: 'const before = true\n',
  newContents: 'const after = false\n',
}
const patch = {
  _tag: 'patch' as const,
  patch: '--- a/example.ts\n+++ b/example.ts\n@@ -1 +1 @@\n-before\n+after\n',
}

test.each([false, true])('Diff preserves full files and expansion (collapsed=%s)', (collapsed) => {
  renderToStaticMarkup(<Diff id="diff" source={files} collapsed={collapsed} />)
  expect(MultiFileDiff).toHaveBeenLastCalledWith(
    expect.objectContaining({
      oldFile: { name: files.path, contents: files.oldContents },
      newFile: { name: files.path, contents: files.newContents },
      options: expect.objectContaining({ expandUnchanged: !collapsed }),
    }),
    undefined,
  )
  expect(PatchDiff).not.toHaveBeenCalled()
})

test('Diff keeps patch-only hunks without requesting missing full files', () => {
  renderToStaticMarkup(<Diff id="diff" source={patch} />)
  expect(PatchDiff).toHaveBeenLastCalledWith(
    expect.objectContaining({
      patch: patch.patch,
      options: expect.objectContaining({ expandUnchanged: false }),
    }),
    undefined,
  )
  expect(MultiFileDiff).not.toHaveBeenCalled()
})

test.each(['folded', 'full'] as const)('PierreDiff expands only complete inputs (%s)', (context) => {
  renderToStaticMarkup(<PierreDiff source={files} arrangement="unified" context={context} />)
  expect(MultiFileDiff).toHaveBeenLastCalledWith(
    expect.objectContaining({
      oldFile: { name: files.path, contents: files.oldContents },
      newFile: { name: files.path, contents: files.newContents },
      options: expect.objectContaining({ expandUnchanged: context === 'full' }),
    }),
    undefined,
  )
  renderToStaticMarkup(<PierreDiff source={patch} arrangement="split" context={context} />)
  expect(PatchDiff).toHaveBeenLastCalledWith(
    expect.objectContaining({
      patch: patch.patch,
      options: expect.objectContaining({ expandUnchanged: false }),
    }),
    undefined,
  )
})
