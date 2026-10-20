/**
 * Shared chrome for every semantic diff lens: title, lens badge, before/after provenance
 * chips, per-kind change summary, the Combined / Side by side arrangement switch, the
 * lens-specific mode picker and collapse. Also owns the change-kind color vocabulary
 * (`changeKindStyles`, `ChangeMark`, `ChangeLegend`) so every lens marks
 * added/removed/changed/moved content the same way, including when lenses nest.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import {
  Button,
  Disclosure,
  DisclosureGroupStateContext,
  DisclosurePanel,
  Focusable,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components'

import {
  arrangementLabel,
  type ChangeCounts,
  type ChangeKind,
  type DiffArrangement,
  type DiffFrameProps,
  type DiffMode,
  type DiffRelation,
  type DiffSide,
} from './contract.ts'

export type { DiffRelation } from './contract.ts'

/** Display order of change kinds in summaries and legends. */
export const changeKinds: readonly ChangeKind[] = [
  'added',
  'removed',
  'changed',
  'moved',
  'unchanged',
]

/** Human label per change kind. */
export const changeKindLabel: Readonly<Record<ChangeKind, string>> = {
  added: 'added',
  removed: 'removed',
  changed: 'changed',
  moved: 'moved',
  unchanged: 'unchanged',
}

/** Raw Geist color per change kind, for SVG strokes/fills and canvas drawing. */
export const changeKindAccent: Readonly<Record<ChangeKind, string>> = {
  added: tokens['--ds-green-900'],
  removed: tokens['--ds-red-900'],
  changed: tokens['--ds-amber-900'],
  moved: tokens['--ds-blue-700'],
  unchanged: tokens['--ds-gray-700'],
}

/**
 * Background tint, border color and text color per change kind. Apply with
 * `stylex.props(changeKindStyles[kind])`; set border width/style yourself. `unchanged` is a no-op.
 */
export const changeKindStyles = stylex.create({
  added: {
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-green-900']} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${tokens['--ds-green-900']} 45%, transparent)`,
    color: tokens['--ds-gray-1000'],
  },
  removed: {
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-red-900']} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${tokens['--ds-red-900']} 45%, transparent)`,
    color: tokens['--ds-gray-1000'],
  },
  changed: {
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-amber-900']} 16%, transparent)`,
    borderColor: `color-mix(in srgb, ${tokens['--ds-amber-900']} 50%, transparent)`,
    color: tokens['--ds-gray-1000'],
  },
  moved: {
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-blue-700']} 10%, transparent)`,
    borderColor: tokens['--ds-blue-700'],
    color: tokens['--ds-gray-1000'],
  },
  unchanged: {},
})

/** Props for {@link ChangeMark}. */
export interface ChangeMarkProps {
  readonly kind: ChangeKind
  /** Render as a block (`div` with an inline-start accent bar) instead of an inline span. */
  readonly block?: boolean
  /** Extra hover text, e.g. `was: Draft` or `moved from §2`. */
  readonly title?: string
  readonly children: React.ReactNode
}

/**
 * Marks a span or block with its change kind: added/removed/changed get a tint (removed
 * inline also strikes through), moved gets a dashed blue outline so it never reads as an
 * edit, unchanged renders its children unmarked.
 */
export const ChangeMark = ({ kind, block = false, title, children }: ChangeMarkProps) => {
  if (kind === 'unchanged') return block ? <div title={title}>{children}</div> : <>{children}</>
  const label = title === undefined ? changeKindLabel[kind] : `${changeKindLabel[kind]}: ${title}`
  if (block) {
    return (
      <div
        data-change-kind={kind}
        title={label}
        {...stylex.props(
          markStyles.block,
          changeKindStyles[kind],
          kind === 'moved' && markStyles.blockMoved,
        )}
      >
        {children}
      </div>
    )
  }
  return (
    <span
      data-change-kind={kind}
      title={label}
      {...stylex.props(
        markStyles.inline,
        changeKindStyles[kind],
        kind === 'removed' && markStyles.inlineRemoved,
        kind === 'moved' && markStyles.inlineMoved,
      )}
    >
      {children}
    </span>
  )
}

/** Props for {@link ChangeLegend}. */
export interface ChangeLegendProps {
  /** Kinds to show; defaults to all except `unchanged`. */
  readonly kinds?: readonly ChangeKind[]
  /** When given, shows counts and hides kinds with a zero/missing count. */
  readonly counts?: ChangeCounts
}

