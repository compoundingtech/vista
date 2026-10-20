#!/usr/bin/env node

/**
 * `vista` CLI binary bootstrap (decision 0028). Resolve build identity and
 * preserve the metadata-only version path before loading the operational runtime.
 * Runs from source for local dev; packaged runtime.js is installed beside it.
 *
 * Build identity (decision 0064) is shared with the runtime's OTel bootstrap
 * (decision 0062): `displayVersion` (human prose) for `--version`,
 * `machineVersion` (protocol form) for telemetry `service.version`.
 */
import { resolveCliBuildIdentity } from '@overeng/utils/node/cli-version'

/** The build stamp embedded in the imported product. */
const buildStamp = '__CLI_BUILD_STAMP__'

/**
 * Structured build identity resolved from the embedded stamp (decision 0064,
 * AGT.CLI-R67). Falls back to the base version when running unstamped from source.
 */
const buildIdentity = resolveCliBuildIdentity({ baseVersion: '0.1.0', buildStamp })

const main = async (): Promise<void> => {
  // Effect 4 formats its built-in version output as `vista v<version>`.
  // Preserve Vista's established machine-readable bytes (`<version>\n`) and
  // long-standing `-v` alias without loading the runtime/telemetry closure.
  if (process.argv[2] === '--version' || process.argv[2] === '-v') {
    process.stdout.write(`${buildIdentity.displayVersion}\n`)
    return
  }

  // A static import would load the operational closure on the metadata-only path.
  const { runCli } = await import('./runtime.js')
  await runCli(buildIdentity)
}

void main()
