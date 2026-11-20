import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { TestProject } from 'vitest/node'

import { publishWorkerBundleArgs } from './src/bundle-config.ts'

/** Build once, outside the service and outside the Vitest module transformer. */
export default function setup(project: TestProject) {
  const service = dirname(fileURLToPath(import.meta.url))
  mkdirSync(join(service, 'tmp'), { recursive: true })
  const directory = mkdtempSync(join(service, 'tmp', 'worker-test-bundle-'))
  const entry = join(directory, 'publish-worker.mjs')
  try {
    execFileSync(
      'bun',
      publishWorkerBundleArgs({
        entrypoint: join(service, 'src', 'publish-worker.ts'),
        outfile: entry,
        target: 'node',
      }),
      { cwd: service, stdio: 'inherit' },
    )
    project.provide('publishWorkerEntry', entry)
  } catch (error) {
    rmSync(directory, { recursive: true, force: true })
    throw error
  }
  return () => rmSync(directory, { recursive: true, force: true })
}
