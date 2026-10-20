// @genie-bootstrap
import {
  pnpmInstallStorageContractV2 as storage,
  projectionArtifact,
} from './repos/effect-utils/genie/external.ts'
import rootPackageJson from './package.json.genie.ts'
import rootPnpmWorkspaceYaml, { rootPnpmSourceInputs } from './pnpm-workspace.yaml.genie.ts'

const packageManager = rootPackageJson.data.packageManager!
const pnpmVersion = packageManager.slice('pnpm@'.length)
const workspaceData = rootPnpmWorkspaceYaml.data

export default projectionArtifact.json({
  schemaVersion: 2,
  data: {
    contract: 'effect-utils/pnpm-install-contract',
    packageManager: { name: 'pnpm', version: pnpmVersion },
    storeContract: storage.storeContract,
    dependencyGraphContract: {
      packageManager: { name: 'pnpm', version: pnpmVersion },
      allowBuilds: workspaceData.allowBuilds,
      overrides: workspaceData.overrides,
      packageExtensions: workspaceData.packageExtensions,
    },
    installPolicy: {
      dedupePeerDependents: workspaceData.dedupePeerDependents,
      ignoreScripts: workspaceData.ignoreScripts,
      minimumReleaseAgeExclude: workspaceData.minimumReleaseAgeExclude,
      optimisticRepeatInstall: workspaceData.optimisticRepeatInstall,
      packageImportMethod: storage.packageImportMethod,
      peerDependencyRules: workspaceData.peerDependencyRules,
      pmOnFail: workspaceData.pmOnFail,
      sideEffectsCache: workspaceData.sideEffectsCache,
      strictPeerDependencies: workspaceData.strictPeerDependencies,
      strictStorePkgContentCheck: workspaceData.strictStorePkgContentCheck,
      supportedArchitectures: workspaceData.supportedArchitectures,
      verifyDepsBeforeRun: workspaceData.verifyDepsBeforeRun,
      verifyStoreIntegrity: workspaceData.verifyStoreIntegrity,
    },
    workspaceManifestContract: {
      injectWorkspacePackages: workspaceData.injectWorkspacePackages,
      allowUnusedPatches: workspaceData.allowUnusedPatches,
      patchedDependencies: workspaceData.patchedDependencies,
      packages: workspaceData.packages,
      sourceInputPaths: rootPnpmSourceInputs.sourceInputPaths,
    },
    metadata: {
      pnpmStoreOwnership: {
        cacheLifecycle: 'pnpm-owned disposable Store Cache',
        derivedIndexLifecycle: 'shared only inside one same-user trust boundary',
        virtualStoreLifecycle: 'Materialization-Root-owned rebuildable dependency graph',
      },
      nixIntegration: {
        liveVirtualStoreScope: 'materialization-root',
        fixedOutputDependencyPrepUsesSameVirtualStoreScope: true,
      },
      buck2Integration: {
        consumeContractArtifact: true,
        avoidNodeModulesLayoutAsApi: true,
      },
    },
  },
})
