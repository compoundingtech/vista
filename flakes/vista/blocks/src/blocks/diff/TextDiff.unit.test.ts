import { describe, expect, it } from 'vitest'

import { pierreTextContents, textDiffModel, textDiffSummary } from './TextDiff.tsx'

describe('pierre text contents', () => {
  it('keeps source lines and indentation for the `lines` renderer', () => {
    const before = 'server:\n  port: 80\nclient:\n  port: 81'
    const after = 'server:\n  port: 80\nclient:\nport: 81'
    expect(pierreTextContents(before, 'pierre')).toBe(before)
    expect(pierreTextContents(after, 'pierre')).not.toBe(pierreTextContents(before, 'pierre'))
    // One source line stays one line, so pierre's line numbers match the source.
    expect(
      pierreTextContents('INFO start. Loaded 3 plugins. OK', 'pierre').split('\n'),
    ).toHaveLength(1)
  })

  it('reflows to one sentence per line only for the explicit prose-over-pierre renderer', () => {
    expect(pierreTextContents('INFO start. Loaded 3 plugins. OK', 'pierre-sentences')).toBe(
      'INFO start.\nLoaded 3 plugins.\nOK',
    )
  })
})

describe('text diff summary', () => {
  const clipAt = 10

  it('does not call texts identical when only their clipped prefixes match', () => {
    const before: string = 'same start, then A'
    const after: string = 'same start, then B'
    const model = textDiffModel(before.slice(0, clipAt), after.slice(0, clipAt))
    expect(model.identical).toBe(true)
    expect(textDiffSummary(model, { identical: before === after, clipAt })).toBe(
      'No changes in the first 10 characters; the texts differ after that',
    )
  })

  it('calls equal full inputs identical', () => {
    const text = 'same start, same end'
    const model = textDiffModel(text.slice(0, clipAt), text.slice(0, clipAt))
    expect(textDiffSummary(model, { identical: true, clipAt })).toBe('Identical text')
  })

  it('summarises word changes found in the compared text', () => {
    const model = textDiffModel('one two three', 'one four three five')
    expect(textDiffSummary(model, { identical: false, clipAt })).toBe('2 words added, 1 removed')
  })
})
