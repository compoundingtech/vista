import effectUtilsProducts from '../repos/effect-utils/nix/buck2-products/manifest.json'
import {
  catalog as effectUtilsCatalog,
  defineCatalog,
} from '../repos/effect-utils/genie/external.ts'

export {
  baseTsconfigCompilerOptions,
  domLib,
  packageJson,
  packageTsconfigCompilerOptions,
  privatePackageDefaults,
  reactJsx,
  tsconfigJson,
  type PackageJsonData,
} from '../repos/effect-utils/genie/external.ts'

export const effectUtilsArtifactUrls = Object.fromEntries(
  effectUtilsProducts.products
    .filter((product) => product.name.startsWith('@overeng/'))
    .map((product) => [product.name, product.artifactUrl]),
)

export const effectUtilsArtifacts = (...names: readonly string[]): Record<string, string> =>
  Object.fromEntries(names.map((name) => [name, effectUtilsArtifactUrls[name]!]))

export const catalog = defineCatalog({
  extends: effectUtilsCatalog,
  packages: {
    ...effectUtilsArtifactUrls,
    '@effect/language-service': '0.69.2',
    '@internationalized/date': '3.12.1',
    clsx: '2.1.1',
    'fast-check': '4.9.0',
    'oxc-parser': '0.149.0',
    recharts: '3.8.1',
  },
})
