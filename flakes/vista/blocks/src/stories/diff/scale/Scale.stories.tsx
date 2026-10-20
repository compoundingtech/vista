import type { Meta, StoryObj } from '@storybook/react'
import * as React from 'react'

import { CodeDiff } from '../../../blocks/diff/CodeDiff.tsx'
import type { DiffSide } from '../../../blocks/diff/contract.ts'
import { DiagramDiff } from '../../../blocks/diff/DiagramDiff.tsx'
import { DiffPage, useDiffArrangement } from '../../../blocks/diff/DiffFrame.tsx'
import { DocumentDiff } from '../../../blocks/diff/DocumentDiff.tsx'
import { ImageDiff } from '../../../blocks/diff/ImageDiff.tsx'
import { PageSetDiff } from '../../../blocks/diff/PageSetDiff.tsx'
import { RecordDiff } from '../../../blocks/diff/RecordDiff.tsx'
import { TextDiff } from '../../../blocks/diff/TextDiff.tsx'
import { TraceDiff } from '../../../blocks/diff/TraceDiff.tsx'
import { TreeDiff } from '../../../blocks/diff/TreeDiff.tsx'
import {
  a4Page,
  diagramPair,
  documentPair,
  imagePair,
  ocrPair,
  pageSetPair,
  recordPair,
  tracePair,
  treePair,
} from './_generators.ts'
import { ScaleDiagnostics, ScaleProfiler } from './diagnostics.tsx'

declare global {
  var diffScaleReady: boolean
}

const before: DiffSide = {
  label: 'Before',
  basis: 'observed',
  provenance: 'Seeded synthetic archive',
}
const after: DiffSide = {
  label: 'After',
  basis: 'projected',
  provenance: 'Seeded synthetic revision',
}

/**
 * One declared meters counter per lens boundary (`Renders.<lens id>`); counts commits
 * within that lens, not function calls.
 * The Profiler must re-render when the page arrangement changes: React 19 propagates context
 * lazily, so a bailed-out Profiler above a context consumer never learns its subtree committed.
 * Reading the arrangement here re-renders the Profiler inside the page scope on every toggle.
 */
const Profiled = ({
  id,
  children,
}: {
  readonly id: string
  readonly children: React.ReactNode
}) => {
  useDiffArrangement()
  return <ScaleProfiler id={id}>{children}</ScaleProfiler>
}
const profile = (id: string, lens: React.ReactNode) => (
  <Profiled key={id} id={id}>
    {lens}
  </Profiled>
)

/** The story owns a scoped session and its development-only DOM measurement authority. */
const ScalePage = ({
  ids,
  children,
}: {
  readonly ids: readonly string[]
  readonly children: React.ReactNode
}) => {
  React.useState(() => {
    globalThis.diffScaleReady = false
  })
  React.useLayoutEffect(() => {
    globalThis.diffScaleReady = true
    return () => {
      globalThis.diffScaleReady = false
    }
  }, [])
  return (
    <ScaleDiagnostics ids={ids}>
      <ScaleProfiler id="page">
        <DiffPage>{children}</DiffPage>
      </ScaleProfiler>
    </ScaleDiagnostics>
  )
}

/**
 * Marks the story's first render, before its page generates fixtures: the perf gates' mount
 * bracket (MED.BLK.DIFF-R93) starts here rather than at navigation.
 */
const MountMark = ({ children }: { readonly children: React.ReactNode }) => {
  React.useState(() => performance.mark('vista-diff-scale-mount'))
  return children
}

