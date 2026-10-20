import { describe, expect, it } from 'vitest'

import { diffSubjectCounts, diffSubjectKind, subjectKey } from './SemanticDiff.tsx'
import type { DiffSubject, SubjectEmbedBlock } from './subject.ts'

const image = (src: string, contentHash?: string): DiffSubject => ({
  _tag: 'image',
  src,
  ...(contentHash === undefined ? {} : { contentHash }),
})

const pages = (...entries: readonly (readonly [string, string | undefined])[]): DiffSubject => ({
  _tag: 'pageSet',
  pages: entries.map(([src, contentHash]) =>
    contentHash === undefined ? { src } : { src, contentHash },
  ),
})

const recordWith = (subject: DiffSubject): DiffSubject => ({
  _tag: 'record',
  fields: { scan: { _tag: 'subject', subject } },
})

const docWithEmbed = (subject: DiffSubject, fingerprint?: string): DiffSubject => {
  const embed: SubjectEmbedBlock = {
    _tag: 'embed',
    id: 'receipt',
    media: 'pdf',
    name: 'receipt.pdf',
    subject,
    ...(fingerprint === undefined ? {} : { fingerprint }),
  }
  return { _tag: 'document', title: 'Receipt', blocks: [embed] }
}

describe('subjectKey (R92: content identity, never location)', () => {
  it('keys images and pages by contentHash alone, ignoring their URLs', () => {
    expect(subjectKey(image('/v1.png', 'aa'))).toBe(subjectKey(image('/v2.png', 'aa')))
    expect(subjectKey(pages(['/a/1.png', 'p1'], ['/a/2.png', 'p2']))).toBe(
      subjectKey(pages(['/b/1.png', 'p1'], ['/b/2.png', 'p2'])),
    )
    expect(subjectKey(pages(['/1.png', 'p1']))).not.toBe(subjectKey(pages(['/1.png', 'p9'])))
  })

  it('has no key for an unhashed image or page, at any depth', () => {
    expect(subjectKey(image('/same.png'))).toBeUndefined()
    expect(subjectKey(pages(['/1.png', 'p1'], ['/2.png', undefined]))).toBeUndefined()
    expect(subjectKey(recordWith(image('/same.png')))).toBeUndefined()
    expect(subjectKey(docWithEmbed(pages(['/1.png', undefined])))).toBeUndefined()
  })
})

describe('diffSubjectKind', () => {
  it('never calls an unhashed pair unchanged, even at the same URL', () => {
    expect(diffSubjectKind(image('/same.png'), image('/same.png'))).toBeUndefined()
    expect(
      diffSubjectKind(pages(['/same.png', undefined]), pages(['/same.png', undefined])),
    ).toBeUndefined()
    expect(
      diffSubjectKind(recordWith(image('/same.png')), recordWith(image('/same.png'))),
    ).toBeUndefined()
  })

  it('calls equal hashes unchanged whatever their URLs', () => {
    expect(diffSubjectKind(image('/v1.png', 'aa'), image('/v2.png', 'aa'))).toBe('unchanged')
    expect(
      diffSubjectKind(recordWith(image('/v1.png', 'aa')), recordWith(image('/v2.png', 'aa'))),
    ).toBe('unchanged')
  })
})

describe('document embeds holding subjects', () => {
  it('reports a changed nested subject even when the author fingerprint stayed the same', () => {
    const before = docWithEmbed(pages(['/v1/1.png', 'p1']), 'receipt-v1')
    const after = docWithEmbed(pages(['/v2/1.png', 'p2']), 'receipt-v1')
    expect(diffSubjectKind(before, after)).toBe('changed')
  })

  it('treats re-issued page URLs with equal hashes as the same embed', () => {
    const before = docWithEmbed(pages(['/v1/1.png', 'p1']))
    const after = docWithEmbed(pages(['/v2/1.png', 'p1']))
    expect(diffSubjectKind(before, after)).toBe('unchanged')
    expect(diffSubjectCounts(before, after).changed ?? 0).toBe(0)
  })

  it('surfaces an unhashed embed pair for comparison instead of calling it unchanged', () => {
    const subject = pages(['/same.png', undefined])
    expect(diffSubjectKind(docWithEmbed(subject), docWithEmbed(subject))).not.toBe('unchanged')
  })
})
