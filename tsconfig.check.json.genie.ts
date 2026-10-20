import { rootWorkspacePackages } from './package.json.genie.ts'
import { tsconfigJsonFromPackages } from './repos/effect-utils/packages/@overeng/genie/src/runtime/node/tsconfig-from-packages.ts'

export default tsconfigJsonFromPackages({
  dir: import.meta.dirname,
  packages: rootWorkspacePackages,
  repoName: 'vista',
  files: [],
})
