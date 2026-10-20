/**
 * Typed graph diff rendered through Mermaid; raw Mermaid source is not parsed or compared.
 * Combined arrangement: one merged graph with change classDefs. Side by side: the before
 * and after graphs next to each other, emitted with the same node IDs and declaration
 * order so the layouts line up. Not `@pierre/diffs`: a graph is not line-oriented.
 */
import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import type { ReactNode } from 'react'
import { ListBox, ListBoxItem, type Selection } from 'react-aria-components'

import type { Theme } from '../../model.ts'
import { useTheme } from '../../theme.ts'
import { MermaidDiagram } from '../MermaidDiagram.tsx'
import type { ChangeCounts, ChangeKind, DiffFrameProps } from './contract.ts'
import { ChangeMark, DiffFrame, useDiffArrangement } from './DiffFrame.tsx'

/** Stable IDs identify nodes across both graph snapshots. */
export interface DiagramNode {
  readonly id: string
  readonly label: string
  readonly group?: string
}

/** Directed edge; endpoints and optional label identify a connection. */
export interface DiagramEdge {
  readonly from: string
  readonly to: string
  readonly label?: string
}

/** Graph input to the diagram lens. IDs should be unique within a graph. */
export interface DiagramGraph {
  readonly nodes: readonly DiagramNode[]
  readonly edges: readonly DiagramEdge[]
}

/** A semantic change to a node identified by its stable ID. */
export interface DiagramNodeChange {
  readonly id: string
  readonly kind: ChangeKind
  readonly before?: DiagramNode
  readonly after?: DiagramNode
}

/** A semantic edge change; reroutes are represented as `moved` rather than two changes. */
export interface DiagramEdgeChange {
  readonly kind: ChangeKind
  readonly before?: DiagramEdge
  readonly after?: DiagramEdge
}

/** Pure graph diff model, with nodes/edges in stable before-then-after order. */
export interface DiagramDiffModel {
  readonly nodes: readonly DiagramNodeChange[]
  readonly edges: readonly DiagramEdgeChange[]
  readonly counts: ChangeCounts
}

const edgeKey = (edge: DiagramEdge) => JSON.stringify([edge.from, edge.to, edge.label ?? ''])

/** A removed/added edge pair that shares one endpoint and the label: a reroute candidate. */
const isRerouteCandidate = (b: DiagramEdge, a: DiagramEdge) =>
  b.label === a.label &&
  ((b.from === a.from && b.to !== a.to) || (b.to === a.to && b.from !== a.from))

/**
 * Diff graph nodes by ID and edges by endpoints + label. An unambiguous removed
 * and added edge with one shared endpoint and the same label becomes a reroute.
 */
export const diffDiagrams = (before: DiagramGraph, after: DiagramGraph): DiagramDiffModel => {
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]))
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]))
  const nodes: DiagramNodeChange[] = []
  for (const id of new Set([...beforeNodes.keys(), ...afterNodes.keys()])) {
    const b = beforeNodes.get(id)
    const a = afterNodes.get(id)
    nodes.push({
      id,
      kind:
        b && a
          ? b.label === a.label && b.group === a.group
            ? 'unchanged'
            : 'changed'
          : b
            ? 'removed'
            : 'added',
      ...(b ? { before: b } : {}),
      ...(a ? { after: a } : {}),
    })
  }
  const beforeEdges = new Map(before.edges.map((edge) => [edgeKey(edge), edge]))
  const afterEdges = new Map(after.edges.map((edge) => [edgeKey(edge), edge]))
  const removed = [...beforeEdges].filter(([key]) => !afterEdges.has(key))
  const added = [...afterEdges].filter(([key]) => !beforeEdges.has(key))
  const pairs = new Map<string, string>()
  const pairedAdded = new Set<string>()
  for (const [bKey, bEdge] of removed) {
    const candidates = added.filter(([, aEdge]) => isRerouteCandidate(bEdge, aEdge))
    if (candidates.length !== 1) continue
    const [aKey, aEdge] = candidates[0]!
    if (removed.filter(([, other]) => isRerouteCandidate(other, aEdge)).length !== 1) continue
    pairs.set(bKey, aKey)
    pairedAdded.add(aKey)
  }
  const edges: DiagramEdgeChange[] = []
  for (const [key, edge] of beforeEdges) {
    if (afterEdges.has(key)) {
      edges.push({ kind: 'unchanged', before: edge, after: afterEdges.get(key)! })
    } else if (pairs.has(key)) {
      edges.push({ kind: 'moved', before: edge, after: afterEdges.get(pairs.get(key)!)! })
    } else {
      edges.push({ kind: 'removed', before: edge })
    }
  }
  for (const [key, edge] of added) {
    if (!pairedAdded.has(key)) edges.push({ kind: 'added', after: edge })
  }
  const counts: Partial<Record<ChangeKind, number>> = {}
  for (const item of [...nodes, ...edges]) counts[item.kind] = (counts[item.kind] ?? 0) + 1
  return { nodes, edges, counts }
}

