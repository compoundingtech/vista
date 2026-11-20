import { join } from 'node:path'

import { Context, Layer } from 'effect'

import { root } from './paths.ts'

export type PublishWorkerCommand = {
  readonly command: string
  readonly args: ReadonlyArray<string>
}

/** The interpreter and compiled entry belong to the service's runtime layout. */
export class PublishWorkerLauncher extends Context.Service<
  PublishWorkerLauncher,
  PublishWorkerCommand
>()('Vista/PublishWorkerLauncher') {}

export const PublishWorkerLauncherLive = Layer.sync(PublishWorkerLauncher, () => ({
  command: process.execPath,
  args: [...process.execArgv, join(root(), 'flakes', 'vista', 'service', 'publish-worker.mjs')],
}))
