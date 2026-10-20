/**
 * Public surface of `@vista/service`. The standing service plus the disk-derived
 * AppIndex and publish/retire operations the thin `vista` CLI reuses (decision
 * 0002 — one source of truth for the AppIndex; the CLI does not reimplement it).
 */
export { startService, evictDraft, type ServiceState, type StartedService } from './server.ts'
export {
  scanAll,
  scanApp,
  latestMeta,
  appDir,
  versionDir,
  type AppState,
  type VersionMeta,
  type StatusCounts,
} from './registry.ts'
export {
  publish,
  PublicationReceipt,
  type PublishInput,
  type PublishResult,
  type PublishedBinding,
} from './publish.ts'
export {
  scaffold,
  SCAFFOLD_FILES,
  ScaffoldExists,
  InvalidSlug,
  type ScaffoldOptions,
} from './scaffold.ts'
export {
  captureFrozen,
  type CaptureReport,
  type BlockCaptureResult,
  type CapturedCall,
} from './data/freeze.ts'
export { assertNoSecrets, type SecretFinding } from './data/secrets.ts'
export {
  implement,
  mountProvider,
  ProviderCallFailed,
  type MountedProvider,
  type ProviderCore,
  type ProviderImplementation,
  type ProviderMount,
} from './data/provider.ts'
export {
  SubscriptionHub,
  SubscriptionError,
  makeProviderBudget,
  makeSubscriptionHub,
  subscriptionHubLayer,
  type LiveDriver,
  type ProviderBudget,
  type ProviderBudgetOptions,
  type SubscriptionHubOptions,
  type SubscriptionHubService,
  type SubscriptionHubStatus,
} from './data/live-hub.ts'
export { snapshotKey, type Snapshot } from './data/snapshot.ts'
export {
  createProviderRegistry,
  discoverProviders,
  providerSsrProxy,
  type ProviderRegistryManager,
  type ProviderRegistry,
} from './data/mount.ts'
export {
  appSourcePath,
  appsDir,
  root,
  cacheDir,
  liveStateDir,
  depsNodeModules,
} from './paths.ts'
export {
  classifyVistaClientImport,
  RuntimePolicyError,
  RuntimePolicyProjection,
  vistaRuntimePolicy,
  vistaViteResolveConfig,
  type ImportClassification,
  type RuntimePolicyProjection as RuntimePolicyProjectionType,
} from './runtime-policy/index.ts'
// Interview integration (decisions 0013/0038). The isomorphic contract stays
// importable; agent commands cross the typed control RPC instead of a second
// interview HTTP client.
export {
  DecisionOption,
  DecisionQuestion,
  DecisionAnswer,
  StoredQuestion,
  AskInput,
  AskResult,
  AwaitResult,
  AnswerInput,
  createInterviewStore,
  handleInterview,
  type InterviewStore,
} from './interview/index.ts'
