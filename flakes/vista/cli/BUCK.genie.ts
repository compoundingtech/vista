import { dependencyImporterFor } from '../../../buck2/dependencies/generate.ts'
import {
  buck2TypeScriptPackageProjection,
  withConsumerJavaScriptProducts,
} from '../../../genie/buck2/javascript-candidates.ts'
import { rootWorkspacePackages } from '../../../package.json.genie.ts'
import type { Buck2TypeScriptPackageProjection } from '../../../repos/effect-utils/genie/buck2/typescript-package-projection.ts'

const admission = {
  dependencyImporter: dependencyImporterFor('flakes/vista/cli'),
  packageName: '@vista/cli',
  packagePath: 'flakes/vista/cli',
  projectionSource: 'flakes/vista/cli/BUCK.genie.ts',
  rulesCell: '@rules',
  workspacePackages: rootWorkspacePackages,
  sourceRoots: ['src'],
  workspaceSiblings: [
    { packageName: '@vista/service', packagePath: 'flakes/vista/service', sourceRoots: ['src'] },
  ],
  authorities: [{ projectFile: 'tsconfig.json' }],
} as const satisfies Buck2TypeScriptPackageProjection

export default withConsumerJavaScriptProducts({
  projection: buck2TypeScriptPackageProjection(admission),
  products: [
    {
      entrypoint: 'src/cli.ts',
      // Share the verified helper module rather than embedding a second Effect/CLI graph.
      external: ['*/runtime.js', '@overeng/utils'],
      kind: 'cli',
      output: 'vista.mjs',
      productName: 'vista',
      runtime: 'bun',
      targetName: 'vista-bundle',
    },
    {
      entrypoint: 'src/runtime.ts',
      external: [
        // Share the helper's Effect modules rather than embedding another copy.
        'effect',
        '*/preflight.js',
        '@effect/platform-node',
        '@playwright/test',
        '@vista/telemetry-island',
        '@vista/interview/component',
        '@xterm/xterm/css/xterm.css?inline',
      ],
      kind: 'module',
      output: 'runtime.js',
      productName: 'vista-runtime',
      runtime: 'bun',
      targetName: 'vista-runtime-bundle',
    },
    {
      entrypoint: 'src/preflight.ts',
      external: [
        'effect',
        '@effect/platform-node',
        '@vitejs/plugin-react',
        '@playwright/test',
        'vite',
        // Keep the async API beside its native compiler.
        'typescript',
        'lightningcss',
        '@vista/telemetry-island',
        '@vista/interview/component',
        '@xterm/xterm/css/xterm.css?inline',
      ],
      kind: 'module',
      output: 'preflight.js',
      productName: 'vista-preflight',
      runtime: 'bun',
      targetName: 'vista-preflight-bundle',
    },
  ],
})