const MixedPage = () => {
  const lenses = React.useMemo(() => {
    const ocr = ocrPair(0.1)
    const [traceBefore, traceAfter] = tracePair(30)
    const [treeBefore, treeAfter] = treePair(80)
    const [docBefore, docAfter] = documentPair(30)
    const [recordBefore, recordAfter] = recordPair(30)
    const [diagramBefore, diagramAfter] = diagramPair(30)
    return Array.from({ length: 40 }, (_, i) => {
      const id = `mixed-${i}`
      switch (i % 8) {
        case 0:
          return profile(
            id,
            <TextDiff
              id={id}
              title={`OCR page ${i}`}
              before={before}
              after={after}
              beforeText={ocr.before}
              afterText={ocr.after}
            />,
          )
        case 1:
          return profile(
            id,
            <TraceDiff
              id={id}
              title={`Trace ${i}`}
              before={before}
              after={after}
              beforeTrace={traceBefore}
              afterTrace={traceAfter}
            />,
          )
        case 2:
          return profile(
            id,
            <TreeDiff
              id={id}
              title={`Tree ${i}`}
              beforeSide={before}
              afterSide={after}
              before={treeBefore}
              after={treeAfter}
            />,
          )
        case 3:
          return profile(
            id,
            <DocumentDiff
              id={id}
              title={`Document ${i}`}
              beforeSide={before}
              afterSide={after}
              before={docBefore}
              after={docAfter}
            />,
          )
        case 4:
          return profile(
            id,
            <RecordDiff
              id={id}
              title={`Record ${i}`}
              before={before}
              after={after}
              beforeRecord={recordBefore}
              afterRecord={recordAfter}
            />,
          )
        case 5:
          return profile(
            id,
            <DiagramDiff
              id={id}
              title={`Diagram ${i}`}
              before={before}
              after={after}
              beforeGraph={diagramBefore}
              afterGraph={diagramAfter}
            />,
          )
        case 6: {
          const [b, a] = imagePair(i)
          return profile(
            id,
            <ImageDiff
              id={id}
              title={`Scan ${i}`}
              before={before}
              after={after}
              beforeImage={b}
              afterImage={a}
            />,
          )
        }
        default:
          return profile(
            id,
            <CodeDiff
              id={id}
              title={`intake-${i}.ts`}
              before={before}
              after={after}
              source={{
                _tag: 'files',
                path: `intake-${i}.ts`,
                oldContents: `export const bay = ${i}\n`,
                newContents: `export const bay = ${i + 1}\n`,
              }}
            />,
          )
      }
    })
  }, [])
  return <ScalePage ids={Array.from({ length: 40 }, (_, i) => `mixed-${i}`)}>{lenses}</ScalePage>
}

const OcrPage = ({ rate, count = 1 }: { readonly rate: number; readonly count?: number }) => {
  const lenses = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const pair = ocrPair(rate, i + 7)
        return profile(
          `ocr-${i}`,
          <TextDiff
            id={`ocr-${i}`}
            title={`OCR re-extraction ${i + 1} · ${rate * 100}%`}
            before={before}
            after={after}
            beforeText={pair.before}
            afterText={pair.after}
          />,
        )
      }),
    [rate, count],
  )
  return <ScalePage ids={Array.from({ length: count }, (_, i) => `ocr-${i}`)}>{lenses}</ScalePage>
}

const TracePage = () => {
  const lenses = React.useMemo(() => {
    const [a, b] = tracePair()
    return profile(
      'trace-500',
      <TraceDiff
        id="trace-500"
        title="500-span request trace"
        before={before}
        after={after}
        beforeTrace={a}
        afterTrace={b}
      />,
    )
  }, [])
  return <ScalePage ids={['trace-500']}>{lenses}</ScalePage>
}

const TreePage = () => {
  const lenses = React.useMemo(() => {
    const [a, b] = treePair()
    return profile(
      'tree-1000',
      <TreeDiff
        id="tree-1000"
        title="1000-node hierarchy with moves"
        beforeSide={before}
        afterSide={after}
        before={a}
        after={b}
      />,
    )
  }, [])
  return <ScalePage ids={['tree-1000']}>{lenses}</ScalePage>
}

const PageSetPage = ({
  count = 200,
  sets = 1,
  width = 2_480,
  height = 3_508,
}: {
  readonly count?: number
  readonly sets?: number
  readonly width?: number
  readonly height?: number
}) => {
  const lenses = React.useMemo(
    () =>
      Array.from({ length: sets }, (_, i) => {
        const [b, a] = pageSetPair(count, i * count, width, height, sets === 1 ? 40 : 1)
        const id = `pages-${i}`
        return profile(
          id,
          <PageSetDiff
            id={id}
            title={`Rendered PDF ${i + 1} · ${count} pages`}
            before={before}
            after={after}
            beforePages={b}
            afterPages={a}
          />,
        )
      }),
    [count, sets, width, height],
  )
  return <ScalePage ids={Array.from({ length: sets }, (_, i) => `pages-${i}`)}>{lenses}</ScalePage>
}

const ImagesPage = () => {
  const lenses = React.useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const id = `a4-${i}`
        return profile(
          id,
          <ImageDiff
            id={id}
            title={`A4 300-dpi scan ${i + 1}`}
            before={before}
            after={after}
            beforeImage={a4Page(i, 0)}
            afterImage={a4Page(i, 1)}
            defaultMode="difference"
          />,
        )
      }),
    [],
  )
  return <ScalePage ids={Array.from({ length: 10 }, (_, i) => `a4-${i}`)}>{lenses}</ScalePage>
}

