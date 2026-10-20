import { dependencyImporterFor } from '../../../buck2/dependencies/generate.ts'
import { createGenieOutput } from '../../../repos/effect-utils/packages/@overeng/genie/src/runtime/core.ts'

/**
 * The telemetry island is a Vite library build, not a TypeScript package: its
 * Buck package tree is the importer's own pnpm dependency view plus
 * the sources Vite reads, and the one product is the self-contained
 * `island.js` chunk (decision 0046).
 */
const dependencyView = dependencyImporterFor('flakes/vista/island').replace(
  '//buck2/dependencies:importer_',
  '//buck2/dependencies:view_',
)

export default createGenieOutput({
  data: { dependencyView },
  stringify: () => `load("@rules//buck2:materialization.bzl", "package_view")
load("@rules//buck2:package_tools.bzl", "package_bin_build")

export_file(
    name = "package.json",
    src = "package.json",
    visibility = ["PUBLIC"],
)

alias(
    name = "node_modules",
    actual = ${JSON.stringify(dependencyView)},
    visibility = ["PUBLIC"],
)

package_view(
    name = "island_package_tree",
    dependency_view = ":node_modules",
    files = dict([(source, source) for source in glob(["src/**/*.ts", "src/**/*.tsx", "vendor/**/*.js", "vendor/**/*.ts", "vendor/**/*.tsx"])] + [
        ("package.json", "package.json"),
        ("vite.config.ts", "vite.config.ts"),
    ]),
    workspace_dist = {},
    workspace_dependency_views = {},
    runtime = "@rules//:package_tree_runtime",
    runtime_entry = "package-tree.ts",
    visibility = ["PUBLIC"],
)

package_bin_build(
    name = "telemetry-island",
    package_tree = ":island_package_tree",
    entrypoint = "node_modules/vite/bin/vite.js",
    args = ["build", "--config", "vite.config.ts", "--configLoader", "runner", "--outDir", "{OUT}"],
    output = "island",
    visibility = ["PUBLIC"],
)
`,
})
