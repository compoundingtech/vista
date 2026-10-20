import { tokens } from '@vista/ui/tokens.stylex'

import type { AgentTimelineScene, Lane } from './projection.ts'
import type { ActivitySegment, SpanHue } from './types.ts'

const PALETTE = [
  {
    base: tokens['--ds-blue-700'],
    muted: tokens['--ds-blue-300'],
    strong: tokens['--ds-blue-900'],
  },
  {
    base: tokens['--ds-purple-700'],
    muted: tokens['--ds-purple-300'],
    strong: tokens['--ds-purple-900'],
  },
  {
    base: tokens['--ds-teal-700'],
    muted: tokens['--ds-teal-300'],
    strong: tokens['--ds-teal-900'],
  },
  {
    base: tokens['--ds-pink-700'],
    muted: tokens['--ds-pink-300'],
    strong: tokens['--ds-pink-900'],
  },
  {
    base: tokens['--ds-amber-700'],
    muted: tokens['--ds-amber-300'],
    strong: tokens['--ds-amber-900'],
  },
  {
    base: tokens['--ds-green-700'],
    muted: tokens['--ds-green-300'],
    strong: tokens['--ds-green-900'],
  },
  { base: tokens['--ds-red-700'], muted: tokens['--ds-red-300'], strong: tokens['--ds-red-900'] },
] as const

/** Progressive rendering tier selected from a span's width in CSS pixels. */
export type SpanDetailTier = 'span' | 'span-end' | 'span-content' | 'span-label'

/** Semantic swatch variants shared by timeline marks and their legend representations. */
export type SpanMarkSwatch =
  | { readonly _tag: 'context-histogram' }
  | { readonly _tag: 'context-estimate' }
  | { readonly _tag: 'binned' }
  | { readonly _tag: 'activity' }
  | { readonly _tag: 'turn-tick' }
  | { readonly _tag: 'model-change' }
  | { readonly _tag: 'prompt-marker'; readonly steering: boolean }
  | { readonly _tag: 'compaction-marker' }
  | { readonly _tag: 'span-end-active' }
  | { readonly _tag: 'span-end-inactive' }
  | { readonly _tag: 'span-end'; readonly failed: boolean }
  | { readonly _tag: 'span-highlight' }
  | { readonly _tag: 'ancestor-dimming' }
  | { readonly _tag: 'cursor-line' }
  | { readonly _tag: 'span-label' }

/** Registry entry coupling a timeline mark's copy, visibility threshold, and legend swatch. */
export interface SpanMarkDefinition {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly minimumTier: SpanDetailTier
  readonly swatch: SpanMarkSwatch
}