/** Swatch legend explaining the change-kind marks, optionally with counts. */
export const ChangeLegend = ({ kinds, counts }: ChangeLegendProps) => {
  const shown = (kinds ?? changeKinds.filter((kind) => kind !== 'unchanged')).filter(
    (kind) => counts === undefined || (counts[kind] ?? 0) > 0,
  )
  return (
    <ul aria-label="Change legend" {...stylex.props(legendStyles.root)}>
      {shown.map((kind) => (
        <li key={kind} {...stylex.props(legendStyles.item)}>
          <span
            aria-hidden
            {...stylex.props(
              legendStyles.swatch,
              changeKindStyles[kind],
              kind === 'moved' && legendStyles.swatchMoved,
              kind === 'unchanged' && legendStyles.swatchUnchanged,
            )}
          />
          {counts === undefined
            ? changeKindLabel[kind]
            : `${counts[kind]} ${changeKindLabel[kind]}`}
        </li>
      ))}
    </ul>
  )
}

/** Kept as an alias of the contract props for existing imports. */
export type DiffFrameComponentProps = DiffFrameProps

const ArrangementContext = React.createContext<DiffArrangement | undefined>(undefined)
const ModeContext = React.createContext<string | undefined>(undefined)
const VisibleContext = React.createContext(false)

/** Active arrangement of the nearest enclosing `DiffFrame` (or page scope), else `unified`. */
export const useDiffArrangement = (): DiffArrangement =>
  React.useContext(ArrangementContext) ?? 'unified'

/** Active lens-specific mode of the nearest enclosing `DiffFrame`, if it declares modes. */
export const useDiffMode = (): string | undefined => React.useContext(ModeContext)

/**
 * True after the enclosing frame reaches the viewport margin, while it is expanded.
 * Put expensive lens model computation in the body, not the outer lens component:
 * the outer component renders even for collapsed and off-screen frames.
 */
export const useDiffFrameVisible = (): boolean => React.useContext(VisibleContext)

// A single observer serves all frames. The callback ref disconnects removed targets
// (including Strict Mode remounts).
const nearCallbacks = new Map<Element, (near: boolean) => void>()
let nearObserver: IntersectionObserver | undefined
const observeNear = (node: Element, onNear: (near: boolean) => void) => {
  if (typeof IntersectionObserver === 'undefined') {
    onNear(true)
    return () => {}
  }
  nearObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const callback = nearCallbacks.get(entry.target)
        if (callback !== undefined) React.startTransition(() => callback(entry.isIntersecting))
      }
    },
    { rootMargin: '600px' },
  )
  nearCallbacks.set(node, onNear)
  nearObserver.observe(node)
  return () => {
    nearCallbacks.delete(node)
    nearObserver?.unobserve(node)
  }
}

/**
 * Presentation variants kept for the exploration story (`Vista/Blocks/Diff/Explore/DiffFrame`).
 * Not part of the public API: the defaults are the decided chrome (single-row header,
 * pill summary, segmented switch that a {@link DiffPage} takes over).
 */
export interface DiffFrameVariants {
  /** `stacked`: title row + sides row; `inline`: one row, sides as chips; `minimal`: sides in a tooltip. */
  readonly header: 'stacked' | 'inline' | 'minimal'
  /** `pills`: tinted chip per kind; `git`: `+3 −2 ~1 ↔1` text; `bar`: proportional change bar. */
  readonly summary: 'pills' | 'git' | 'bar'
  /** Per-frame switch style outside a {@link DiffPage}: `segmented` text toggle or `icons` with tooltips. */
  readonly switcher: 'segmented' | 'icons'
}

const defaultVariants: DiffFrameVariants = {
  header: 'inline',
  summary: 'pills',
  switcher: 'segmented',
}

const VariantsContext = React.createContext<DiffFrameVariants>(defaultVariants)

/** Exploration-only: applies {@link DiffFrameVariants} to every frame below. */
export const Unstable_DiffFrameVariants = ({
  value,
  children,
}: {
  readonly value: DiffFrameVariants
  readonly children: React.ReactNode
}) => <VariantsContext.Provider value={value}>{children}</VariantsContext.Provider>

/** True below a {@link DiffPage}: the page owns the arrangement switch, frames drop theirs. */
const PageScopeContext = React.createContext(false)

