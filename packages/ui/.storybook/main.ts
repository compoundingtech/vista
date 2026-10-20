import react from '@vitejs/plugin-react'
import type { InlineConfig } from 'vite'

import { createDomStorybookConfig } from '@overeng/utils-storybook/config'
import { createStylexVitePlugins } from '@overeng/utils/node/stylex'

const storybookPreviewEntry = new URL('./preview.tsx', import.meta.url).pathname

/**
 * Unlike an application package, this one has no `vite.config.ts` for the
 * Storybook builder to merge, so the StyleX plugins have to be registered here.
 * The shared spec's "registering the compiler plugin in Storybook is redundant"
 * note describes an app that owns a bundler config; a component library whose
 * only build surface is the Storybook preview is the opposite case.
 *
 * `a11y` is what makes the gate's `parameters.a11y.test: 'error'` mean anything;
 * without the addon registered the accessibility check passes everything.
 */
export default createDomStorybookConfig({
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  a11y: true,
  viteFinal: (config: InlineConfig): InlineConfig => ({
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      // The preview is the only build entry this package has, so it is the
      // only place the compiled-CSS virtual module can be imported from.
      ...createStylexVitePlugins({ entries: [storybookPreviewEntry] }),
      react(),
    ],
  }),
})
