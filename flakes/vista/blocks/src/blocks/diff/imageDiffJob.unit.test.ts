import { describe, expect, it } from 'vitest'

import { makeJobQueue } from './imageDiffJob.ts'

describe('image job queue', () => {
  it('runs at most the slot count and starts waiting jobs in enqueue order', async () => {
    const queue = makeJobQueue(2)
    const gates = Array.from({ length: 4 }, () => Promise.withResolvers<number>())
    const starts = gates.map(() => Promise.withResolvers<void>())
    const started: number[] = []
    const results = gates.map((gate, index) =>
      queue.schedule(() => {
        started.push(index)
        starts[index]!.resolve()
        return gate.promise
      }),
    )
    expect(started).toEqual([0, 1])
    expect([queue.active(), queue.waiting()]).toEqual([2, 2])

    // A later job finishing first hands its slot to the oldest waiting job.
    gates[1]!.resolve(1)
    await starts[2]!.promise
    expect(started).toEqual([0, 1, 2])
    expect([queue.active(), queue.waiting()]).toEqual([2, 1])

    gates[0]!.resolve(0)
    gates[2]!.resolve(2)
    gates[3]!.resolve(3)
    expect(await Promise.all(results)).toEqual([0, 1, 2, 3])
    expect([queue.active(), queue.waiting()]).toEqual([0, 0])
  })

  it('settles and frees the slot when a job rejects or throws synchronously', async () => {
    const queue = makeJobQueue(1)
    const rejected = queue.schedule(() => Promise.reject(new Error('worker failed')))
    const thrown = queue.schedule((): Promise<number> => {
      throw new Error('transfer failed')
    })
    const next = queue.schedule(() => Promise.resolve('ran'))

    await expect(rejected).rejects.toThrow('worker failed')
    await expect(thrown).rejects.toThrow('transfer failed')
    await expect(next).resolves.toBe('ran')
    expect([queue.active(), queue.waiting()]).toEqual([0, 0])
  })
})
