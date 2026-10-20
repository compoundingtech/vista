import { dependencyImporterFor } from '../../../buck2/dependencies/generate.ts'
import { buck2TypeScriptPackageProjection } from '../../../genie/buck2/javascript-candidates.ts'
import { rootWorkspacePackages } from '../../../package.json.genie.ts'
import type { Buck2TypeScriptPackageProjection } from '../../../repos/effect-utils/genie/buck2/typescript-package-projection.ts'
import { createGenieOutput } from '../../../repos/effect-utils/packages/@overeng/genie/src/runtime/core.ts'

const admission = {
  dependencyImporter: dependencyImporterFor('flakes/vista/blocks'),
  packageName: '@vista/blocks',
  packagePath: 'flakes/vista/blocks',
  projectionSource: 'flakes/vista/blocks/BUCK.genie.ts',
  rulesCell: '@rules',
  workspacePackages: rootWorkspacePackages,
  sourceRoots: ['src'],
  authorities: [{ projectFile: 'tsconfig.json' }],
} as const satisfies Buck2TypeScriptPackageProjection

const projection = buck2TypeScriptPackageProjection(admission)

export default createGenieOutput({
  ...projection,
  // Vite reads these static imports from the materialized source package.
  stringify: (context) =>
    projection.stringify(context).replace(
      '    files = {\n',
      `    files = {
        "src/assets/vista-icon-mono-dark.svg": "src/assets/vista-icon-mono-dark.svg",
        "src/assets/vista-icon-mono-light.svg": "src/assets/vista-icon-mono-light.svg",
`,
    ) +
    `
export_file(
    name = "src/assets/vista-icon-mono-dark.svg",
    src = "src/assets/vista-icon-mono-dark.svg",
    visibility = ["PUBLIC"],
)

export_file(
    name = "src/assets/vista-icon-mono-light.svg",
    src = "src/assets/vista-icon-mono-light.svg",
    visibility = ["PUBLIC"],
)
`,
})
