import { createRequire } from 'node:module'

import { defineConfig } from 'vitest/config'

import { createStylexVitePlugins } from '@overeng/utils/node/stylex'

const require_ = createRequire(import.meta.url)
// Vitest has no HTTP server to close. The upstream development hook starts an
// interval that only follows that server lifecycle; tests need its compiler
// transform, not its CSS hot-reload middleware.
const stylexTestPlugins = createStylexVitePlugins({
  externalPackages: ['@vista/ui', '@overeng/agent-timeline'],
  entries: [new URL('./src/index.ts', import.meta.url).pathname],
}).map((plugin) => ({ ...plugin, configureServer: undefined }))

export default defineConfig({
  plugins: stylexTestPlugins,
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: /^react$/, replacement: require_.resolve('react') },
      { find: /^react-dom$/, replacement: require_.resolve('react-dom') },
      { find: /^clsx$/, replacement: require_.resolve('clsx') },
      {
        find: /^react-aria-components$/,
        replacement: require_.resolve('react-aria-components'),
      },
    ],
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.pw.test.ts'],
    server: {
      deps: {
        inline: ['@vista/ui', 'react-aria-components', '@effect/vitest'],
      },
    },
  },
})