/** Escape a label for a Mermaid quoted string, including user-supplied punctuation. */
const mermaidLabel = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br/>')

/**
 * How changes are marked: `fill` tints changed nodes, `stroke` draws an accent stroke plus a
 * `+`/`−`/`~` label badge, `dim` keeps accent strokes and fades everything unchanged.
 */
export type DiagramChangeStyle = 'fill' | 'stroke' | 'dim'

/** Placement of the textual change list: beside the graph, below it, or omitted. */
export type DiagramChangeList = 'side' | 'below' | 'none'

/** Graph to emit: the merged diff, or one side marking only the changes visible on that side. */
export type DiagramView = 'merged' | 'before' | 'after'

/** Rendering options for {@link diagramToMermaid}. */
export interface DiagramRenderOptions {
  readonly theme: Theme
  readonly changeStyle: DiagramChangeStyle
  /** Change key (`node:<id>` / `edge:<index into model.edges>`) to emphasise. */
  readonly selected?: string | undefined
}

/** Mermaid needs literal colors (no CSS variables), so the palette mirrors the Geist change accents. */
const palettes = {
  light: {
    added: '#1a7f37',
    removed: '#cf222e',
    changed: '#9a6700',
    moved: '#0969da',
    addedFill: '#dafbe1',
    removedFill: '#ffebe9',
    changedFill: '#fff8c5',
    base: '#57606a',
    text: '#24292f',
    muted: '#8c959f',
    fill: '#ffffff',
    select: '#8250df',
  },
  dark: {
    added: '#3fb950',
    removed: '#f85149',
    changed: '#d29922',
    moved: '#58a6ff',
    addedFill: '#12361f',
    removedFill: '#3d1417',
    changedFill: '#3a2d0b',
    base: '#8b949e',
    text: '#f0f6fc',
    muted: '#6e7681',
    fill: '#1b2430',
    select: '#bc8cff',
  },
} as const

type Palette = (typeof palettes)[Theme]
type Css = Readonly<Record<string, string>>

const serializeCss = (css: Css) =>
  Object.entries(css)
    .map(([key, value]) => `${key}:${value}`)
    .join(',')

const accentOf = (kind: ChangeKind, palette: Palette) =>
  kind === 'added'
    ? palette.added
    : kind === 'removed'
      ? palette.removed
      : kind === 'moved'
        ? palette.moved
        : kind === 'changed'
          ? palette.changed
          : palette.base

const fillOf = (kind: ChangeKind, palette: Palette) =>
  kind === 'added'
    ? palette.addedFill
    : kind === 'removed'
      ? palette.removedFill
      : kind === 'changed'
        ? palette.changedFill
        : palette.fill

const nodeCss = (
  kind: ChangeKind,
  style: DiagramChangeStyle,
  palette: Palette,
): Css | undefined => {
  if (kind === 'unchanged') {
    return style === 'dim'
      ? { 'fill-opacity': '0.35', 'stroke-opacity': '0.35', color: palette.muted }
      : undefined
  }
  const dash = kind === 'removed' ? { 'stroke-dasharray': '5 4' } : {}
  return style === 'fill'
    ? {
        fill: fillOf(kind, palette),
        stroke: accentOf(kind, palette),
        'stroke-width': '1px',
        color: palette.text,
        ...dash,
      }
    : {
        fill: palette.fill,
        stroke: accentOf(kind, palette),
        'stroke-width': '3px',
        color: palette.text,
        ...dash,
      }
}

