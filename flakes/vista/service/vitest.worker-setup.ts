import { inject, vi } from 'vitest'

import type * as WorkerLauncherModule from './src/publish-worker-launcher.ts'

// The test parent is transformed by Vitest; its subprocess is not. Use a real
// compiled Node entry, with the same launcher contract as the packaged service.
vi.mock('./src/publish-worker-launcher.ts', async (importOriginal) => {
  const original = await importOriginal<typeof WorkerLauncherModule>()
  const { Layer } = await import('effect')
  return {
    ...original,
    publishWorkerLauncherLayer: () =>
      Layer.succeed(original.PublishWorkerLauncher, {
        command: process.execPath,
        args: [inject('publishWorkerEntry')],
      }),
  }
})

declare module 'vitest' {
  export interface ProvidedContext {
    publishWorkerEntry: string
  }
}
