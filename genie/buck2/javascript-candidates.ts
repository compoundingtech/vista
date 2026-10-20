import {
  withJavaScriptCandidates,
  type JavaScriptProduct as SharedJavaScriptProduct,
} from '../../repos/effect-utils/genie/buck2/javascript-candidates.ts'
import {
  createGenieOutput,
  type GenieOutput,
} from '../../repos/effect-utils/packages/@overeng/genie/src/runtime/core.ts'

export { buck2TypeScriptPackageProjection } from '../../repos/effect-utils/genie/buck2/typescript-package-projection.ts'

export type JavaScriptProduct = Omit<
  SharedJavaScriptProduct,
  'compiledExecutable' | 'smokeArgs' | 'smokeRuntime'
>

/** Preserve the consumer's source-tree admission while sharing product rendering. */
export const withConsumerJavaScriptProducts = <TData>({
  products,
  projection,
}: {
  readonly products: readonly JavaScriptProduct[]
  readonly projection: GenieOutput<TData>
}): GenieOutput<TData> => {
  const candidates = withJavaScriptCandidates({
    projection,
    products: products.map((product) => ({
      ...product,
      // The original consumer uses the canonical package tree, not E's product-only view.
      packageTree: product.packageTree ?? ':package_tree',
    })),
  })
  if (products.length === 0) return candidates
  return createGenieOutput({
    ...candidates,
    stringify: (context) =>
      candidates
        .stringify(context)
        .replace(
          'load("//buck2:package_tools.bzl", "package_bin_artifact")',
          'load("@rules//buck2:package_tools.bzl", "package_bin_artifact")',
        )
        .replace(
          'load("//buck2/products:defs.bzl", "javascript_product")',
          'load("@rules//buck2/products:defs.bzl", "javascript_product")',
        ),
  })
}
