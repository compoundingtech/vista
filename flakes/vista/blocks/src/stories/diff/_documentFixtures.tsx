/**
 * Synthetic document and hierarchy fixtures shared by the DocumentTree stories and the
 * DocumentDiff / TreeDiff explorations. PDF previews are inline SVG; no real documents.
 */
import type { DiffSide } from '../../blocks/diff/contract.ts'
import type { DocBlock, DocSnapshot, EmbedBlock } from '../../blocks/diff/DocumentDiff.tsx'
import { ImageDiff } from '../../blocks/diff/ImageDiff.tsx'
import type { TreeSnapshot } from '../../blocks/diff/TreeDiff.tsx'
import { scan } from './_imageFixtures.ts'

/** Observed side: the workspace as the office scanner left it at 10:00. */
export const captured: DiffSide = {
  label: 'Before · capture 1',
  provenance: 'Synthetic workspace snapshot, 10:00',
  basis: 'observed',
}
/** Projected side: the same workspace four minutes later, as the dry run would leave it. */
export const proposed: DiffSide = {
  label: 'After · migration preview',
  provenance: 'Synthetic dry-run projection, 10:04',
  basis: 'projected',
}

/** `renderEmbed` slot: a changed embed with render previews nests an image lens over its pages. */
export const renderEmbedPreviews = (before: EmbedBlock, after: EmbedBlock) =>
  before.preview && after.preview ? (
    <ImageDiff
      title={`${after.name} · page 1`}
      before={captured}
      after={proposed}
      beforeImage={{
        src: before.preview,
        alt: `${before.name} before`,
        contentHash: before.fingerprint,
      }}
      afterImage={{
        src: after.preview,
        alt: `${after.name} after`,
        contentHash: after.fingerprint,
      }}
      nested
    />
  ) : undefined

/** First page of the receipt PDF as rendered before / after the rescan. */
export const receiptPageBefore = scan('RECEIVED')
/** Rescanned first page: the RECEIVED stamp becomes a VERIFIED one, so the image lens has real pixels to move. */
export const receiptPageAfter = scan('VERIFIED', '#0f766e')

const thumbnail = scan('THUMB', '#6d28d9').src

const history: readonly DocBlock[] = [
  { _tag: 'heading', id: 'r-history', level: 2, text: 'History' },
  { _tag: 'listItem', id: 'r-h1', style: 'numbered', text: 'Captured by the office scanner' },
  { _tag: 'listItem', id: 'r-h2', style: 'numbered', text: 'Queued for OCR' },
  { _tag: 'listItem', id: 'r-h3', style: 'numbered', text: 'Linked to the March card statement' },
  { _tag: 'listItem', id: 'r-h4', style: 'numbered', text: 'Assigned to the finance inbox' },
]

/** Receipt with an OCR typo ("TotaI"), a flagged-confidence callout, an unchecked todo and a scanned PDF embed. */
export const receiptBefore: DocSnapshot = {
  title: 'Cafe receipt · 2024-03-18',
  location: ['Finance', 'Inbox'],
  properties: { Status: 'Needs review', Vendor: 'Fictional Cafe', Total: '$18.40', Year: '2024' },
  blocks: [
    { _tag: 'heading', id: 'r-heading', level: 1, text: 'Receipt' },
    { _tag: 'paragraph', id: 'r-intro', text: 'Paid at Fictional Cafe on 18 March 2024.' },
    { _tag: 'callout', id: 'r-callout', label: 'OCR', text: 'Imported from a scanned receipt.' },
    { _tag: 'paragraph', id: 'r-ocr-old', text: 'Item 1 Coffee 14.40  Tip 4.00  TotaI 18.40' },
    { _tag: 'paragraph', id: 'r-ocr-warning', text: 'OCR flagged 2 low-confidence characters.' },
    {
      _tag: 'embed',
      id: 'r-pdf',
      media: 'pdf',
      name: 'receipt-scan.pdf',
      src: 'https://files.example.org/synthetic/receipt-scan-v1.pdf',
      preview: receiptPageBefore.src,
      fingerprint: 'a17c44bd90',
      meta: '1 page · original scan',
    },
    {
      _tag: 'embed',
      id: 'r-thumb',
      media: 'image',
      name: 'receipt-thumb.png',
      src: thumbnail,
      fingerprint: '5e0d11c2aa',
    },
    {
      _tag: 'toggle',
      id: 'r-notes',
      text: 'Review notes',
      children: [
        {
          _tag: 'todo',
          id: 'r-todo',
          checked: false,
          text: 'Verify line items against card statement',
        },
        { _tag: 'listItem', id: 'r-note-1', style: 'bulleted', text: 'Tax included in total' },
        {
          _tag: 'listItem',
          id: 'r-note-2',
          style: 'bulleted',
          text: 'Filed under travel expenses',
        },
      ],
    },
    ...history,
    { _tag: 'custom', id: 'r-quality', customType: 'confidence', signature: 'OCR confidence 0.68' },
  ],
}