const nodeBadge: Readonly<Record<ChangeKind, string>> = {
  added: '+ ',
  removed: '− ',
  changed: '~ ',
  moved: '',
  unchanged: '',
}

/** Edge route tone; a reroute draws its old route (`movedFrom`) and new route (`movedTo`). */
type EdgeTone = ChangeKind | 'movedFrom' | 'movedTo'

const edgeCss = (tone: EdgeTone, style: DiagramChangeStyle, palette: Palette): Css | undefined => {
  switch (tone) {
    case 'unchanged':
      return style === 'dim' ? { 'stroke-opacity': '0.3' } : undefined
    case 'removed':
      return { stroke: palette.removed, 'stroke-width': '2px', 'stroke-dasharray': '5 4' }
    case 'movedFrom':
      return { stroke: palette.moved, 'stroke-width': '2px', 'stroke-dasharray': '5 4' }
    case 'movedTo':
    case 'moved':
      return { stroke: palette.moved, 'stroke-width': '3px' }
    case 'added':
    case 'changed':
      return { stroke: accentOf(tone, palette), 'stroke-width': '3px' }
  }
}

/** Mermaid source for one view plus the rendered-SVG selectors of every selectable change. */
interface MermaidEmission {
  readonly source: string
  /** Change key → CSS selectors matching its node group / edge paths in Mermaid's SVG. */
  readonly targets: ReadonlyMap<string, readonly string[]>
}

const emitMermaid = (
  model: DiagramDiffModel,
  view: DiagramView,
  { theme, changeStyle, selected }: DiagramRenderOptions,
): MermaidEmission => {
  const palette = palettes[theme]
  const ids = new Map(model.nodes.map((node, index) => [node.id, `n${index}`]))
  const shownIds = new Set<string>()
  const classDefs = new Map<string, string>()
  const body: string[] = []
  const targets = new Map<string, string[]>()
  const selectCss = { stroke: palette.select, 'stroke-width': '4px' }

  for (const node of model.nodes) {
    const shown =
      view === 'before' ? node.before : view === 'after' ? node.after : (node.after ?? node.before)
    if (!shown) continue
    const nid = ids.get(node.id)!
    shownIds.add(node.id)
    // Flowchart vertices render as `g.node` with DOM id `[<svg id>-]flowchart-<vertex id>-<counter>`.
    targets.set(`node:${node.id}`, [`g.node[id*="flowchart-${nid}-"]`])
    const label =
      view === 'merged' && node.before && node.after && node.before.label !== node.after.label
        ? `${node.before.label} → ${node.after.label}`
        : shown.label
    const badge = changeStyle === 'stroke' ? nodeBadge[node.kind] : ''
    body.push(`  ${nid}["${mermaidLabel(`${badge}${label}`)}"]`)
    const isSelected = selected === `node:${node.id}`
    const css = nodeCss(node.kind, changeStyle, palette)
    if (css === undefined && !isSelected) continue
    const className = isSelected ? `${node.kind}Sel` : node.kind
    classDefs.set(className, serializeCss({ ...css, ...(isSelected ? selectCss : {}) }))
    body.push(`  class ${nid} ${className}`)
  }

  let linkIndex = 0
  const pairCounts = new Map<string, number>()
  const pushEdge = (
    key: string,
    edge: DiagramEdge | undefined,
    tone: EdgeTone,
    isSelected: boolean,
  ) => {
    if (!edge || !shownIds.has(edge.from) || !shownIds.has(edge.to)) return
    const from = ids.get(edge.from)!
    const to = ids.get(edge.to)!
    const arrow = edge.label === undefined ? '-->' : `-->|"${mermaidLabel(edge.label)}"|`
    body.push(`  ${from} ${arrow} ${to}`)
    // Mermaid's auto edge id: `L_<from>_<to>_0` for the first link of a pair, then `_2`, `_3`, …
    const pair = `${from}_${to}`
    const existing = pairCounts.get(pair) ?? 0
    pairCounts.set(pair, existing + 1)
    const edgeSelector = `path[data-id="L_${pair}_${existing === 0 ? 0 : existing + 1}"]`
    targets.set(key, [...(targets.get(key) ?? []), edgeSelector])
    const css = edgeCss(tone, changeStyle, palette)
    if (css !== undefined || isSelected) {
      body.push(
        `  linkStyle ${linkIndex} ${serializeCss({ ...css, ...(isSelected ? selectCss : {}) })}`,
      )
    }
    linkIndex++
  }
  model.edges.forEach((change, index) => {
    const key = `edge:${index}`
    const isSelected = selected === key
    const moved = change.kind === 'moved'
    if (view === 'before')
      pushEdge(key, change.before, moved ? 'movedFrom' : change.kind, isSelected)
    else if (view === 'after')
      pushEdge(key, change.after, moved ? 'movedTo' : change.kind, isSelected)
    else if (moved) {
      pushEdge(key, change.before, 'movedFrom', isSelected)
      pushEdge(key, change.after, 'movedTo', isSelected)
    } else pushEdge(key, change.after ?? change.before, change.kind, isSelected)
  })

  return {
    source: [
      'flowchart LR',
      ...[...classDefs].map(([name, css]) => `  classDef ${name} ${css}`),
      ...body,
    ].join('\n'),
    targets,
  }
}

