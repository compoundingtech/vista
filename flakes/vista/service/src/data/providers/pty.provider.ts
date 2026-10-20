import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import net from 'node:net'

import { NodeServices } from '@effect/platform-node'
import {
  type ScreenEvent,
  type ScreenDelta,
  type ScreenState,
  PtyError,
  SessionNotDeclared,
  pty,
} from '@vista/blocks/internal/provider-contracts'
import xtermHeadless from '@xterm/headless'
import { Context, Effect, Layer, RcMap, Scope, Schema, Stream, SubscriptionRef } from 'effect'
import { ChildProcess } from 'effect/process'
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner'

import { NonEmptyTrimmedString } from '../../api-version.ts'
import { implement, mountProvider } from '../provider.ts'

const HeadlessTerminal = xtermHeadless.Terminal
type HeadlessTerminal = InstanceType<typeof HeadlessTerminal>

const DATA = 0
const ATTACH = 1
const DETACH = 2
const EXIT = 4
const SCREEN = 5
const PEEK = 6
const GEOMETRY = 10
const INITIAL_COLUMNS = 80
const INITIAL_ROWS = 24
const LEASE_TTL_MS = 60_000
const FRAME_COALESCE_MS = 16
const MAX_PACKET_BYTES = 64 * 1024 * 1024

interface Packet {
  readonly type: number
  readonly payload: Buffer
}

/** Server-held, actor/session-bound single-writer authority. */
export class AttachLease {
  private current: Lease | undefined

  acquire(actor: string, now = Date.now()): Lease {
    if (
      this.current !== undefined &&
      this.current.expiresAt > now &&
      this.current.actor !== actor
    ) {
      throw ptyError('lease', 'another viewer holds the attach lease')
    }
    const lease = { actor, id: randomUUID(), expiresAt: now + LEASE_TTL_MS }
    this.current = lease
    return lease
  }

  isExpired(now = Date.now()): boolean {
    return this.current !== undefined && this.current.expiresAt <= now
  }
  authorize(actor: string, leaseId: string, now = Date.now()): void {
    const current = this.current
    if (
      current === undefined ||
      current.expiresAt <= now ||
      current.actor !== actor ||
      current.id !== leaseId
    ) {
      if (current !== undefined && current.expiresAt <= now) this.current = undefined
      throw ptyError('lease', 'attach lease is missing, expired, or belongs to another viewer')
    }
  }

  renew(now = Date.now()): void {
    if (this.current !== undefined) this.current.expiresAt = now + LEASE_TTL_MS
  }

  release(actor: string, leaseId: string, now = Date.now()): void {
    this.authorize(actor, leaseId, now)
    this.current = undefined
  }

  revoke(): void {
    this.current = undefined
  }
}

interface Lease {
  readonly actor: string
  readonly id: string
  expiresAt: number
}

interface SessionResource {
  readonly bridge: SessionBridge
  readonly state: SubscriptionRef.SubscriptionRef<ScreenState>
}

interface SharedRegistry {
  readonly sessions: RcMap.RcMap<string, SessionResource, PtyError>
}

const PtyRegistry = Context.Service<SharedRegistry>('Vista/Pty/Registry')

const ptyRoot = (): string => process.env.PTY_ROOT ?? `${process.env.HOME}/.local/state/pty`
const socketPath = (sessionId: string): string => `${ptyRoot()}/${sessionId}.sock`

const ptyError = (
  reason: 'identity' | 'session' | 'lease' | 'transport' | 'audit',
  cause: unknown,
): PtyError =>
  new PtyError({
    reason,
    message: cause instanceof Error ? cause.message : String(cause),
  })

const encodePacket = (type: number, payload: Buffer): Buffer => {
  const header = Buffer.alloc(5)
  header.writeUInt8(type, 0)
  header.writeUInt32BE(payload.length, 1)
  return Buffer.concat([header, payload])
}

const encodeAttach = (rows: number, columns: number): Buffer => {
  const geometry = Buffer.alloc(4)
  geometry.writeUInt16BE(rows, 0)
  geometry.writeUInt16BE(columns, 2)
  return encodePacket(ATTACH, geometry)
}
const encodePeek = (): Buffer => encodePacket(PEEK, Buffer.from([0]))
const decodeGeometry = (payload: Buffer): { readonly columns: number; readonly rows: number } => {
  if (payload.length < 4) throw new Error('PTY GEOMETRY payload is truncated')
  return {
    rows: payload.readUInt16BE(0),
    columns: payload.readUInt16BE(2),
  }
}