/** Props for {@link DiffPage}. */
export interface DiffPageProps {
  /** Arrangement the page starts in; defaults to `unified`. */
  readonly defaultArrangement?: DiffArrangement
  readonly children: React.ReactNode
}

/**
 * Page-level Combined / Side by side switch for a review page with several diffs. Frames
 * below inherit its arrangement and drop their own switch; a frame given `arrangement` or
 * `defaultArrangement` keeps that local override. Without a `DiffPage`, every top-level
 * frame renders its own switch.
 */
export const DiffPage = ({ defaultArrangement = 'unified', children }: DiffPageProps) => {
  const [arrangement, setArrangement] = React.useState<DiffArrangement>(defaultArrangement)
  // The switch reflects the click immediately; the frames re-render from the deferred value.
  const framesArrangement = React.useDeferredValue(arrangement)
  return (
    <div {...stylex.props(frameStyles.page)}>
      <div {...stylex.props(frameStyles.pageBar)}>
        <span {...stylex.props(frameStyles.pageLabel)}>All diffs</span>
        <ArrangementSwitch value={arrangement} onChange={setArrangement} variant="segmented" />
      </div>
      <PageScopeContext.Provider value={true}>
        <ArrangementContext.Provider value={framesArrangement}>
          {children}
        </ArrangementContext.Provider>
      </PageScopeContext.Provider>
    </div>
  )
}

/**
 * Pair each item of a positional list with a stable React key: its identity plus how often that
 * identity occurred before, so repeated items stay distinct without keying by array index.
 */
export const withOccurrenceKeys = <T,>(
  items: Iterable<T>,
  identity: (item: T) => string,
): readonly { readonly key: string; readonly item: T }[] => {
  const seen = new Map<string, number>()
  return Array.from(items, (item) => {
    const id = identity(item)
    const occurrence = seen.get(id) ?? 0
    seen.set(id, occurrence + 1)
    return { key: `${id}#${occurrence}`, item }
  })
}

const arrangements: readonly DiffArrangement[] = ['unified', 'split']

const isArrangement = (value: string): value is DiffArrangement =>
  arrangements.some((arrangement) => arrangement === value)

const ArrangementIcon = ({ arrangement }: { arrangement: DiffArrangement }) => (
  <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor">
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" strokeWidth="1.2" />
    {arrangement === 'split' ? (
      <path d="M8 2.5v11M3.5 6h3M3.5 9h2.5M9.5 6h3M9.5 9h2" strokeWidth="1.2" />
    ) : (
      <path d="M3.5 5.5h9M3.5 8h6M3.5 10.5h8" strokeWidth="1.2" />
    )}
  </svg>
)

const ArrangementSwitch = ({
  value,
  onChange,
  variant,
}: {
  value: DiffArrangement
  onChange: (next: DiffArrangement) => void
  variant: 'segmented' | 'icons'
}) => (
  <ToggleButtonGroup
    aria-label="Diff arrangement"
    selectionMode="single"
    disallowEmptySelection
    selectedKeys={[value]}
    onSelectionChange={(keys) => {
      const key = Array.from(keys, String)[0]
      if (key !== undefined && isArrangement(key)) onChange(key)
    }}
    {...stylex.props(frameStyles.toggleGroup)}
  >
    {arrangements.map((option) =>
      variant === 'icons' ? (
        <TooltipTrigger key={option} delay={300}>
          <ToggleButton
            id={option}
            aria-label={arrangementLabel[option]}
            {...stylex.props(frameStyles.toggleButton, frameStyles.toggleButtonIcon)}
          >
            <ArrangementIcon arrangement={option} />
          </ToggleButton>
          <Tooltip offset={6} {...stylex.props(frameStyles.tooltip)}>
            {arrangementLabel[option]}
          </Tooltip>
        </TooltipTrigger>
      ) : (
        <ToggleButton key={option} id={option} {...stylex.props(frameStyles.toggleButton)}>
          {arrangementLabel[option]}
        </ToggleButton>
      ),
    )}
  </ToggleButtonGroup>
)

