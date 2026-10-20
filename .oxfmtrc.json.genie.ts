import { oxfmtConfig } from './repos/effect-utils/genie/external.ts'
import {
  baseOxfmtIgnorePatterns,
  baseOxfmtOptions,
} from './repos/effect-utils/genie/oxfmt-base.ts'

export default oxfmtConfig({
  ...baseOxfmtOptions,
  ignorePatterns: baseOxfmtIgnorePatterns,
})
