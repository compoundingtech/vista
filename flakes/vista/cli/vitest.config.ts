import { defineConfig } from 'vitest/config'

import { createStylexVitePlugins } from '@overeng/utils/node/stylex'

const stylexTestPlugins = createStylexVitePlugins({
  externalPackages: ['@vista/ui', '@overeng/agent-timeline'],
  entries: [new URL('./src/index.ts', import.meta.url).pathname],
}).map((plugin) => ({ ...plugin, configureServer: undefined }))

export default defineConfig({
  plugins: stylexTestPlugins,
  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    server: {
      deps: {
        inline: ['@vista/ui'],
      },
    },
  },
})
