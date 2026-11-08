import type { Buck2TypeScriptPackageProjection } from '#mr/effect-utils/genie/buck2/typescript-package-projection.ts'
import { buck2TypeScriptPackageProjection } from '#mr/effect-utils/genie/buck2/typescript-package-projection.ts'

import { dependencyImporterFor } from '../../buck2/dependencies/generate.ts'
import { rootWorkspacePackages } from '../../package.json.genie.ts'

export const buck2TypeScriptAdmission = {
  dependencyImporter: dependencyImporterFor('packages/ui-legacy-alias'),
  packageName: '@overeng/geist-design-system',
  packagePath: 'packages/ui-legacy-alias',
  projectionSource: 'packages/ui-legacy-alias/BUCK.genie.ts',
  rulesCell: '@rules',
  workspacePackages: rootWorkspacePackages,
  sourceRoots: ['src'],
  authorities: [{ declarationEntrypoint: 'src/mod.d.ts', projectFile: 'tsconfig.json' }],
} as const satisfies Buck2TypeScriptPackageProjection

export default buck2TypeScriptPackageProjection(buck2TypeScriptAdmission)
