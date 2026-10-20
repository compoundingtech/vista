import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ScreenState } from '@vista/blocks/internal/provider-contracts'
import { Effect, Stream, SubscriptionRef } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'

import { SessionBridge } from './pty.provider.ts'

const DATA = 0
const ATTACH = 1
const DETACH = 2
const SCREEN = 5
const PEEK = 6
const GEOMETRY = 10

const initialState = (): ScreenState => ({
  _tag: 'ScreenState',
  cursor: 'frame-0',
  seq: 0,
  columns: 80,
  rowCount: 24,
  rows: [],
  cursorX: 0,
  cursorY: 0,
  observedAt: new Date(0).toISOString(),
})

const packet = (type: number, payload: Buffer): Buffer => {
  const header = Buffer.alloc(5)
  header.writeUInt8(type, 0)
  header.writeUInt32BE(payload.length, 1)
  return Buffer.concat([header, payload])
}

const geometryPacket = (rows: number, columns: number): Buffer => {
  const geometry = Buffer.alloc(4)
  geometry.writeUInt16BE(rows, 0)
  geometry.writeUInt16BE(columns, 2)
  return packet(GEOMETRY, geometry)
}

const attachPacket = (rows: number, columns: number): Buffer => {
  const geometry = Buffer.alloc(4)
  geometry.writeUInt16BE(rows, 0)
  geometry.writeUInt16BE(columns, 2)
  return packet(ATTACH, geometry)
}

const withTimeout = async <A>(promise: Promise<A>, timeoutMs = 5_000): Promise<A> => {
  const timeout = Promise.withResolvers<never>()
  // This is a failure watchdog around real daemon/socket integration, not a
  // synchronization delay; successful paths resolve from protocol events.
  setTimeout(() => timeout.reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs).unref()
  return await Promise.race([promise, timeout.promise])
}

const resizeIsolatedSession = async (
  root: string,
  sessionId: string,
  rows: number,
  columns: number,
): Promise<void> => {
  const resized = Promise.withResolvers<void>()
  const socket = net.createConnection(join(root, `${sessionId}.sock`))
  let received = Buffer.alloc(0)
  socket.once('connect', () => socket.write(attachPacket(rows, columns)))
  socket.on('data', (chunk) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    received = Buffer.concat([received, bytes])
    while (received.length >= 5) {
      const length = received.readUInt32BE(1)
      if (received.length < length + 5) return
      const type = received.readUInt8(0)
      received = received.subarray(length + 5)
      if (type !== SCREEN) continue
      socket.write(packet(DETACH, Buffer.alloc(0)))
      socket.destroy()
      resized.resolve()
      return
    }
  })
  socket.once('error', resized.reject)
  await withTimeout(resized.promise)
}

const tuiProgram = String.raw`
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let frame = 0;
const draw = () => {
  const rows = Array.from({ length: 101 }, (_, row) =>
    String(row + 1).padStart(3, '0') + ' frame-' + String(frame).padStart(3, '0') + ' ' + 'busy-livepty '.repeat(13)
  );
  process.stdout.write('\x1b[H\x1b[2J' + rows.join('\r\n'));
};
(async () => {
  while (true) {
    draw();
    await wait(70);
    draw();
    await wait(70);
    frame += 1;
  }
})();
`

