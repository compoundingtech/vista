/**
 * `SemanticDiff`: the data-first entry point agents author. Every story renders the diff and,
 * below it, the exact plain-data props (collapsed) so reviewers see what was authored:
 * no lens components, no render callbacks, only tagged data.
 */
import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import { Button, Disclosure, DisclosurePanel } from 'react-aria-components'

import type { DiffSide } from '../../blocks/diff/contract.ts'
import { SemanticDiff, type SemanticDiffProps } from '../../blocks/diff/SemanticDiff.tsx'
import type { DiffSubject } from '../../blocks/diff/subject.ts'
import type { TraceSpan } from '../../model.ts'
import { receiptAfter, receiptBefore, treeAfter, treeBefore } from './_documentFixtures.tsx'
import { blueprint, invoice, longAfter, longBefore, scan } from './_imageFixtures.ts'

const observed: DiffSide = {
  label: 'Before',
  basis: 'observed',
  provenance: 'Synthetic capture · 09:12 UTC',
}
const projected: DiffSide = {
  label: 'After',
  basis: 'projected',
  provenance: 'Synthetic dry run · 09:16 UTC',
}

// --- authored data display ---

/** Long strings (data URLs, OCR) are shortened so the literal stays readable. */
const authoredJson = (props: SemanticDiffProps): string =>
  JSON.stringify(
    props,
    (_key, value: unknown) =>
      typeof value === 'string' && value.length > 96
        ? `${value.slice(0, 56)}… (${value.length} chars)`
        : value,
    2,
  )

