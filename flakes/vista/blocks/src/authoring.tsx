import { Effect, Result, Schema } from 'effect'
import { createContext, useContext, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  encodeCaptureArgsSync,
  flatMapDependencyBinding,
  flatMapEdge,
  projectMappedSourceValue,
  sourceBinding,
  type BindingPolicy,
  type CapturePlan,
  type DataBinding,
  type FlatMapSelector,
} from './data-contract.ts'
import type { DecisionStatus, Template } from './model.ts'
import {
  decodeSemanticManifest,
  type MutableSemanticNode,
  type SemanticManifest,
  type SemanticStatus,
  validateSemanticManifest,
} from './semantic.ts'

interface SemanticCollector {
  readonly nodes: MutableSemanticNode[]
  readonly flatMapSelectors: Map<string, FlatMapSelector>
  readonly selectorsByTransform: Map<string, FlatMapSelector>
  app: Omit<SemanticManifest['app'], 'status'> | undefined
}

type SemanticRenderContext =
  | { readonly _tag: 'root'; readonly collector: SemanticCollector | undefined }
  | {
      readonly _tag: 'semantic'
      readonly collector: SemanticCollector | undefined
      readonly node: MutableSemanticNode
      /** Visual/outline nesting below the app root; the first authored rank is zero. */
      readonly depth: number
    }
  | { readonly _tag: 'runtime' }

const SemanticContext = createContext<SemanticRenderContext>({ _tag: 'root', collector: undefined })

/**
 * Props for AppRoot, establishing the app title, its semantic template, the storage identity
 * scope, and optional children.
 */
export interface AppRootProps {
  readonly title: string
  readonly template: Template
  readonly scope: string
  readonly children?: ReactNode
}

/** The sole semantic root. Vista owns storage identity and the browser shell. */
export const AppRoot = ({ title, template, scope, children }: AppRootProps): ReactNode => {
  const context = useContext(SemanticContext)
  if (context._tag !== 'root') throw new Error('AppRoot must be the semantic root')
  if (context.collector?.app !== undefined) throw new Error('only one AppRoot may be extracted')
  if (context.collector !== undefined) context.collector.app = { id: 'app', title, template, scope }
  const node: MutableSemanticNode = { id: 'app', kind: 'app', refs: [], bindings: [] }
  context.collector?.nodes.push(node)
  return (
    <SemanticContext.Provider value={{ _tag: 'semantic', collector: context.collector, node, depth: 0 }}>
      <main data-vista-id="app" data-vista-kind="app" data-vista-template={template}>
        <header data-vista-app-header="">
          <h1 data-vista-app-title="">{title}</h1>
          <p data-vista-app-scope="">{scope}</p>
        </header>
        {children}
      </main>
    </SemanticContext.Provider>
  )
}

interface CommonMarkerProps {
  /**
   * Human-facing name for this node in the shell outline. Optional: an
   * unlabelled node falls back to its nearest descendant heading, then to a
   * humanized id, so apps authored before `label` existed keep working.
   */
  readonly label?: string
  readonly refs?: readonly string[]
  readonly provenance?: string
  readonly children?: ReactNode
}

/**
 * Props for the Section marker, where the optional id is omitted for purely structural grouping
 * and supplied only when the section should become an addressable concept in the outline.
 */
export interface SectionProps extends CommonMarkerProps {
  /** Omit for structural grouping; provide only when this section is an addressable concept. */
  readonly id?: string
}

/**
 * Base props for any node participating in the semantic outline, requiring a stable id so the node
 * can be targeted by links, refs, and capture bindings.
 */
export interface AddressableProps extends CommonMarkerProps {
  readonly id: string
}

/**
 * Props for a decision node, extending the addressable contract with a required status that
 * reports whether the decision is locked, open, or awaiting sign-off.
 */
export interface DecisionProps extends AddressableProps {
  readonly status: DecisionStatus
}

interface SemanticNodeProps extends AddressableProps {
  readonly kind: 'ask' | 'fork' | 'evidence'
}

/**
 * An authored `label` names a node for a reader, not only for the outline.
 * Rendering it as a heading is what keeps authors from duplicating the label as
 * a markdown lead-in inside the node's first prose block.
 *
 * This module is evaluated by the service under Bun with no StyleX transform,
 * so it emits Vista-owned data attributes and leaves presentation to
 * `semantic-chrome.css`, which only the client entry pulls in.
 */
