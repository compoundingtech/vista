import {
  baseTsconfigCompilerOptions,
  domLib,
  packageTsconfigCompilerOptions,
  reactJsx,
  tsconfigJson,
} from '../../genie/repo.ts'

export default tsconfigJson({
  compilerOptions: {
    ...baseTsconfigCompilerOptions,
    ...packageTsconfigCompilerOptions,
    lib: domLib,
    ...reactJsx,
  },
  include: ['src/**/*', 'stories/**/*'],
})
