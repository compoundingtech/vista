import { createGenieOutput } from '../../repos/effect-utils/packages/@overeng/genie/src/runtime/core.ts'

export default createGenieOutput({
  data: null,
  stringify: () => `load("@rules//buck2/products:defs.bzl", "javascript_product")
load("@rules//buck2/dependencies:defs.bzl", "pnpm_runtime_closure")

pnpm_runtime_closure(
    name = "vista-runtime-closure",
    importers = {
        "service": "//flakes/vista/service:node_modules",
        "cli": "//flakes/vista/cli:node_modules",
        "blocks": "//flakes/vista/blocks:node_modules",
    },
    primary = "service",
    runtime = "@rules//buck2/dependencies:runtime-closure.ts",
    visibility = ["PUBLIC"],
)

javascript_product(
    name = "vista-candidate",
    module = "//flakes/vista/cli:vista-bundle-module",
    product_kind = "cli",
    product_name = "vista",
    visibility = ["PUBLIC"],
)

javascript_product(
    name = "vista-runtime-candidate",
    module = "//flakes/vista/cli:vista-runtime-bundle-module",
    product_kind = "module",
    product_name = "vista-runtime",
    visibility = ["PUBLIC"],
)

javascript_product(
    name = "vista-preflight-candidate",
    module = "//flakes/vista/cli:vista-preflight-bundle-module",
    product_kind = "module",
    product_name = "vista-preflight",
    visibility = ["PUBLIC"],
)

javascript_product(
    name = "vista-service-candidate",
    module = "//flakes/vista/service:vista-service-bundle-module",
    product_kind = "cli",
    product_name = "vista-service",
    visibility = ["PUBLIC"],
)
`,
})
