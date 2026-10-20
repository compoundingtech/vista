import {
  baseTsconfigCompilerOptions,
  tsconfigJson,
} from './repos/effect-utils/genie/external.ts'

export default tsconfigJson({
  compilerOptions: {
    ...baseTsconfigCompilerOptions,
    noEmit: true,
  },
  include: ['*.genie.ts', 'genie/**/*.ts'],
})
