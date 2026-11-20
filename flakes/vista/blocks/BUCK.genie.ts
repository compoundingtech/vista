import { globSync } from 'node:fs'

import { dependencyImporterFor } from '../../../buck2/dependencies/generate.ts'
import { buck2TypeScriptPackageProjectionWithAssets } from '../../../genie/buck2/dist-assets.ts'
import { rootWorkspacePackages } from '../../../package.json.genie.ts'
import type { Buck2TypeScriptPackageProjection } from '../../../repos/effect-utils/genie/buck2/typescript-package-projection.ts'

const admission = {
  dependencyImporter: dependencyImporterFor('flakes/vista/blocks'),
  packageName: '@vista/blocks',
  packagePath: 'flakes/vista/blocks',
  projectionSource: 'flakes/vista/blocks/BUCK.genie.ts',
  rulesCell: '@rules',
  workspacePackages: rootWorkspacePackages,
  sourceRoots: ['src'],
  authorities: [
    {
      projectFile: 'tsconfig.json',
      // Stories and tests import JSON fixtures alongside their TypeScript sources.
      projectInputs: globSync('src/**/*.json', { cwd: import.meta.dirname }).sort(),
    },
  ],
} as const satisfies Buck2TypeScriptPackageProjection

export default buck2TypeScriptPackageProjectionWithAssets(admission)