/** The same receipt re-OCR'd: corrected totals, blocks reordered, PDF replaced, a Category property added, the todo ticked and a note on the unchanged thumbnail. */
export const receiptAfter: DocSnapshot = {
  title: 'Cafe receipt · 2024-03-18',
  location: ['Finance', 'Archive', '2024'],
  properties: {
    Status: 'Verified',
    Vendor: 'Fictional Cafe',
    Total: '$18.40',
    Year: '2024',
    Category: 'Meals',
  },
  blocks: [
    { _tag: 'heading', id: 'r-heading', level: 1, text: 'Receipt' },
    { _tag: 'paragraph', id: 'r-intro', text: 'Paid at Fictional Cafe on 18 March 2024.' },
    { _tag: 'paragraph', id: 'r-ocr-new', text: 'Item 1 Coffee $14.40  Tip $4.00  Total $18.40' },
    {
      _tag: 'embed',
      id: 'r-pdf',
      media: 'pdf',
      name: 'receipt-scan.pdf',
      src: 'https://files.example.org/synthetic/receipt-scan-v2.pdf',
      preview: receiptPageAfter.src,
      fingerprint: 'd9e120ab4f',
      meta: '1 page · rescan',
    },
    { _tag: 'callout', id: 'r-callout', label: 'OCR', text: 'Reprocessed from a cleaner scan.' },
    {
      _tag: 'embed',
      id: 'r-thumb',
      media: 'image',
      name: 'receipt-thumb.png',
      src: thumbnail,
      fingerprint: '5e0d11c2aa',
      note: 'thumbnail regenerated from the rescan; pixels identical',
    },
    {
      _tag: 'toggle',
      id: 'r-notes',
      text: 'Review notes',
      children: [
        {
          _tag: 'todo',
          id: 'r-todo',
          checked: true,
          text: 'Verify line items against card statement',
        },
        { _tag: 'listItem', id: 'r-note-1', style: 'bulleted', text: 'Tax included in total' },
        { _tag: 'listItem', id: 'r-note-2', style: 'bulleted', text: 'Filed under meals' },
        {
          _tag: 'listItem',
          id: 'r-note-3',
          style: 'bulleted',
          text: 'Card statement matched on 2 April',
        },
      ],
    },
    ...history,
    { _tag: 'custom', id: 'r-quality', customType: 'confidence', signature: 'OCR confidence 0.97' },
  ],
}

/** Research bundle with all three studies written inline as headed paragraphs. */
export const splitBefore: DocSnapshot = {
  title: 'Research bundle',
  location: ['Projects', 'Inbox'],
  properties: { Status: 'Draft', Pages: '1' },
  blocks: [
    { _tag: 'heading', id: 's-heading', level: 1, text: 'Research bundle' },
    {
      _tag: 'paragraph',
      id: 's-intro',
      text: 'Three independent studies were originally filed together.',
    },
    { _tag: 'heading', id: 's-a', level: 2, text: 'Study A · pigments' },
    { _tag: 'paragraph', id: 's-a-body', text: 'Red and blue pigments were compared in daylight.' },
    { _tag: 'heading', id: 's-b', level: 2, text: 'Study B · fibers' },
    {
      _tag: 'paragraph',
      id: 's-b-body',
      text: 'Cotton and wool fibers were compared after washing.',
    },
    { _tag: 'heading', id: 's-c', level: 2, text: 'Study C · binders' },
    {
      _tag: 'paragraph',
      id: 's-c-body',
      text: 'Water-based binders performed differently under heat.',
    },
  ],
}

/** Same bundle after filing: the three studies become child pages and the inline prose is dropped. */
export const splitAfter: DocSnapshot = {
  title: 'Research bundle · index',
  location: ['Projects', 'Research'],
  properties: { Status: 'Organized', Pages: '4' },
  blocks: [
    { _tag: 'heading', id: 's-heading', level: 1, text: 'Research bundle' },
    {
      _tag: 'paragraph',
      id: 's-intro',
      text: 'Three independent studies now have their own pages.',
    },
    { _tag: 'childPage', id: 's-child-a', title: 'Study A · pigments' },
    { _tag: 'childPage', id: 's-child-b', title: 'Study B · fibers' },
    { _tag: 'childPage', id: 's-child-c', title: 'Study C · binders' },
  ],
}

