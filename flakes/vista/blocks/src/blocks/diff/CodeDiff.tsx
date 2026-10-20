/**
 * Code lens: semantic counts and frame chrome around `@pierre/diffs`, the same renderer and
 * Vista themes the `Diff` block uses. The frame's arrangement is the only switch: it maps to
 * pierre's `diffStyle` directly instead of going through the `Diff` block, whose own in-block
 * view toggle would be a second, competing switch.
 *
 * `PierreDiff` is also the line-oriented renderer the text lens can opt into, so everything
 * line-shaped in the family renders through one pierre integration. The renderer itself lives
 * in `PierreDiff.tsx` and loads on demand, so importing this module (or `codeDiffModel`) never
 * pulls `@pierre/diffs` into the eager graph.
 */
import type { SupportedLanguages } from '@pierre/diffs'
import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import type { ReactNode } from 'react'

import type { DiffSource } from '../../model.ts'
import type { ChangeCounts, DiffArrangement, DiffRelation, DiffSide } from './contract.ts'
import { DiffFrame, useDiffArrangement } from './DiffFrame.tsx'
import type { PierreDiffProps } from './PierreDiff.tsx'
import { diffSequence } from './TextDiff.tsx'

export type { PierreDiffProps, PierreLineDiff } from './PierreDiff.tsx'

/** Code diff model: changed line totals from contents (or patch hunks). */
export interface CodeDiffModel {
  readonly counts: ChangeCounts
  readonly identical: boolean
  readonly path: string
}

/** Lines without a phantom final empty line for a trailing newline. */
const lines = (contents: string): readonly string[] => {
  if (contents === '') return []
  const parts = contents.split('\n')
  if (parts[parts.length - 1] === '') parts.pop()
  return parts
}

/** `@@ -a[,b] +c[,d] @@`: captures the old and new line counts (absent means 1). */
const hunkHeader = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/

/** Count actual additions/removals, not unchanged lines, from the same source pierre renders. */
export const codeDiffModel = (source: DiffSource): CodeDiffModel => {
  if (source._tag === 'files') {
    const before = lines(source.oldContents)
    const after = lines(source.newContents)
    const runs = diffSequence(before, after, (line) => line)
    let added = 0
    let removed = 0
    for (const run of runs) {
      if (run._tag === 'added') added += run.bEnd - run.bStart
      if (run._tag === 'removed') removed += run.aEnd - run.aStart
    }
    return {
      counts: { added, removed },
      identical: source.oldContents === source.newContents,
      path: source.path,
    }
  }
  let added = 0
  let removed = 0
  let path = 'patch'
  let removedPath: string | undefined
  // Lines still owed by the current hunk, from its `@@ -a,b +c,d @@` header. Content lines are
  // consumed by these counts, so a removed `---` or added `+++` line is never read as a header.
  let oldLeft = 0
  let newLeft = 0
  for (const line of source.patch.split('\n')) {
    if (oldLeft > 0 || newLeft > 0) {
      const marker = line[0]
      // Some tools strip the single space of an empty context line.
      if (marker === ' ' || line === '') {
        oldLeft--
        newLeft--
        continue
      }
      if (marker === '-') {
        removed++
        oldLeft--
        continue
      }
      if (marker === '+') {
        added++
        newLeft--
        continue
      }
      if (marker === '\\') continue
      // A truncated hunk: the line is not hunk content, so read it as a header below.
      oldLeft = 0
      newLeft = 0
    }
    const hunk = hunkHeader.exec(line)
    if (hunk !== null) {
      oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1])
      newLeft = hunk[2] === undefined ? 1 : Number(hunk[2])
    } else if (line.startsWith('--- a/')) removedPath = line.slice(6)
    else if (line.startsWith('+++ b/')) path = line.slice(6)
    else if (line.startsWith('+++ /dev/null') && removedPath !== undefined) path = removedPath
  }
  return { counts: { added, removed }, identical: added === 0 && removed === 0, path }
}

// --- shared pierre renderer ---

const LazyPierreDiff = React.lazy(() =>
  import('./PierreDiff.tsx').then((module) => ({ default: module.PierreDiff })),
)

/**
 * `@pierre/diffs` with Vista's registered themes, loaded on demand. File pairs go through
 * `MultiFileDiff` so pierre computes real hunks (unchanged stretches fold); patches go through
 * `PatchDiff`.
 */
export const PierreDiff = (props: PierreDiffProps) => (
  <React.Suspense fallback={<div {...stylex.props(styles.loading)}>Loading diff renderer…</div>}>
    <LazyPierreDiff {...props} />
  </React.Suspense>
)

// --- lens ---

/** Props for the code lens; `source` is the existing Vista `DiffSource` union. */
export interface CodeDiffProps {
  readonly id: string
  readonly title: ReactNode
  readonly before: DiffSide
  readonly after: DiffSide
  readonly source: DiffSource
  /** Defaults to `temporal`; `peer` presents the sides as A vs B. */
  readonly relation?: DiffRelation
  /** Override pierre's language inference from the path (e.g. an extension it does not know). */
  readonly lang?: SupportedLanguages
  readonly arrangement?: DiffArrangement
  readonly defaultArrangement?: DiffArrangement
  readonly nested?: boolean
  readonly collapsed?: boolean
}

/** Frame body: follows the enclosing frame's arrangement. */
const CodeDiffBody = ({
  source,
  lang,
}: {
  readonly source: DiffSource
  readonly lang: SupportedLanguages | undefined
}) => {
  const arrangement = useDiffArrangement()
  return (
    <PierreDiff
      source={source}
      arrangement={arrangement}
      {...(lang === undefined ? {} : { lang })}
    />
  )
}

/** Code lens view: semantic counts/frame around a pierre diff driven by the frame arrangement. */
export const CodeDiff = ({
  id,
  title,
  before,
  after,
  source,
  relation,
  lang,
  arrangement,
  defaultArrangement,
  nested = false,
  collapsed,
}: CodeDiffProps) => {
  const model = React.useMemo(() => codeDiffModel(source), [source])
  return (
    <DiffFrame
      id={id}
      title={title}
      lens="code"
      before={before}
      after={after}
      counts={model.counts}
      nested={nested}
      {...(relation === undefined ? {} : { relation })}
      {...(arrangement === undefined ? {} : { arrangement })}
      {...(defaultArrangement === undefined ? {} : { defaultArrangement })}
      {...(collapsed === undefined ? {} : { collapsed })}
    >
      <CodeDiffBody source={source} lang={lang} />
    </DiffFrame>
  )
}

const styles = stylex.create({
  loading: {
    margin: 0,
    padding: '0.75rem',
    color: tokens['--ds-gray-800'],
    fontSize: '0.82rem',
  },
})
