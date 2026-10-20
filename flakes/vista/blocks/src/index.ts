/// <reference path="./types/css.d.ts" />
/// <reference path="./types/telemetry-island.d.ts" />
/// <reference path="./types/vista-data.d.ts" />

/** Client-only presentation for the node-safe markup `authoring.tsx` emits. */
import './semantic-chrome.css'

/** Public surface of the Vista semantic React primitives and reusable components. */
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
  type AddressableProps,
  type AppRootProps,
  type DecisionProps,
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
  validateSemanticManifest,
  type SemanticKind,
  type SemanticManifest,
  validatePatch,
  type PatchProblem,
  type SemanticManifestNode,
  type SemanticManifestProblem,
  type SemanticStatus,
} from './semantic.ts'
export * from './data-components.tsx'
export * from './data-query.tsx'
export * from './model.ts'
/** Typed bindings for app-owned projections sharing the host's data runtime. */
export { bind } from './data-contract.ts'
export { otel } from './provider-contracts.ts'
export {
  annotationUiStorageKey,
  AppShell,
  type AppShellNavigation,
  type AppShellProps,
} from './AppShell.tsx'
export { LazyBlock, type LazyBlockProps } from './LazyBlock.tsx'
export {
  AppVersionPreferenceProvider,
  ResizableSplit,
  projectResizeIntent,
  projectUsefulExtentBounds,
  resizeIntentStorageKey,
  type AppVersionPreferenceIdentity,
  type ResizableSplitProps,
  type ResizeIntent,
  type SplitBounds,
  type SplitContentSemantics,
  type UsefulExtentReadiness,
  type UsefulExtentSample,
} from './blocks/ResizableSplit.tsx'
/** The taste kit: context-first page grammar, real choice controls, semantic tones and icons. */
export { ChoiceCards, type Choice, type ChoiceCardsProps } from './blocks/kit/ChoiceCards.tsx'
export { Comparison, type ComparisonProps } from './blocks/kit/Comparison.tsx'
export { ContextHeader, type ContextHeaderProps } from './blocks/kit/ContextHeader.tsx'
export { Icon, type IconName, type IconProps } from './blocks/kit/icons.tsx'
export { InspectRow, type InspectRowProps } from './blocks/kit/InspectRow.tsx'
export { Mark, type MarkProps, type Tone } from './blocks/kit/Mark.tsx'
export {
  MissionGraph,
  type MissionGate,
  type MissionGraphProps,
  type MissionOverlay,
  type MissionStep,
} from './blocks/kit/MissionGraph.tsx'
export { Note, type NoteProps } from './blocks/kit/Note.tsx'
export {
  ProgressLanes,
  type LaneState,
  type ProgressLane,
  type ProgressLanesProps,
} from './blocks/kit/ProgressLanes.tsx'
export {
  RankedFindings,
  type Finding,
  type RankedFindingsProps,
} from './blocks/kit/RankedFindings.tsx'
export { TimeTrack, type TimeTrackProps, type TimeTrackRow } from './blocks/kit/TimeTrack.tsx'
export { ThemeProvider, useTheme } from './theme.ts'
export { VistaHostRuntimeProvider, type VistaHostRuntime } from './host-runtime.tsx'

export { Ask as AskBlock, Fork as ForkBlock, Settled, StatusLine } from './blocks/doctrine.tsx'
export {
  Callout,
  DecisionLog,
  InterfacesTable,
  OptionsGrid,
  ResponsibilitiesTable,
} from './blocks/content.tsx'
export { Markdown } from './blocks/markdown.tsx'
export { CodeBlock, type CodeBlockProps } from './blocks/CodeBlock.tsx'
export { MermaidDiagram } from './blocks/MermaidDiagram.tsx'
export {
  SnapshotModeView,
  snapshotUnavailableMessage,
  snapshotUnsupportedMessage,
  type SnapshotPresentation,
} from './blocks/SnapshotModeView.tsx'
export { SnapshotBadge } from './blocks/SnapshotBadge.tsx'
export { ChartBlock } from './blocks/ChartBlock.tsx'
export * from './blocks/decision-review/index.ts'
export {
  SpendByProject,
  SpendByProjectView,
  UsageOverTime,
  UsageOverTimeView,
  type SpendByProjectProps,
  type SpendByProjectViewProps,
  type UsageGroupBy,
  type UsageOverTimeProps,
  type UsageOverTimeViewProps,
} from './blocks/UsageBlocks.tsx'
export { Diff } from './blocks/Diff.tsx'
/**
 * Semantic diff family: data-first `SemanticDiff`, shared frame chrome and the hooks a custom
 * body reads, and the lenses as the escape hatch, each with its pure model function.
 */
