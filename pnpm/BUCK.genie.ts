import { vistaPatchedDependencies } from '../pnpm-workspace.yaml.genie.ts'
import { createGenieOutput } from '../repos/effect-utils/packages/@overeng/genie/src/runtime/core.ts'

// Match frozen D's Nix-staged public exports in the patch-only pnpm package.
// Generate them in the source projection instead of synthesizing a second overlay.
export default createGenieOutput({
  data: null,
  stringify: () =>
    Object.values(vistaPatchedDependencies)
      .map((path) => {
        const name = path.slice('pnpm/'.length)
        return `export_file(
    name = ${JSON.stringify(name)},
    src = ${JSON.stringify(name)},
    visibility = ["PUBLIC"],
)
`
      })
      .join('\n'),
})
