import { globSync, statSync } from 'node:fs'
import path from 'node:path'

import {
  buck2TypeScriptPackageProjection,
  type Buck2TypeScriptPackageProjection,
} from '../../repos/effect-utils/genie/buck2/typescript-package-projection.ts'
import { createGenieOutput } from '../../repos/effect-utils/packages/@overeng/genie/src/runtime/core.ts'

/** Archive projects emit from rootDir '.', preserving package-relative asset paths. */
export const buck2TypeScriptPackageProjectionWithAssets = (
  admission: Buck2TypeScriptPackageProjection,
) => {
  const packageRoot = path.join(process.cwd(), admission.packagePath)
  const assets = globSync(
    admission.sourceRoots.map((root) => `${root}/**/*`),
    { cwd: packageRoot },
  )
    .filter(
      (file) =>
        /\.[cm]?[jt]sx?$/.test(file) === false &&
        statSync(path.join(packageRoot, file)).isFile(),
    )
    .sort()
  const projectInputs = new Set(
    admission.authorities.flatMap((authority) => authority.projectInputs ?? []),
  )
  // The pinned projection already admits CSS and explicitly declared project inputs.
  const additionalAssets = assets.filter(
    (file) => path.extname(file) !== '.css' && projectInputs.has(file) === false,
  )
  const runtimeFiles = [
    ...new Set([
      ...(admission.runtimeFiles ?? []),
      ...additionalAssets,
    ]),
  ].sort()
  const projection = buck2TypeScriptPackageProjection({ ...admission, runtimeFiles })
  if (assets.length === 0) return projection
  return createGenieOutput({
    ...projection,
    stringify: (context) =>
      projection
        .stringify(context)
        .replace(
          'load("@rules//buck2:typescript.bzl", "tsgo_emit", "tsgo_typecheck")',
          'load("@rules//buck2:typescript.bzl", "tsgo_typecheck")\nload("//buck2:dist-assets.bzl", "tsgo_emit")',
        )
        .replace(
          '    name = "dist",',
          `    name = "dist",\n    assets = {\n${assets
            .map((file) => `        ${JSON.stringify(file)}: ${JSON.stringify(file)},`)
            .join('\n')}\n    },`,
        ) +
      `\nexport_materialization_inputs(${JSON.stringify(additionalAssets)})\n`,
  })
}
