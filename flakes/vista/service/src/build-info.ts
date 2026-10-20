import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { resolveCliBuildIdentity } from '@overeng/utils/node/cli-version'

import { root } from './paths.ts'

let cachedPackagedBuildStamp: string | undefined

/**
 * The packaged Vista workspace already carries one canonical Nix stamp in the
 * CLI entrypoint. Read that same stamp rather than introducing a second build
 * substitution contract for the service.
 */
const packagedBuildStamp = (): string => {
  if (cachedPackagedBuildStamp !== undefined) return cachedPackagedBuildStamp
  try {
    const cli = readFileSync(join(root(), 'flakes/vista/cli/src/cli.ts'), 'utf8')
    cachedPackagedBuildStamp =
      /const buildStamp = '([^'\n]*)'/.exec(cli)?.[1] ?? '__CLI_BUILD_STAMP__'
  } catch {
    cachedPackagedBuildStamp = '__CLI_BUILD_STAMP__'
  }
  return cachedPackagedBuildStamp
}

/**
 * Immutable provenance snapshot for the running service build, capturing the base version, git
 * revision and dirty state, where the build came from, commit timestamp, and machine and
 * human-readable version strings.
 */
export interface VistaBuildInfo {
  readonly baseVersion: string
  readonly rev: string
  readonly dirty: boolean
  readonly sourceKind: 'package' | 'local' | 'nix'
  readonly commitTs: string
  readonly machineVersion: string
  readonly displayVersion: string
}

let cachedVistaBuildInfo: VistaBuildInfo | undefined

/** Canonical Vista build identity shared by telemetry and browser bootstraps. */
export const resolveVistaBuildInfo = (now?: number): VistaBuildInfo => {
  if (now === undefined && cachedVistaBuildInfo !== undefined) return cachedVistaBuildInfo
  const identity = resolveCliBuildIdentity({
    baseVersion: '0.1.0',
    buildStamp: packagedBuildStamp(),
    ...(now === undefined ? {} : { now }),
  })
  const timestamp = identity.commitTs ?? identity.buildTs ?? 0
  const buildInfo = {
    baseVersion: identity.baseVersion,
    rev: identity.rev ?? 'unknown',
    dirty: identity.dirty,
    sourceKind: identity.sourceKind,
    commitTs: new Date(timestamp * 1_000).toISOString(),
    machineVersion: identity.machineVersion,
    displayVersion: identity.displayVersion,
  }
  if (now === undefined) cachedVistaBuildInfo = buildInfo
  return buildInfo
}
