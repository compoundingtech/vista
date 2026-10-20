import { describe, expect, it } from 'vitest'

import {
  compareSetDefault,
  compareSetModel,
  type ImageCandidate,
  type ImageVerdict,
} from './ImageDiff.tsx'
import { alignPageSets, pageSetDefault, pageSetModel, type PageImage } from './PageSetDiff.tsx'

const pending: ImageVerdict = { _tag: 'Pending' }
const changed: ImageVerdict = { _tag: 'Compared', kind: 'changed', ratio: 0.2, bytes: 'different' }
const same: ImageVerdict = { _tag: 'Compared', kind: 'unchanged', ratio: 0, bytes: 'different' }
const failed: ImageVerdict = { _tag: 'Failed', message: 'decode failed' }

const page = (id: string): PageImage => ({ src: `/${id}.png`, contentHash: id })

describe('page set default selection', () => {
  // Three pixel-compared pairs: every after page has different bytes.
  const pairs = alignPageSets(
    { pages: [page('a1'), page('b1'), page('c1')] },
    { pages: [page('a2'), page('b2'), page('c2')] },
  )
  const defaultIndex = (verdicts: readonly ImageVerdict[]) => {
    const model = pageSetModel(pairs, new Map(pairs.map((pair, i) => [pair.key, verdicts[i]!])))
    const selected = pageSetDefault(model.entries)
    return selected === undefined ? undefined : model.entries.indexOf(selected)
  }

  it('stays undecided while an earlier pair is pending, then never moves as later verdicts land', () => {
    expect(defaultIndex([pending, pending, pending])).toBeUndefined()
    // A later pair resolving first must not claim the default ahead of page 1.
    expect(defaultIndex([pending, changed, pending])).toBeUndefined()
    expect(defaultIndex([same, changed, pending])).toBe(1)
    expect(defaultIndex([same, changed, changed])).toBe(1)
  })

  it('falls back to the first page only when every pair settled unchanged', () => {
    expect(defaultIndex([same, same, pending])).toBeUndefined()
    expect(defaultIndex([same, same, same])).toBe(0)
  })

  it('treats a failed comparison as needing attention', () => {
    expect(defaultIndex([same, failed, changed])).toBe(1)
  })

  it('decides immediately from hash and presence without pixel work', () => {
    const known = alignPageSets(
      { pages: [page('a'), page('b')] },
      { pages: [page('a'), page('b'), page('c')] },
    )
    const model = pageSetModel(known, new Map())
    expect(pageSetDefault(model.entries)?.kind).toBe('added')
  })
})

describe('compare set default selection', () => {
  const candidates: readonly ImageCandidate[] = ['x', 'y', 'z'].map((id) => ({
    id,
    side: { label: id, basis: 'observed' },
    image: { src: `/${id}.png`, contentHash: id },
  }))
  const defaultId = (verdicts: readonly ImageVerdict[]) =>
    compareSetDefault(compareSetModel(candidates, verdicts).entries)?.candidate.id

  it('waits for earlier candidates instead of provisionally selecting the first one', () => {
    expect(defaultId([pending, pending, pending])).toBeUndefined()
    expect(defaultId([pending, changed, pending])).toBeUndefined()
    expect(defaultId([same, changed, pending])).toBe('y')
    expect(defaultId([same, changed, changed])).toBe('y')
  })

  it('skips failed candidates and falls back to the first when none differs', () => {
    expect(defaultId([failed, same, changed])).toBe('z')
    expect(defaultId([same, failed, same])).toBe('x')
  })
})