/**
 * Emit a Mermaid flowchart for one view of the diff. Node IDs (`n<index>`) and declaration
 * order come from the merged model, so `before` and `after` lay out alike.
 */
export const diagramToMermaid = (
  model: DiagramDiffModel,
  view: DiagramView,
  options: DiagramRenderOptions,
): string => emitMermaid(model, view, options).source

/** One selectable entry of the change list. */
interface DiagramChangeItem {
  readonly key: string
  readonly kind: ChangeKind
  readonly subject: 'node' | 'edge'
  readonly text: ReactNode
  readonly textValue: string
}

const diagramChangeItems = (model: DiagramDiffModel): readonly DiagramChangeItem[] => {
  const labels = new Map(model.nodes.map((node) => [node.id, (node.after ?? node.before)!.label]))
  const route = (edge: DiagramEdge) =>
    `${labels.get(edge.from) ?? edge.from} → ${labels.get(edge.to) ?? edge.to}`
  const nodes = model.nodes.flatMap((node): DiagramChangeItem[] => {
    if (node.kind === 'unchanged') return []
    const name = (node.after ?? node.before)!.label
    const details = [
      node.before && node.after && node.before.label !== node.after.label
        ? `${node.before.label} → ${node.after.label}`
        : undefined,
      node.before && node.after && node.before.group !== node.after.group
        ? `group ${node.before.group ?? 'none'} → ${node.after.group ?? 'none'}`
        : undefined,
    ].filter((detail) => detail !== undefined)
    return [
      {
        key: `node:${node.id}`,
        kind: node.kind,
        subject: 'node',
        textValue: [name, ...details].join(' · '),
        text: (
          <>
            <strong>{name}</strong>
            {details.length > 0 ? <span> · {details.join(' · ')}</span> : null}
          </>
        ),
      },
    ]
  })
  const edges = model.edges.flatMap((change, index): DiagramChangeItem[] => {
    if (change.kind === 'unchanged') return []
    const label = change.after?.label ?? change.before?.label
    const text = [
      change.kind === 'moved' && change.before && change.after
        ? `${route(change.before)} rerouted to ${route(change.after)}`
        : route((change.after ?? change.before)!),
      label,
    ]
      .filter((part) => part !== undefined)
      .join(' · ')
    return [{ key: `edge:${index}`, kind: change.kind, subject: 'edge', textValue: text, text }]
  })
  return [...nodes, ...edges]
}

