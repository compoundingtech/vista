import { defineConfig } from 'vitest/config'

import { createStoryGateConfig } from '@overeng/utils-storybook/gate'
import { createStylexVitePlugins } from '@overeng/utils/node/stylex'

// Run through `runStoryGate`, not directly: baselines are derived from a git ref
// on demand and never committed, so this config needs the runner to tell it
// which ref-derived directory to compare against.
//
// The StyleX plugin has to be repeated here rather than inherited. Vitest treats
// this file as the Vite config for the run, so `.storybook/main.ts`'s `viteFinal`
// is the only other place it is registered and that only applies to a Storybook
// build. No `entries`: the virtual stylesheet is a build-only concern and this
// run is served, not bundled.
//
export default defineConfig(
  createStoryGateConfig({
    themes: [
      { name: 'theme', value: 'dark' },
      { name: 'theme', value: 'light' },
    ],
    plugins: createStylexVitePlugins(),
  }),
)
