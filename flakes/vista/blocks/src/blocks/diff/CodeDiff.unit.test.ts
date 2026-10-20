import { describe, expect, it } from 'vitest'

import { codeDiffModel } from './CodeDiff.tsx'

const patch = (...lines: readonly string[]) => ({ _tag: 'patch' as const, patch: lines.join('\n') })

describe('codeDiffModel over a patch', () => {
  it('counts removed `---` and added `+++` content lines as changes, not headers', () => {
    const model = codeDiffModel(
      patch(
        'diff --git a/doc.md b/doc.md',
        '--- a/doc.md',
        '+++ b/doc.md',
        '@@ -1,4 +1,4 @@',
        '----',
        '---- section',
        '++++ title',
        ' body',
        '-old',
        '+new',
      ),
    )
    expect(model).toEqual({ counts: { added: 2, removed: 3 }, identical: false, path: 'doc.md' })
  })

  it('reads the next file header after a hunk consumes its declared lines', () => {
    const model = codeDiffModel(
      patch(
        'diff --git a/a.ts b/a.ts',
        '--- a/a.ts',
        '+++ b/a.ts',
        '@@ -1 +1 @@',
        '-a',
        '+b',
        'diff --git a/b.ts b/b.ts',
        '--- a/b.ts',
        '+++ b/b.ts',
        '@@ -1,3 +1,3 @@',
        ' keep',
        // An empty context line whose leading space was stripped stays inside the hunk.
        '',
        '-c',
        '+d',
        '\\ No newline at end of file',
      ),
    )
    expect(model).toEqual({ counts: { added: 2, removed: 2 }, identical: false, path: 'b.ts' })
  })

  it('reports a context-only patch as identical', () => {
    expect(
      codeDiffModel(patch('--- a/x', '+++ b/x', '@@ -1,2 +1,2 @@', ' a', ' b')).identical,
    ).toBe(true)
  })

  it('names a deleted file by its old path', () => {
    const model = codeDiffModel(
      patch('--- a/gone.ts', '+++ /dev/null', '@@ -1,2 +0,0 @@', '-a', '-b'),
    )
    expect(model).toEqual({ counts: { added: 0, removed: 2 }, identical: false, path: 'gone.ts' })
  })
})
