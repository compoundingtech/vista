import {
  renderPnpmPackageTargets,
  renderPnpmPlatformGatedPackages,
  renderPnpmStoreBuck,
} from '../../repos/effect-utils/buck2/dependencies/pnpm-store-buck.ts'
import { createGenieOutput } from '../../repos/effect-utils/packages/@overeng/genie/src/runtime/core.ts'
import { loadVistaPnpmLockData } from './generate.ts'

const { metadata, sidecar, store } = loadVistaPnpmLockData()

// Only shared rule/runtime locations change; the shared translator owns the graph.
const storeDeclarations = renderPnpmStoreBuck(store)
  .replace('load(":defs.bzl",', 'load("@rules//buck2/dependencies:defs.bzl",')
  .replace(
    'export_file(\n    name = "assemble-store.ts",\n    src = "assemble-store.ts",\n    visibility = ["PUBLIC"],\n)\n\n',
    '',
  )
  .replace(
    'pnpm_platform_configurations()',
    'pnpm_platform_configurations(platforms_cell = "@rules")',
  )
  .replaceAll(
    'runtime = ":assemble-store.ts"',
    'runtime = "@rules//buck2/dependencies:assemble-store.ts"',
  )

export default createGenieOutput({
  data: { store },
  stringify: () => `# Generated file - DO NOT EDIT
# Source: pnpm-lock.yaml
# Store fingerprint: ${store.fingerprint}

load("@rules//buck2:materialization.bzl", "export_materialization_inputs")

export_materialization_inputs(glob(["*.ts"]) + ["BUCK", "pnpm-lock.sha256.json"])

load("@rules//buck2/dependencies:defs.bzl", "pnpm_package", "pnpm_platform_gated_packages")

${renderPnpmPlatformGatedPackages({ metadata })}
${renderPnpmPackageTargets({ metadata, sidecar, patchSourceCells: { 'repos/effect-utils': 'rules' } })}
${storeDeclarations}
${store.views.map((view) => `alias(
    name = ${JSON.stringify(view.target.replace(/^view_/, 'importer_'))},
    actual = ${JSON.stringify(`:${view.target}`)},
    visibility = ["PUBLIC"],
)
`).join('\n')}`,
})
