import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

import base from './vitest.config.ts'

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['tests/AppShell.browser.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
