import { fileURLToPath } from 'node:url'

import { createPlaywrightConfig } from '../../../repos/effect-utils/packages/@overeng/utils/src/node/playwright/config/mod.ts'

export default createPlaywrightConfig({
  testDir: './tests',
  timeout: 45_000,
  webServer: {
    command:
      'pnpm exec storybook dev --host 127.0.0.1 --port {{port}} --no-open --ci --exact-port',
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    timeout: 60_000,
  },
})