const NodeLabel = ({
  label,
  kind,
  depth,
}: {
  label: string | undefined
  kind: 'section' | 'node'
  depth: number
}): ReactNode => {
  if (label === undefined || label === '') return null
  const level = Math.min(depth + 2, 6)
  const Tag = `h${level}` as 'h2'
  return (
    <Tag data-vista-node-label={kind} data-vista-heading-level={level}>
      {label}
    </Tag>
  )
}

const AddressableNode = ({ id, kind, label, refs = [], provenance, children }: SemanticNodeProps): ReactNode => {
  const context = useContext(SemanticContext)
  if (context._tag === 'runtime') throw new Error(`semantic node "${id}" cannot be rendered beneath a RuntimeIsland`)
  if (context._tag !== 'semantic') throw new Error(`semantic node "${id}" must be rendered beneath AppRoot`)
  const node: MutableSemanticNode = {
    id,
    kind,
    parentId: context.node.id,
    refs: [...refs],
    bindings: [],
    ...(label === undefined ? {} : { label }),
    ...(provenance === undefined ? {} : { provenance }),
  }
  context.collector?.nodes.push(node)
  return (
    <SemanticContext.Provider
      value={{ _tag: 'semantic', collector: context.collector, node, depth: context.depth + 1 }}
    >
      <section id={id} data-vista-id={id} data-vista-kind={kind} data-vista-label={label}>
        <NodeLabel label={label} kind="node" depth={context.depth} />
        {children}
      </section>
    </SemanticContext.Provider>
  )
}

/**
 * Renders a grouping section element, registering it as an addressable node (with label, refs, and
 * provenance) only when an id is provided, and throwing if rendered beneath a RuntimeIsland or
 * outside AppRoot.
 */
export const Section = ({ id, label, refs = [], provenance, children }: SectionProps): ReactNode => {
  const context = useContext(SemanticContext)
  if (context._tag === 'runtime') throw new Error('Section cannot be rendered beneath a RuntimeIsland')
  if (context._tag !== 'semantic') throw new Error('Section must be rendered beneath AppRoot')
  if (id === undefined)
    return (
      <SemanticContext.Provider value={{ ...context, depth: context.depth + 1 }}>
        <section data-vista-kind="section" data-vista-depth={context.depth}>
          {children}
        </section>
      </SemanticContext.Provider>
    )
  const node: MutableSemanticNode = {
    id,
    kind: 'section',
    parentId: context.node.id,
    refs: [...refs],
    bindings: [],
    ...(label === undefined ? {} : { label }),
    ...(provenance === undefined ? {} : { provenance }),
  }
  context.collector?.nodes.push(node)
  return (
    <SemanticContext.Provider
      value={{ _tag: 'semantic', collector: context.collector, node, depth: context.depth + 1 }}
    >
      <section
        id={id}
        data-vista-id={id}
        data-vista-kind="section"
        data-vista-label={label}
        data-vista-depth={context.depth}
      >
        <NodeLabel label={label} kind="section" depth={context.depth} />
        {children}
      </section>
    </SemanticContext.Provider>
  )
}

/**
 * Creates an addressable semantic node of kind ask that marks an open question raised in the
 * document's prose.
 */
export const Ask = (props: AddressableProps): ReactNode => <AddressableNode {...props} kind="ask" />
/**
 * Creates an addressable semantic node of kind fork that marks a point where alternative paths
 * diverge.
 */
export const Fork = (props: AddressableProps): ReactNode => <AddressableNode {...props} kind="fork" />
/**
 * Creates an addressable semantic node of kind evidence that anchors supporting material for
 * claims made elsewhere in the document.
 */
export const Evidence = (props: AddressableProps): ReactNode => <AddressableNode {...props} kind="evidence" />

/**
 * Registers a decision node carrying its id, status, refs, and optional label or provenance
 * beneath the current semantic parent, throwing when rendered beneath a RuntimeIsland or outside
 * AppRoot.
 */