/** After-image only: a page that exists solely on the projected side. */
export const addOnly: DocSnapshot = {
  title: 'New project note',
  blocks: [
    { _tag: 'heading', id: 'add-head', level: 1, text: 'New project note' },
    { _tag: 'paragraph', id: 'add-body', text: 'This page was created by the migration.' },
  ],
}
/** Before-image only: a titled but empty page, so the added case has something to attach to. */
export const emptyDoc: DocSnapshot = { title: 'New project note', blocks: [] }

const batchMeta = 'batch-0321.pdf · 3 pages'
const templates: TreeSnapshot = [
  {
    id: 'templates',
    kind: 'folder',
    name: 'Templates',
    children: [
      { id: 'tpl-meeting', kind: 'page', name: 'Meeting notes' },
      { id: 'tpl-weekly', kind: 'page', name: 'Weekly review' },
      { id: 'tpl-trip', kind: 'page', name: 'Trip checklist' },
    ],
  },
]
const vendors = { id: 'vendors', kind: 'database', name: 'Vendors', meta: '14 rows' } as const

/** Workspace before the migration: receipt loose in Finance/Inbox, scanner batch and bundle still unexpanded. */
export const treeBefore: TreeSnapshot = [
  {
    id: 'root',
    kind: 'folder',
    name: 'Workspace',
    children: [
      {
        id: 'finance',
        kind: 'folder',
        name: 'Finance',
        children: [
          {
            id: 'inbox',
            kind: 'folder',
            name: 'Inbox',
            children: [
              {
                id: 'receipt',
                kind: 'page',
                name: 'Cafe receipt · 2024-03-18',
                href: 'https://notion.example.org/receipt',
              },
              { id: 'statement', kind: 'page', name: 'March card statement' },
              { id: 'batch', kind: 'pdf', name: 'Scanner batch 2024-03-21', meta: batchMeta },
            ],
          },
          {
            id: 'archive',
            kind: 'folder',
            name: 'Archive',
            children: [{ id: 'year', kind: 'folder', name: '2024' }, vendors],
          },
        ],
      },
      {
        id: 'projects',
        kind: 'folder',
        name: 'Projects',
        children: [
          {
            id: 'research',
            kind: 'folder',
            name: 'Research',
            children: [{ id: 'bundle', kind: 'page', name: 'Research bundle' }],
          },
          ...templates,
        ],
      },
    ],
  },
]

/** Workspace after: receipt moved into Archive/2024, the scanner batch split into three receipts, the bundle split into three studies. */
export const treeAfter: TreeSnapshot = [
  {
    id: 'root',
    kind: 'folder',
    name: 'Workspace',
    children: [
      {
        id: 'finance',
        kind: 'folder',
        name: 'Finance',
        children: [
          {
            id: 'inbox',
            kind: 'folder',
            name: 'Inbox',
            children: [{ id: 'statement', kind: 'page', name: 'March card statement' }],
          },
          {
            id: 'archive',
            kind: 'folder',
            name: 'Archive',
            children: [
              {
                id: 'year',
                kind: 'folder',
                name: '2024',
                children: [
                  {
                    id: 'receipt',
                    kind: 'page',
                    name: 'Cafe receipt · 2024-03-18',
                    href: 'https://notion.example.org/receipt',
                  },
                  {
                    id: 'rcpt-a',
                    kind: 'page',
                    name: 'Bakery receipt · 03-19',
                    meta: batchMeta,
                    splitFrom: 'batch',
                  },
                  {
                    id: 'rcpt-b',
                    kind: 'page',
                    name: 'Taxi receipt · 03-20',
                    meta: batchMeta,
                    splitFrom: 'batch',
                  },
                  {
                    id: 'rcpt-c',
                    kind: 'page',
                    name: 'Hardware receipt · 03-21',
                    meta: batchMeta,
                    splitFrom: 'batch',
                  },
                ],
              },
              vendors,
            ],
          },
        ],
      },
      {
        id: 'projects',
        kind: 'folder',
        name: 'Projects',
        children: [
          {
            id: 'research',
            kind: 'folder',
            name: 'Research',
            children: [
              {
                id: 'bundle',
                kind: 'page',
                name: 'Research bundle · index',
                children: [
                  { id: 'study-a', kind: 'page', name: 'Study A · pigments', splitFrom: 'bundle' },
                  { id: 'study-b', kind: 'page', name: 'Study B · fibers', splitFrom: 'bundle' },
                  { id: 'study-c', kind: 'page', name: 'Study C · binders', splitFrom: 'bundle' },
                ],
              },
            ],
          },
          ...templates,
        ],
      },
    ],
  },
]
