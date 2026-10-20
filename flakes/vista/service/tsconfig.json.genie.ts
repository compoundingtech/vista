import { baseTsconfigCompilerOptions, domLib, reactJsx, tsconfigJson } from '../../../genie/repo.ts'

/**
 * The service is a Node app, but `src/` also holds the example provider and the
 * sample-review authoring helpers, and `transformIndexHtml`/JSX touch DOM types.
 * `domLib` + `react-jsx` keep those honest; Node runtime types coexist with
 * `vite/client` for imported browser modules and stylesheets. The hand-placed
 * sample app lives under `apps/` (gitignored, browser-built by the dev server),
 * so it stays out of this tsc scope by design.
 */
export default tsconfigJson({
  compilerOptions: {
    ...baseTsconfigCompilerOptions,
    ...reactJsx,
    lib: domLib,
    composite: true,
    tsBuildInfoFile: './dist/tsconfig.tsbuildinfo',
    rootDir: '.',
    outDir: 'dist',
    types: ['node', 'vite/client'],
    paths: {
      '@vista/data/*.css': ['./src/data/*.css'],
      '@vista/data/*': ['./src/data/*.ts'],
      '@vista/interview/*.css': ['./src/interview/*.css'],
      '@vista/interview/*': ['./src/interview/*.ts'],
    },
  },
  include: ['src/**/*', 'samples/**/*.ts', 'samples/**/*.tsx', 'samples/**/*.json'],
  references: [{ path: '../blocks' }, { path: '../agent-timeline' }, { path: '../../../packages/ui' }],
})
