import { baseTsconfigCompilerOptions, domLib, reactJsx, tsconfigJson } from '../../../genie/repo.ts'

export default tsconfigJson({
  compilerOptions: {
    ...baseTsconfigCompilerOptions,
    ...reactJsx,
    lib: domLib,
    composite: true,
    tsBuildInfoFile: './dist/tsconfig.tsbuildinfo',
    rootDir: '.',
    outDir: 'dist',
    allowArbitraryExtensions: true,
    types: ['node', 'vite/client'],
  },
  // `.storybook/**` is intentionally excluded from tsc: its `main.ts` imports
  // the effect-utils SOURCE of `@overeng/utils-storybook/config` (via the
  // `link:` dep), which tsc would then typecheck in the effect-utils worktree
  // where Storybook/Vite deps don't resolve. The Storybook build validates it
  // instead — the same idiom factory/op-proxy use (`include: src` only).
  include: ['src/**/*', 'src/**/*.json'],
  references: [{ path: '../agent-timeline' }, { path: '../../../packages/ui' }],
})