class PacketReader {
  private readonly chunks: Buffer[] = []
  private bufferedBytes = 0

  feed(data: Buffer): readonly Packet[] {
    if (data.length > 0) {
      this.chunks.push(data)
      this.bufferedBytes += data.length
    }
    const packets: Packet[] = []
    while (this.bufferedBytes >= 5) {
      const header = this.peekHeader()
      const length = header.readUInt32BE(1)
      if (length > MAX_PACKET_BYTES) throw new Error(`oversize PTY packet: ${length}`)
      if (this.bufferedBytes < length + 5) break
      this.take(5)
      packets.push({ type: header.readUInt8(0), payload: this.take(length) })
    }
    return packets
  }

  private peekHeader(): Buffer {
    const first = this.chunks[0]
    if (first === undefined) throw new Error('PTY packet buffer is unexpectedly empty')
    if (first.length >= 5) return first.subarray(0, 5)
    const header = Buffer.allocUnsafe(5)
    let offset = 0
    for (const chunk of this.chunks) {
      const count = Math.min(chunk.length, 5 - offset)
      chunk.copy(header, offset, 0, count)
      offset += count
      if (offset === 5) return header
    }
    throw new Error('PTY packet header is unexpectedly incomplete')
  }

  private take(length: number): Buffer {
    if (length === 0) return Buffer.alloc(0)
    const first = this.chunks[0]
    if (first === undefined) throw new Error('PTY packet buffer is unexpectedly empty')
    this.bufferedBytes -= length
    if (first.length === length) {
      this.chunks.shift()
      return first
    }
    if (first.length > length) {
      this.chunks[0] = first.subarray(length)
      return first.subarray(0, length)
    }
    const result = Buffer.allocUnsafe(length)
    let offset = 0
    while (offset < length) {
      const chunk = this.chunks[0]
      if (chunk === undefined) throw new Error('PTY packet payload is unexpectedly incomplete')
      const count = Math.min(chunk.length, length - offset)
      chunk.copy(result, offset, 0, count)
      offset += count
      if (count === chunk.length) this.chunks.shift()
      else this.chunks[0] = chunk.subarray(count)
    }
    return result
  }
}

const terminalRows = (terminal: HeadlessTerminal): readonly string[] => {
  const buffer = terminal.buffer.active
  const rows = Array.from(
    { length: terminal.rows },
    (_, index) => buffer.getLine(buffer.viewportY + index)?.translateToString(true) ?? '',
  )
  while (rows.at(-1) === '') rows.pop()
  return rows
}

const screenState = (terminal: HeadlessTerminal, seq: number): ScreenState => ({
  _tag: 'ScreenState',
  cursor: `frame-${seq}`,
  seq,
  columns: terminal.cols,
  rowCount: terminal.rows,
  rows: terminalRows(terminal),
  cursorX: terminal.buffer.active.cursorX,
  cursorY: terminal.buffer.active.cursorY,
  observedAt: new Date().toISOString(),
})

const sameScreen = (left: ScreenState, right: ScreenState): boolean =>
  left.columns === right.columns &&
  left.rowCount === right.rowCount &&
  left.cursorX === right.cursorX &&
  left.cursorY === right.cursorY &&
  left.rows.length === right.rows.length &&
  left.rows.every((row, index) => row === right.rows[index])

/** Minimal wire update between two independently renderable terminal states. */
export const screenDelta = (previous: ScreenState, next: ScreenState): ScreenDelta => ({
  cursor: next.cursor,
  seq: next.seq,
  columns: next.columns,
  rowCount: next.rowCount,
  contentRowCount: next.rows.length,
  rows: next.rows.flatMap((value, index) =>
    previous.rows[index] === value ? [] : [{ index, value }],
  ),
  cursorX: next.cursorX,
  cursorY: next.cursorY,
  observedAt: next.observedAt,
})
/** Deterministic terminal fold shared by the provider and its unit proof. */
export const foldPtyScreen = async (
  chunks: readonly Uint8Array[],
  columns = INITIAL_COLUMNS,
  rows = INITIAL_ROWS,
): Promise<ScreenState> => {
  const terminal = new HeadlessTerminal({
    allowProposedApi: true,
    cols: columns,
    rows,
    scrollback: 0,
  })
  try {
    for (const chunk of chunks) {
      await new Promise<void>((resolve) => terminal.write(chunk, resolve))
    }
    return screenState(terminal, chunks.length)
  } finally {
    terminal.dispose()
  }
}

