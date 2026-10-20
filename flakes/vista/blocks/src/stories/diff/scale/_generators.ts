import type { DiagramGraph } from '../../../blocks/diff/DiagramDiff.tsx'
import type { DocBlock, DocSnapshot } from '../../../blocks/diff/DocumentDiff.tsx'
import type { ImageSource } from '../../../blocks/diff/ImageDiff.tsx'
import type { PageImage } from '../../../blocks/diff/PageSetDiff.tsx'
import type { RecordEntries, RecordValue } from '../../../blocks/diff/RecordDiff.tsx'
import type { TreeNode, TreeSnapshot } from '../../../blocks/diff/TreeDiff.tsx'
import type { TraceData, TraceSpan } from '../../../model.ts'

/** A fresh stream for each fixture: story order and React re-renders never alter the data. */
const random = (seed: number) => () => {
  seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
  return seed / 0x1_0000_0000
}

const vocabulary = Array.from(
  { length: 3_000 },
  (_, i) =>
    `${['shipment', 'archive', 'inspection', 'manifest', 'parcel', 'ledger'][i % 6]}${i.toString(36)}`,
)

/** Exactly 5,000 whitespace-delimited words, in one OCR paragraph. */
export const ocrPair = (editRate: number, seed = 7): { before: string; after: string } => {
  const next = random(seed)
  const before = Array.from(
    { length: 5_000 },
    () => vocabulary[Math.floor(next() * vocabulary.length)]!,
  )
  const after = before.map((word) => (next() < editRate ? `${word.slice(0, -1)}0` : word))
  return { before: before.join(' '), after: after.join(' ') }
}

/** `count` spans in a shallow tree; every fifth after-span runs 40% slower and occasional spans are renamed. */
export const tracePair = (count = 500): readonly [TraceData, TraceData] => {
  const make = (changed: boolean): TraceData => ({
    traceId: changed ? 'synthetic-after' : 'synthetic-before',
    spans: Array.from({ length: count }, (_, i): TraceSpan => {
      const start = 1_000_000_000_000_000n + BigInt(i) * 1_000_000n
      const duration = BigInt(
        Math.round((1 + (i % 7)) * 1_000_000 * (changed && i % 5 === 0 ? 1.4 : 1)),
      )
      return {
        spanId: `span-${i}`,
        parentSpanId: i === 0 ? '' : `span-${Math.floor((i - 1) / 5)}`,
        name: `${changed && i % 50 === 7 ? 'renamed' : 'operation'}.${i % 40}`,
        serviceName: `service-${i % 6}`,
        startTimeUnixNano: String(start),
        endTimeUnixNano: String(start + duration),
      }
    }),
  })
  return [make(false), make(true)]
}

/** Stable IDs with a different valid parent for every twentieth moved node. */
export const treePair = (count = 1_000): readonly [TreeSnapshot, TreeSnapshot] => {
  const make = (changed: boolean): TreeSnapshot => {
    const nodes: { id: string; name: string; kind: string; children: TreeNode[] }[] = Array.from(
      { length: count },
      (_, i) => ({
        id: `node-${i}`,
        name: `${changed && i % 20 === 3 ? 'Renamed' : 'Node'} ${i}`,
        kind: 'folder',
        children: [],
      }),
    )
    const roots: TreeNode[] = []
    nodes.forEach((node, i) => {
      const parent =
        i === 0 ? -1 : changed && i % 20 === 5 ? Math.floor(i / 7) : Math.floor((i - 1) / 4)
      if (parent < 0) roots.push(node)
      else nodes[parent]!.children.push(node)
    })
    return roots
  }
  return [make(false), make(true)]
}