/** Semantic registry for every mark Span may draw and Legend must explain. */
export const spanMarks = [
  {
    id: 'context-histogram',
    label: 'context histogram',
    description:
      'Height is the fraction of that request model’s context window. A faint top rule is 100%; an outline-only step means the model capacity is unknown.',
    minimumTier: 'span',
    swatch: { _tag: 'context-histogram' },
  },
  {
    id: 'context-estimate',
    label: 'context estimate',
    description:
      'A dotted top edge marks a context-estimate stretch derived from billed input because no measured context snapshot exists.',
    minimumTier: 'span',
    swatch: { _tag: 'context-estimate' },
  },
  {
    id: 'binned',
    label: 'binned',
    description:
      'A light stipple marks a fixed time bin that preserves folded request, token, tool, model, stop, and spend totals without pretending they are exact request rows. A hatched band inside it spans the min–max context fill of each folded compaction segment; a dotted band edge means estimated tokens or partly unknown capacity.',
    minimumTier: 'span',
    swatch: { _tag: 'binned' },
  },
  {
    id: 'activity',
    label: 'activity',
    description:
      'Working is the context histogram, waiting is a light hatch, and idle is an empty gap.',
    minimumTier: 'span',
    swatch: { _tag: 'activity' },
  },
  {
    id: 'compaction-marker',
    label: 'compaction marker',
    description: 'A histogram drop and labelled notch mark context before and after compaction.',
    minimumTier: 'span-end',
    swatch: { _tag: 'compaction-marker' },
  },
  {
    id: 'prompt-marker',
    label: 'prompt marker',
    description: 'A filled triangle above a root span marks a human prompt.',
    minimumTier: 'span-label',
    swatch: { _tag: 'prompt-marker', steering: false },
  },
  {
    id: 'steering-prompt-marker',
    label: 'steering prompt marker',
    description: 'A hollow triangle above a root span marks a steering prompt.',
    minimumTier: 'span-label',
    swatch: { _tag: 'prompt-marker', steering: true },
  },
  {
    id: 'span-end-active',
    label: 'span end · active',
    description:
      'A green open marker means no exit was observed and the last request is within the 10-minute idle threshold.',
    minimumTier: 'span-end',
    swatch: { _tag: 'span-end-active' },
  },
  {
    id: 'span-end-inactive',
    label: 'span end · inactive',
    description:
      'A faded open marker means no exit was observed and the last request is older than the 10-minute idle threshold.',
    minimumTier: 'span-end',
    swatch: { _tag: 'span-end-inactive' },
  },
  {
    id: 'span-end-exited',
    label: 'span end · exited',
    description: 'A firm cap is reserved for a recorded session exit.',
    minimumTier: 'span-end',
    swatch: { _tag: 'span-end', failed: false },
  },
  {
    id: 'span-end-failed',
    label: 'span end · failed',
    description: 'A red cap with an × marks an exited span whose final request failed.',
    minimumTier: 'span-end',
    swatch: { _tag: 'span-end', failed: true },
  },
  {
    id: 'span-highlight',
    label: 'span highlight',
    description: 'An amber outline marks the selected span or a find match.',
    minimumTier: 'span',
    swatch: { _tag: 'span-highlight' },
  },
  {
    id: 'ancestor-dimming',
    label: 'ancestor dimming',
    description:
      'Reduced opacity preserves the session tree path without presenting ancestors as direct matches.',
    minimumTier: 'span',
    swatch: { _tag: 'ancestor-dimming' },
  },
  {
    id: 'turn-tick',
    label: 'turn tick',
    description:
      'A vertical stroke marks a completed agent turn; close ticks merge at medium span width.',
    minimumTier: 'span-content',
    swatch: { _tag: 'turn-tick' },
  },
  {
    id: 'model-change',
    label: 'model change',
    description: 'A short vertical tick marks when subsequent requests switch to a new model.',
    minimumTier: 'span-content',
    swatch: { _tag: 'model-change' },
  },
  {
    id: 'cursor-line',
    label: 'cursor line',
    description: 'A red rule follows the inspected timestamp.',
    minimumTier: 'span',
    swatch: { _tag: 'cursor-line' },
  },
  {
    id: 'span-label',
    label: 'span label',
    description: 'Wide spans repeat the session label inside the span.',
    minimumTier: 'span-label',
    swatch: { _tag: 'span-label' },
  },
] as const satisfies ReadonlyArray<SpanMarkDefinition>

/** Stable identifier inferred from the canonical span mark registry. */
export type SpanMarkId = (typeof spanMarks)[number]['id']

const SPAN_MARK_BY_ID: Readonly<Record<SpanMarkId, SpanMarkDefinition>> = Object.fromEntries(
  spanMarks.map((mark) => [mark.id, mark]),
) as Record<SpanMarkId, SpanMarkDefinition>

const TIER_RANK: Readonly<Record<SpanDetailTier, number>> = {
  span: 0,
  'span-end': 1,
  'span-content': 2,
  'span-label': 3,
}

/** Select the greatest detail tier supportable by the rendered span width in CSS pixels. */
export const spanDetailTier = (spanWidth: number): SpanDetailTier =>
  spanWidth < 8
    ? 'span'
    : spanWidth < 24
      ? 'span-end'
      : spanWidth <= 96
        ? 'span-content'
        : 'span-label'