export const Decision = ({ id, status, label, refs = [], provenance, children }: DecisionProps): ReactNode => {
  const context = useContext(SemanticContext)
  if (context._tag === 'runtime') throw new Error(`Decision "${id}" cannot be rendered beneath a RuntimeIsland`)
  if (context._tag !== 'semantic') throw new Error(`Decision "${id}" must be rendered beneath AppRoot`)
  const node: MutableSemanticNode = {
    id,
    kind: 'decision',
    parentId: context.node.id,
    status,
    refs: [...refs],
    bindings: [],
    ...(label === undefined ? {} : { label }),
    ...(provenance === undefined ? {} : { provenance }),
  }
  context.collector?.nodes.push(node)
  // Same rank rule as every other labelled node: tag rank derives from
  // semantic depth so the accessible outline never disagrees with the rail.
  // Visual scale is untouched — `[data-vista-decision-title]` wins over the
  // shared ramp at equal specificity and keeps the card-title size.
  const level = Math.min(context.depth + 2, 6)
  const Tag = `h${level}` as 'h2'
  return (
    <SemanticContext.Provider
      value={{ _tag: 'semantic', collector: context.collector, node, depth: context.depth + 1 }}
    >
      <section id={id} data-vista-id={id} data-vista-kind="decision" data-vista-label={label}>
        <div data-vista-decision-header="">
          <span data-vista-decision-status={status}>{DECISION_STATUS_LABEL[status]}</span>
          {label === undefined || label === '' ? null : (
            <Tag data-vista-decision-title="" data-vista-heading-level={level}>
              {label}
            </Tag>
          )}
        </div>
        {children}
      </section>
    </SemanticContext.Provider>
  )
}

/**
 * Props for the RuntimeIsland marker, reusing the addressable contract (required id plus optional
 * label, refs, and provenance) because hydration islands are first-class semantic nodes.
 */
export type RuntimeIslandProps = AddressableProps
/**
 * Wraps interactive content as a client-hydrated island, registering an island node in the
 * semantic tree and throwing unless rendered beneath a semantic node.
 */
export const RuntimeIsland = ({ id, label, refs = [], provenance, children }: RuntimeIslandProps): ReactNode => {
  const context = useContext(SemanticContext)
  if (context._tag !== 'semantic') throw new Error(`RuntimeIsland "${id}" must be rendered beneath a semantic node`)
  const node: MutableSemanticNode = {
    id,
    kind: 'island',
    parentId: context.node.id,
    refs: [...refs],
    bindings: [],
    ...(label === undefined ? {} : { label }),
    ...(provenance === undefined ? {} : { provenance }),
  }
  context.collector?.nodes.push(node)
  return (
    <SemanticContext.Provider value={{ _tag: 'runtime' }}>
      <section id={id} data-vista-id={id} data-vista-kind="island" data-vista-label={label}>
        {context.collector === undefined ? children : undefined}
      </section>
    </SemanticContext.Provider>
  )
}

/**
 * Props for Ref: the id of the target node to reference and optional children that override the
 * default link text.
 */
export interface RefProps {
  readonly target: string
  readonly children?: ReactNode
}

/**
 * Renders an anchor link to a target node while recording the target on the enclosing node's refs
 * for manifest extraction, defaulting the link text to the target id and throwing outside a
 * semantic context.
 */
export const Ref = ({ target, children }: RefProps): ReactNode => {
  const context = useContext(SemanticContext)
  if (context._tag !== 'semantic') throw new Error(`Ref "${target}" must be rendered beneath a semantic node`)
  context.node.refs.push(target)
  return (
    <a href={`#${target}`} data-vista-ref={target}>
      {children ?? target}
    </a>
  )
}

/** Internal collector seam used by domain-owned data components. */
export const useDataBinding = <
  TArgs,
  TValue,
  TError,
  TPolicy extends BindingPolicy,
>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): { readonly semanticId: string; readonly extracting: boolean } => {
  const context = useContext(SemanticContext)
  if (context._tag !== 'semantic') throw new Error('data-backed component must be rendered beneath a semantic node')
  const source = sourceBinding(binding)
  const dependency = (() => {
    const resolved = flatMapDependencyBinding(binding)
    if (resolved === undefined) return undefined
    const { operation, args } = resolved
    const authoredSelector = operation.select as FlatMapSelector
    const selector: FlatMapSelector = (value) =>
      operation.select(projectMappedSourceValue(operation.source, args, value))
    const transform = `${source.operation.providerId}\u0000${source.operation.tag}\u0000${operation.id}`
    const existing = context.collector?.selectorsByTransform.get(transform)
    if (existing !== undefined && existing !== authoredSelector) {
      throw new Error(
        `duplicate flatMap transform id "${operation.id}" for ${source.operation.providerId}.${source.operation.tag}`,
      )
    }
    const edge = Effect.runSync(flatMapEdge(binding))!
    context.collector?.selectorsByTransform.set(transform, authoredSelector)
    context.collector?.flatMapSelectors.set(edge, selector)
    return { _tag: 'flatMap' as const, id: operation.id, edge }
  })()
  context.node.bindings.push({
    provider: source.operation.providerId,
    operation: source.operation.tag,
    args: encodeCaptureArgsSync(source),
    policy: binding.policy,
    ...(dependency === undefined ? {} : { dependency }),
  })
  return { semanticId: context.node.id, extracting: context.collector !== undefined }
}