const ModePicker = ({
  modes,
  value,
  onChange,
}: {
  modes: readonly DiffMode[]
  value: string | undefined
  onChange: (next: string) => void
}) => (
  <ToggleButtonGroup
    aria-label="Diff mode"
    selectionMode="single"
    disallowEmptySelection
    selectedKeys={value === undefined ? [] : [value]}
    onSelectionChange={(keys) => {
      const key = Array.from(keys, String)[0]
      if (key !== undefined) onChange(key)
    }}
    {...stylex.props(frameStyles.toggleGroup)}
  >
    {modes.map((option) => (
      <ToggleButton key={option.id} id={option.id} {...stylex.props(frameStyles.toggleButton)}>
        {option.label}
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
)

type SidePosition = 'before' | 'after'

const sideRole = (position: SidePosition, relation: DiffRelation): string =>
  relation === 'peer'
    ? position === 'before'
      ? 'A'
      : 'B'
    : position === 'before'
      ? 'Before'
      : 'After'

const basisText = (side: DiffSide): string =>
  side.basis === 'projected' ? 'projected, not observed state' : 'observed state'

const SideDetails = ({
  position,
  side,
  relation,
}: {
  position: SidePosition
  side: DiffSide
  relation: DiffRelation
}) => (
  <span {...stylex.props(frameStyles.sideDetails)}>
    <span {...stylex.props(frameStyles.sideDetailsTitle)}>
      {sideRole(position, relation)}: {side.label}
    </span>
    <span>{basisText(side)}</span>
    {side.provenance === undefined ? null : <span>{side.provenance}</span>}
  </span>
)

/** Side chip; provenance always lives in a keyboard-reachable tooltip, `showProvenance` also prints it inline. */
const SideChip = ({
  position,
  side,
  relation,
  showProvenance,
}: {
  position: SidePosition
  side: DiffSide
  relation: DiffRelation
  showProvenance: boolean
}) => {
  const projected = side.basis === 'projected'
  return (
    <TooltipTrigger delay={300}>
      <Focusable>
        <span
          role="img"
          tabIndex={0}
          aria-label={`${sideRole(position, relation)}: ${side.label}, ${basisText(side)}`}
          data-basis={side.basis}
          {...stylex.props(frameStyles.chip, projected && frameStyles.chipProjected)}
        >
          <span {...stylex.props(frameStyles.chipRole)}>{sideRole(position, relation)}</span>
          <span {...stylex.props(frameStyles.chipLabel)}>{side.label}</span>
          {projected ? <span {...stylex.props(frameStyles.projectedTag)}>projected</span> : null}
          {showProvenance && side.provenance !== undefined ? (
            <span {...stylex.props(frameStyles.chipProvenance)}>{side.provenance}</span>
          ) : null}
        </span>
      </Focusable>
      <Tooltip offset={6} {...stylex.props(frameStyles.tooltip)}>
        <SideDetails position={position} side={side} relation={relation} />
      </Tooltip>
    </TooltipTrigger>
  )
}

const RelationGlyph = ({ relation }: { relation: DiffRelation }) =>
  relation === 'peer' ? (
    <span {...stylex.props(frameStyles.relation, frameStyles.relationPeer)}>vs</span>
  ) : (
    <span aria-hidden {...stylex.props(frameStyles.relation)}>
      →
    </span>
  )

/** `minimal` header: both sides collapse into one `Before → After` (peer: `A vs B`) handle whose tooltip carries labels and provenance. */
const SidesHandle = ({
  before,
  after,
  relation,
}: {
  before: DiffSide
  after: DiffSide
  relation: DiffRelation
}) => {
  const projected = before.basis === 'projected' || after.basis === 'projected'
  return (
    <TooltipTrigger delay={200}>
      <Focusable>
        <span
          role="img"
          tabIndex={0}
          aria-label={`${sideRole('before', relation)}: ${before.label}; ${sideRole('after', relation)}: ${after.label}`}
          {...stylex.props(frameStyles.sidesHandle, projected && frameStyles.chipProjected)}
        >
          {sideRole('before', relation)} {relation === 'peer' ? 'vs' : '→'}{' '}
          {sideRole('after', relation)}
          {projected ? ' · projected' : ''}
        </span>
      </Focusable>
      <Tooltip offset={6} {...stylex.props(frameStyles.tooltip, frameStyles.tooltipStack)}>
        <SideDetails position="before" side={before} relation={relation} />
        <SideDetails position="after" side={after} relation={relation} />
      </Tooltip>
    </TooltipTrigger>
  )
}

const summaryKinds: readonly ChangeKind[] = ['added', 'removed', 'changed', 'moved']

const changeGlyph: Readonly<Record<ChangeKind, string>> = {
  added: '+',
  removed: '−',
  changed: '~',
  moved: '↔',
  unchanged: '=',
}

/** Per-kind count summary in the chosen style. Removed counts are never struck through: strikethrough marks removed content only. */
const CountSummary = ({
  counts,
  style,
}: {
  counts: ChangeCounts | undefined
  style: DiffFrameVariants['summary']
}) => {
  if (counts === undefined) return null
  const changes = summaryKinds.reduce((total, kind) => total + (counts[kind] ?? 0), 0)
  const unchanged = counts.unchanged ?? 0
  if (changes === 0) {
    return (
      <span data-no-changes {...stylex.props(frameStyles.noChanges)}>
        no changes
        {unchanged > 0 ? ` · ${unchanged} unchanged` : ''}
      </span>
    )
  }
  const shown = changeKinds.filter((kind) => (counts[kind] ?? 0) > 0)
  const label = `Change summary: ${shown.map((kind) => `${counts[kind]} ${changeKindLabel[kind]}`).join(', ')}`
  switch (style) {
    case 'git':
      return (
        <span role="group" aria-label={label} {...stylex.props(frameStyles.git)}>
          {shown.map((kind) => (
            <span
              key={kind}
              aria-hidden
              data-change-kind={kind}
              {...stylex.props(frameStyles.gitCount, gitStyles[kind])}
            >
              {changeGlyph[kind]}
              {counts[kind]}
            </span>
          ))}
        </span>
      )
    case 'bar': {
      const total = changes + unchanged
      return (
        <span {...stylex.props(frameStyles.barSummary)}>
          <span role="img" aria-label={label} {...stylex.props(frameStyles.bar)}>
            {shown.map((kind) => (
              <span
                key={kind}
                data-change-kind={kind}
                {...stylex.props(frameStyles.barSegment(counts[kind] ?? 0), barStyles[kind])}
              />
            ))}
          </span>
          <span aria-hidden {...stylex.props(frameStyles.barText)}>
            {changes}/{total} changed
          </span>
        </span>
      )
    }
    case 'pills':
      return (
        <span role="group" aria-label="Change summary" {...stylex.props(frameStyles.summary)}>
          {shown.map((kind) => (
            <span
              key={kind}
              data-change-kind={kind}
              {...stylex.props(
                frameStyles.count,
                changeKindStyles[kind],
                kind === 'moved' && frameStyles.countMoved,
                kind === 'unchanged' && frameStyles.countUnchanged,
              )}
            >
              <span {...stylex.props(frameStyles.countValue)}>{counts[kind]}</span>
              {changeKindLabel[kind]}
            </span>
          ))}
        </span>
      )
  }
}

const Chevron = ({ expanded }: { expanded: boolean }) => (
  <svg
    aria-hidden
    viewBox="0 0 12 12"
    width="10"
    height="10"
    {...stylex.props(frameStyles.chevron, !expanded && frameStyles.chevronCollapsed)}
  >
    <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

/** Keep mounted bodies alive off screen but hold their context values until they return. */
const FrameBody = React.memo(
  ({
    children,
    arrangement,
    mode,
    near,
  }: {
    readonly children: React.ReactNode
    readonly arrangement: DiffArrangement
    readonly mode: string | undefined
    readonly near: boolean
  }) => {
    const shown = React.useRef({ arrangement, mode })
    if (near) shown.current = { arrangement, mode }
    return (
      <ArrangementContext.Provider value={shown.current.arrangement}>
        <ModeContext.Provider value={shown.current.mode}>
          <VisibleContext.Provider value={true}>{children}</VisibleContext.Provider>
        </ModeContext.Provider>
      </ArrangementContext.Provider>
    )
  },
)

/**
 * Frame shared by every diff lens. The body reads the active arrangement and mode with
 * {@link useDiffArrangement} / {@link useDiffMode}. Arrangement, mode and collapse are each
 * controlled when their value prop is passed, uncontrolled otherwise; an uncontrolled
 * arrangement follows the nearest parent frame until the reviewer picks one locally.
 * The title is the collapse trigger; collapsed frames keep header and summary only.
 */
export const DiffFrame = ({
  id,
  title,
  lens,
  before,
  after,
  counts,
  arrangement,
  defaultArrangement,
  onArrangementChange,
  modes,
  mode,
  defaultMode,
  onModeChange,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  nested = false,
  relation = 'temporal',
  children,
}: DiffFrameComponentProps) => {
  const variants = React.useContext(VariantsContext)
  const pageOwnsArrangement = React.useContext(PageScopeContext)
  const parentArrangement = React.useContext(ArrangementContext)
  const [localArrangement, setLocalArrangement] = React.useState<DiffArrangement | undefined>(
    defaultArrangement,
  )
  const [localMode, setLocalMode] = React.useState<string | undefined>(defaultMode)

  const activeArrangement = arrangement ?? localArrangement ?? parentArrangement ?? 'unified'
  const activeModes = modes?.filter((option) => option.arrangement === activeArrangement) ?? []
  const requestedMode = mode ?? localMode
  const activeMode =
    activeModes.find((option) => option.id === requestedMode)?.id ?? activeModes[0]?.id

  const [near, setNear] = React.useState(false)
  const hasMounted = React.useRef(false)
  if (near) hasMounted.current = true
  const cleanupObserver = React.useRef<(() => void) | undefined>(undefined)
  const frameRef = React.useCallback((node: HTMLElement | null) => {
    cleanupObserver.current?.()
    cleanupObserver.current = node === null ? undefined : observeNear(node, setNear)
  }, [])

  const selectArrangement = (next: DiffArrangement) => {
    if (arrangement === undefined) setLocalArrangement(next)
    onArrangementChange?.(next)
  }
  const selectMode = (next: string) => {
    if (mode === undefined) setLocalMode(next)
    onModeChange?.(next)
  }

  const { header, summary, switcher } = variants
  const sides =
    header === 'minimal' ? (
      <SidesHandle before={before} after={after} relation={relation} />
    ) : (
      <span {...stylex.props(frameStyles.sides)}>
        <SideChip
          position="before"
          side={before}
          relation={relation}
          showProvenance={header === 'stacked' && !nested}
        />
        <RelationGlyph relation={relation} />
        <SideChip
          position="after"
          side={after}
          relation={relation}
          showProvenance={header === 'stacked' && !nested}
        />
      </span>
    )

  return (
    <section
      id={id}
      data-lens={lens}
      data-relation={relation}
      ref={frameRef}
      {...stylex.props(frameStyles.root, nested ? frameStyles.rootNested : frameStyles.rootTop)}
    >
      {/* A frame nested in a lens's DisclosureGroup must not be driven by that group. */}
      <DisclosureGroupStateContext.Provider value={null}>
        <Disclosure
          {...(collapsed === undefined ? {} : { isExpanded: !collapsed })}
          defaultExpanded={!defaultCollapsed}
          onExpandedChange={(expanded) => onCollapsedChange?.(!expanded)}
        >
          {({ isExpanded }) => (
            <>
              <header
                {...stylex.props(
                  frameStyles.header,
                  nested && frameStyles.headerNested,
                  !isExpanded && frameStyles.headerCollapsed,
                )}
              >
                <div {...stylex.props(frameStyles.titleRow)}>
                  <h3 {...stylex.props(frameStyles.heading, nested && frameStyles.headingNested)}>
                    <Button slot="trigger" {...stylex.props(frameStyles.trigger)}>
                      <Chevron expanded={isExpanded} />
                      <span {...stylex.props(frameStyles.lens)}>{lens}</span>
                      <span {...stylex.props(frameStyles.title)}>{title}</span>
                    </Button>
                  </h3>
                  {header === 'stacked' ? null : sides}
                  <CountSummary counts={counts} style={summary} />
                  {isExpanded ? (
                    <span {...stylex.props(frameStyles.controls)}>
                      {activeModes.length > 1 ? (
                        <ModePicker modes={activeModes} value={activeMode} onChange={selectMode} />
                      ) : null}
                      {pageOwnsArrangement ? null : (
                        <ArrangementSwitch
                          value={activeArrangement}
                          onChange={selectArrangement}
                          variant={switcher}
                        />
                      )}
                    </span>
                  ) : null}
                </div>
                {header === 'stacked' ? sides : null}
              </header>
              <DisclosurePanel
                {...stylex.props(frameStyles.body, nested && frameStyles.bodyNested)}
              >
                {isExpanded ? (
                  hasMounted.current ? (
                    <FrameBody arrangement={activeArrangement} mode={activeMode} near={near}>
                      {children}
                    </FrameBody>
                  ) : (
                    <div aria-hidden="true" {...stylex.props(frameStyles.placeholder)} />
                  )
                ) : null}
              </DisclosurePanel>
            </>
          )}
        </Disclosure>
      </DisclosureGroupStateContext.Provider>
    </section>
  )
}

const markStyles = stylex.create({
  inline: {
    borderRadius: scale.radiusSm,
    borderWidth: 1,
    borderStyle: 'solid',
    paddingInline: '0.12em',
    boxDecorationBreak: 'clone',
  },
  inlineRemoved: {
    textDecorationLine: 'line-through',
    textDecorationThickness: '1px',
  },
  inlineMoved: {
    borderStyle: 'dashed',
  },
  block: {
    borderWidth: 0,
    borderInlineStartWidth: 3,
    borderInlineStartStyle: 'solid',
    borderRadius: scale.radiusSm,
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    color: 'inherit',
  },
  blockMoved: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderInlineStartWidth: 3,
    borderInlineStartStyle: 'dashed',
  },
})

const legendStyles = stylex.create({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: scale.space3,
    listStyle: 'none',
    margin: 0,
    padding: 0,
    fontSize: '0.75rem',
    color: tokens['--ds-gray-900'],
  },
  item: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space1,
  },
  swatch: {
    display: 'inline-block',
    width: '0.8rem',
    height: '0.8rem',
    borderRadius: scale.radiusSm,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  swatchMoved: {
    borderStyle: 'dashed',
  },
  swatchUnchanged: {
    borderColor: tokens['--ds-gray-alpha-400'],
  },
})

const gitStyles = stylex.create({
  added: { color: tokens['--ds-green-900'] },
  removed: { color: tokens['--ds-red-900'] },
  changed: { color: tokens['--ds-amber-900'] },
  moved: { color: tokens['--ds-blue-700'] },
  unchanged: { color: tokens['--ds-gray-900'] },
})

const barStyles = stylex.create({
  added: { backgroundColor: tokens['--ds-green-900'] },
  removed: { backgroundColor: tokens['--ds-red-900'] },
  changed: { backgroundColor: tokens['--ds-amber-900'] },
  moved: { backgroundColor: tokens['--ds-blue-700'] },
  unchanged: { backgroundColor: tokens['--ds-gray-alpha-300'] },
})

const frameStyles = stylex.create({
  root: {
    minWidth: 0,
    color: tokens['--ds-gray-1000'],
  },
  rootTop: {
    backgroundColor: tokens['--ds-background-100'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    overflow: 'hidden',
  },
  rootNested: {
    borderInlineStartWidth: 2,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: tokens['--ds-gray-alpha-400'],
    paddingInlineStart: scale.space2,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
    backgroundColor: tokens['--ds-background-200'],
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  headerNested: {
    paddingBlock: scale.space1,
    paddingInline: 0,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  headerCollapsed: {
    borderBottomWidth: 0,
  },
  titleRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: scale.space2,
    minWidth: 0,
  },
  heading: {
    margin: 0,
    flex: '1 1 12rem',
    minWidth: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  headingNested: {
    fontSize: '0.85rem',
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    width: '100%',
    minWidth: 0,
    padding: 0,
    borderWidth: 0,
    borderRadius: scale.radiusSm,
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'start',
    cursor: 'pointer',
    outlineColor: tokens['--ds-blue-700'],
    outlineStyle: { default: 'none', ':is([data-focus-visible])': 'solid' },
    outlineWidth: 2,
    outlineOffset: 2,
  },
  chevron: {
    flexShrink: 0,
    color: tokens['--ds-gray-900'],
    transitionProperty: 'transform',
    transitionDuration: '120ms',
  },
  chevronCollapsed: {
    transform: 'rotate(-90deg)',
  },
  lens: {
    flexShrink: 0,
    fontFamily: scale.fontMono,
    fontSize: '0.68rem',
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens['--ds-gray-900'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    paddingInline: '0.35rem',
    lineHeight: 1.5,
  },
  title: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  controls: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: scale.space2,
    marginInlineStart: 'auto',
  },
  summary: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: scale.space1,
  },
  count: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.25rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: scale.radiusSm,
    paddingInline: '0.35rem',
    fontSize: '0.72rem',
    lineHeight: 1.6,
  },
  countMoved: {
    borderStyle: 'dashed',
  },
  countUnchanged: {
    color: tokens['--ds-gray-900'],
    borderColor: tokens['--ds-gray-alpha-400'],
  },
  countValue: {
    fontWeight: 650,
    fontVariantNumeric: 'tabular-nums',
  },
  git: {
    display: 'inline-flex',
    gap: '0.5rem',
    fontFamily: scale.fontMono,
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
  },
  gitCount: {
    fontWeight: 600,
  },
  barSummary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space2,
  },
  bar: {
    display: 'inline-flex',
    gap: 1,
    width: '6rem',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  barSegment: (grow: number) => ({
    flexGrow: grow,
    flexShrink: 0,
    flexBasis: 0,
    minWidth: 3,
  }),
  barText: {
    fontSize: '0.72rem',
    color: tokens['--ds-gray-900'],
    fontVariantNumeric: 'tabular-nums',
  },
  noChanges: {
    fontSize: '0.72rem',
    color: tokens['--ds-gray-900'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    paddingInline: '0.35rem',
    lineHeight: 1.6,
  },
  toggleGroup: {
    display: 'inline-flex',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    overflow: 'hidden',
  },
  toggleButton: {
    display: 'inline-flex',
    alignItems: 'center',
    font: 'inherit',
    fontSize: '0.72rem',
    paddingInline: '0.5rem',
    paddingBlock: '0.1rem',
    borderWidth: 0,
    cursor: 'pointer',
    backgroundColor: {
      default: 'transparent',
      ':hover': tokens['--ds-gray-alpha-100'],
      ':is([data-selected])': tokens['--ds-gray-alpha-200'],
    },
    color: {
      default: tokens['--ds-gray-900'],
      ':is([data-selected])': tokens['--ds-gray-1000'],
    },
    outlineColor: tokens['--ds-blue-700'],
    outlineStyle: { default: 'none', ':is([data-focus-visible])': 'solid' },
    outlineWidth: 2,
    outlineOffset: -2,
  },
  toggleButtonIcon: {
    paddingInline: '0.3rem',
    paddingBlock: '0.2rem',
  },
  tooltip: {
    maxWidth: 360,
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-gray-1000'],
    fontSize: '0.72rem',
    lineHeight: 1.45,
    boxShadow: '0 4px 14px rgb(0 0 0 / 0.14)',
    outline: 'none',
  },
  tooltipStack: {
    display: 'grid',
    gap: scale.space2,
  },
  sideDetails: {
    display: 'grid',
    color: tokens['--ds-gray-900'],
  },
  sideDetailsTitle: {
    fontWeight: 600,
    color: tokens['--ds-gray-1000'],
  },
  sides: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: scale.space2,
    minWidth: 0,
  },
  relation: {
    color: tokens['--ds-gray-700'],
    fontSize: '0.8rem',
  },
  relationPeer: {
    fontFamily: scale.fontMono,
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens['--ds-gray-900'],
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.35rem',
    minWidth: 0,
    maxWidth: '100%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    paddingInline: '0.4rem',
    fontSize: '0.75rem',
    lineHeight: 1.6,
    backgroundColor: tokens['--ds-background-100'],
    cursor: 'default',
    outlineColor: tokens['--ds-blue-700'],
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineOffset: 1,
  },
  chipProjected: {
    borderStyle: 'dashed',
    borderColor: tokens['--ds-purple-700'],
    backgroundImage: `repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, ${tokens['--ds-purple-700']} 8%, transparent) 6px 8px)`,
  },
  chipRole: {
    fontFamily: scale.fontMono,
    fontSize: '0.65rem',
    color: tokens['--ds-gray-800'],
  },
  chipLabel: {
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  projectedTag: {
    fontFamily: scale.fontMono,
    fontSize: '0.62rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens['--ds-purple-900'],
  },
  chipProvenance: {
    minWidth: 0,
    color: tokens['--ds-gray-900'],
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sidesHandle: {
    fontFamily: scale.fontMono,
    fontSize: '0.68rem',
    color: tokens['--ds-gray-900'],
    borderWidth: 1,
    borderStyle: 'dotted',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    paddingInline: '0.35rem',
    lineHeight: 1.6,
    cursor: 'help',
    outlineColor: tokens['--ds-blue-700'],
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineOffset: 1,
  },
  body: {
    padding: scale.space3,
    minWidth: 0,
    contentVisibility: 'auto',
    containIntrinsicSize: 'auto 480px',
  },
  placeholder: {
    minHeight: 480,
    contentVisibility: 'auto',
    containIntrinsicSize: 'auto 480px',
  },
  bodyNested: {
    paddingBlock: scale.space1,
    paddingInline: 0,
  },
  page: {
    display: 'grid',
    gap: scale.space3,
  },
  pageBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale.space2,
    paddingBlock: scale.space1,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  pageLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: tokens['--ds-gray-900'],
  },
})
