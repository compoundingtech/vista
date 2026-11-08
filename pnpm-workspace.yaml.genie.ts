// @genie-bootstrap
import { catalog, effectUtilsArtifactUrls } from './genie/repo.ts'
import { rootWorkspacePackages } from './package.json.genie.ts'
import {
  commonPnpmPolicySettings,
  createPnpmPatchedDependencies,
  pnpmWorkspaceYaml,
  projectPnpmSourceInputs,
} from './repos/effect-utils/genie/external.ts'

/**
 * Keep runtime singletons and their executable toolchains on one cohort.
 * Staged source repositories may retain older exact development pins.
 */
const singletonOverrides = catalog.pick(
  '@effect/atom-react',
  '@effect/opentelemetry',
  '@effect/platform-node',
  '@effect/vitest',
  '@opentui/core',
  '@opentui/react',
  '@opentelemetry/sdk-logs',
  '@opentelemetry/sdk-trace-node',
  '@opentelemetry/semantic-conventions',
  '@playwright/test',
  '@storybook/react',
  '@storybook/react-vite',
  'effect',
  'playwright',
  'react',
  'react-dom',
  'storybook',
  'typescript',
  'vitest',
)

const effectCohortOverrides = {
  '@effect/platform-node-shared': catalog.effect,
} as const

const pnpmPatchedDependencies = createPnpmPatchedDependencies({
  basePath: 'repos/effect-utils',
})

const {
  'effect-distributed-lock@0.0.11': _retiredDistributedLockPatch,
  ...rootPatchedDependencies
} = pnpmPatchedDependencies()

// Native callable resolvers otherwise retain closed Vista preflight graphs.
// https://github.com/rolldown/rolldown/issues/10887
export const vistaPatchedDependencies = {
  'rolldown@1.2.7': 'pnpm/patches/rolldown@1.2.7.patch',
} as const

export const rootPnpmSourceInputs = projectPnpmSourceInputs({
  packages: rootWorkspacePackages,
  repoName: 'vista',
})

export default pnpmWorkspaceYaml.root({
  ...commonPnpmPolicySettings,
  packages: rootWorkspacePackages,
  repoName: 'vista',
  blockExoticSubdeps: false,
  resolvePeersFromWorkspaceRoot: false,
  nodeLinker: 'hoisted',
  hoistPattern: ['*'],
  publicHoistPattern: ['*'],
  enableGlobalVirtualStore: false,
  injectWorkspacePackages: false,
  overrides: {
    ...singletonOverrides,
    ...effectCohortOverrides,
    ...rootPnpmSourceInputs.overrides,
    ...effectUtilsArtifactUrls,
    '@types/bun': '1.4.2',
    '@types/hast': '3.0.5',
    '@types/unist': '3.0.3',
    // Preserve frozen F's Storybook edge, previously deduped onto a fleet-only esbuild pin.
    'storybook@10.6.0>esbuild': '0.27.1',
  },
  patchedDependencies: {
    ...rootPatchedDependencies,
    ...vistaPatchedDependencies,
  },
  allowUnusedPatches: true,
  peerDependencyRules: {
    allowedVersions: {
      ...commonPnpmPolicySettings.peerDependencyRules.allowedVersions,
      ...rootPnpmSourceInputs.peerDependencyRules.allowedVersions,
    },
  },
})
