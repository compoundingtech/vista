/**
 * Worker entry for the image lens: runs {@link runImageJob} off the main thread. Loaded only
 * through `new Worker(new URL('./imageDiff.worker.ts', import.meta.url))` and never imported,
 * so `self` is always the worker scope and no page or server module evaluates this registration.
 */
import { type ImageJob, runImageJob } from './imageDiffJob.ts'

self.addEventListener('message', (event: MessageEvent<ImageJob>) => {
  try {
    const result = runImageJob(event.data)
    self.postMessage(result, {
      transfer:
        result.painting === undefined
          ? [result.diff.mask.buffer, result.diff.delta.buffer]
          : [result.diff.mask.buffer, result.diff.delta.buffer, result.painting],
    })
  } catch (error) {
    // Nothing to transfer: the error reply is a plain clone to the owning page.
    self.postMessage(
      {
        id: event.data.id,
        error: error instanceof Error ? error.message : 'Comparison failed.',
      },
      { transfer: [] },
    )
  }
})