/** Props for the typed graph comparison; frame props (`arrangement`, `nested`, …) pass through to `DiffFrame`. */
export interface DiagramDiffProps extends Pick<
  DiffFrameProps,
  | 'title'
  | 'before'
  | 'after'
  | 'arrangement'
  | 'relation'
  | 'defaultArrangement'
  | 'mode'
  | 'collapsed'
  | 'nested'
> {
  /** Also prefixes the Mermaid render IDs. */
  readonly id: string
  readonly beforeGraph: DiagramGraph
  readonly afterGraph: DiagramGraph
  /** Defaults to `stroke`. */
  readonly changeStyle?: DiagramChangeStyle
  /** Defaults to `side`. */
  readonly changeList?: DiagramChangeList
}

/** Merged or side-by-side graph comparison with a selectable list of semantic changes. */
export const DiagramDiff = ({
  beforeGraph,
  afterGraph,
  changeStyle = 'stroke',
  changeList = 'side',
  ...frame
}: DiagramDiffProps) => {
  const model = React.useMemo(
    () => diffDiagrams(beforeGraph, afterGraph),
    [beforeGraph, afterGraph],
  )
  return (
    <DiffFrame {...frame} lens="diagram" counts={model.counts}>
      <DiagramDiffBody
        id={frame.id}
        model={model}
        beforeLabel={frame.before.label}
        afterLabel={frame.after.label}
        changeStyle={changeStyle}
        changeList={changeList}
      />
    </DiffFrame>
  )
}

const DiagramDiffBody = ({
  id,
  model,
  beforeLabel,
  afterLabel,
  changeStyle,
  changeList,
}: {
  readonly id: string
  readonly model: DiagramDiffModel
  readonly beforeLabel: string
  readonly afterLabel: string
  readonly changeStyle: DiagramChangeStyle
  readonly changeList: DiagramChangeList
}) => {
  const arrangement = useDiffArrangement()
  const theme = useTheme()
  const [selected, setSelected] = React.useState<string | null>(null)
  // Selection is not part of the source: it is painted onto the rendered SVG, so a click never
  // re-runs Mermaid. Only the views the arrangement shows are emitted.
  const views = React.useMemo(() => {
    const options: DiagramRenderOptions = { theme, changeStyle }
    return arrangement === 'split'
      ? ({
          _tag: 'split',
          before: emitMermaid(model, 'before', options),
          after: emitMermaid(model, 'after', options),
        } as const)
      : ({ _tag: 'merged', merged: emitMermaid(model, 'merged', options) } as const)
  }, [arrangement, changeStyle, model, theme])
  const items = React.useMemo(() => diagramChangeItems(model), [model])
  const selectColor = palettes[theme].select
  const onSelectionChange = React.useCallback((keys: Selection) => {
    if (keys === 'all') return
    const next = [...keys][0]
    setSelected(next === undefined ? null : String(next))
  }, [])

  return (
    <div {...stylex.props(styles.content, changeList === 'side' && styles.contentSide)}>
      {views._tag === 'split' ? (
        <div {...stylex.props(styles.split)}>
          <section {...stylex.props(styles.diagramSide)} aria-label={`${beforeLabel} diagram`}>
            <h3 {...stylex.props(styles.sideLabel)}>{beforeLabel}</h3>
            <DiagramCanvas
              id={`${id}-before`}
              emission={views.before}
              selected={selected}
              selectColor={selectColor}
            />
          </section>
          <section {...stylex.props(styles.diagramSide)} aria-label={`${afterLabel} diagram`}>
            <h3 {...stylex.props(styles.sideLabel)}>{afterLabel}</h3>
            <DiagramCanvas
              id={`${id}-after`}
              emission={views.after}
              selected={selected}
              selectColor={selectColor}
            />
          </section>
        </div>
      ) : (
        <div {...stylex.props(styles.diagramSide)}>
          <DiagramCanvas
            id={`${id}-merged`}
            emission={views.merged}
            selected={selected}
            selectColor={selectColor}
          />
        </div>
      )}
      {changeList === 'none' ? null : (
        <section
          aria-label="Diagram changes"
          {...stylex.props(
            styles.changes,
            changeList === 'side' ? styles.changesSide : styles.changesBelow,
          )}
        >
          <h3 {...stylex.props(styles.changesTitle)}>Changes</h3>
          <ListBox
            aria-label="Diagram changes"
            selectionMode="single"
            layout={changeList === 'below' ? 'grid' : 'stack'}
            items={items}
            selectedKeys={selected === null ? [] : [selected]}
            onSelectionChange={onSelectionChange}
            renderEmptyState={renderEmptyChanges}
            {...stylex.props(styles.changeList, changeList === 'below' && styles.changeListGrid)}
          >
            {renderChangeItem}
          </ListBox>
        </section>
      )}
    </div>
  )
}