describe('PTY provider bridge', () => {
  const roots: string[] = []
  const sessions: Array<{ readonly root: string; readonly id: string }> = []
  const bridges: SessionBridge[] = []
  const originalRoot = process.env.PTY_ROOT

  afterEach(async () => {
    await Promise.all(bridges.splice(0).map((bridge) => bridge.close()))
    for (const { root, id } of sessions.splice(0)) {
      try {
        execFileSync('pty', ['--root', root, 'kill', id], { stdio: 'ignore' })
      } catch {
        // A completed test process may already be gone.
      }
    }
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
    if (originalRoot === undefined) delete process.env.PTY_ROOT
    else process.env.PTY_ROOT = originalRoot
  })

  it('waits for a folded SCREEN before exposing the capture seed', async () => {
    const root = mkdtempSync(join(tmpdir(), 'vista-livepty-seed-'))
    roots.push(root)
    process.env.PTY_ROOT = root
    const sessionId = 'delayed-screen'
    const server = net.createServer((socket) => {
      socket.once('data', (request) => {
        const requestBytes = Buffer.isBuffer(request) ? request : Buffer.from(request)
        expect(requestBytes.readUInt8(0)).toBe(PEEK)
        socket.write(geometryPacket(101, 183))
        // The real daemon's GEOMETRY→SCREEN ordering crosses the bridge's
        // 16 ms coalescing boundary for a busy 183×101 fold. Model that exact
        // protocol timing so the pre-fix geometry-only capture fails reliably.
        setTimeout(() => {
          socket.write(packet(SCREEN, Buffer.from('busy capture\r\nsecond row')))
        }, 50)
      })
    })
    const listening = Promise.withResolvers<void>()
    server.once('error', listening.reject)
    server.listen(join(root, `${sessionId}.sock`), listening.resolve)
    await listening.promise

    let bridge: SessionBridge | undefined
    try {
      const state = await Effect.runPromise(SubscriptionRef.make(initialState()))
      bridge = await withTimeout(SessionBridge.open(sessionId, state))
      const seed = await Effect.runPromise(SubscriptionRef.get(state))

      expect(seed.columns).toBe(183)
      expect(seed.rowCount).toBe(101)
      expect(seed.rows).toEqual(['busy capture', 'second row'])
    } finally {
      await bridge?.close()
      const closed = Promise.withResolvers<void>()
      server.close((error) => {
        if (error === undefined) closed.resolve()
        else closed.reject(error)
      })
      await closed.promise
    }
  })

  it('audits send before delivering terminal input', async () => {
    const root = mkdtempSync(join(tmpdir(), 'vista-livepty-audit-'))
    roots.push(root)
    process.env.PTY_ROOT = root
    const sessionId = 'audit-before-send'
    const inputs: string[] = []
    const order: string[] = []
    const inputReceived = Promise.withResolvers<void>()
    const server = net.createServer((socket) => {
      let received = Buffer.alloc(0)
      socket.on('data', (chunk) => {
        received = Buffer.concat([received, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)])
        while (received.length >= 5) {
          const payloadLength = received.readUInt32BE(1)
          if (received.length < 5 + payloadLength) return
          const type = received.readUInt8(0)
          const payload = received.subarray(5, 5 + payloadLength)
          received = received.subarray(5 + payloadLength)
          if (type === PEEK) {
            socket.write(geometryPacket(24, 80))
            socket.write(packet(SCREEN, Buffer.from('ready')))
          }
          if (type === DATA) {
            order.push('wire:data')
            inputs.push(payload.toString())
            inputReceived.resolve()
          }
        }
      })
    })
    const listening = Promise.withResolvers<void>()
    server.once('error', listening.reject)
    server.listen(join(root, `${sessionId}.sock`), listening.resolve)
    await listening.promise

    const auditStarted = Promise.withResolvers<void>()
    const auditMayFinish = Promise.withResolvers<void>()
    let sendAuditAttempt = 0
    const emitAudit = async (_sessionId: string, type: string): Promise<void> => {
      if (type !== 'user.vista.input.send') return
      sendAuditAttempt += 1
      if (sendAuditAttempt === 1) {
        order.push('audit:send:failed')
        throw new Error('audit unavailable')
      }
      order.push('audit:send:started')
      auditStarted.resolve()
      await auditMayFinish.promise
      order.push('audit:send:done')
    }

    let bridge: SessionBridge | undefined
    try {
      const state = await Effect.runPromise(SubscriptionRef.make(initialState()))
      bridge = await withTimeout(SessionBridge.open(sessionId, state, emitAudit))
      const metadata = {
        _tag: 'RequestMetadata',
        actor: 'viewer-a',
        actorSource: 'loopback-dev',
        appVersion: 'test',
      } as const
      const lease = await bridge.attach(metadata)

      await expect(bridge.send(metadata, lease.leaseId, 'dangerous\n')).rejects.toThrow(
        'audit unavailable',
      )
      expect(inputs).toEqual([])

      const send = bridge.send(metadata, lease.leaseId, 'safe\n')
      await auditStarted.promise
      expect(inputs).toEqual([])
      auditMayFinish.resolve()
      await send
      await inputReceived.promise

      expect(inputs).toEqual(['safe\n'])
      expect(order.indexOf('audit:send:done')).toBeLessThan(order.indexOf('wire:data'))
    } finally {
      await bridge?.close()
      const closed = Promise.withResolvers<void>()
      server.close((error) => {
        if (error === undefined) closed.resolve()
        else closed.reject(error)
      })
      await closed.promise
    }
  })

  it('streams distinct 183×101 frames through daemon-enforced read-only PEEK', async () => {
    const root = mkdtempSync(join(tmpdir(), 'vista-livepty-stream-'))
    roots.push(root)
    process.env.PTY_ROOT = root
    const sessionId = 'large-tui'
    const childEnv = { ...process.env }
    delete childEnv.PTY_SESSION
    execFileSync(
      'pty',
      ['--root', root, 'run', '-d', '--id', sessionId, '--', process.execPath, '-e', tuiProgram],
      { env: childEnv, stdio: 'ignore' },
    )
    sessions.push({ root, id: sessionId })
    await resizeIsolatedSession(root, sessionId, 101, 183)

    const state = await Effect.runPromise(SubscriptionRef.make(initialState()))
    const bridge = await withTimeout(SessionBridge.open(sessionId, state))
    bridges.push(bridge)
    const initial = await Effect.runPromise(SubscriptionRef.get(state))
    expect(initial.columns).toBe(183)
    expect(initial.rowCount).toBe(101)
    expect(initial.rows.join('\n')).toContain('busy-livepty')

    const stats = JSON.parse(
      execFileSync('pty', ['--root', root, 'stats', '--json', sessionId], { encoding: 'utf8' }),
    ) as { readonly clients: { readonly attached: number; readonly readOnly: number } }
    expect(stats.clients).toMatchObject({ attached: 0, readOnly: 1 })

    const frames = Array.from(
      await withTimeout(
        Effect.runPromise(SubscriptionRef.changes(state).pipe(Stream.take(5), Stream.runCollect)),
      ),
    )
    const visibleFrames = frames.map((frame) =>
      [frame.columns, frame.rowCount, frame.cursorX, frame.cursorY, ...frame.rows].join('\n'),
    )

    expect(frames).toHaveLength(5)
    expect(new Set(visibleFrames).size).toBe(frames.length)
  }, 10_000)
})
