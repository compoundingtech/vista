import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPlaywrightConfig } from '../../../repos/effect-utils/packages/@overeng/utils/src/node/playwright/config/mod.ts'

const packageRoot = fileURLToPath(new URL('.', import.meta.url))
const referenceRoot = process.env['REFERENCE_STORYBOOK_DIR']
const candidateRoot = process.env['CANDIDATE_STORYBOOK_DIR']
if (referenceRoot === undefined || candidateRoot === undefined) {
  throw new Error('REFERENCE_STORYBOOK_DIR and CANDIDATE_STORYBOOK_DIR are required')
}

const config = await createPlaywrightConfig({
  testDir: './visual',
  timeout: 240_000,
  workers: 1,
  webServer: {
    command: 'node visual/static-server.mjs {{port}}',
    cwd: packageRoot,
    timeout: 30_000,
    portEnvVar: 'VISTA_BLOCKS_VISUAL_PORT',
  },
})

export default {
  ...config,
  use: {
    ...config.use,
    trace: 'off',
  },
  snapshotPathTemplate: join(packageRoot, 'tmp', 'visual-parity', 'reference', '{arg}{ext}'),
}
