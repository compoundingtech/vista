// @genie-bootstrap
import {
  catalog,
  effectUtilsArtifactUrls,
  packageJson,
  privatePackageDefaults,
} from '../../../genie/repo.ts'
import devbarPkg from '../../../repos/effect-utils/packages/@overeng/devbar/package.json.genie.ts'
import explorerReactPkg from '../../../repos/effect-utils/packages/@overeng/effect-rpc-explorer-react/package.json.genie.ts'
import explorerPkg from '../../../repos/effect-utils/packages/@overeng/effect-rpc-explorer/package.json.genie.ts'
import utilsDevPkg from '../../../repos/effect-utils/packages/@overeng/utils-dev/package.json.genie.ts'
import utilsStorybookPkg from '../../../repos/effect-utils/packages/@overeng/utils-storybook/package.json.genie.ts'
import utilsPkg from '../../../repos/effect-utils/packages/@overeng/utils/package.json.genie.ts'
import uiPkg from '../../../packages/ui/package.json.genie.ts'
import agentTimelinePkg from '../agent-timeline/package.json.genie.ts'
import { vistaRuntimePolicyFromComposition } from '../genie/runtime-policy.ts'

const composition = catalog.compose({
  mode: 'install',
  workspace: { repoName: 'vista', memberPath: 'flakes/vista/blocks' },
  dependencies: {
    workspace: [uiPkg, explorerPkg, explorerReactPkg, devbarPkg, agentTimelinePkg],
    external: {
      '@overeng/meters': effectUtilsArtifactUrls['@overeng/meters'],
      ...catalog.pick('@stylexjs/stylex'),
      ...uiPkg.data.dependencies,
      ...explorerReactPkg.data.peerDependencies,
      ...catalog.pick('effect', '@effect/atom-react'),
      // Not in the catalog: Vista needs the 3.1 line for accessible names and
      // inactive-state semantics on every portal-rendered control.
      agentation: '3.1.1',
      ...catalog.pick('react-aria-components'),
      'react-aria': '3.52.1',
      ...catalog.pick('recharts'),
      mermaid: '11.15.0',
      'svg-pan-zoom': '3.6.2',
      // LivePty loads the browser terminal only behind its client view boundary.
      '@xterm/xterm': '6.0.0',
      // Markdown documents and wrapped diff / file-tree families (decisions 0024, 0079).
      'react-markdown': '10.1.0',
      'remark-gfm': '4.0.1',
      '@pierre/diffs': '1.4.1',
      // @pierre/trees' theming peer is still on theme v1 while diffs carries v2.
      '@pierre/theme': '1.1.0',
      // @pierre/trees remains beta — watch item per decision 0024.
      '@pierre/trees': '1.0.0-beta.6',
      '@xyflow/react': '12.11.0',
      elkjs: '0.11.1',
      // treemap block (decision 0055): d3-hierarchy provides the treemap()/
      // partition() layout math rendered as plain SVG. Chosen over visx's
      // render-prop components, which recompute layout every render and defeat
      // the projection's layoutSignature memoization.
      'd3-hierarchy': '3.1.2',
    },
  },
  // react / react-dom are the singleton the host service owns — peer, not bundled.
  peerDependencies: {
    external: catalog.peers('react', 'react-dom'),
  },
  devDependencies: {
    workspace: [utilsPkg, utilsDevPkg, utilsStorybookPkg],
    external: {
      ...catalog.pick(
        '@effect/vitest',
        '@storybook/react',
        '@storybook/react-vite',
        '@types/node',
        '@types/react',
        '@types/react-dom',
        '@vitejs/plugin-react',
        'oxlint',
        'react',
        'react-dom',
        'storybook',
        'typescript',
        'vite',
        'vitest',
      ),
      // Types for the treemap block's d3-hierarchy layout math (decision 0055).
      '@types/d3-hierarchy': '3.1.7',
    },
  },
  gvsTypeExtensions: {
    'react-aria-components': catalog.pick('@types/react', '@types/react-dom'),
  },
})

