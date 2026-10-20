#!/usr/bin/env node
/**
 * Author-time git helper (decision 0068): emit the `FileChange[]` a Vista review's
 * `diff-data` freezes and `fromGitDiff` consumes. Combines `git diff --numstat` with a
 * single batched `git check-attr linguist-generated linguist-vendored` to classify each
 * file's `provenance` from git's OWN source of truth (`.gitattributes`) — no hand-list.
 *
 * This is the ONE impure, git-touching step; it runs once at author time and its output is
 * frozen into the review, so the pure kit layers (fromGitDiff, the treemap component) never
 * invoke git (the purity boundary that keeps the component reusable / git-blind).
 *
 * Usage:
 *   node flakes/vista/scripts/git-changes.mjs <git-range> [--cwd <dir>]
 *   node flakes/vista/scripts/git-changes.mjs main...HEAD > changes.json
 *
 * Output: a JSON `FileChange[]` — `{ path, insertions, deletions, provenance }[]`, where
 * `provenance` is `'generated' | 'vendored' | 'authored'`. Binary files (numstat `-`) are
 * skipped. Degrades to all-`authored` when git attributes are unavailable.
 */
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const cwdFlag = args.indexOf('--cwd')
const cwd = cwdFlag === -1 ? process.cwd() : args[cwdFlag + 1]
// The `--cwd` VALUE index to skip when finding the range; -1 (no match) when `--cwd` is
// absent, so `i !== cwdValueIndex` never wrongly excludes `args[0]`.
const cwdValueIndex = cwdFlag === -1 ? -1 : cwdFlag + 1
const range = args.find((a, i) => !a.startsWith('--') && i !== cwdValueIndex)

if (range === undefined) {
  process.stderr.write('usage: git-changes.mjs <git-range> [--cwd <dir>]\n')
  process.exit(2)
}

// `-c core.quotePath=false` so non-ASCII/special paths are emitted verbatim by BOTH numstat
// and check-attr — otherwise a quoted path from one and an unquoted path from the other would
// not round-trip through `attrByPath`, misclassifying the file as authored.
const git = (gitArgs, input) =>
  execFileSync('git', ['-c', 'core.quotePath=false', ...gitArgs], {
    cwd,
    encoding: 'utf8',
    ...(input === undefined ? {} : { input }),
    maxBuffer: 64 * 1024 * 1024,
  })

/**
 * Normalize a `git diff --numstat` rename path (`{old => new}/rest`, `dir/{old => new}`,
 * or a whole-path `old => new`) to the real new-side path — mirrors the kit's
 * `normalizeRenamePath` so `check-attr` gets a real path.
 */
const normalizeRenamePath = (raw) => {
  const braced = raw.replace(/\{([^}]*?) => ([^}]*?)\}/g, (_all, _old, next) => next)
  if (braced.includes(' => '))
    return braced.slice(braced.indexOf(' => ') + 4).replace(/\/{2,}/g, '/')
  return braced.replace(/\/{2,}/g, '/')
}

// 1. Churn per file from numstat.
const numstat = git(['diff', '--numstat', range])
const files = []
for (const rawLine of numstat.split('\n')) {
  const line = rawLine.trim()
  if (line === '') continue
  const parts = line.split('\t')
  if (parts.length < 3) continue
  const [insText, delText, ...rest] = parts
  if (insText === '-' || delText === '-') continue // binary
  const insertions = Number(insText)
  const deletions = Number(delText)
  if (Number.isNaN(insertions) || Number.isNaN(deletions)) continue
  files.push({ path: normalizeRenamePath(rest.join('\t')), insertions, deletions })
}

// 2. One batched check-attr for provenance. `--stdin` reads NUL-free paths, one per line.
//    Output lines: `<path>: <attr>: <value>` where value is `set`/`true`/`unspecified`.
const attrByPath = new Map()
if (files.length > 0) {
  let out = ''
  try {
    out = git(
      ['check-attr', '--stdin', 'linguist-generated', 'linguist-vendored'],
      `${files.map((f) => f.path).join('\n')}\n`,
    )
  } catch {
    out = '' // no git attributes available → everything stays authored
  }
  for (const rawLine of out.split('\n')) {
    // Split from the RIGHT: path may contain `: ` but attr and value do not.
    const m = rawLine.match(/^(.*): ([^:]+): (.+)$/)
    if (!m) continue
    const [, path, attr, value] = m
    const set = value === 'set' || value === 'true'
    if (!set) continue
    const cur = attrByPath.get(path) ?? {}
    if (attr === 'linguist-generated') cur.generated = true
    if (attr === 'linguist-vendored') cur.vendored = true
    attrByPath.set(path, cur)
  }
}

// 3. Map to FileChange[]. Generated wins over vendored when both are set.
const changes = files.map((f) => {
  const a = attrByPath.get(f.path) ?? {}
  const provenance = a.generated ? 'generated' : a.vendored ? 'vendored' : 'authored'
  return { path: f.path, insertions: f.insertions, deletions: f.deletions, provenance }
})

process.stdout.write(`${JSON.stringify(changes, null, 2)}\n`)
