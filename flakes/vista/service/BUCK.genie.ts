import { dependencyImporterFor } from '../../../buck2/dependencies/generate.ts'
import {
  buck2TypeScriptPackageProjection,
  withConsumerJavaScriptProducts,
} from '../../../genie/buck2/javascript-candidates.ts'
import { rootWorkspacePackages } from '../../../package.json.genie.ts'
import type { Buck2TypeScriptPackageProjection } from '../../../repos/effect-utils/genie/buck2/typescript-package-projection.ts'
import { createGenieOutput } from '../../../repos/effect-utils/packages/@overeng/genie/src/runtime/core.ts'

const admission = {
  dependencyImporter: dependencyImporterFor('flakes/vista/service'),
  packageName: '@vista/service',
  packagePath: 'flakes/vista/service',
  projectionSource: 'flakes/vista/service/BUCK.genie.ts',
  rulesCell: '@rules',
  workspacePackages: rootWorkspacePackages,
  sourceRoots: ['src'],
  workspaceSiblings: [
    { packageName: '@vista/blocks', packagePath: 'flakes/vista/blocks', sourceRoots: ['src'] },
  ],
  authorities: [{ projectFile: 'tsconfig.json' }],
} as const satisfies Buck2TypeScriptPackageProjection

const projection = buck2TypeScriptPackageProjection(admission)

export default withConsumerJavaScriptProducts({
  projection: createGenieOutput({
    ...projection,
    // The source sibling also needs the assets that AppShell imports at runtime.
    stringify: (context) =>
      projection.stringify(context).replace(
        '    workspace_dist = {\n',
        `    workspace_dist = {
        "node_modules/@vista/blocks/src/assets/vista-icon-mono-dark.svg": "//flakes/vista/blocks:src/assets/vista-icon-mono-dark.svg",
        "node_modules/@vista/blocks/src/assets/vista-icon-mono-light.svg": "//flakes/vista/blocks:src/assets/vista-icon-mono-light.svg",
`,
      ),
  }),
  products: [
    {
      entrypoint: 'src/main.ts',
      // Vite loads authored TSX and resolves review dependencies from the installed workspace.
      external: [
        // Runtime Vite evaluates provider modules from the installed closure.
        // Their Effect schemas and Vista contracts must be the same instances
        // used by this service, not a second copy inlined into its Bun bundle.
        'effect',
        '@vista/blocks',
        // Bun's wildcard catches subpackages; the product verifier also needs
        // each actual bare import explicitly declared.
        '@effect/*',
        '@effect/atom-react',
        '@effect/opentelemetry',
        '@effect/platform-node',
        '@effect/vitest',
        '@vitejs/plugin-react',
        '@playwright/test',
        'vite',
        // External declarations name packages; retain the async API's native compiler and libraries.
        'typescript',
        'lightningcss',
        '@vista/telemetry-island',
        '@vista/interview/component',
        '@vista/interview',
        '@xterm/xterm',
        '@xterm/xterm/css/xterm.css?inline',
      ],
      kind: 'cli',
      output: 'vista-service.mjs',
      productName: 'vista-service',
      runtime: 'bun',
      targetName: 'vista-service-bundle',
    },
  ],
})
