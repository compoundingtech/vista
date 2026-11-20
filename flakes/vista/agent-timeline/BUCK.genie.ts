import { dependencyImporterFor } from '../../../buck2/dependencies/generate.ts'
import { buck2TypeScriptPackageProjectionWithAssets } from '../../../genie/buck2/dist-assets.ts'
import { rootWorkspacePackages } from '../../../package.json.genie.ts'
import type { Buck2TypeScriptPackageProjection } from '../../../repos/effect-utils/genie/buck2/typescript-package-projection.ts'

export default buck2TypeScriptPackageProjectionWithAssets({
  dependencyImporter: dependencyImporterFor('flakes/vista/agent-timeline'),
  packageName: '@overeng/agent-timeline',
  packagePath: 'flakes/vista/agent-timeline',
  projectionSource: 'flakes/vista/agent-timeline/BUCK.genie.ts',
  rulesCell: '@rules',
  workspacePackages: rootWorkspacePackages,
  sourceRoots: ['src'],
  authorities: [{ projectFile: 'tsconfig.json' }],
} as const satisfies Buck2TypeScriptPackageProjection)
