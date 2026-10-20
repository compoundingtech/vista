import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { assertNoSecrets } from './secrets.ts'
import { collectAuthoredFiles } from './self-capture.ts'

describe('collectAuthoredFiles', () => {
  let root = ''
  afterEach(() => {
    if (root !== '') rmSync(root, { recursive: true, force: true })
    root = ''
  })

  it('collects authored files sorted, skipping dependency trees, dot entries, caches, and symlinks', () => {
    root = mkdtempSync(join(tmpdir(), 'vista-self-capture-'))
    const write = (rel: string, contents: string): void => {
      mkdirSync(join(root, rel.split('/').slice(0, -1).join('/')), { recursive: true })
      writeFileSync(join(root, rel), contents)
    }
    write('app.tsx', 'export default 1\n')
    write('notes.md', '# Notes\n')
    write('sub/helper.ts', 'export const helper = 1\n')
    write('trail.json', '[]\n')
    write('node_modules/dep/index.js', 'module.exports = 1\n')
    write('sub/node_modules/deep.js', 'module.exports = 2\n')
    const envContents = 'DATABASE_PASSWORD=hunter2\n'
    write('.env', envContents)
    write('.git/config', '[core]\n')
    write('.vite/cache.json', '{}\n')
    write('.publishing', '')
    write('real.ts', 'export const real = 1\n')
    symlinkSync(join(root, 'real.ts'), join(root, 'file-link.ts'))
    symlinkSync(join(root, 'sub'), join(root, 'dir-link'))

    // The planted .env passes the value scan, so only the walk exclusion keeps
    // it out of the publicly served capture.
    expect(assertNoSecrets(envContents)).toEqual([])

    const files = collectAuthoredFiles(root)
    expect(files.map((file) => file.path)).toEqual([
      'app.tsx',
      'notes.md',
      'real.ts',
      'sub/helper.ts',
      'trail.json',
    ])
    expect(files.find((file) => file.path === 'sub/helper.ts')?.contents).toBe(
      'export const helper = 1\n',
    )
  })
})