const Showcase = (props: SemanticDiffProps) => (
  <div {...stylex.props(styles.page)}>
    <SemanticDiff {...props} />
    <Disclosure {...stylex.props(styles.authored)}>
      {({ isExpanded }) => (
        <>
          <Button slot="trigger" {...stylex.props(styles.trigger)}>
            <span aria-hidden>{isExpanded ? '▾' : '▸'}</span> Authored data
          </Button>
          <DisclosurePanel>
            <pre {...stylex.props(styles.code)}>{authoredJson(props)}</pre>
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  </div>
)

const meta = {
  title: 'Vista/Blocks/Diff/SemanticDiff',
  component: SemanticDiff,
  render: (args) => <Showcase {...args} />,
  argTypes: {
    before: { control: false },
    after: { control: false },
    defaultArrangement: { control: 'inline-radio', options: ['unified', 'split'] },
    relation: { control: 'inline-radio', options: ['temporal', 'peer'] },
  },
} satisfies Meta<typeof SemanticDiff>

export default meta
type Story = StoryObj<typeof meta>

// --- one story per tag ---

/** `image`: equal content hashes would skip pixel work; here a one-cent change lights up. */
export const SingleImage: Story = {
  args: {
    id: 'semantic-image',
    title: 'Invoice render',
    before: {
      side: observed,
      subject: { _tag: 'image', ...invoice('120.00'), contentHash: 'sha256:invoice-v1' },
    },
    after: {
      side: projected,
      subject: { _tag: 'image', ...invoice('120.01'), contentHash: 'sha256:invoice-v2' },
    },
  },
}

/** `pageSet`: hashed pages align without pixel work; only differing pages are compared. */
export const PageSet: Story = {
  args: {
    id: 'semantic-page-set',
    title: 'Harbor survey export',
    before: { side: observed, subject: { _tag: 'pageSet', pages: longBefore } },
    after: { side: projected, subject: { _tag: 'pageSet', pages: longAfter } },
  },
}

const ocrBefore = [
  'INTAKE MANIFEST 0421',
  'Carrier: Northwind Freight',
  'Parcels: 12',
  'Bay: 4',
  'Seal: 88-1204 intact',
  'Received by: A. Reader',
  'Notes: two cartons damp on arrival',
].join('\n')
const ocrAfter = [
  'INTAKE MANIFEST 0421',
  'Carrier: Northwind Freight',
  'Parcels: 14',
  'Bay: 7',
  'Seal: 88-1204 intact',
  'Received by: A. Reader, B. Clerk',
  'Notes: two cartons damp on arrival',
].join('\n')

/** `text`, default `shape: 'lines'`: OCR renders line by line through `@pierre/diffs`. */
export const TextLines: Story = {
  args: {
    id: 'semantic-text-lines',
    title: 'Manifest OCR · re-extracted',
    before: { side: observed, subject: { _tag: 'text', text: ocrBefore } },
    after: { side: projected, subject: { _tag: 'text', text: ocrAfter } },
  },
}

/** `text` with `shape: 'prose'`: a paragraph edit renders with inline word marks. */
export const TextProse: Story = {
  args: {
    id: 'semantic-text-prose',
    title: 'Intake procedure',
    before: {
      side: observed,
      subject: {
        _tag: 'text',
        shape: 'prose',
        text: 'The archive receives a shipment every Tuesday. A staff member checks each label against the ledger before placing the parcel on a shelf.',
      },
    },
    after: {
      side: projected,
      subject: {
        _tag: 'text',
        shape: 'prose',
        text: 'The archive receives a shipment every Thursday. A staff member checks each label against the ledger before placing the parcel in a numbered bay.',
      },
    },
  },
}

/** `code`: file contents through `@pierre/diffs`; `lang` overrides inference from the path. */
export const Code: Story = {
  args: {
    id: 'semantic-code',
    title: 'src/intake.ts',
    before: {
      side: observed,
      subject: {
        _tag: 'code',
        path: 'src/intake.ts',
        lang: 'typescript',
        contents:
          'export function inspectParcel(parcel: Parcel) {\n  const shelf = parcel.shelf ?? "overflow"\n  return `Inspect ${parcel.id} at ${shelf}`\n}\n',
      },
    },
    after: {
      side: projected,
      subject: {
        _tag: 'code',
        path: 'src/intake.ts',
        lang: 'typescript',
        contents:
          'export function inspectParcel(parcel: Parcel) {\n  const bay = parcel.bay ?? "receiving"\n  return `Inspect ${parcel.id} at ${bay}`\n}\n',
      },
    },
  },
}

/** `record`: typed fields, one row per leaf path. */
export const PlainRecord: Story = {
  args: {
    id: 'semantic-record',
    title: 'Parcel properties',
    before: {
      side: observed,
      subject: {
        _tag: 'record',
        fields: {
          Status: { _tag: 'text', value: 'Draft' },
          Copies: { _tag: 'number', value: 2 },
          Archived: { _tag: 'boolean', value: false },
          Received: { _tag: 'date', value: '2026-09-10' },
          Tags: {
            _tag: 'list',
            items: [
              { _tag: 'text', value: 'operations' },
              { _tag: 'text', value: 'incoming' },
            ],
          },
        },
      },
    },
    after: {
      side: projected,
      subject: {
        _tag: 'record',
        fields: {
          Status: { _tag: 'text', value: 'Published' },
          Copies: { _tag: 'number', value: 3 },
          Archived: { _tag: 'boolean', value: false },
          Received: { _tag: 'date', value: '2026-09-10' },
          Tags: {
            _tag: 'list',
            items: [
              { _tag: 'text', value: 'operations' },
              { _tag: 'text', value: 'reviewed' },
            ],
          },
          Portal: { _tag: 'url', value: 'https://example.org/intake', label: 'Intake portal' },
        },
      },
    },
  },
}

/** `document`: blocks, location and (typed) properties; embeds without a subject render as cards. */
export const PlainDocument: Story = {
  args: {
    id: 'semantic-document',
    title: 'Cafe receipt',
    before: {
      side: observed,
      subject: {
        _tag: 'document',
        title: receiptBefore.title,
        location: ['Finance', 'Inbox'],
        properties: {
          Status: { _tag: 'text', value: 'Needs review' },
          Vendor: { _tag: 'text', value: 'Fictional Cafe' },
          Total: { _tag: 'number', value: 18.4, unit: 'USD' },
        },
        blocks: receiptBefore.blocks,
      },
    },
    after: {
      side: projected,
      subject: {
        _tag: 'document',
        title: receiptAfter.title,
        location: ['Finance', 'Archive', '2024'],
        properties: {
          Status: { _tag: 'text', value: 'Verified' },
          Vendor: { _tag: 'text', value: 'Fictional Cafe' },
          Total: { _tag: 'number', value: 18.4, unit: 'USD' },
          Category: { _tag: 'text', value: 'Meals' },
        },
        blocks: receiptAfter.blocks,
      },
    },
  },
}

/** `tree`: nodes matched by stable id; moves and splits link across both trees. */
export const Tree: Story = {
  args: {
    id: 'semantic-tree',
    title: 'Workspace hierarchy',
    before: { side: observed, subject: { _tag: 'tree', roots: treeBefore } },
    after: { side: projected, subject: { _tag: 'tree', roots: treeAfter } },
  },
}

const ms = (value: number) => String(BigInt(value) * 1_000_000n)
const span = (
  spanId: string,
  parentSpanId: string,
  serviceName: string,
  name: string,
  start: number,
  end: number,
): TraceSpan => ({
  spanId,
  parentSpanId,
  serviceName,
  name,
  startTimeUnixNano: ms(start),
  endTimeUnixNano: ms(end),
})

/** `trace`: spans aligned by structural path; the query regresses and a cache span appears. */
export const Trace: Story = {
  args: {
    id: 'semantic-trace',
    title: 'Catalog request',
    before: {
      side: observed,
      subject: {
        _tag: 'trace',
        traceId: 'synthetic-before',
        spans: [
          span('root-a', '', 'gateway', 'GET /catalog', 0, 150),
          span('auth-a', 'root-a', 'identity', 'check session', 7, 25),
          span('query-a', 'root-a', 'catalog', 'SELECT products', 30, 100),
          span('render-a', 'root-a', 'gateway', 'render response', 110, 140),
        ],
      },
    },
    after: {
      side: projected,
      subject: {
        _tag: 'trace',
        traceId: 'synthetic-after',
        spans: [
          span('root-b', '', 'gateway', 'GET /catalog', 0, 360),
          span('auth-b', 'root-b', 'identity', 'check session', 7, 26),
          span('cache-b', 'root-b', 'cache', 'GET product index', 27, 38),
          span('query-b', 'root-b', 'catalog', 'SELECT products', 42, 320),
          span('render-b', 'root-b', 'gateway', 'render response', 325, 350),
        ],
      },
    },
  },
}

/** `diagram`: nodes by id, edges by endpoints; a cache is inserted between API and store. */
export const Diagram: Story = {
  args: {
    id: 'semantic-diagram',
    title: 'Catalog topology',
    before: {
      side: observed,
      subject: {
        _tag: 'diagram',
        nodes: [
          { id: 'edge', label: 'API gateway', group: 'edge' },
          { id: 'catalog', label: 'Catalog API', group: 'services' },
          { id: 'store', label: 'Product store', group: 'storage' },
        ],
        edges: [
          { from: 'edge', to: 'catalog', label: 'HTTP' },
          { from: 'catalog', to: 'store', label: 'query' },
        ],
      },
    },
    after: {
      side: projected,
      subject: {
        _tag: 'diagram',
        nodes: [
          { id: 'edge', label: 'API gateway', group: 'edge' },
          { id: 'catalog', label: 'Catalog API', group: 'services' },
          { id: 'cache', label: 'Query cache', group: 'services' },
          { id: 'store', label: 'Product store', group: 'storage' },
        ],
        edges: [
          { from: 'edge', to: 'catalog', label: 'HTTP' },
          { from: 'catalog', to: 'cache', label: 'query' },
          { from: 'cache', to: 'store', label: 'miss' },
        ],
      },
    },
  },
}

// --- nesting decided by the data ---

/**
 * A document whose PDF embed carries a `pageSet` subject and whose properties are record
 * fields: the embed nests the page-set lens and the properties nest the record lens, with
 * nothing wired by the author.
 */
export const DocumentWithNestedSubjects: Story = {
  args: {
    id: 'semantic-document-nested',
    title: 'Harbor survey',
    before: {
      side: observed,
      subject: {
        _tag: 'document',
        title: 'Harbor survey · Q3',
        location: ['Projects', 'Harbor'],
        properties: {
          Status: { _tag: 'text', value: 'Draft' },
          Pages: { _tag: 'number', value: 3 },
          Reviewed: { _tag: 'boolean', value: false },
        },
        blocks: [
          { _tag: 'heading', id: 's-heading', level: 1, text: 'Harbor survey' },
          {
            _tag: 'paragraph',
            id: 's-intro',
            text: 'Quarterly inspection of berths one to three.',
          },
          {
            _tag: 'embed',
            id: 's-export',
            media: 'pdf',
            name: 'harbor-survey.pdf',
            meta: '3 pages',
            subject: { _tag: 'pageSet', pages: longBefore.slice(0, 3) },
          },
          {
            _tag: 'todo',
            id: 's-review',
            checked: false,
            text: 'Check berth depths against tolerance',
          },
        ],
      },
    },
    after: {
      side: projected,
      subject: {
        _tag: 'document',
        title: 'Harbor survey · Q3',
        location: ['Projects', 'Harbor'],
        properties: {
          Status: { _tag: 'text', value: 'Published' },
          Pages: { _tag: 'number', value: 4 },
          Reviewed: { _tag: 'boolean', value: true },
          Reviewer: { _tag: 'text', value: 'B. Clerk' },
        },
        blocks: [
          { _tag: 'heading', id: 's-heading', level: 1, text: 'Harbor survey' },
          { _tag: 'paragraph', id: 's-intro', text: 'Quarterly inspection of berths one to four.' },
          {
            _tag: 'embed',
            id: 's-export',
            media: 'pdf',
            name: 'harbor-survey.pdf',
            meta: '4 pages',
            subject: { _tag: 'pageSet', pages: longAfter.slice(0, 4) },
          },
          {
            _tag: 'todo',
            id: 's-review',
            checked: true,
            text: 'Check berth depths against tolerance',
          },
        ],
      },
    },
  },
}

const signature = (stamp: string, color: string, contentHash: string): DiffSubject => ({
  _tag: 'image',
  ...scan(stamp, color),
  contentHash,
})

/** A record field holding an `image` subject nests the image lens below the plain field rows. */
export const RecordWithImageField: Story = {
  args: {
    id: 'semantic-record-image',
    title: 'Delivery confirmation',
    before: {
      side: observed,
      subject: {
        _tag: 'record',
        fields: {
          Parcel: { _tag: 'text', value: 'PKT-0421' },
          Status: { _tag: 'text', value: 'Awaiting signature' },
          Signature: {
            _tag: 'subject',
            subject: signature('PENDING', '#475569', 'sha256:signature-v1'),
          },
        },
      },
    },
    after: {
      side: projected,
      subject: {
        _tag: 'record',
        fields: {
          Parcel: { _tag: 'text', value: 'PKT-0421' },
          Status: { _tag: 'text', value: 'Delivered' },
          Signature: {
            _tag: 'subject',
            subject: signature('SIGNED', '#166534', 'sha256:signature-v2'),
          },
        },
      },
    },
  },
}

// --- kind change and one-sided inputs ---

/** Different tags (`text` → `image`): a `kind changed` frame shows each side with its own lens. */
export const KindChange: Story = {
  args: {
    id: 'semantic-kind-change',
    title: 'Delivery proof',
    before: {
      side: observed,
      subject: {
        _tag: 'text',
        shape: 'prose',
        text: 'Signature pending: the courier noted a paper copy at the front desk.',
      },
    },
    after: { side: projected, subject: signature('SIGNED', '#166534', 'sha256:signature-v2') },
  },
}

/** `before.subject: null`: everything on the after side is added. */
export const AddedOnly: Story = {
  args: {
    id: 'semantic-added',
    title: 'New parcel',
    before: { side: observed, subject: null },
    after: {
      side: projected,
      subject: {
        _tag: 'record',
        fields: {
          Parcel: { _tag: 'text', value: 'PKT-0422' },
          Status: { _tag: 'text', value: 'Received' },
          Copies: { _tag: 'number', value: 1 },
        },
      },
    },
  },
}

/** `after.subject: null`: the before side is removed. */
export const RemovedOnly: Story = {
  args: {
    id: 'semantic-removed',
    title: 'Deleted floor plan',
    before: { side: observed, subject: { _tag: 'image', ...blueprint } },
    after: { side: projected, subject: null },
  },
}

const styles = stylex.create({
  page: {
    display: 'grid',
    gap: 12,
  },
  authored: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: 8,
    backgroundColor: tokens['--ds-background-200'],
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    paddingBlock: 8,
    paddingInline: 12,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-900'],
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    textAlign: 'start',
    cursor: 'pointer',
    outline: {
      default: 'none',
      ':focus-visible': `2px solid ${tokens['--ds-focus-color']}`,
    },
  },
  code: {
    margin: 0,
    paddingBlock: 8,
    paddingInline: 12,
    maxHeight: 420,
    overflow: 'auto',
    fontSize: '0.75rem',
    lineHeight: 1.5,
    color: tokens['--ds-gray-1000'],
  },
})
