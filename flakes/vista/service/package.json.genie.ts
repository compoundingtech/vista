// @genie-bootstrap
import {
  catalog,
  effectUtilsArtifactUrls,
  packageJson,
  privatePackageDefaults,
} from '../../../genie/repo.ts'
import explorerPkg from '../../../repos/effect-utils/packages/@overeng/effect-rpc-explorer/package.json.genie.ts'
import utilsDevPkg from '../../../repos/effect-utils/packages/@overeng/utils-dev/package.json.genie.ts'
import utilsPkg from '../../../repos/effect-utils/packages/@overeng/utils/package.json.genie.ts'
import uiPkg from '../../../packages/ui/package.json.genie.ts'
import agentTimelinePkg from '../agent-timeline/package.json.genie.ts'
import blocksPkg from '../blocks/package.json.genie.ts'
import { vistaRuntimePolicyFromComposition } from '../genie/runtime-policy.ts'

const {
  '@vista/ui': _blocksUi,
  '@overeng/agent-timeline': _blocksAgentTimeline,
  '@vista/blocks': _blocksSelf,
  effect: _blocksEffect,
  '@effect/cluster': _blocksEffectCluster,
  '@effect/experimental': _blocksEffectExperimental,
  '@effect/opentelemetry': _blocksEffectOpenTelemetry,
  '@effect/platform': _blocksEffectPlatform,
  '@effect/platform-node': _blocksEffectPlatformNode,
  '@effect/rpc': _blocksEffectRpc,
  '@effect/vitest': _blocksEffectVitest,
  '@effect/workflow': _blocksEffectWorkflow,
  ...blocksRuntimeDependencies
} = blocksPkg.data.dependencies ?? {}

/**
 * The standing Vista service publishes receipt-verified, self-contained static
 * AppVersions and serves live AppSource drafts through per-App Vite servers.
 * Providers mount through `vite.ssrLoadModule` and share the host Effect realm.
 *
 * The unbundled service owns the shared browser dependency closure used for
 * local checks, drafts, and publication builds.
 */
const composition = catalog.compose({
  mode: 'install',
  workspace: { repoName: 'vista', memberPath: 'flakes/vista/service' },
  dependencies: {
    // `@overeng/utils` backs the service OTel bootstrap (`withTelemetry` +
    // `ServiceIdentity`/`otelEndpointFromConfig`, decision 0062) wired at the
    // Effect-native host root in `main.ts` (decision 0060).
    workspace: [uiPkg, blocksPkg, utilsPkg, explorerPkg, agentTimelinePkg],
    external: {
      ...catalog.pick(
        'effect',
        '@effect/platform-node',
        // The published service runs a browser render smoke, not just tests.
        '@playwright/test',
        '@vitejs/plugin-react',
        'react',
        'react-dom',
        'vite',
      ),
      // Both Bun bundles externalize Vite's native CSS transformer. Keep the
      // package at the importer root where the service bundle resolves it.
      lightningcss: '1.33.0',
      // Babel loads this preset by package name while Vite transforms authored
      // `app.tsx`; declare it because Bun must resolve the dynamic load at compile time.
      '@babel/preset-typescript': '7.29.7',
      // Import policy parses TSX syntax instead of matching import-like text
      // inside review payload strings.
      '@babel/parser': '7.29.8',
      ...uiPkg.data.peerDependencies,
      ...uiPkg.data.dependencies,
      ...blocksPkg.data.peerDependencies,
      // The shared app dep closure is the kit browser closure. Keep it derived
      // from the kit package output so service packaging cannot drift from blocks.
      ...blocksRuntimeDependencies,
      '@overeng/effect-rpc-observer': effectUtilsArtifactUrls['@overeng/effect-rpc-observer'],
      '@xterm/headless': '6.0.0',
      // Vite optimizes these package roots directly even when they are normally
      // transitive peer/helper deps of the public runtime packages.
      lru_map: '0.4.1',
      'use-sync-external-store': '1.6.0',
    },
  },
  devDependencies: {
    workspace: [utilsDevPkg],
    external: {
      ...catalog.pick(
        '@effect/vitest',
        '@types/node',
        '@types/react',
        '@types/react-dom',
        'fast-check',
        'oxlint',
        'oxc-parser',
        'typescript',
        'vitest',
      ),
    },
  },
})