/** Module-level so RAC's per-item render cache survives selection re-renders. */
const renderChangeItem = (item: DiagramChangeItem) => (
  <ListBoxItem id={item.key} textValue={item.textValue} {...stylex.props(styles.changeItem)}>
    <ChangeMark kind={item.kind}>{item.subject}</ChangeMark>
    <span>{item.text}</span>
  </ListBoxItem>
)

const renderEmptyChanges = () => <span {...stylex.props(styles.empty)}>No graph changes.</span>

// --- render scheduling ---

/**
 * Mermaid layout is main-thread work, so diagrams render one at a time, each started in an
 * idle slot, and only once they approach the viewport.
 */
const renderQueue: Array<() => void> = []
let renderSlotBusy = false

const pumpRenderQueue = () => {
  if (renderSlotBusy) return
  const next = renderQueue.shift()
  if (next === undefined) return
  renderSlotBusy = true
  if (typeof requestIdleCallback === 'function') requestIdleCallback(next, { timeout: 500 })
  else setTimeout(next, 0)
}

const releaseRenderSlot = () => {
  renderSlotBusy = false
  pumpRenderQueue()
}

/** Upper bound on holding the render slot if Mermaid never produces output. */
const RENDER_SLOT_TIMEOUT_MS = 3000

/** `true` once the element neared the viewport and its turn in the render queue came up. */
const useRenderSlot = (targetRef: React.RefObject<HTMLElement | null>): boolean => {
  const [granted, setGranted] = React.useState(false)
  React.useEffect(() => {
    const target = targetRef.current
    if (target === null) return
    let phase: 'waiting' | 'queued' | 'granted' | 'done' = 'waiting'
    let timer: number | undefined
    let output: MutationObserver | undefined
    const finish = () => {
      if (phase !== 'granted') return
      phase = 'done'
      window.clearTimeout(timer)
      output?.disconnect()
      releaseRenderSlot()
    }
    const grant = () => {
      if (phase !== 'queued') {
        // Unmounted after being dequeued: hand the slot straight on.
        releaseRenderSlot()
        return
      }
      phase = 'granted'
      // Hold the slot until Mermaid's SVG (or the raw-source error fallback) lands.
      output = new MutationObserver(() => {
        if (target.querySelector('svg, pre') !== null) finish()
      })
      output.observe(target, { childList: true, subtree: true })
      timer = window.setTimeout(finish, RENDER_SLOT_TIMEOUT_MS)
      setGranted(true)
    }
    const visibility = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        visibility.disconnect()
        phase = 'queued'
        renderQueue.push(grant)
        pumpRenderQueue()
      },
      { rootMargin: '400px 0px' },
    )
    visibility.observe(target)
    return () => {
      visibility.disconnect()
      if (phase === 'queued') {
        phase = 'done'
        const index = renderQueue.indexOf(grant)
        if (index !== -1) renderQueue.splice(index, 1)
      } else finish()
    }
  }, [targetRef])
  return granted
}

/** Shape elements of a flowchart node group that carry its border. */
const NODE_SHAPES =
  ':scope > rect, :scope > polygon, :scope > path, :scope > circle, :scope > ellipse, :scope > g > path'

/**
 * Paint the selected change onto the rendered SVG in place. Mermaid writes class styles as
 * inline `!important` declarations, so the emphasis is an inline `!important` override that is
 * restored on deselect and re-applied whenever Mermaid replaces the SVG.
 */
