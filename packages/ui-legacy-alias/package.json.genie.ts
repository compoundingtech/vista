// @genie-bootstrap
import { catalog, packageJson, privatePackageDefaults } from '../../genie/repo.ts'
import uiPkg from '../ui/package.json.genie.ts'

const composition = catalog.compose({
  workspace: { repoName: 'vista', memberPath: 'packages/ui-legacy-alias' },
  dependencies: { workspace: [uiPkg] },
})

export default packageJson(
  {
    name: '@overeng/geist-design-system',
    ...privatePackageDefaults,
    license: 'Apache-2.0',
    deprecated: 'legacy import root @overeng/geist-design-system; use @vista/ui',
    exports: {
      '.': './src/mod.ts',
      './components': './src/components.ts',
      './foundations': './src/foundations.ts',
      './document.css': './src/document.css',
      './styles.css': './src/styles.css',
      './tokens.stylex': './src/tokens.stylex.ts',
    },
  },
  composition,
)
