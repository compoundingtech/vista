import { baseTsconfigCompilerOptions, domLib, reactJsx, tsconfigJson } from '../../../genie/repo.ts'

export default tsconfigJson({
  compilerOptions: {
    ...baseTsconfigCompilerOptions,
    ...reactJsx,
    lib: domLib,
    composite: true,
    rootDir: '.',
    outDir: 'dist',
    tsBuildInfoFile: './dist/tsconfig.tsbuildinfo',
  },
  include: ['src'],
  references: [{ path: '../../../packages/ui' }],
})
