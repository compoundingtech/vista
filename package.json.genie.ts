// @genie-bootstrap
import agentTimelinePkg from './flakes/vista/agent-timeline/package.json.genie.ts'
import blocksPkg from './flakes/vista/blocks/package.json.genie.ts'
import cliPkg from './flakes/vista/cli/package.json.genie.ts'
import islandPkg from './flakes/vista/island/package.json.genie.ts'
import servicePkg from './flakes/vista/service/package.json.genie.ts'
import uiPkg from './packages/ui/package.json.genie.ts'
import { packageJson } from './repos/effect-utils/genie/external.ts'

export const rootWorkspacePackages = [
  agentTimelinePkg,
  blocksPkg,
  cliPkg,
  islandPkg,
  servicePkg,
  uiPkg,
] as const

export default packageJson.aggregateFromPackages({
  name: 'vista-workspace',
  repoName: 'vista',
  packages: rootWorkspacePackages,
})
