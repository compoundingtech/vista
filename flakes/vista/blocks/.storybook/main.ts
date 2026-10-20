import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

import type { InlineConfig } from 'vite'

import { createDomStorybookConfig } from '@overeng/utils-storybook/config'
import { createStylexVitePlugins } from '@overeng/utils/node/stylex'

const require_ = createRequire(import.meta.url)

const resolvePackageDir = (pkg: string) => {
  const entry = require_.resolve(pkg)
  let current = dirname(entry)

  while (true) {
    if (existsSync(join(current, 'package.json'))) return current

    const parent = dirname(current)
    if (parent === current) return dirname(entry)
    current = parent
  }
}
const storybookPreviewEntry = new URL('./preview.tsx', import.meta.url).pathname

/** Production-faithful Vista Storybook with the same StyleX extraction as published apps. */
const storybookConfig = createDomStorybookConfig<InlineConfig>({
  viteFinal: (config) => {
    config.plugins = [
      ...createStylexVitePlugins({
        externalPackages: [
          '@vista/ui',
          '@overeng/agent-timeline',
          '@overeng/devbar',
          '@overeng/effect-rpc-explorer-react',
          '@overeng/stylex-tokens',
        ],
        entries: [storybookPreviewEntry],
      }),
      ...(config.plugins ?? []),
    ]
    config.resolve = {
      ...config.resolve,
      // Keep React a singleton across the kit + stories (matches the service's
      // resolve.dedupe; decision 0017 / seam fix #5).
      dedupe: [...new Set([...(config.resolve?.dedupe ?? []), 'react', 'react-dom'])],
      alias: {
        ...(config.resolve?.alias as Record<string, string> | undefined),
        '@vista/ui/document.css': resolve(
          import.meta.dirname,
          '..',
          '..',
          '..',
          '..',
          'packages',
          'ui',
          'src',
          'foundations',
          'document.css',
        ),
        // Let the package exports resolve @vista/blocks and its internal subpaths.
        // A prefix alias to src/index.ts turns subpaths into paths inside a file.
        // Resolve the telemetry-island chunk's bare specifier to the pre-built
        // artifact so the telemetry/LazyBlock stories' dynamic `import()` loads the
        // REAL self-contained React + Grafana chunk (decision 0046). Mirrors the
        // service's runtime-policy alias; build it first with
        // `devenv tasks run vista:island:build`.
        '@vista/telemetry-island': resolve(
          import.meta.dirname,
          '..',
          '..',
          'island',
          'dist',
          'island.js',
        ),
        '@vista/interview/component': resolve(
          import.meta.dirname,
          '..',
          '..',
          'service',
          'src',
          'interview',
          'component.ts',
        ),
        '@vista/interview/styles.css': resolve(
          import.meta.dirname,
          '..',
          '..',
          'service',
          'src',
          'interview',
          'styles.css',
        ),
        clsx: resolvePackageDir('clsx'),
        'react-aria-components': resolvePackageDir('react-aria-components'),
      },
    }
    // Lazy operator panels load after the initial dependency scan. Prebundle
    // React's CommonJS JSX entrypoints before that source-only chunk mounts.
    config.optimizeDeps = {
      ...config.optimizeDeps,
      include: [
        ...new Set([
          ...(config.optimizeDeps?.include ?? []),
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
        ]),
      ],
    }
    return config
  },
})

export default {
  ...storybookConfig,
  staticDirs: ['../src/assets'],
}