export {
  SemanticDiff,
  diffSubjectCounts,
  type SemanticDiffProps,
} from './blocks/diff/SemanticDiff.tsx'
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
export {
  ChangeLegend,
  ChangeMark,
  DiffFrame,
  DiffPage,
  useDiffArrangement,
  useDiffFrameVisible,
  useDiffMode,
  type ChangeLegendProps,
  type ChangeMarkProps,
  type DiffPageProps,
} from './blocks/diff/DiffFrame.tsx'
export {
  DiffSummary,
  type DiffLedger,
  type DiffLedgerStep,
  type DiffSummaryDelta,
  type DiffSummaryProps,
} from './blocks/diff/DiffSummary.tsx'
export {
  compareSetModel,
  ImageCompareSet,
  ImageDiff,
  imageDiffModel,
  type CompareSetEntry,
  type ImageCandidate,
  type ImageCompareSetProps,
  type ImageDiffModel,
  type ImageDiffProps,
  type ImageSource,
} from './blocks/diff/ImageDiff.tsx'
export {
  alignPageSets,
  PageSetDiff,
  pageSetModel,
  type PageImage,
  type PageSetDiffProps,
  type PageSetModel,
  type PageSetSide,
} from './blocks/diff/PageSetDiff.tsx'
export {
  TextDiff,
  textDiffModel,
  type TextDiffModel,
  type TextDiffProps,
} from './blocks/diff/TextDiff.tsx'
export {
  RecordDiff,
  recordDiffModel,
  type RecordDiffModel,
  type RecordDiffProps,
  type RecordEntries,
  type RecordValue,
} from './blocks/diff/RecordDiff.tsx'
export {
  CodeDiff,
  codeDiffModel,
  type CodeDiffModel,
  type CodeDiffProps,
} from './blocks/diff/CodeDiff.tsx'
export {
  diffDocument,
  DocumentDiff,
  type DocBlock,
  type DocSnapshot,
  type DocumentDiffModel,
  type DocumentDiffProps,
  type EmbedBlock,
} from './blocks/diff/DocumentDiff.tsx'
export {
  diffTrees,
  TreeDiff,
  type TreeDiffModel,
  type TreeDiffProps,
  type TreeNode,
  type TreeSnapshot,
} from './blocks/diff/TreeDiff.tsx'
export {
  diffTraces,
  TraceDiff,
  type TraceDiffModel,
  type TraceDiffProps,
} from './blocks/diff/TraceDiff.tsx'
export {
  DiagramDiff,
  diffDiagrams,
  type DiagramDiffModel,
  type DiagramDiffProps,
  type DiagramEdge,
  type DiagramGraph,
  type DiagramNode,
} from './blocks/diff/DiagramDiff.tsx'
export { FileTree } from './blocks/FileTree.tsx'
export {
  PullRequestViewer,
  type PullRequestData,
  type PullRequestFile,
  type PullRequestTreemapPlacement,
  type PullRequestViewerProps,
} from './blocks/PullRequestViewer.tsx'
export {
  PullRequestChecks,
  PullRequestReviewBlock,
  PullRequestStackSummary,
  pullRequestStackSelectionStorageKey,
  type PullRequestChecksProps,
  type PullRequestReviewBlockProps,
  type PullRequestStackSummaryProps,
} from './blocks/PullRequestDataBlocks.tsx'
export {
  PullRequestChecksView,
  type PullRequestChecksViewProps,
} from './blocks/PullRequestDataViews.tsx'
export { LivePty, type LivePtyProps } from './blocks/LivePty.tsx'
export {
  PULL_REQUEST_TREEMAP_LENSES,
  pathForTreemapId,
  projectPullRequest,
  pullRequestTreemapModel,
  treemapIdForPath,
  type PullRequestCommit,
  type PullRequestFileEntry,
  type PullRequestProjection,
  type PullRequestTreemapOptions,
} from './blocks/pull-request.ts'
export {
  orderPullRequestStack,
  pullRequestStackOverlap,
  summarizePullRequestStack,
  type PullRequestStackAggregate,
} from './blocks/pull-request-stack.ts'
export {
  PullRequestReview,
  usePullRequestReview,
  type PullRequestReviewProps,
  type PullRequestReviewState,
  type PullRequestCommitProjection,
} from './blocks/pull-request/review.tsx'
export {
  PullRequestBody,
  PullRequestHeader,
  PullRequestProblems,
  PullRequestStackNav,
} from './blocks/pull-request/parts.tsx'
export { PullRequestDiffPane, PullRequestFileRail } from './blocks/pull-request/PullRequestDiff.tsx'
export {
  PullRequestTreemap,
  type PullRequestTreemapProps,
} from './blocks/pull-request/PullRequestTreemap.tsx'
export { PullRequestCommits } from './blocks/pull-request/PullRequestCommits.tsx'
export {
  nextSelection,
  type NextSelectionInput,
  type SelectionModifiers,
} from './blocks/pull-request/selection.ts'
export {
  SourceInspector,
  type AppSourceData,
  type AppSourceFile,
  type AppSourceReceipt,
  type AppSourceTrailStep,
  type SourceInspectorProps,
} from './blocks/SourceInspector.tsx'
export {
  projectAppSource,
  sourceFileItemId,
  type AppSourceFileEntry,
  type AppSourceProjection,
} from './blocks/app-source.ts'
export {
  SystemExplorer,
  type SystemExplorerProps,
} from './blocks/system-explorer/SystemExplorer.tsx'
export {
  AgentTimeline,
  projectAgentTimeline,
  type ActivitySegment,
  type ActivitySegmentState,
  type AgentSessionRole,
  type AgentTimelineBin,
  type AgentTimelineEvent,
  type AgentTimelineHorizon,
  type AgentTimelineHumanPrompt,
  type AgentTimelineModel,
  type AgentTimelineProps,
  type AgentTimelineRequest,
  type AgentTimelineScene,
  type AgentTimelineSession,
  type ForkEdge,
  type Lane,
  type LaneStatus,
  type LaneSample,
  type SpanHue,
  type TraceCursor,
  type TraceFilters,
  type TraceViewport,
} from './blocks/agent-timeline/index.ts'

