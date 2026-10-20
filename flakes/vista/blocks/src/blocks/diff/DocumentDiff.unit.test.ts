import { describe, expect, it } from 'vitest'

import { type DocBlock, type DocSnapshot, diffDocument } from './DocumentDiff.tsx'

const doc = (...blocks: DocBlock[]): DocSnapshot => ({ title: 'Doc', blocks })

describe('diffDocument embed identity (MED.BLK.DIFF-R92)', () => {
  const embed = (src: string, fingerprint?: string): DocBlock => ({
    id: 'e',
    _tag: 'embed',
    media: 'image',
    name: 'plan.png',
    src,
    ...(fingerprint === undefined ? {} : { fingerprint }),
  })

  it('treats equal fingerprints behind rotated URLs as the same file', () => {
    const model = diffDocument(
      doc(embed('https://files.example/plan.png?sig=1', 'sha256:aa')),
      doc(embed('https://files.example/plan.png?sig=2', 'sha256:aa')),
    )
    expect(model.rows[0]).toMatchObject({ kind: 'unchanged', contentChanged: false })
    expect(model.counts.changed).toBeUndefined()
  })

  it('reports different fingerprints behind one URL as a changed file', () => {
    const model = diffDocument(
      doc(embed('https://files.example/plan.png', 'sha256:aa')),
      doc(embed('https://files.example/plan.png', 'sha256:bb')),
    )
    expect(model.rows[0]).toMatchObject({ kind: 'changed', contentChanged: true })
  })

  it('matches id-less fingerprinted embeds across rotated URLs', () => {
    const idless = (src: string): DocBlock => ({
      _tag: 'embed',
      media: 'file',
      name: 'spec.pdf',
      src,
      fingerprint: 'sha256:cc',
    })
    const model = diffDocument(doc(idless('https://a/?sig=1')), doc(idless('https://a/?sig=2')))
    expect(model.rows.map((row) => row.kind)).toEqual(['unchanged'])
  })
})
