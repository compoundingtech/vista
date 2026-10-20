import { createElement, type ReactNode } from 'react'

import { Ask } from './authoring.tsx'
import type { DiffArrangement } from './blocks/diff/contract.ts'
import type { ChoiceCardsProps } from './blocks/kit/ChoiceCards.tsx'
import type { NoteProps } from './blocks/kit/Note.tsx'

/** Node-safe semantic evaluator surface. Public app source still imports only `@vista/blocks`. */
export {
  AppRoot,
  Ask,
  Decision,
  Evidence,
  Fork,
  RuntimeIsland,
  Ref,
  Section,
  extractSemanticManifest,
  extractSemanticProjection,
  type AddressableProps,
  type AppRootProps,
  type DecisionProps,
  type SemanticExtraction,
  type RuntimeIslandProps,
  type RefProps,
  type SectionProps,
} from './authoring.tsx'
export {
  DecisionStatusSchema,
  SemanticKindSchema,
  SemanticManifestSchema,
  SemanticNodeSchema,
  SemanticStatusSchema,
  decodeSemanticManifest,
  decodeSemanticManifestJson,
  validatePatch,
  validateSemanticManifest,
  type PatchProblem,
  type SemanticKind,
  type SemanticManifest,
  type SemanticManifestNode,
  type SemanticManifestProblem,
  type SemanticStatus,
} from './semantic.ts'
export * from './data-components.tsx'
export * from './blocks/PullRequestDataBlocks.tsx'
export * from './blocks/LivePty.tsx'
export {
  buildTreemapModel,
  fromDu,
  fromGitDiff,
  type BuildTreemapOptions,
  type FileChange,
  type FromGitDiffOptions,
  type GitDiffValueField,
  type Provenance,
  type TreemapEntry,
} from './treemap-model.ts'
export * from './model.ts'
export { ThemeProvider, useTheme } from './theme.ts'

const SemanticOnlyBlock = ({ children }: { readonly children?: ReactNode }) => children ?? null

/** Semantic-only `ChoiceCards`: the controls are presentation, the ask registration is not. */
export const ChoiceCards = ({ id, label }: ChoiceCardsProps) =>
  createElement(Ask, { id, ...(label === undefined ? {} : { label }) })

/** Semantic-only `Note`: the explanation is presentation; the wrapped content is not. */
export const Note = ({ children }: NoteProps) => children

export {
  SemanticOnlyBlock as AppShell,
  SemanticOnlyBlock as AskBlock,
  SemanticOnlyBlock as Callout,
  SemanticOnlyBlock as Comparison,
  SemanticOnlyBlock as ContextHeader,
  SemanticOnlyBlock as ChangeLegend,
  SemanticOnlyBlock as ChangeMark,
  SemanticOnlyBlock as ChartBlock,
  SemanticOnlyBlock as CodeDiff,
  SemanticOnlyBlock as DecisionLog,
  SemanticOnlyBlock as DiagramDiff,
  SemanticOnlyBlock as Diff,
  SemanticOnlyBlock as DiffFrame,
  SemanticOnlyBlock as DiffPage,
  SemanticOnlyBlock as DiffSummary,
  SemanticOnlyBlock as DocumentDiff,
  SemanticOnlyBlock as FileTree,
  SemanticOnlyBlock as Icon,
  SemanticOnlyBlock as ImageCompareSet,
  SemanticOnlyBlock as ImageDiff,
  SemanticOnlyBlock as PageSetDiff,
  SemanticOnlyBlock as PullRequestViewer,
  SemanticOnlyBlock as ForkBlock,
  SemanticOnlyBlock as InspectRow,
  SemanticOnlyBlock as InterfacesTable,
  SemanticOnlyBlock as LazyBlock,
  SemanticOnlyBlock as Markdown,
  SemanticOnlyBlock as Mark,
  SemanticOnlyBlock as CodeBlock,
  SemanticOnlyBlock as MermaidDiagram,
  SemanticOnlyBlock as MissionGraph,
  SemanticOnlyBlock as OptionsGrid,
  SemanticOnlyBlock as ProgressLanes,
  SemanticOnlyBlock as RankedFindings,
  SemanticOnlyBlock as RecordDiff,
  SemanticOnlyBlock as ResponsibilitiesTable,
  SemanticOnlyBlock as SemanticDiff,
  SemanticOnlyBlock as Settled,
  SemanticOnlyBlock as SnapshotBadge,
  SemanticOnlyBlock as SnapshotModeView,
  SemanticOnlyBlock as StatusLine,
  SemanticOnlyBlock as SystemExplorer,
  SemanticOnlyBlock as TextDiff,
  SemanticOnlyBlock as TimeTrack,
  SemanticOnlyBlock as TraceDiff,
  SemanticOnlyBlock as Treemap,
  SemanticOnlyBlock as TreeDiff,
}