const audit = (
  sessionId: string,
  type: string,
  metadata: RequestMetadata,
  detail: Readonly<Record<string, string | number>>,
): Promise<void> => {
  const withSpawner = ChildProcessSpawner.use.bind(ChildProcessSpawner)
  return Effect.runPromise(
    withSpawner((spawner) =>
      spawner.string(
        ChildProcess.make('pty', [
          '--root',
          ptyRoot(),
          'emit',
          sessionId,
          type,
          '--json',
          JSON.stringify({
            actor: metadata.actor,
            appVersion: metadata.appVersion,
            sessionId,
            ...detail,
          }),
        ]),
      ),
    ).pipe(
      Effect.asVoid,
      Effect.mapError((cause) => ptyError('audit', cause)),
      Effect.provide(NodeServices.layer),
    ),
  )
}
type Audit = typeof audit
const RequestMetadata = Schema.TaggedStruct('RequestMetadata', {
  actor: NonEmptyTrimmedString,
  actorSource: Schema.Literals(['loopback-dev', 'tailscale']),
  appVersion: NonEmptyTrimmedString,
}).annotate({ identifier: 'Vista.Pty.RequestMetadata' })
type RequestMetadata = typeof RequestMetadata.Type

const DeclaredPtySessions = Schema.fromJsonString(Schema.Array(NonEmptyTrimmedString)).annotate({
  identifier: 'Vista.Pty.DeclaredSessions',
})

const requestHeader = (options: unknown, name: string): string | undefined => {
  if (typeof options !== 'object' || options === null) return undefined
  const headers = Reflect.get(options, 'headers')
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  if (typeof headers !== 'object' || headers === null) return undefined
  const value = Reflect.get(headers, name)
  return typeof value === 'string' ? value : undefined
}

const declaredSessionsFrom = (options: unknown): Effect.Effect<readonly string[], PtyError> => {
  const encoded = requestHeader(options, 'x-vista-declared-pty-sessions')
  if (encoded === undefined) return Effect.succeed([])
  return Schema.decodeEffect(DeclaredPtySessions)(encoded).pipe(
    Effect.mapError(() => ptyError('session', 'declared PTY session metadata is invalid')),
  )
}

const payloadSessionId = (payload: unknown): string | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined
  const sessionId = Reflect.get(payload, 'sessionId')
  return typeof sessionId === 'string' && sessionId !== '' ? sessionId : undefined
}

const isAllowedCommandOrigin = (origin: string): boolean => {
  let candidate: URL
  try {
    candidate = new URL(origin)
  } catch {
    return false
  }
  const publicUrl = process.env.VISTA_PUBLIC_URL
  if (publicUrl !== undefined) {
    try {
      if (candidate.origin === new URL(publicUrl).origin) return true
    } catch {
      // Invalid service configuration cannot grant command authority.
    }
  }
  return (
    (candidate.protocol === 'http:' || candidate.protocol === 'https:') &&
    (candidate.hostname === 'localhost' ||
      candidate.hostname === '127.0.0.1' ||
      candidate.hostname === '[::1]')
  )
}

/**
 * Union type naming the transport ('http' or 'websocket') on which a PTY command request arrives,
 * used to select the correct request-boundary authorization path.
 */
export type PtyCommandTransport = 'http' | 'websocket'

/**
 * Shared request-boundary authorization for every PTY transport. A future
 * WebSocket upgrade dispatcher must call this with `websocket` before upgrade;
 * the mounted HTTP Rpc path invokes it through Provider authorizeLive.
 */