export default packageJson(
  {
    name: '@vista/blocks',
    ...privatePackageDefaults,
    license: 'Apache-2.0',
    description: 'Vista’s typed semantic blocks for ordinary TSX app sources.',
    exports: {
      '.': './src/index.ts',
      /** Schema-only host contract (semantic manifest); no React, blocks or CSS. */
      './contract': './src/contract.ts',
      /** /sk-explore-variants picker (RAC + Vista UI tokens); Storybook tooling for Vista and hosts. */
      './explore': './src/explore.tsx',
      './internal/authoring': './src/internal-authoring.ts',
      './internal/provider-contracts': './src/provider-contracts.ts',
      './internal/data-contract': './src/data-contract.ts',
      './internal/owner-identity': './src/owner-identity.ts',
      './query': './src/query.ts',
      './shell': './src/shell.ts',
      './package.json': './package.json',
    },
    scripts: {
      test: 'vitest run',
      typecheck: 'tsc -p tsconfig.json',
      storybook: 'storybook dev -p ${PORT:-6016} --host ${HOST:-127.0.0.1} --no-open --ci',
      'storybook:build': 'storybook build',
      'storybook:e2e': 'playwright test --config playwright.config.ts',
      'storybook:visual-parity': 'playwright test --config playwright.visual.config.ts',
    },
    dependenciesMeta: {
      '@vista/ui': { injected: true },
      '@overeng/devbar': { injected: true },
    },
    $vista: {
      runtimePolicy: vistaRuntimePolicyFromComposition({
        packageName: '@vista/blocks',
        composition,
        publicPackages: ['@vista/blocks'],
        optimizeExcludeRoots: ['@vista/blocks', 'elkjs'],
        aliases: [
          {
            specifier: '@vista/blocks/internal/authoring',
            target: { kind: 'blocks', path: 'src/internal-authoring.ts' },
            public: false,
          },
          {
            specifier: '@vista/blocks/internal/provider-contracts',
            target: { kind: 'blocks', path: 'src/provider-contracts.ts' },
            public: false,
          },
          {
            specifier: '@vista/blocks/internal/data-contract',
            target: { kind: 'blocks', path: 'src/data-contract.ts' },
            public: false,
          },
          {
            specifier: '@vista/blocks/query',
            target: { kind: 'blocks', path: 'src/query.ts' },
            public: true,
          },
          {
            specifier: '@vista/blocks/shell',
            target: { kind: 'blocks', path: 'src/shell.ts' },
            public: true,
          },
          {
            specifier: '@vista/blocks',
            target: { kind: 'blocks', path: 'src/index.ts' },
            public: true,
          },
        ],
        slices: [
          {
            name: 'ui-shell',
            publicImportRoots: [
              '@vista/ui',
              '@overeng/utils',
              '@effect/atom-react',
              '@stylexjs/stylex',
              'agentation',
              'react',
              'react-aria-components',
              'react-aria',
              'react-dom',
            ],
            optimizeInclude: [
              '@effect/atom-react',
              '@overeng/utils',
              '@stylexjs/stylex',
              'react-aria',
              'react-dom/client',
              'react-dom/server',
              'react/jsx-dev-runtime',
              'react/jsx-runtime',
            ],
            cssImports: ['@vista/ui/document.css'],
          },
          {
            name: 'doctrine-blocks',
            publicImportRoots: [
              'effect',
              'mermaid',
              'react-markdown',
              'recharts',
              'remark-gfm',
              'svg-pan-zoom',
            ],
          },
          {
            name: 'system-explorer-blocks',
            publicImportRoots: [
              '@pierre/diffs',
              '@pierre/trees',
              '@xyflow/react',
              'elkjs',
              '@overeng/effect-rpc-explorer',
              '@overeng/devbar',
              '@overeng/effect-rpc-explorer-react',
              '@overeng/agent-timeline',
            ],
            optimizeInclude: [
              '@pierre/diffs/react',
              '@pierre/trees/react',
              'elkjs/lib/elk.bundled.js',
              // Only pure helpers may bypass the StyleX compiler. The .ts compact
              // barrel re-exports TSX components, so it must stay source-transformed.
              '@overeng/agent-timeline/encodings',
              '@overeng/agent-timeline/labels',
              '@overeng/agent-timeline/model',
              '@overeng/agent-timeline/projection',
              '@overeng/agent-timeline/types',
            ],
          },
          {
            // Data runtime (decisions 0092/0094): the browser-side binding runtime
            // imports these `effect` subpaths directly. Listing them lets a cold
            // draft prebundle them in the first optimizer pass (decision 0044 seed).
            name: 'data-runtime',
            publicImportRoots: ['effect', '@effect/atom-react'],
            optimizeInclude: [
              'effect/http',
              'effect/reactivity',
              'effect/reactivity/AsyncResult',
              'effect/reactivity/Atom',
              'effect/reactivity/AtomRegistry',
              'effect/reactivity/AtomRpc',
              'effect/reactivity/Reactivity',
              'effect/rpc/Rpc',
              'effect/rpc/RpcClient',
              'effect/rpc/RpcClientError',
              'effect/rpc/RpcGroup',
              'effect/rpc/RpcSerialization',
              'effect/rpc/RpcSchema',
            ],
          },
          {
            // treemap block (decision 0055): pure d3-hierarchy layout math + SVG,
            // SSR-safe, a normal React.lazy arm (not a foreign-React runtime). Now also
            // imports `react-aria-components` (already resident via Vista UI) for the
            // hierarchical filter popover + collision-aware hover tooltip.
            name: 'treemap-blocks',
            publicImportRoots: ['d3-hierarchy', 'react', 'react-aria-components'],
          },
          {
            name: 'live-pty-block',
            publicImportRoots: ['@xterm/xterm'],
            optimizeInclude: ['@xterm/xterm'],
            cssImports: ['@xterm/xterm/css/xterm.css?inline'],
          },
        ],
      }),
    },
  },
  composition,
)