export default packageJson(
  {
    name: '@vista/service',
    ...privatePackageDefaults,
    license: 'Apache-2.0',
    description:
      'Vista service for live AppSource drafts, static AppVersions, AppIndex, and schema-backed Providers.',
    exports: {
      '.': './src/index.ts',
      // Lightweight subpaths for the CLI: they preserve the one-source-of-truth
      // registry/publish implementation without importing the Vite-backed server
      // barrel into the Bun-compiled `vista` binary.
      './control': './src/control.ts',
      './read': './src/read.ts',
      // The control-RPC wire-envelope helpers (`wireCall`/`NoPayload`, decision
      // 0061): the CLI client wraps every RPC through these, mirroring `./control`.
      './wire': './src/wire.ts',
      './registry': './src/registry.ts',
      './publish': './src/publish.ts',
      './preflight': './src/preflight.ts',
      './preflight-contract': './src/preflight-contract.ts',
      // Native embedding compiler; hosts inject singleton React and block namespaces.
      './native-build': './src/native-build.ts',
      // Isomorphic interview contract (decisions 0013/0038): browser code can
      // import the schema without the service barrel, while agent commands use
      // the typed VistaControlApi boundary instead of a parallel HTTP client.
      './interview/contract': './src/interview/contract.ts',
      './runtime-policy': './src/runtime-policy/index.ts',
      './package.json': './package.json',
    },
    bin: {
      'vista-service': './src/main.ts',
    },
    scripts: {
      start: 'node --experimental-strip-types src/main.ts',
      test: 'vitest run',
      typecheck: 'tsc -p tsconfig.json',
    },
    dependenciesMeta: {
      '@vista/ui': { injected: true },
    },
    $vista: {
      runtimePolicy: vistaRuntimePolicyFromComposition({
        packageName: '@vista/service',
        composition,
        publicPackages: ['effect'],
        optimizeExcludeRoots: ['@vista/data', '@vista/interview', '@vista/telemetry-island'],
        remoteImports: [
          {
            name: 'esm.sh pinned package URL',
            pattern: '^https://esm\\.sh/(?:@[^/@]+/[^@/?#]+|[^@/?#]+)@[^/?#]+',
            description: 'App code may use pinned esm.sh package URLs as an escape hatch.',
          },
        ],
        ssrExternal: ['@effect/platform-node', '@xterm/headless', 'effect'],
        dedupe: ['react', 'react-dom'],
        slices: [
          {
            name: 'effect-control-client',
            optimizeInclude: ['effect/rpc/RpcClient', 'effect/rpc/RpcSerialization'],
          },
          {
            name: 'app-service-owned-imports',
            serviceOwnedImportRoots: [
              '@vista/data',
              '@vista/interview',
              // The pre-built telemetry island chunk (decision 0046). It resolves to
              // ONE self-contained built artifact via the alias below — react18 +
              // Grafana are inlined, so it has no optimizeInclude entry.
              '@vista/telemetry-island',
            ],
            aliases: [
              {
                specifier: '@vista/data',
                target: { kind: 'service-src', path: 'data' },
                public: false,
              },
              {
                specifier: '@vista/interview',
                target: { kind: 'service-src', path: 'interview' },
                public: false,
              },
              {
                specifier: '@vista/telemetry-island',
                target: { kind: 'island', path: 'dist/island.js' },
                public: false,
              },
            ],
          },
          {
            name: 'vite-review-runtime',
            optimizeInclude: [
              'lru_map',
              'use-sync-external-store/shim',
              'use-sync-external-store/shim/with-selector',
            ],
          },
        ],
      }),
    },
  },
  composition,
)