export const authorizePtyLiveRequest = (
  tag: string,
  payload: unknown,
  options: unknown,
  transport: PtyCommandTransport = 'http',
): Effect.Effect<void, PtyError | SessionNotDeclared> =>
  Effect.gen(function* () {
    const sessionId = payloadSessionId(payload)
    if (sessionId !== undefined) {
      const declared = yield* declaredSessionsFrom(options)
      if (!declared.includes(sessionId)) {
        if (tag === 'screen') {
          return yield* Effect.fail(
            SessionNotDeclared.make({
              sessionId,
              message: `PTY session '${sessionId}' is not declared by this AppVersion`,
            }),
          )
        }
        return yield* ptyError(
          'session',
          `PTY session '${sessionId}' is not declared by this AppVersion`,
        )
      }
    }
    if (tag === 'screen') return

    const origin = requestHeader(options, 'origin')
    if (origin === undefined || !isAllowedCommandOrigin(origin)) {
      return yield* ptyError('identity', 'command Origin is missing or not allowed')
    }
    if (transport === 'http' && requestHeader(options, 'sec-fetch-site') !== 'same-origin') {
      return yield* ptyError('identity', 'HTTP commands require Sec-Fetch-Site: same-origin')
    }
  })

/**
 * Bridges a PTY session by feeding its process socket output into a headless terminal emulator,
 * tracking readiness through a resolvable promise and managing attach leases for connected
 * consumers.
 */
export class SessionBridge {
  private readonly terminal = new HeadlessTerminal({
    allowProposedApi: true,
    cols: INITIAL_COLUMNS,
    rows: INITIAL_ROWS,
    scrollback: 0,
  })
  private readonly socket: net.Socket
  private readonly ready: Promise<void>
  private readyResolve: (() => void) | undefined
  private readyReject: ((cause: Error) => void) | undefined
  private readonly leases = new AttachLease()
  private latest: ScreenState
  private frameTimer: ReturnType<typeof setTimeout> | undefined
  private closed = false
  private receivedScreen = false

  readonly sessionId: string
  private readonly state: SubscriptionRef.SubscriptionRef<ScreenState>
  private readonly emitAudit: Audit
  private constructor(
    sessionId: string,
    state: SubscriptionRef.SubscriptionRef<ScreenState>,
    emitAudit: Audit,
  ) {
    this.sessionId = sessionId
    this.state = state
    this.emitAudit = emitAudit
    this.latest = Effect.runSync(SubscriptionRef.get(state))
    const ready = Promise.withResolvers<void>()
    this.ready = ready.promise
    this.readyResolve = ready.resolve
    this.readyReject = ready.reject
    const reader = new PacketReader()
    this.socket = net.createConnection(socketPath(sessionId))
    this.socket.on('connect', () => this.socket.write(encodePeek()))
    this.socket.on('data', (data) => {
      try {
        for (const packet of reader.feed(Buffer.isBuffer(data) ? data : Buffer.from(data))) {
          if (packet.type === EXIT) {
            this.readyReject?.(new Error('PTY session exited'))
            continue
          }
          if (packet.type === GEOMETRY) {
            const geometry = decodeGeometry(packet.payload)
            this.terminal.resize(geometry.columns, geometry.rows)
            // The daemon sends GEOMETRY before the initial SCREEN. Geometry is
            // fold configuration, not a complete frame: publishing it here
            // races capture and produces a correctly sized blank snapshot.
            if (this.receivedScreen) this.scheduleFrame()
            continue
          }
          if (packet.type !== SCREEN && packet.type !== DATA) continue
          const isScreen = packet.type === SCREEN
          if (isScreen) this.terminal.reset()
          this.terminal.write(packet.payload, () => {
            if (isScreen) this.receivedScreen = true
            if (this.receivedScreen) this.scheduleFrame()
          })
        }
      } catch (cause) {
        this.readyReject?.(cause instanceof Error ? cause : new Error(String(cause)))
      }
    })
    this.socket.on('error', (cause) => this.readyReject?.(cause))
    this.socket.on('close', () => {
      if (!this.closed) this.readyReject?.(new Error('PTY transport closed'))
    })
  }

  static async open(
    sessionId: string,
    state: SubscriptionRef.SubscriptionRef<ScreenState>,
    emitAudit: Audit = audit,
  ): Promise<SessionBridge> {
    const bridge = new SessionBridge(sessionId, state, emitAudit)
    await bridge.ready
    return bridge
  }

  async attach(
    metadata: RequestMetadata,
  ): Promise<{ readonly leaseId: string; readonly expiresAt: string }> {
    let lease: Lease
    try {
      lease = this.leases.acquire(metadata.actor)
    } catch (cause) {
      await this.emitAudit(this.sessionId, 'user.vista.input.denied', metadata, {
        operation: 'attach',
      })
      throw cause
    }
    this.socket.write(encodeAttach(this.terminal.rows, this.terminal.cols))
    await this.emitAudit(this.sessionId, 'user.vista.input.attach', metadata, {
      operation: 'attach',
      expiresAtEpochMs: lease.expiresAt,
    })
    return { leaseId: lease.id, expiresAt: new Date(lease.expiresAt).toISOString() }
  }