const DocumentPage = () => {
  const lens = React.useMemo(() => {
    const [b, a] = documentPair()
    return profile(
      'document-300',
      <DocumentDiff
        id="document-300"
        title="300-block document with embeds"
        beforeSide={before}
        afterSide={after}
        before={b}
        after={a}
        foldUnchanged={0}
      />,
    )
  }, [])
  return <ScalePage ids={['document-300']}>{lens}</ScalePage>
}

const RecordPage = () => {
  const lens = React.useMemo(() => {
    const [b, a] = recordPair()
    return profile(
      'record-200',
      <RecordDiff
        id="record-200"
        title="200-row record"
        before={before}
        after={after}
        beforeRecord={b}
        afterRecord={a}
        unchanged="dim"
      />,
    )
  }, [])
  return <ScalePage ids={['record-200']}>{lens}</ScalePage>
}

const DiagramPage = () => {
  const lens = React.useMemo(() => {
    const [b, a] = diagramPair()
    return profile(
      'diagram-150',
      <DiagramDiff
        id="diagram-150"
        title="150-node service map"
        before={before}
        after={after}
        beforeGraph={b}
        afterGraph={a}
      />,
    )
  }, [])
  return <ScalePage ids={['diagram-150']}>{lens}</ScalePage>
}

const CodePage = () => {
  const lenses = React.useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const id = `code-${i}`
        const contents = Array.from(
          { length: 80 },
          (_line, line) => `export const scan${line} = 'archive-${i}-${line}'`,
        ).join('\n')
        return profile(
          id,
          <CodeDiff
            id={id}
            title={`archive-${i}.ts`}
            before={before}
            after={after}
            source={{
              _tag: 'files',
              path: `archive-${i}.ts`,
              oldContents: contents,
              newContents: contents.replace('scan40', 'scan40Revised'),
            }}
          />,
        )
      }),
    [],
  )
  return <ScalePage ids={Array.from({ length: 40 }, (_, i) => `code-${i}`)}>{lenses}</ScalePage>
}
const meta = {
  title: 'Vista/Blocks/Diff/Scale',
  component: MixedPage,
  decorators: [
    (Story) => (
      <MountMark>
        <Story />
      </MountMark>
    ),
  ],
} satisfies Meta<typeof MixedPage>
export default meta
type Story = StoryObj<typeof meta>

/** Page-level arrangement switches 40 real, mixed semantic-diff frames. */
export const MixedFortyFrames: Story = {}
/** One 5,000-word OCR diff with a 10% edit rate: the light end of the text budget. */
export const OcrTenPercent: Story = { render: () => <OcrPage rate={0.1} /> }
/** Same single frame at a 30% edit rate, so every word-level diff path is hit. */
export const OcrThirtyPercent: Story = { render: () => <OcrPage rate={0.3} /> }
/** 40 stacked OCR frames: many independent text diffs on one page. */
export const FortyOcrFrames: Story = { render: () => <OcrPage rate={0.1} count={40} /> }
/** 500 spans in a shallow tree, the default trace load. */
export const TraceFiveHundred: Story = { render: () => <TracePage /> }
/** 1,000 tree nodes with scattered renames and reparentings. */
export const TreeOneThousand: Story = { render: () => <TreePage /> }
/** 200 A4 pages where every page differs, the default page-set load. */
export const PageSetTwoHundred: Story = { render: () => <PageSetPage /> }
/** Three 200-page sets produce 600 distinct pixel-verdict requests, crossing the 512-entry store cap. */
export const MoreThanFiveHundredTwelveImagePairs: Story = {
  render: () => <PageSetPage sets={3} width={600} height={848} />,
}
/** 10 full-size A4 image diffs, the heaviest per-pixel case. */
export const TenA4ImageDiffs: Story = { render: () => <ImagesPage /> }
/** A 300-block document mixing headings, paragraphs and PDF embeds. */
export const DocumentThreeHundred: Story = { render: () => <DocumentPage /> }
/** 200 keyed record rows where every seventh row's value shifts. */
export const RecordTwoHundred: Story = { render: () => <RecordPage /> }
/** A 150-node, 149-edge service graph with a few label and edge changes. */
export const DiagramOneHundredFifty: Story = { render: () => <DiagramPage /> }
/** 40 file diffs from the code lens, checking that the highlight pass stays linear. */
export const FortyCodeFiles: Story = { render: () => <CodePage /> }
/** Every lens at once on one page, to spot cross-lens interference. */
export const AllStates: Story = { render: () => <MixedPage /> }
