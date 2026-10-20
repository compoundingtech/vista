import { existsSync, readFileSync } from 'node:fs'

import {
  decodePnpmSha256Sidecar,
  translatePnpmLock,
  validatePnpmSha256Sidecar,
  type PnpmLockMetadata,
  type PnpmSha256Sidecar,
} from '../../repos/effect-utils/buck2/dependencies/pnpm-lock.ts'
import {
  makePnpmStoreProjection,
  type PnpmStoreProjection,
} from '../../repos/effect-utils/buck2/dependencies/pnpm-store.ts'
import { defineRepoContext } from '../../repos/effect-utils/packages/@overeng/genie/src/runtime/repo-context/mod.ts'

const repo = defineRepoContext({ name: 'vista', importMetaUrl: import.meta.url })
const sidecarPath = 'buck2/dependencies/pnpm-lock.sha256.json'

export type VistaPnpmLockData = {
  readonly metadata: PnpmLockMetadata
  readonly sidecar: PnpmSha256Sidecar
  readonly store: PnpmStoreProjection
}

/** Buck never executes pnpm lifecycle builds, matching the original consumer policy. */
const buckWorkspaceText = (workspaceText: string): string =>
  workspaceText.replace(/^allowBuilds:\n(?:[ \t]+.*\n)*/m, (block) =>
    block.replaceAll(': true', ': false'),
  )

const readPrerequisite = (path: string): string => {
  if (existsSync(repo.resolve(path)) === false) {
    throw new Error(
      `Vista Buck dependency projection requires ${path}; supply the Vista workspace lock and its validated archive sidecar explicitly before design generation. No installation or sidecar refresh runs during generator evaluation.`,
    )
  }
  return repo.readText(path)
}

const load = (): VistaPnpmLockData => {
  const metadata = translatePnpmLock({
    lockfileText: readPrerequisite('pnpm-lock.yaml'),
    workspaceText: buckWorkspaceText(readPrerequisite('pnpm-workspace.yaml')),
    readPatch: (patchPath) => readFileSync(repo.resolve(patchPath)),
  })
  const sidecar = decodePnpmSha256Sidecar(JSON.parse(readPrerequisite(sidecarPath)))
  validatePnpmSha256Sidecar({ metadata, sidecar })
  return { metadata, sidecar, store: makePnpmStoreProjection({ metadata, sidecar }) }
}

let loaded: VistaPnpmLockData | undefined

/** Reads only this consumer's authorities; never invokes E's producer-anchored loader. */
export const loadVistaPnpmLockData = (): VistaPnpmLockData => (loaded ??= load())

export const dependencyImporterFor = (
  packagePath: string,
): `//buck2/dependencies:importer_${string}` => {
  const view = loadVistaPnpmLockData().store.views.find(({ importer }) => importer === packagePath)
  if (view === undefined || view.target.startsWith('view_') === false) {
    throw new Error(`No Vista lock importer view for ${packagePath}; update the actual workspace lock before design generation.`)
  }
  return `//buck2/dependencies:importer_${view.target.slice('view_'.length)}`
}