/** Test whether a mark is enabled by an optional caller-supplied mark filter. */
export const spanMarkApplies = (
  mark: SpanMarkDefinition,
  options: { readonly marks?: ReadonlySet<SpanMarkId> } = {},
): boolean => options.marks === undefined || options.marks.has(mark.id as SpanMarkId)

/** Test whether a mark's minimum detail requirement is met by the current tier. */
export const spanMarkIsVisible = (id: SpanMarkId, tier: SpanDetailTier): boolean =>
  TIER_RANK[tier] >= TIER_RANK[SPAN_MARK_BY_ID[id].minimumTier]

/** Resolve a lane's visual end as an epoch-millisecond timestamp from its lifecycle state. */
export const laneEnd = (lane: Lane, scene: AgentTimelineScene): number => {
  switch (lane.status._tag) {
    case 'active':
      return scene.model.windowEnd
    case 'inactive':
      return lane.status.lastRequestAt
    case 'exited':
      return lane.status.at
  }
}

/** Resolve the model active at an epoch-millisecond timestamp from ordered model transitions. */
export const modelAt = (lane: Lane, ts: number): string =>
  lane.models.findLast((entry) => entry.from <= ts)?.model ?? lane.session.model

/** Activity is projected from the unthinned ledger using the model's published threshold. */
export const laneActivity = (lane: Lane): ReadonlyArray<ActivitySegment> => lane.activity

const uniqueSorted = (values: Iterable<string>): ReadonlyArray<string> =>
  Array.from(new Set(values)).toSorted()

const paletteIndex = (category: string, categories: ReadonlyArray<string>): number =>
  Math.max(0, categories.indexOf(category)) % PALETTE.length

/** Resolve the categorical span hue from agent type for the active theme. */
export const spanHue = (lane: Lane, scene: AgentTimelineScene, theme: 'light' | 'dark'): SpanHue => {
  const categories = uniqueSorted(
    scene.lanes.map((candidate) => candidate.session.agentType ?? candidate.session.role),
  )
  const agentType = lane.session.agentType ?? lane.session.role
  const palette = PALETTE[paletteIndex(agentType, categories)]!
  return {
    base: palette.base,
    muted: `color-mix(in srgb, ${palette.muted} ${theme === 'dark' ? 62 : 78}%, ${tokens['--ds-background-100']})`,
    strong: palette.strong,
    text: theme === 'dark' ? tokens['--ds-gray-1000'] : tokens['--ds-background-100'],
  }
}

/**
 * Every lane's hue for one scene and theme, sharing one hue object per agent type. Rows read
 * hues from this map so memoized spans see stable props instead of a new object per render.
 */
export const spanHueMap = (
  scene: AgentTimelineScene,
  theme: 'light' | 'dark',
): ReadonlyMap<string, SpanHue> => {
  const byType = new Map<string, SpanHue>()
  const hues = new Map<string, SpanHue>()
  for (const lane of scene.lanes) {
    const agentType = lane.session.agentType ?? lane.session.role
    const hue = byType.get(agentType) ?? spanHue(lane, scene, theme)
    byType.set(agentType, hue)
    hues.set(lane.session.id, hue)
  }
  return hues
}

/** Stable identity, display label, and theme color for one categorical hue legend entry. */
export interface HueLegendItem {
  readonly id: string
  readonly label: string
  readonly color: string
}

/** Legend entries match the same stable agent-type ordering used by spanHue. */
export const hueLegend = (
  scene: AgentTimelineScene,
  theme: 'light' | 'dark' = 'light',
): ReadonlyArray<HueLegendItem> =>
  uniqueSorted(scene.lanes.map((lane) => lane.session.agentType ?? lane.session.role)).map(
    (agentType): HueLegendItem => {
      const lane = scene.lanes.find(
        (candidate) => (candidate.session.agentType ?? candidate.session.role) === agentType,
      )!
      return {
        id: `type:${agentType}`,
        label: agentType,
        color: spanHue(lane, scene, theme).base,
      }
    },
  )