/** SVG describes a 2480×3508 raster-sized page without eagerly allocating ~35 MB per page. */
export const a4Page = (
  index: number,
  revision: number,
  width = 2_480,
  height = 3_508,
): PageImage => {
  const changed = revision !== 0
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 2480 3508">
    <rect width="2480" height="3508" fill="white"/>
    <text x="180" y="270" font-size="72" font-family="sans-serif" fill="#172554">Archive report · page ${index + 1}</text>
    <path d="M180 360h2120M180 540h2120M180 720h2120M180 900h2120M180 1080h2120M180 1260h2120M180 1440h2120M180 1620h2120M180 1800h2120M180 1980h2120M180 2160h2120M180 2340h2120M180 2520h2120M180 2700h2120M180 2880h2120M180 3060h2120" stroke="#cbd5e1" stroke-width="24"/>
    ${changed ? '<rect x="1600" y="420" width="600" height="250" fill="#c2410c"/>' : ''}
  </svg>`
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`,
    alt: `Synthetic archive page ${index + 1}${changed ? ' revised' : ''}`,
    label: `Page ${index + 1}`,
    contentHash: `archive:${width}x${height}:${index}:${revision}`,
  }
}

/** `count` A4 pages; every `changedEvery`-th after-page is revised, so its differing hash forces a pixel verdict. */
export const pageSetPair = (
  count = 200,
  offset = 0,
  width = 2_480,
  height = 3_508,
  changedEvery = 1,
): readonly [readonly PageImage[], readonly PageImage[]] => {
  const before = Array.from({ length: count }, (_, i) => a4Page(offset + i, 0, width, height))
  const after = before.map((page, i) =>
    i % changedEvery === 0 ? a4Page(offset + i, 1, width, height) : page,
  )
  return [before, after]
}
/** One A4 page against its revised twin, so the pair differs only in the orange block. */
export const imagePair = (index: number): readonly [ImageSource, ImageSource] => [
  a4Page(index, 0),
  a4Page(index, 1),
]

/** `count` blocks of mixed headings, paragraphs and PDF embeds; every ninth paragraph gains a trailing clause and every thirtieth embed is re-scanned. */
export const documentPair = (count = 300): readonly [DocSnapshot, DocSnapshot] => {
  const make = (changed: boolean): DocSnapshot => ({
    title: 'Archive intake handbook',
    location: ['Archive', 'Operations'],
    blocks: Array.from({ length: count }, (_, i): DocBlock => {
      if (i % 15 === 0)
        return {
          _tag: 'embed',
          id: `embed-${i}`,
          media: 'pdf',
          name: `Scan ${i}.pdf`,
          preview: a4Page(i, changed && i % 30 === 0 ? 1 : 0, 600, 848).src,
          fingerprint: `scan-${i}-${changed && i % 30 === 0 ? 1 : 0}`,
          caption: `Attached archive scan ${i}`,
        }
      if (i % 12 === 0)
        return { _tag: 'heading', id: `heading-${i}`, level: 2, text: `Intake section ${i / 12}` }
      return {
        _tag: 'paragraph',
        id: `paragraph-${i}`,
        text: `The receiving clerk verifies shipment ${i} against the archive ledger and records its storage bay${changed && i % 9 === 3 ? ' before filing the amended receipt' : ''}.`,
      }
    }),
  })
  return [make(false), make(true)]
}

/** `count` keyed rows where every seventh row after-side reports a different storage bay. */
export const recordPair = (count = 200): readonly [RecordEntries, RecordEntries] => {
  const make = (changed: boolean): RecordEntries =>
    Object.fromEntries(
      Array.from({ length: count }, (_, i): readonly [string, RecordValue] => [
        `intake-${String(i).padStart(3, '0')}`,
        { _tag: 'text', value: `Archive parcel ${i} · bay ${changed && i % 7 === 0 ? i + 1 : i}` },
      ]),
    )
  return [make(false), make(true)]
}

/** `count` nodes across six zones with `count - 1` edges; occasional labels migrate and edge types flip to `replica`. */
export const diagramPair = (count = 150): readonly [DiagramGraph, DiagramGraph] => {
  const make = (changed: boolean): DiagramGraph => ({
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `service-${i}`,
      label: `${changed && i % 19 === 3 ? 'Migrated' : 'Service'} ${i}`,
      group: `zone-${i % 6}`,
    })),
    edges: Array.from({ length: count - 1 }, (_, i) => ({
      from: `service-${Math.floor(i / 2)}`,
      to: `service-${i + 1}`,
      label: changed && i % 17 === 4 ? 'replica' : 'request',
    })),
  })
  return [make(false), make(true)]
}
