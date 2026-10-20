import { join } from 'node:path'

import { blocksDir } from './paths.ts'

/** Canonical color icon shipped by the Vista blocks package. */
export const VISTA_FAVICON_FILE = 'vista-icon-color.svg'

/** Resolve through the packaged blocks tree rather than the source checkout. */
export const vistaFaviconPath = (): string => join(blocksDir(), 'src', 'assets', VISTA_FAVICON_FILE)