const useSelectionHighlight = (
  hostRef: React.RefObject<HTMLElement | null>,
  selectors: readonly string[] | undefined,
  color: string,
) => {
  React.useLayoutEffect(() => {
    const host = hostRef.current
    if (host === null || selectors === undefined || selectors.length === 0) return
    const touched = new Map<SVGElement, string | null>()
    const apply = () => {
      for (const selector of selectors) {
        for (const match of host.querySelectorAll(selector)) {
          const shapes = match.tagName === 'path' ? [match] : match.querySelectorAll(NODE_SHAPES)
          for (const shape of shapes) {
            if (!(shape instanceof SVGElement) || touched.has(shape)) continue
            touched.set(shape, shape.getAttribute('style'))
            shape.style.setProperty('stroke', color, 'important')
            shape.style.setProperty('stroke-width', '4px', 'important')
          }
        }
      }
    }
    apply()
    const rerenders = new MutationObserver(apply)
    rerenders.observe(host, { childList: true, subtree: true })
    return () => {
      rerenders.disconnect()
      for (const [shape, style] of touched) {
        if (style === null) shape.removeAttribute('style')
        else shape.setAttribute('style', style)
      }
    }
  }, [hostRef, selectors, color])
}

/** One Mermaid view: rendered once per source when near the viewport; selection is painted on. */
const DiagramCanvas = React.memo(function DiagramCanvas({
  id,
  emission,
  selected,
  selectColor,
}: {
  readonly id: string
  readonly emission: MermaidEmission
  readonly selected: string | null
  readonly selectColor: string
}) {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const ready = useRenderSlot(hostRef)
  useSelectionHighlight(
    hostRef,
    selected === null ? undefined : emission.targets.get(selected),
    selectColor,
  )
  return (
    <div ref={hostRef} {...stylex.props(!ready && styles.pending)}>
      {ready ? <MermaidDiagram id={id} source={emission.source} /> : null}
    </div>
  )
})

const styles = stylex.create({
  content: { display: 'grid', gap: '0.75rem', alignItems: 'start', minWidth: 0 },
  contentSide: { gridTemplateColumns: 'minmax(0, 2fr) minmax(13rem, 1fr)' },
  split: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.5rem',
    minWidth: 0,
  },
  diagramSide: { minWidth: 0 },
  sideLabel: {
    margin: 0,
    marginBottom: '0.35rem',
    fontSize: '0.8rem',
    color: tokens['--ds-gray-800'],
  },
  changes: { minWidth: 0 },
  changesSide: {
    maxHeight: '28rem',
    overflowY: 'auto',
    borderInlineStartWidth: 1,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: tokens['--ds-gray-alpha-400'],
    paddingInlineStart: '0.75rem',
  },
  changesBelow: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    paddingTop: '0.5rem',
  },
  changesTitle: {
    margin: 0,
    marginBottom: '0.5rem',
    color: tokens['--ds-gray-1000'],
    fontSize: '0.82rem',
  },
  changeList: { display: 'flex', flexDirection: 'column', gap: 2, outline: 'none' },
  changeListGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))',
  },
  changeItem: {
    display: 'flex',
    gap: '0.45rem',
    alignItems: 'baseline',
    paddingBlock: '0.3rem',
    paddingInline: '0.4rem',
    borderRadius: 6,
    fontSize: '0.8rem',
    color: tokens['--ds-gray-900'],
    overflowWrap: 'anywhere',
    cursor: 'pointer',
    backgroundColor: {
      default: 'transparent',
      ':is([data-hovered])': tokens['--ds-gray-alpha-100'],
      ':is([data-selected])': tokens['--ds-gray-alpha-200'],
    },
    outline: {
      default: 'none',
      ':is([data-focus-visible])': `2px solid ${tokens['--ds-focus-color']}`,
    },
  },
  empty: { color: tokens['--ds-gray-800'], fontSize: '0.8rem' },
  pending: { minHeight: '12rem' },
})
