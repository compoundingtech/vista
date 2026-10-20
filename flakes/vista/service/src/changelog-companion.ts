import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { root } from './paths.ts'

/** Foundation-owned browser filename, mirrored at the service publication boundary. */
export const CHANGELOG_MANIFEST_FILENAME = 'changelog.v1.json'
/**
 * Re-exports the changelog foundation's canonical manifest filename so consumers reference a
 * single name for the generated changelog artifact.
 */
export const VISTA_CHANGELOG_FILE = CHANGELOG_MANIFEST_FILENAME

/** Foundation-owned package installation path, relative to the Vista package root. */
export const CHANGELOG_PACKAGE_RELATIVE_PATH = 'share/vista/changelog.v1.json'

/** Override used by packaged deployments when the companion lives outside the workspace. */
export const VISTA_CHANGELOG_PATH_ENV = 'VISTA_CHANGELOG_MANIFEST'

/**
 * Package-owned companion path. Kept behind this boundary so the changelog
 * foundation can move its generated artifact without touching publication.
 */
export const vistaChangelogCompanionPath = (): string => {
  const configured = process.env[VISTA_CHANGELOG_PATH_ENV]?.trim()
  return configured === undefined || configured === ''
    ? join(root(), CHANGELOG_PACKAGE_RELATIVE_PATH)
    : resolve(configured)
}

/** Read the exact companion bytes; absence is an explicit service-boundary failure. */
export const readVistaChangelogCompanion = (): Buffer => {
  const path = vistaChangelogCompanionPath()
  try {
    return readFileSync(path)
  } catch (cause) {
    throw new Error(`Vista changelog companion is unavailable at ${path}`, { cause })
  }
}