/** Semantic-only `useDiffArrangement`: outside any `DiffFrame` a body sees `unified`. */
export const useDiffArrangement = (): DiffArrangement => 'unified'
/** Semantic-only `useDiffMode`: outside any `DiffFrame` there is no active mode. */
export const useDiffMode = (): string | undefined => undefined
/** Semantic-only `useDiffFrameVisible`: outside any `DiffFrame` a body is never visible. */
export const useDiffFrameVisible = (): boolean => false

export type { AppShellNavigation, AppShellProps } from './AppShell.tsx'
export type { Choice, ChoiceCardsProps } from './blocks/kit/ChoiceCards.tsx'
export type { ComparisonProps } from './blocks/kit/Comparison.tsx'
export type { ContextHeaderProps } from './blocks/kit/ContextHeader.tsx'
export type { IconName, IconProps } from './blocks/kit/icons.tsx'
export type { InspectRowProps } from './blocks/kit/InspectRow.tsx'
export type { MarkProps, Tone } from './blocks/kit/Mark.tsx'
export type {
  MissionGate,
  MissionGraphProps,
  MissionOverlay,
  MissionStep,
} from './blocks/kit/MissionGraph.tsx'
export type { NoteProps } from './blocks/kit/Note.tsx'
export type { LaneState, ProgressLane, ProgressLanesProps } from './blocks/kit/ProgressLanes.tsx'
export type { Finding, RankedFindingsProps } from './blocks/kit/RankedFindings.tsx'
export type { TimeTrackProps, TimeTrackRow } from './blocks/kit/TimeTrack.tsx'
export type { LazyBlockProps } from './LazyBlock.tsx'
export type { SystemExplorerProps } from './blocks/system-explorer/SystemExplorer.tsx'
export type {
  PullRequestData,
  PullRequestFile,
  PullRequestViewerProps,
} from './blocks/PullRequestViewer.tsx'
export type {
  DepthIndicatorVariant,
  TreemapDetailProps,
  TreemapProps,
} from './blocks/treemap/Treemap.tsx'
export type { SnapshotPresentation } from './blocks/SnapshotModeView.tsx'
export type { SemanticDiffProps } from './blocks/diff/SemanticDiff.tsx'
export type {
  DiffInput,
  DiffSubject,
  DiffSubjectTag,
  DocumentSubjectSnapshot,
  RecordFieldValue,
  RecordFields,
  SubjectDocBlock,
  SubjectEmbedBlock,
  SubjectField,
  TextShape,
} from './blocks/diff/subject.ts'
export type {
  ChangeCounts,
  ChangeKind,
  DiffArrangement,
  DiffFrameProps,
  DiffMode,
  DiffRelation,
  DiffSide,
} from './blocks/diff/contract.ts'
export type { ChangeLegendProps, ChangeMarkProps, DiffPageProps } from './blocks/diff/DiffFrame.tsx'
export type {
  DiffLedger,
  DiffLedgerStep,
  DiffSummaryDelta,
  DiffSummaryProps,
} from './blocks/diff/DiffSummary.tsx'
export type {
  CompareSetEntry,
  ImageCandidate,
  ImageCompareSetProps,
  ImageDiffModel,
  ImageDiffProps,
  ImageSource,
} from './blocks/diff/ImageDiff.tsx'
export type {
  PageImage,
  PageSetDiffProps,
  PageSetModel,
  PageSetSide,
} from './blocks/diff/PageSetDiff.tsx'
export type { TextDiffModel, TextDiffProps } from './blocks/diff/TextDiff.tsx'
export type {
  RecordDiffModel,
  RecordDiffProps,
  RecordEntries,
  RecordValue,
} from './blocks/diff/RecordDiff.tsx'
export type { CodeDiffModel, CodeDiffProps } from './blocks/diff/CodeDiff.tsx'
export type {
  DocBlock,
  DocSnapshot,
  DocumentDiffModel,
  DocumentDiffProps,
  EmbedBlock,
} from './blocks/diff/DocumentDiff.tsx'
export type {
  TreeDiffModel,
  TreeDiffProps,
  TreeNode,
  TreeSnapshot,
} from './blocks/diff/TreeDiff.tsx'
export type { TraceDiffModel, TraceDiffProps } from './blocks/diff/TraceDiff.tsx'
export type {
  DiagramDiffModel,
  DiagramDiffProps,
  DiagramEdge,
  DiagramGraph,
  DiagramNode,
} from './blocks/diff/DiagramDiff.tsx'