  async send(metadata: RequestMetadata, leaseId: string, input: string): Promise<void> {
    await this.authorize(metadata, leaseId, 'send')
    await this.emitAudit(this.sessionId, 'user.vista.input.send', metadata, {
      operation: 'send',
      bytes: Buffer.byteLength(input),
    })
    this.socket.write(encodePacket(DATA, Buffer.from(input)))
    this.leases.renew()
  }

  async release(metadata: RequestMetadata, leaseId: string): Promise<void> {
    await this.authorize(metadata, leaseId, 'release')
    this.leases.release(metadata.actor, leaseId)
    this.socket.write(encodePeek())
    await this.emitAudit(this.sessionId, 'user.vista.input.release', metadata, {
      operation: 'release',
    })
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    clearTimeout(this.frameTimer)
    this.leases.revoke()
    this.socket.write(encodePacket(DETACH, Buffer.alloc(0)))
    this.socket.destroy()
    this.terminal.dispose()
  }

  private async authorize(
    metadata: RequestMetadata,
    leaseId: string,
    operation: 'send' | 'release',
  ): Promise<void> {
    const expired = this.leases.isExpired()
    try {
      this.leases.authorize(metadata.actor, leaseId)
    } catch (cause) {
      await this.emitAudit(
        this.sessionId,
        expired ? 'user.vista.input.expired' : 'user.vista.input.denied',
        metadata,
        { operation },
      )
      throw cause
    }
  }

  private scheduleFrame(): void {
    if (this.closed) return
    // Debounce at the producer boundary: the trailing state replaces pending
    // work instead of queuing another full viewport behind a slow viewer.
    clearTimeout(this.frameTimer)
    this.frameTimer = setTimeout(() => {
      this.frameTimer = undefined
      const next = screenState(this.terminal, this.latest.seq + 1)
      const firstScreen = this.readyResolve !== undefined
      if (firstScreen || !sameScreen(this.latest, next)) {
        this.latest = next
        Effect.runSync(SubscriptionRef.set(this.state, this.latest))
      }
      if (firstScreen) {
        this.readyResolve?.()
        this.readyResolve = undefined
        this.readyReject = undefined
      }
    }, FRAME_COALESCE_MS)
  }
}

const initialState = (): ScreenState => ({
  _tag: 'ScreenState',
  cursor: 'frame-0',
  seq: 0,
  columns: INITIAL_COLUMNS,
  rowCount: INITIAL_ROWS,
  rows: [],
  cursorX: 0,
  cursorY: 0,
  observedAt: new Date(0).toISOString(),
})

const makeSharedRegistry = Effect.gen(function* () {
  const sessions = yield* RcMap.make({
    idleTimeToLive: '30 seconds',
    lookup: (sessionId: string) =>
      Effect.gen(function* () {
        const state = yield* SubscriptionRef.make(initialState())
        const bridge = yield* Effect.acquireRelease(
          Effect.tryPromise({
            try: () => SessionBridge.open(sessionId, state),
            catch: (cause) => ptyError('transport', cause),
          }),
          (resource) => Effect.promise(() => resource.close()),
        )
        return { bridge, state }
      }),
  })
  return { sessions } satisfies SharedRegistry
})

const sharedRegistryKey = Symbol.for('vista.pty.shared-registry')
const sharedRegistry = (): Promise<SharedRegistry> => {
  const existing = Reflect.get(globalThis, sharedRegistryKey)
  if (existing instanceof Promise) return existing as Promise<SharedRegistry>
  const created = Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      return yield* makeSharedRegistry.pipe(Effect.provideService(Scope.Scope, scope))
    }),
  )
  Reflect.set(globalThis, sharedRegistryKey, created)
  return created
}

const registryLayer = Layer.effect(PtyRegistry, Effect.promise(sharedRegistry))

/**
 * Decodes trusted viewer identity from the x-vista-trusted-actor family of request headers into a
 * RequestMetadata value, failing with an 'identity' PtyError when any header is missing or
 * malformed.
 */
