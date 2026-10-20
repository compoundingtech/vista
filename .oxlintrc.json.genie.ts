import {
  baseOxlintCategories,
  baseOxlintIgnorePatterns,
  baseOxlintPlugins,
  baseOxlintRules,
  oxlintConfig,
} from './repos/effect-utils/genie/external.ts'
import { baseOxlintOverrides } from './repos/effect-utils/genie/oxlint-base.ts'

// Preserve the frozen consumer policy rather than re-enabling retired base rules.
const {
  'overeng/explicit-boolean-compare': _removedExplicitBooleanCompare,
  ...baseRulesWithoutDeprecatedOvereng
} = baseOxlintRules

const vistaOverrides = [
  {
    files: [
      '**/flakes/vista/blocks/src/index.ts',
      '**/flakes/vista/agent-timeline/src/index.ts',
      '**/flakes/vista/agent-timeline/src/compact.ts',
    ],
    rules: { 'oxc/no-barrel-file': 'off' },
  },
  {
    files: ['**/flakes/vista/**'],
    rules: {
      'overeng/named-args': 'off',
      'overeng/jsdoc-require-exports': 'off',
      'overeng/exports-first': 'off',
    },
  },
  {
    files: [
      '**/flakes/vista/blocks/src/**',
      '**/flakes/vista/agent-timeline/src/**',
      '**/flakes/vista/service/src/**',
      '**/flakes/vista/service/samples/**',
      '**/flakes/vista/cli/src/**',
    ],
    rules: { 'overeng/jsdoc-require-exports': 'error' },
  },
  {
    files: ['**/flakes/vista/service/samples/**'],
    rules: {
      'react/no-array-index-key': 'off',
      'import/no-unassigned-import': 'off',
      'import/no-dynamic-require': 'off',
      'typescript/consistent-type-imports': 'off',
    },
  },
  {
    files: ['**/flakes/vista/blocks/.storybook/**'],
    rules: { 'react/rules-of-hooks': 'off' },
  },
  {
    files: ['**/flakes/vista/blocks/src/blocks/ChartBlock.tsx'],
    rules: { 'react/no-unstable-nested-components': 'off' },
  },
  {
    files: ['**/flakes/vista/blocks/src/blocks/markdown.tsx'],
    rules: { 'react/no-array-index-key': 'off' },
  },
  {
    files: ['**/flakes/vista/service/src/interview/roundtrip.browser.test.ts'],
    rules: { 'eslint/no-unmodified-loop-condition': 'off' },
  },
] as const

export default oxlintConfig({
  plugins: baseOxlintPlugins,
  jsPlugins: [
    './repos/effect-utils/packages/@overeng/oxc-config/src/mod.ts',
    './repos/effect-utils/packages/@overeng/oxc-config/src/stylex-upstream-plugin.ts',
  ],
  categories: baseOxlintCategories,
  rules: {
    ...baseRulesWithoutDeprecatedOvereng,
    'no-await-in-loop': 'off',
    'no-underscore-dangle': [
      'warn',
      {
        allow: [
          '_tag', '_page_id', '_nds_outbox', '_idleTimeout', '_getActiveHandles',
          '_getActiveRequests', '__stylexCollectCss', 'try_', 'expect_', 'PtySpec_',
          '_meta', '_raw', '__typename', '__name__', '__legacyStringValue',
          '__dirname', 'require_', '__webUtils_domSettleState', '__webUtils_Readability',
          '__webUtils_TurndownService', '__testing',
        ],
      },
    ],
  },
  ignorePatterns: baseOxlintIgnorePatterns,
  overrides: [...baseOxlintOverrides, ...vistaOverrides],
})