/** Read extraction mode without recording a second binding for companion hooks. */
export const useDataExtraction = (): boolean => {
  const context = useContext(SemanticContext)
  return context._tag === 'semantic' && context.collector !== undefined
}

const deriveStatus = (nodes: readonly MutableSemanticNode[]): SemanticStatus => {
  let locked = 0
  let open = 0
  let awaiting = 0
  for (const node of nodes) {
    if (node.kind !== 'decision') continue
    if (node.status === 'locked') locked += 1
    else if (node.status === 'open') open += 1
    else if (node.status === 'awaiting-sign-off') awaiting += 1
  }
  return { locked, open, awaiting }
}

const assertSerializable = (
  value: unknown,
  path: string,
  ancestors: WeakSet<object> = new WeakSet(),
): void => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) return
  if (typeof value !== 'object') throw new Error(`${path} is not JSON-serializable`)
  if (ancestors.has(value)) throw new Error(`${path} contains a cycle`)
  ancestors.add(value)
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSerializable(entry, `${path}[${index}]`, ancestors))
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error(`${path} must be a plain serializable record`)
    }
    if (Reflect.ownKeys(value).some((key) => typeof key !== 'string')) {
      throw new Error(`${path} contains a symbol key`)
    }
    for (const [key, entry] of Object.entries(value)) assertSerializable(entry, `${path}.${key}`, ancestors)
  }
  ancestors.delete(value)
}

/**
 * The paired outputs of static extraction: the semantic manifest describing the document's node
 * tree and the capture plan for wiring runtime data feeds.
 */
export interface SemanticExtraction {
  readonly manifest: SemanticManifest
  readonly capturePlan: CapturePlan
}

/**
 * Statically renders a root element to collect every semantic node, selector mapping, and app
 * root, returning the manifest plus capture plan and throwing if no AppRoot is rendered.
 */
export const extractSemanticProjection = (root: ReactNode): SemanticExtraction => {
  const collector: SemanticCollector = {
    nodes: [],
    flatMapSelectors: new Map(),
    selectorsByTransform: new Map(),
    app: undefined,
  }
  const html = renderToStaticMarkup(
    <SemanticContext.Provider value={{ _tag: 'root', collector }}>{root}</SemanticContext.Provider>,
  )
  if (collector.app === undefined) throw new Error('default component must render one AppRoot')
  for (const node of collector.nodes) {
    node.bindings.forEach((binding, index) =>
      assertSerializable(binding.args, `data binding ${node.id}[${index}].args`),
    )
  }
  const candidate = {
    schemaVersion: 2 as const,
    app: { ...collector.app, status: deriveStatus(collector.nodes) },
    nodes: collector.nodes,
  }
  const decoded = decodeSemanticManifest(candidate)
  if (Result.isFailure(decoded)) throw new Error(`invalid semantic manifest shape: ${String(decoded.failure)}`)
  const manifest = decoded.success
  const problems = [...validateSemanticManifest(manifest)]
  const manifestIds = new Set(manifest.nodes.map(({ id }) => id))
  const domIds = [...html.matchAll(/data-vista-id="([^"]+)"/g)].map((match) => match[1]!)
  for (const id of domIds) {
    if (!manifestIds.has(id)) problems.push({ _tag: 'dom-correspondence', id, message: `DOM semantic target "${id}" has no manifest node` })
  }
  for (const id of manifestIds) {
    if (domIds.filter((domId) => domId === id).length !== 1) {
      problems.push({
        _tag: 'dom-correspondence', id,
        message: `manifest node "${id}" must have exactly one matching DOM semantic target`,
      })
    }
  }
  if (problems.length > 0) throw new Error(problems.map(({ message }) => message).join('\n'))
  return {
    manifest,
    capturePlan: { flatMapSelectors: collector.flatMapSelectors },
  }
}

/**
 * Convenience extractor that statically renders the root and returns only the semantic manifest,
 * discarding the accompanying capture plan.
 */
export const extractSemanticManifest = (root: ReactNode): SemanticManifest =>
  extractSemanticProjection(root).manifest

const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  locked: 'locked',
  open: 'open',
  'awaiting-sign-off': 'awaiting sign-off',
}
