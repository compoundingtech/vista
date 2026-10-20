import { baseTsconfigCompilerOptions, domLib, reactJsx, tsconfigJson } from '../../../genie/repo.ts'

/**
 * The CLI imports `@vista/service` (and transitively `@vista/blocks`), whose barrels
 * re-export DOM-bearing `.tsx`; the interview `ask`/`await` commands reach the
 * isomorphic client subpath but the kit/service barrels still resolve to source.
 * The CLI therefore uses `react-jsx` + `domLib`, Node runtime types and
 * `vite/client` for the imported browser module and stylesheet boundaries.
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
  },
  include: ['src/**/*'],
  references: [{ path: '../service' }],
})