export const requestMetadataFrom = (options: unknown): Effect.Effect<RequestMetadata, PtyError> =>
  Schema.decodeUnknownEffect(RequestMetadata)({
    _tag: 'RequestMetadata',
    actor: requestHeader(options, 'x-vista-trusted-actor'),
    actorSource: requestHeader(options, 'x-vista-trusted-actor-source'),
    appVersion: requestHeader(options, 'x-vista-app-version'),
  }).pipe(Effect.mapError(() => ptyError('identity', 'trusted viewer identity is missing')))

const withSession = <A, E>(
  registry: SharedRegistry,
  sessionId: string,
  use: (resource: SessionResource) => Effect.Effect<A, E>,
): Effect.Effect<A, E | PtyError> =>
  RcMap.get(registry.sessions, sessionId).pipe(Effect.flatMap(use), Effect.scoped)

const screenEvents = (
  state: SubscriptionRef.SubscriptionRef<ScreenState>,
): Stream.Stream<ScreenEvent> =>
  SubscriptionRef.changes(state).pipe(
    Stream.mapAccum(
      (): ScreenState | undefined => undefined,
      (previous, value): readonly [ScreenState, readonly [ScreenEvent]] => [
        value,
        [
          previous === undefined
            ? { _tag: 'Synced', state: value }
            : { _tag: 'CoalescedFrame', delta: screenDelta(previous, value) },
        ],
      ],
    ),
  )

/**
 * Effectful implementation of the pty provider that live-authorizes requests and serves handlers
 * such as screen from session resources acquired through the shared RcMap registry and released
 * when the stream scope closes.
 */
export const ptyImplementation = implement(pty, {
  purity: 'effectful',
  authorizeLive: authorizePtyLiveRequest,
  handlers: {
    screen: ({ sessionId }) =>
      Stream.unwrap(
        Effect.flatMap(PtyRegistry, (registry) =>
          RcMap.get(registry.sessions, sessionId).pipe(
            Effect.map(({ state }) => screenEvents(state)),
          ),
        ),
      ).pipe(Stream.scoped),
    attach: ({ sessionId }, options) =>
      Effect.gen(function* () {
        const metadata = yield* requestMetadataFrom(options)
        const registry = yield* PtyRegistry
        const lease = yield* withSession(registry, sessionId, ({ bridge }) =>
          Effect.tryPromise({
            try: () => bridge.attach(metadata),
            catch: (cause) => (cause instanceof PtyError ? cause : ptyError('lease', cause)),
          }),
        )
        return { _tag: 'AttachLease' as const, ...lease }
      }),
    send: ({ sessionId, leaseId, input }, options) =>
      Effect.gen(function* () {
        const metadata = yield* requestMetadataFrom(options)
        const registry = yield* PtyRegistry
        yield* withSession(registry, sessionId, ({ bridge }) =>
          Effect.tryPromise({
            try: () => bridge.send(metadata, leaseId, input),
            catch: (cause) => (cause instanceof PtyError ? cause : ptyError('transport', cause)),
          }),
        )
        return { _tag: 'PtyCommandAccepted' as const, acceptedAt: new Date().toISOString() }
      }),
    release: ({ sessionId, leaseId }, options) =>
      Effect.gen(function* () {
        const metadata = yield* requestMetadataFrom(options)
        const registry = yield* PtyRegistry
        yield* withSession(registry, sessionId, ({ bridge }) =>
          Effect.tryPromise({
            try: () => bridge.release(metadata, leaseId),
            catch: (cause) => (cause instanceof PtyError ? cause : ptyError('transport', cause)),
          }),
        )
        return { _tag: 'PtyReleased' as const, releasedAt: new Date().toISOString() }
      }),
  },
  live: {
    screen: {
      _tag: 'subscribable',
      initial: ({ sessionId }) =>
        Effect.gen(function* () {
          const registry = yield* PtyRegistry
          return yield* withSession(registry, sessionId, ({ state }) => SubscriptionRef.get(state))
        }),
      stream: ({ sessionId }, _since) =>
        Stream.unwrap(
          Effect.flatMap(PtyRegistry, (registry) =>
            RcMap.get(registry.sessions, sessionId).pipe(
              Effect.map(({ state }) => screenEvents(state)),
            ),
          ),
        ).pipe(Stream.scoped),
    },
  },
})

export default mountProvider(ptyImplementation, registryLayer)
