import { foldPtyScreenEvent, type ScreenState } from '@vista/blocks/internal/provider-contracts'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  AttachLease,
  authorizePtyLiveRequest,
  foldPtyScreen,
  requestMetadataFrom,
  screenDelta,
} from './pty.provider.ts'

describe('PTY provider', () => {
  it('enforces one actor-bound writer lease', () => {
    const leases = new AttachLease()
    const first = leases.acquire('viewer-a', 1_000)

    expect(() => leases.acquire('viewer-b', 1_001)).toThrow('another viewer holds')
    expect(() => leases.authorize('viewer-b', first.id, 1_002)).toThrow('belongs to another viewer')
    expect(() => leases.authorize('viewer-a', first.id, 1_002)).not.toThrow()

    leases.release('viewer-a', first.id, 1_003)
    expect(() => leases.acquire('viewer-b', 1_004)).not.toThrow()
  })
  it('denies attach metadata without a service-proven actor source', async () => {
    const suppliedActorOnly = requestMetadataFrom({
      headers: {
        'x-vista-trusted-actor': 'forged:viewer',
        'x-vista-app-version': 'owner/app/v1',
      },
    })

    await expect(Effect.runPromise(suppliedActorOnly)).rejects.toMatchObject({
      reason: 'identity',
      message: 'trusted viewer identity is missing',
    })
    await expect(
      Effect.runPromise(
        requestMetadataFrom({
          headers: {
            'x-vista-trusted-actor': 'local:viewer',
            'x-vista-trusted-actor-source': 'loopback-dev',
            'x-vista-app-version': 'owner/app/v1',
          },
        }),
      ),
    ).resolves.toMatchObject({
      actor: 'local:viewer',
      actorSource: 'loopback-dev',
    })
  })

  it('admits only manifest-declared screen sessions without requiring browser command headers', async () => {
    const request = {
      headers: {
        'x-vista-declared-pty-sessions': '["declared-session"]',
      },
    }

    await expect(
      Effect.runPromise(
        authorizePtyLiveRequest('screen', { sessionId: 'declared-session' }, request),
      ),
    ).resolves.toBeUndefined()
    await expect(
      Effect.runPromise(
        authorizePtyLiveRequest('screen', { sessionId: 'foreign-session' }, request),
      ),
    ).rejects.toMatchObject({
      _tag: 'SessionNotDeclared',
      sessionId: 'foreign-session',
    })
  })

  it('requires allowed Origin and same-origin fetch metadata for HTTP commands', async () => {
    const payload = { sessionId: 'declared-session' }
    const declared = {
      'x-vista-declared-pty-sessions': '["declared-session"]',
    }
    const authorize = (headers: Readonly<Record<string, string>>) =>
      Effect.runPromise(authorizePtyLiveRequest('attach', payload, { headers }))

    await expect(
      authorize({
        ...declared,
        origin: 'http://127.0.0.1:5193',
        'sec-fetch-site': 'same-origin',
      }),
    ).resolves.toBeUndefined()
    const previousPublicUrl = process.env.VISTA_PUBLIC_URL
    process.env.VISTA_PUBLIC_URL = 'https://vista-dev3.example.test/reviews'
    try {
      await expect(
        authorize({
          ...declared,
          origin: 'https://vista-dev3.example.test',
          'sec-fetch-site': 'same-origin',
        }),
      ).resolves.toBeUndefined()
    } finally {
      if (previousPublicUrl === undefined) delete process.env.VISTA_PUBLIC_URL
      else process.env.VISTA_PUBLIC_URL = previousPublicUrl
    }
    await expect(
      authorize({
        ...declared,
        origin: 'https://foreign.example',
        'sec-fetch-site': 'same-origin',
      }),
    ).rejects.toMatchObject({ reason: 'identity' })
    await expect(
      authorize({
        ...declared,
        'sec-fetch-site': 'same-origin',
      }),
    ).rejects.toMatchObject({ reason: 'identity' })
    await expect(
      authorize({
        ...declared,
        origin: 'http://localhost:5193',
      }),
    ).rejects.toMatchObject({
      reason: 'identity',
      message: 'HTTP commands require Sec-Fetch-Site: same-origin',
    })
    await expect(
      authorize({
        ...declared,
        origin: 'http://localhost:5193',
        'sec-fetch-site': 'cross-site',
      }),
    ).rejects.toMatchObject({
      reason: 'identity',
      message: 'HTTP commands require Sec-Fetch-Site: same-origin',
    })
  })

  it('uses the same allowed-origin policy for WebSocket command upgrades', async () => {
    const payload = { sessionId: 'declared-session' }
    const declared = {
      'x-vista-declared-pty-sessions': '["declared-session"]',
    }
    const authorize = (headers: Readonly<Record<string, string>>) =>
      Effect.runPromise(authorizePtyLiveRequest('attach', payload, { headers }, 'websocket'))

    await expect(
      authorize({
        ...declared,
        origin: 'http://localhost:5193',
      }),
    ).resolves.toBeUndefined()
    await expect(
      authorize({
        ...declared,
        origin: 'https://foreign.example',
      }),
    ).rejects.toMatchObject({ reason: 'identity' })
    await expect(authorize(declared)).rejects.toMatchObject({ reason: 'identity' })
  })

  it('folds identical terminal output into the same bounded viewport', async () => {
    const chunks = [
      new TextEncoder().encode('alpha\r\n'),
      new TextEncoder().encode('\u001b[2;1Hbeta'),
    ]
    const first = await foldPtyScreen(chunks, 20, 4)
    const second = await foldPtyScreen(chunks, 20, 4)

    expect({ ...first, observedAt: undefined }).toEqual({ ...second, observedAt: undefined })
    expect(first.rows).toEqual(['alpha', 'beta'])
    expect(first.cursorX).toBe(4)
    expect(first.cursorY).toBe(1)
  })

  it('transfers under five percent of full-frame bytes for single-row changes', () => {
    const columns = 183
    const rowCount = 101
    const initial: ScreenState = {
      _tag: 'ScreenState',
      cursor: 'frame-0',
      seq: 0,
      columns,
      rowCount,
      rows: Array.from(
        { length: rowCount },
        (_, index) => `${String(index).padStart(3, '0')}${'.'.repeat(columns - 3)}`,
      ),
      cursorX: 0,
      cursorY: 0,
      observedAt: '2026-09-22T12:00:00.000Z',
    }
    let folded = initial
    let deltaBytes = 0
    let fullFrameBytes = 0

    for (let index = 1; index <= 100; index += 1) {
      const row = (index - 1) % rowCount
      const rows = [...folded.rows]
      rows[row] = String.fromCharCode(65 + (index % 26)).repeat(columns)
      const next: ScreenState = {
        ...folded,
        cursor: `frame-${String(index)}`,
        seq: index,
        rows,
        cursorX: index % columns,
        cursorY: row,
        observedAt: new Date(Date.parse(initial.observedAt) + index).toISOString(),
      }
      const event = { _tag: 'CoalescedFrame' as const, delta: screenDelta(folded, next) }
      deltaBytes += new TextEncoder().encode(JSON.stringify(event)).byteLength
      fullFrameBytes += new TextEncoder().encode(
        JSON.stringify({
          _tag: 'CoalescedFrame',
          state: next,
        }),
      ).byteLength
      folded = foldPtyScreenEvent(folded, event)
    }

    expect(folded.seq).toBe(100)
    expect(folded.rows).toHaveLength(rowCount)
    expect(deltaBytes / fullFrameBytes).toBeLessThan(0.05)
  })
})