export {
  Treemap,
  type DepthIndicatorVariant,
  type TreemapDetailProps,
  type TreemapProps,
  type TreemapChrome,
  type TreemapSelection,
} from './blocks/treemap/Treemap.tsx'

export {
  project,
  type ProjectedScene,
  type SceneEdge,
  type SceneNode,
} from './blocks/system-explorer/projection.ts'
export { SystemModelSchema, decodeSystemModel } from './blocks/system-explorer/schema.ts'
export {
  buildIndex,
  derivedLogMax,
  project as projectTreemap,
  resolveHiddenFacetLeafIds,
  searchMatches,
  tileColor,
  truncate,
  type DerivedKind,
  type DerivedNode,
  type IndexEntry,
  type ModelIndex,
  type ProjectedScene as TreemapProjectedScene,
  type SceneRect,
  type SearchResult,
  type SearchState,
  type TileColor,
  type TreemapProjectionLens,
} from './blocks/treemap/projection.ts'
export { TreemapModelSchema, decodeTreemapModel } from './blocks/treemap/schema.ts'
export { FilterPanel as TreemapFilterPanel } from './blocks/treemap/FilterPanel.tsx'
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

/** @deprecated Use AgentTimeline; Agent Trace is reserved for provenance records. */
export { AgentTimeline as AgentTrace } from './blocks/agent-timeline/index.ts'
/** @deprecated Use projectAgentTimeline. */
export { projectAgentTimeline as projectAgentTrace } from './blocks/agent-timeline/index.ts'
