import { describe, expect, it } from 'vitest'

import type { AttachLease } from '../provider-contracts.ts'
import { makeLivePtyLeaseAuthority, releaseLivePtyLease } from './LivePty.tsx'

const lease: AttachLease = {
  _tag: 'AttachLease',
  leaseId: 'lease-1',
  expiresAt: '2026-09-23T12:00:00.000Z',
}

describe('LivePty lease authority', () => {
  it('serializes terminal input sends within the active lease', async () => {
    const authority = makeLivePtyLeaseAuthority()
    const firstSend = Promise.withResolvers<void>()
    const events: string[] = []
    authority.activate(lease)

    const dispatch = async (activeLease: AttachLease, input: string): Promise<void> => {
      events.push(`start:${activeLease.leaseId}:${input}`)
      if (input === 'first') await firstSend.promise
      events.push(`finish:${activeLease.leaseId}:${input}`)
    }
    const first = authority.enqueue('first', dispatch, () => undefined)
    const second = authority.enqueue('second', dispatch, () => undefined)
    if (first === undefined || second === undefined) throw new Error('active lease rejected input')

    await Promise.resolve()
    expect(events).toEqual(['start:lease-1:first'])

    firstSend.resolve()
    await Promise.all([first, second])
    expect(events).toEqual([
      'start:lease-1:first',
      'finish:lease-1:first',
      'start:lease-1:second',
      'finish:lease-1:second',
    ])
  })

  it('revokes local authority before release and does not restore it when release fails', async () => {
    const authority = makeLivePtyLeaseAuthority()
    let locallyAttached = true
    let dispatchedAfterFailure = false
    authority.activate(lease)

    await expect(
      releaseLivePtyLease(
        authority,
        () => {
          locallyAttached = false
        },
        async (releasedLease) => {
          expect(releasedLease).toEqual(lease)
          expect(locallyAttached).toBe(false)
          expect(authority.active()).toBeUndefined()
          throw new Error('release transport failed')
        },
      ),
    ).rejects.toThrow('release transport failed')

    expect(authority.active()).toBeUndefined()
    expect(
      authority.enqueue(
        'stale input',
        async () => {
          dispatchedAfterFailure = true
        },
        () => undefined,
      ),
    ).toBeUndefined()
    expect(dispatchedAfterFailure).toBe(false)
  })
})
