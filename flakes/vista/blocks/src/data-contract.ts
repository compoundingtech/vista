import { Effect, Schema, SchemaTransformation } from 'effect'
import type * as Stream from 'effect/Stream'
import type * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import * as RpcSchema from 'effect/rpc/RpcSchema'

/** Parse options for every untrusted Vista boundary: excess properties are rejected, never stripped. */
const strictDecode = { onExcessProperty: 'error' } as const

/**
 * String schema that only accepts exactly 64 lowercase hexadecimal characters and brands the
 * result, so snapshot identifiers are structurally validated rather than any string.
 */
export const SnapshotKey = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{64}$/),
).pipe(Schema.brand('VistaSnapshotKey')).annotate({ identifier: 'Vista.SnapshotKey' })
export type SnapshotKey = typeof SnapshotKey.Type
/**
 * Opaque string schema representing a provider-defined resumption position in an event stream,
 * intentionally unvalidated beyond being a string so cursor formats stay provider-specific.
 */
export const Cursor = Schema.String.annotate({ identifier: 'Vista.Cursor' })
export type Cursor = typeof Cursor.Type
/**
 * Tagged struct schema describing a manifest edge that links a parent operation id to the id of
 * its child flatMap operation.
 */
export const FlatMapManifestEdge = Schema.TaggedStruct('flatMap', {
  id: Schema.NonEmptyString,
  edge: Schema.NonEmptyString,
}).annotate({
  identifier: 'Vista.FlatMapManifestEdge',
})
export type FlatMapManifestEdge = typeof FlatMapManifestEdge.Type

const PositiveRefreshDuration = Schema.Finite.pipe(
  Schema.check(Schema.isGreaterThan(0)),
)


/**
 * Union schema governing how a binding is executed: frozen fetches once, live polls on an optional
 * positive refresh interval, and subscription streams, each optionally recording acknowledgement
 * of effectful capture.
 */
export const BindingPolicy = Schema.Union([
  Schema.Struct({
    mode: Schema.Literal('frozen'),
    effectfulCapture: Schema.optionalKey(Schema.Literal('acknowledged')),
  }),
  Schema.Struct({
    mode: Schema.Literal('live'),
    refreshEvery: Schema.optionalKey(PositiveRefreshDuration),
    effectfulCapture: Schema.optionalKey(Schema.Literal('acknowledged')),
  }),
  Schema.Struct({
    mode: Schema.Literal('subscription'),
    effectfulCapture: Schema.optionalKey(Schema.Literal('acknowledged')),
  }),
]).annotate({
  identifier: 'Vista.BindingPolicy',
})
export type BindingPolicy = typeof BindingPolicy.Type

/**
 * Client-safe descriptor of a single provider RPC, carrying its tag, the underlying rpc and group,
 * payload/success codecs, and a phantom error slot, without itself being executable.
 */
export interface Operation<TTag extends string, TArgs, TValue, TError> {
  readonly providerId: string
  readonly tag: TTag
  readonly rpc: Rpc.AnyWithProps
  readonly group: RpcGroup.RpcGroup<Rpc.AnyWithProps>
  readonly payloadSchema: Schema.Codec<TArgs, unknown, never, never>
  readonly successSchema: Schema.Codec<TValue, unknown, never, never>
  readonly _E?: TError
}
/**
 * Operation variant for command-style RPCs whose capture is declared as never, marking them as
 * one-shot actions rather than readable, re-fetchable state.
 */
export interface CommandOp<TTag extends string, TArgs, TValue, TError>
  extends Operation<TTag, TArgs, TValue, TError> {
  readonly kind: 'command'
  readonly capture: 'never'
}

/**
 * Operation variant that projects a validated event stream into validated state, folding each
 * event into the previous state and deriving the resumption cursor from the resulting state.
 */
export interface SubscriptionOperation<
  TTag extends string,
  TArgs,
  TState,
  TEvent,
  TError,
> extends Operation<TTag, TArgs, TState, TError> {
  readonly kind: 'subscription'
  readonly stateSchema: Schema.Codec<TState, unknown, never, never>
  readonly eventSchema: Schema.Codec<TEvent, unknown, never, never>
  readonly fold: (state: TState, event: TEvent) => TState
  readonly cursor: (state: TState) => Cursor
}

/**
 * Derived operation that translates its own args into source args and then transforms the source
 * operation's result with a pure map function to produce its value.
 */
export interface MappedOperation<TArgs, TSourceArgs, TSource, TValue, TError>
  extends Operation<string, TArgs, TValue, TError> {
  readonly kind: 'map'
  readonly id: string
  readonly source: Operation<string, TSourceArgs, TSource, TError>
  readonly mapArgs: (args: TArgs) => TSourceArgs
  readonly map: (source: TSource, args: TArgs) => TValue
}
/**
 * Derived operation that first runs its source with the given args and then resolves a child
 * DataBinding by applying the select function to the parent value, failing with either the
 * parent's or child's error.
 */
export interface FlatMappedOperation<TArgs, TParent, TChildArgs, TValue, TParentError, TChildError>
  extends Operation<string, TArgs, TValue, TParentError | TChildError> {
  readonly kind: 'flatMap'
  readonly id: string
  readonly source: Operation<string, TArgs, TParent, TParentError>
  readonly select: (value: TParent) => DataBinding<TChildArgs, TValue, TChildError>
}

/**
 * Union of the two derived operation shapes with their type parameters erased to unknown, allowing
 * mapped and flatMapped operations to be handled uniformly.
 */
export type DerivedOperation<TArgs, TValue, TError> =
  | MappedOperation<TArgs, unknown, unknown, TValue, TError>
  | FlatMappedOperation<TArgs, unknown, unknown, TValue, TError, TError>

/**
 * Predicate that reports whether an operation's runtime kind field equals 'map', reading via
 * Reflect to work on structural objects without narrowing the static type.
 */
export const isMappedOperation = (
  operation: Operation<string, unknown, unknown, unknown>,
): boolean => Reflect.get(operation, 'kind') === 'map'

/**
 * Predicate that reports whether an operation's runtime kind field equals 'flatMap', reading via
 * Reflect to work on structural objects without narrowing the static type.
 */
export const isFlatMappedOperation = (
  operation: Operation<string, unknown, unknown, unknown>,
): boolean => Reflect.get(operation, 'kind') === 'flatMap'


type UnknownMappedOperation = MappedOperation<unknown, unknown, unknown, unknown, unknown>
type UnknownFlatMappedOperation = FlatMappedOperation<
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown
>

const containsFlatMapOperation = (
  operation: Operation<string, unknown, unknown, unknown>,
): boolean => {
  if (isFlatMappedOperation(operation)) return true
  if (!isMappedOperation(operation)) return false
  return containsFlatMapOperation((operation as UnknownMappedOperation).source)
}
/**
 * Wrapper marking a subscription event as authoritative server state, with a companion type-level
 * convention that any 'Synced' event must carry state of exactly TState.
 */
export type Synced<TState> = {
  readonly _tag: 'Synced'
  readonly state: TState
}

type SyncedConvention<TState, TEvent> = [
  Extract<TEvent, { readonly _tag: 'Synced' }>,
] extends [never]
  ? never
  : Extract<TEvent, { readonly _tag: 'Synced' }> extends Synced<TState>
    ? unknown
    : never

/**
 * Lifts a stream-valued operation into a subscription by validating state and events with the
 * supplied codecs, folding events into state, and honoring the args' optional since cursor as the
 * starting position.
 */
export const subscription = <
  TTag extends string,
  TArgs extends { readonly since?: Cursor },
  TState,
  TEvent extends { readonly _tag: string },
  TError,
>(
  operation: Operation<TTag, TArgs, Stream.Stream<TEvent, TError>, TError>,
  options: {
    readonly stateSchema: Schema.Codec<TState, unknown, never, never>
    readonly eventSchema: Schema.Codec<TEvent, unknown, never, never>
    readonly fold: (state: TState, event: TEvent) => TState
    readonly cursor: (state: TState) => Cursor
  } & SyncedConvention<TState, TEvent>,
): SubscriptionOperation<TTag, TArgs, TState, TEvent, TError> => {
  return {
    ...operation,
    kind: 'subscription',
    successSchema: options.stateSchema,
    stateSchema: options.stateSchema,
    eventSchema: options.eventSchema,
    fold: options.fold,
    cursor: options.cursor,
  }
}


type OperationOf<TRpc extends Rpc.AnyWithProps> = Operation<
  Rpc.Tag<TRpc>,
  Rpc.Payload<TRpc>,
  Rpc.Success<TRpc>,
  Rpc.ErrorExit<TRpc>
>

/**
 * Maps every RPC tag in a group to its operation descriptor, producing CommandOp for tags
 * explicitly listed as commands and query-style operations for all remaining tags.
 */
export type OperationsOf<
  TRpcs extends Rpc.AnyWithProps,
  TCommandTags extends Rpc.Tag<TRpcs> = never,
> = {
  readonly [TTag in Rpc.Tag<TRpcs>]: TTag extends TCommandTags
    ? CommandOp<
        TTag,
        Rpc.Payload<Rpc.ExtractTag<TRpcs, TTag>>,
        Rpc.Success<Rpc.ExtractTag<TRpcs, TTag>>,
        Rpc.ErrorExit<Rpc.ExtractTag<TRpcs, TTag>>
      >
    : OperationOf<Rpc.ExtractTag<TRpcs, TTag>>
}

/**
 * Names a data provider by unique id, its authored RPC group, and the client-safe operation
 * descriptors derived for each of the group's RPC tags.
 */
export interface ProviderContract<
  TRpcs extends Rpc.AnyWithProps,
  TCommandTags extends Rpc.Tag<TRpcs> = never,
> {
  readonly id: string
  readonly group: RpcGroup.RpcGroup<TRpcs>
  readonly ops: OperationsOf<TRpcs, TCommandTags>
}

/**
 * Wire view of an authored schema whose decode is strict regardless of the caller's parse options.
 *
 * RpcClient and RpcServer decode with `Schema.decodeUnknownEffect(codecFor(schema))` and no parse
 * options, and schema annotations cannot override parse options, so an authored struct would
 * silently strip excess keys at the RPC boundary. The wire view's encoded side is the JSON value
 * itself; its transformation decodes that value through the authored JSON codec with
 * `onExcessProperty: 'error'` and encodes through the same codec, so the bytes on the wire are
 * exactly what the authored schema produces. Use it wherever a library decodes with a schema but
 * without caller-supplied parse options (RPC, KeyValueStore schema stores).
 */
export const strictJsonWire = <S extends Schema.Top>(schema: S) => {
  const json = Schema.toCodecJson(schema)
  return Schema.Unknown.pipe(
    Schema.decodeTo(
      Schema.toType(schema),
      SchemaTransformation.transformEffect({
        decode: (input: unknown, options) =>
          Schema.decodeUnknownEffect(json)(input, { ...options, ...strictDecode }).pipe(
            Effect.mapError((error) => error.issue),
          ),
        encode: (value: S['Type'], options) =>
          Schema.encodeUnknownEffect(json)(value, options).pipe(
            Effect.mapError((error) => error.issue),
          ),
      }),
    ),
  )
}

/**
 * Derive client-safe operation descriptors directly from an authored RpcGroup.
 *
 * The returned `group` is the wire view served by providers and called by clients: every payload,
 * success, stream element, and error schema rejects excess properties when decoded. Operation
 * descriptors keep the authored schemas so snapshot keys and captured values use the authored
 * encoding.
 */
export const contract = <
  TRpcs extends Rpc.AnyWithProps,
  const TCommandTags extends readonly Rpc.Tag<TRpcs>[] = readonly [],
>({
  id,
  group,
  commands,
}: {
  readonly id: string
  readonly group: RpcGroup.RpcGroup<TRpcs>
  readonly commands?: TCommandTags
}): ProviderContract<TRpcs, TCommandTags[number]> => {
  const commandTags = new Set<string>(commands ?? [])
  const wireRpcs: Array<readonly [authored: Rpc.AnyWithProps, wire: Rpc.AnyWithProps]> = []
  for (const rpc of group.requests.values()) {
    const authored = rpc as unknown as Rpc.Rpc<
      string,
      Schema.Top,
      Schema.Top,
      Schema.Top,
      never,
      never
    >
    const wireSuccess = RpcSchema.isStreamSchema(authored.successSchema)
      ? RpcSchema.Stream(
        strictJsonWire(authored.successSchema.success),
        strictJsonWire(authored.successSchema.error),
      )
      : strictJsonWire(authored.successSchema)
    wireRpcs.push([
      rpc,
      authored
        .setPayload(strictJsonWire(authored.payloadSchema))
        .setSuccess(wireSuccess)
        .setError(strictJsonWire(authored.errorSchema)),
    ])
  }
  const wireGroup = RpcGroup.make(...wireRpcs.map(([, wire]) => wire))
  const ops: Record<
    string,
    Operation<string, unknown, unknown, unknown> | CommandOp<string, unknown, unknown, unknown>
  > = {}
  for (const [authored, wire] of wireRpcs) {
    const descriptor = {
      providerId: id,
      tag: wire._tag,
      rpc: wire,
      group: wireGroup,
      payloadSchema: authored.payloadSchema as Schema.Codec<unknown, unknown, never, never>,
      successSchema: authored.successSchema as Schema.Codec<unknown, unknown, never, never>,
    }
    ops[wire._tag] = commandTags.has(wire._tag)
      ? { ...descriptor, kind: 'command', capture: 'never' }
      : descriptor
  }
  return {
    id,
    group: wireGroup as unknown as RpcGroup.RpcGroup<TRpcs>,
    ops: ops as OperationsOf<TRpcs, TCommandTags[number]>,
  }
}

/**
 * Declarative unit pairing an operation with concrete args and an execution policy, which the
 * runtime resolves into data rather than calling the RPC directly.
 */
export interface DataBinding<
  TArgs,
  TValue,
  TError,
  TPolicy extends BindingPolicy = BindingPolicy,
> {
  readonly operation: Operation<string, TArgs, TValue, TError>
  readonly args: TArgs
  readonly policy: TPolicy
}

type BindableOperation<TTag extends string, TArgs, TValue, TError> =
  Operation<TTag, TArgs, TValue, TError> & {
    readonly kind?: 'subscription' | 'map' | 'flatMap'
  }

/**
 * Creates a DataBinding from an operation and args, defaulting to the frozen policy when no policy
 * is supplied and otherwise preserving the exact policy type.
 */
export function bind<TTag extends string, TArgs, TValue, TError>(
  operation: BindableOperation<TTag, TArgs, TValue, TError>,
  args: TArgs,
): DataBinding<TArgs, TValue, TError, { readonly mode: 'frozen' }>
export function bind<TTag extends string, TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  operation: BindableOperation<TTag, TArgs, TValue, TError>,
  args: TArgs,
  policy: TPolicy,
): DataBinding<TArgs, TValue, TError, TPolicy>
export function bind<TTag extends string, TArgs, TValue, TError>(
  operation: Operation<TTag, TArgs, TValue, TError>,
  args: TArgs,
  policy: BindingPolicy = { mode: 'frozen' },
): DataBinding<TArgs, TValue, TError> {
  if (Reflect.get(operation, 'kind') === 'command') {
    throw new TypeError(`command operation ${operation.providerId}.${operation.tag} cannot be bound`)
  }
  Schema.decodeSync(BindingPolicy, strictDecode)(policy)
  return { operation, args, policy }
}

/**
 * Type-erased DataBinding alias used where the arg, value, and error types are irrelevant, such as
 * dynamically selected flatMap child bindings.
 */
export type UnknownBinding = DataBinding<unknown, unknown, unknown>
/**
 * Function that, given a parent operation's value, returns the type-erased child binding that a
 * flatMap edge should execute next.
 */
export type FlatMapSelector = (value: unknown) => UnknownBinding

/**
 * Non-persisted executable selectors produced by one semantic evaluation.
 * Keys are the exact manifest edges, so ownership is scoped to that AppVersion
 * rather than to a process-global `(provider, operation, id)` registry.
 */
export interface CapturePlan {
  readonly flatMapSelectors: ReadonlyMap<string, FlatMapSelector>
}

const mapOperation = <TSourceArgs, TSource, TArgs, TValue, TError>(
  source: Operation<string, TSourceArgs, TSource, TError>,
  options: {
    readonly id: string
    readonly payloadSchema: Schema.Codec<TArgs, unknown, never, never>
    readonly successSchema: Schema.Codec<TValue, unknown, never, never>
    readonly mapArgs: (args: TArgs) => TSourceArgs
    readonly map: (source: TSource, args: TArgs) => TValue
  },
): MappedOperation<TArgs, TSourceArgs, TSource, TValue, TError> => ({
  ...source,
  kind: 'map',
  id: options.id,
  source,
  payloadSchema: options.payloadSchema,
  successSchema: options.successSchema,
  mapArgs: options.mapArgs,
  map: options.map,
})

const flatMapOperation = <TArgs, TParent, TChildArgs, TValue, TParentError, TChildError>(
  source: Operation<string, TArgs, TParent, TParentError>,
  select: (value: TParent) => DataBinding<TChildArgs, TValue, TChildError>,
  options: {
    readonly id: string
    readonly successSchema: Schema.Codec<TValue, unknown, never, never>
  },
): FlatMappedOperation<TArgs, TParent, TChildArgs, TValue, TParentError, TChildError> => {
  if (containsFlatMapOperation(source as Operation<string, unknown, unknown, unknown>)) {
    throw new Error('flatMap source cannot contain another flatMap dependency')
  }
  const operation: FlatMappedOperation<
    TArgs,
    TParent,
    TChildArgs,
    TValue,
    TParentError,
    TChildError
  > = {
    ...source,
    kind: 'flatMap',
    id: options.id,
    source,
    select,
    successSchema: options.successSchema,
  }
  return operation
}

/** Serializable composition primitives from decision 0090. */
export const Operation = {
  map: mapOperation,
  flatMap: flatMapOperation,
} as const

/**
 * Tagged error carrying the property path and message describing why a value could not be
 * serialized to canonical JSON.
 */
export class CanonicalJsonError extends Schema.TaggedError<CanonicalJsonError>()(
  'CanonicalJsonError',
  { path: Schema.String, message: Schema.String },
) {}

const canonicalJsonValue = (
  value: unknown,
  path: string,
  ancestors: WeakSet<object>,
): Effect.Effect<string, CanonicalJsonError> => {
  if (value === null) return Effect.succeed('null')
  if (typeof value === 'string' || typeof value === 'boolean') {
    return Effect.succeed(JSON.stringify(value))
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? Effect.succeed(JSON.stringify(value))
      : Effect.fail(new CanonicalJsonError({ path, message: 'numbers must be finite' }))
  }
  if (typeof value !== 'object') {
    return Effect.fail(new CanonicalJsonError({ path, message: `${typeof value} is not JSON-serializable` }))
  }
  if (ancestors.has(value)) {
    return Effect.fail(new CanonicalJsonError({ path, message: 'cyclic values are not JSON-serializable' }))
  }
  ancestors.add(value)
  const encoded = Array.isArray(value)
    ? Effect.forEach(value, (entry, index) => canonicalJsonValue(entry, `${path}[${index}]`, ancestors)).pipe(
      Effect.map((entries) => `[${entries.join(',')}]`),
    )
    : Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null
      ? Effect.fail(new CanonicalJsonError({ path, message: 'objects must be plain records' }))
      : Effect.forEach(
        Object.keys(value).toSorted(),
        (key) => canonicalJsonValue((value as Record<string, unknown>)[key], `${path}.${key}`, ancestors).pipe(
          Effect.map((entry) => `${JSON.stringify(key)}:${entry}`),
        ),
      ).pipe(Effect.map((entries) => `{${entries.join(',')}}`))
  return encoded.pipe(Effect.ensuring(Effect.sync(() => ancestors.delete(value))))
}


/**
 * Recursively unwraps derived (mapped/flatMapped) layers of a binding until it reaches the base,
 * type-erased binding whose operation will actually be executed.
 */
export const sourceBinding = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): UnknownBinding => {
  if (isMappedOperation(binding.operation)) {
    const operation = binding.operation as MappedOperation<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >
    return sourceBinding({
      operation: operation.source,
      args: operation.mapArgs(binding.args),
      policy: binding.policy,
    })
  }
  if (isFlatMappedOperation(binding.operation)) {
    const operation = binding.operation as FlatMappedOperation<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >
    return sourceBinding({
      operation: operation.source,
      args: binding.args,
      policy: binding.policy,
    })
  }
  return binding
}

/**
 * Pairs the underlying flatMapped operation with the pre-selector args that must be executed
 * before a flatMap binding's child can be resolved.
 */
export interface FlatMapDependencyBinding {
  readonly operation: UnknownFlatMappedOperation
  readonly args: unknown
}

/**
 * Traverses a binding's mapped-operation chain to locate the nested flatMap dependency binding,
 * returning undefined when the chain contains no flatMap.
 */
export const flatMapDependencyBinding = <
  TArgs,
  TValue,
  TError,
  TPolicy extends BindingPolicy,
>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): FlatMapDependencyBinding | undefined => {
  if (isMappedOperation(binding.operation)) {
    const operation = binding.operation as UnknownMappedOperation
    return flatMapDependencyBinding({
      operation: operation.source,
      args: operation.mapArgs(binding.args),
      policy: binding.policy,
    })
  }
  if (!isFlatMappedOperation(binding.operation)) return undefined
  return {
    operation: binding.operation as UnknownFlatMappedOperation,
    args: binding.args,
  }
}

/**
 * Recursively applies a mapped operation's mapArgs and map transforms to a source value, but
 * throws if the chain would require evaluating a nested flatMap parent.
 */
export const projectMappedSourceValue = (
  operation: Operation<string, unknown, unknown, unknown>,
  args: unknown,
  sourceValue: unknown,
): unknown => {
  if (isFlatMappedOperation(operation)) {
    throw new Error('flatMap parent cannot contain another flatMap dependency')
  }
  if (!isMappedOperation(operation)) return sourceValue
  const mapped = operation as UnknownMappedOperation
  const sourceArgs = mapped.mapArgs(args)
  return mapped.map(projectMappedSourceValue(mapped.source, sourceArgs, sourceValue), args)
}
/**
 * Serializes any value into a deterministic JSON string while tracking visited objects to detect
 * cycles, failing with a CanonicalJsonError for non-serializable or cyclic input.
 */
export const canonicalJson = (value: unknown): Effect.Effect<string, CanonicalJsonError> =>
  canonicalJsonValue(value, '$', new WeakSet())

const SHA256_INITIAL = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])
const SHA256_ROUND = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotateRight = (value: number, bits: number): number =>
  (value >>> bits) | (value << (32 - bits))

/** Browser-safe SHA-256 with no Node or optional-package dependency. */
const sha256Hex = (text: string): string => {
  const input = new TextEncoder().encode(text)
  const paddedLength = (input.length + 9 + 63) & ~63
  const bytes = new Uint8Array(paddedLength)
  bytes.set(input)
  bytes[input.length] = 0x80
  const view = new DataView(bytes.buffer)
  const bitLength = input.length * 8
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000))
  view.setUint32(paddedLength - 4, bitLength)

  const state = new Uint32Array(SHA256_INITIAL)
  const words = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15]!
      const previous2 = words[index - 2]!
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3)
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10)
      words[index] = (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = state
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25)
      const choose = (e! & f!) ^ (~e! & g!)
      const temporary1 = (h! + sum1 + choose + SHA256_ROUND[index]! + words[index]!) >>> 0
      const sum0 = rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22)
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!)
      const temporary2 = (sum0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d! + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }
    state[0] = (state[0]! + a!) >>> 0
    state[1] = (state[1]! + b!) >>> 0
    state[2] = (state[2]! + c!) >>> 0
    state[3] = (state[3]! + d!) >>> 0
    state[4] = (state[4]! + e!) >>> 0
    state[5] = (state[5]! + f!) >>> 0
    state[6] = (state[6]! + g!) >>> 0
    state[7] = (state[7]! + h!) >>> 0
  }
  return Array.from(state, (word) => word.toString(16).padStart(8, '0')).join('')
}

/**
 * Derives a stable snapshot key for an operation by canonicalizing its provider id, tag, and
 * encoded args together and hashing the resulting JSON with SHA-256.
 */
export const snapshotKey = <TTag extends string, TArgs, TValue, TError>(
  operation: Operation<TTag, TArgs, TValue, TError>,
  encodedArgs: unknown,
): Effect.Effect<SnapshotKey, CanonicalJsonError> =>
  canonicalJson([operation.providerId, operation.tag, encodedArgs]).pipe(
    Effect.map((json) => SnapshotKey.make(sha256Hex(json))),
  )

const isSubscriptionBinding = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): boolean => 'kind' in binding.operation && binding.operation.kind === 'subscription'

/**
 * Subscription args minus the transport-only `since` reconnect hint: the manifest,
 * the frozen seed, and the snapshot key must not depend on where a viewer resumed.
 */
export const captureArgs = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): unknown => isSubscriptionBinding(binding)
    && typeof binding.args === 'object'
    && binding.args !== null
    && !Array.isArray(binding.args)
  ? Object.fromEntries(Object.entries(binding.args).filter(([name]) => name !== 'since'))
  : binding.args

/**
 * Validates and encodes a binding's captured args against its operation's payload schema
 * synchronously, throwing a SchemaError when the args do not conform.
 */
export const encodeCaptureArgsSync = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): unknown => Schema.encodeUnknownSync(binding.operation.payloadSchema)(captureArgs(binding))

/**
 * Validates and encodes a binding's captured args against its operation's payload schema,
 * returning an Effect that fails with a SchemaError instead of throwing.
 */
export const encodeCaptureArgsEffect = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): Effect.Effect<unknown, Schema.SchemaError> =>
  Schema.encodeUnknownEffect(binding.operation.payloadSchema)(captureArgs(binding))
/**
 * Encodes the source binding's captured args and derives its snapshot key, returning both together
 * as an Effect that fails on schema or canonicalization errors.
 */
export const encodeBinding = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): Effect.Effect<
  { readonly encodedArgs: unknown; readonly key: SnapshotKey },
  Schema.SchemaError | CanonicalJsonError
> => {
  const source = sourceBinding(binding as unknown as UnknownBinding)
  return encodeCaptureArgsEffect(source).pipe(
    Effect.flatMap((encodedArgs) => snapshotKey(source.operation, encodedArgs).pipe(
      Effect.map((key) => ({ encodedArgs, key })),
    )),
  )
}

const mappedProjectionKey = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): Effect.Effect<string, Schema.SchemaError | CanonicalJsonError> => {
  if (!isMappedOperation(binding.operation)) return encodeBinding(binding).pipe(Effect.map(({ key }) => key))
  const operation = binding.operation as unknown as MappedOperation<
    TArgs,
    unknown,
    unknown,
    TValue,
    TError
  >
  return Effect.all({
    encoded: encodeCaptureArgsEffect(binding),
    source: encodeBinding(binding),
  }).pipe(
    Effect.flatMap(({ encoded, source }) => canonicalJson(encoded).pipe(
      Effect.map((args) => `${operation.id}::${source.key}::${args}`),
    )),
  )
}

/**
 * Computes the cache key for a mapped binding's atom by joining its projection key with a
 * canonical-JSON encoding of its binding policy, failing on schema or canonicalization errors.
 */
export const mappedAtomKey = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): Effect.Effect<string, Schema.SchemaError | CanonicalJsonError> =>
  Effect.all({
    projection: mappedProjectionKey(binding),
    policy: Schema.encodeUnknownEffect(BindingPolicy)(binding.policy).pipe(
      Effect.flatMap(canonicalJson),
    ),
  }).pipe(
    Effect.map(({ policy, projection }) => `${projection}::policy::${policy}`),
  )

/**
 * Builds the edge identifier linking a flatMap dependency to its parent projection, or resolves to
 * undefined when the binding has no flatMap dependency.
 */
export const flatMapEdge = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): Effect.Effect<string | undefined, Schema.SchemaError | CanonicalJsonError> => {
  const dependency = flatMapDependencyBinding(binding)
  if (dependency === undefined) return Effect.void.pipe(Effect.as(undefined))
  const parent: UnknownBinding = {
    operation: dependency.operation.source,
    args: dependency.args,
    policy: binding.policy,
  }
  return mappedProjectionKey(parent).pipe(
    Effect.map((parentKey) => `${parentKey}::flatMap::${dependency.operation.id}`),
  )
}

/**
 * Schema for a single serialized snapshot record containing provider and operation identifiers,
 * encoded args and value, and the capture timestamp, rejecting excess properties.
 */
export const SnapshotEntry = Schema.Struct({
  provider: Schema.NonEmptyString,
  operation: Schema.NonEmptyString,
  encodedArgs: Schema.Unknown,
  encodedValue: Schema.Unknown,
  capturedAt: Schema.String,
}).annotate({
  identifier: 'Vista.SnapshotEntry',
})
export type SnapshotEntry = typeof SnapshotEntry.Type

/**
 * Immutable format version stamped onto every snapshot so loaders can detect and reject data
 * produced by an incompatible writer.
 */
export const SNAPSHOT_API_VERSION = 2 as const

/**
 * Schema for a serialized snapshot envelope pairing the required api version and freeze timestamp
 * with a record of entries keyed by SnapshotKey, rejecting excess properties.
 */
export const Snapshot = Schema.Struct({
  apiVersion: Schema.Literal(SNAPSHOT_API_VERSION),
  frozenAt: Schema.String,
  entries: Schema.Record(SnapshotKey, SnapshotEntry),
}).annotate({
  identifier: 'Vista.Snapshot',
})
export type Snapshot = typeof Snapshot.Type

/**
 * Reads immutable seeds written before the timeline provider's data-id cutover.
 * Canonical keys win; the legacy arm can be removed when no retained publication
 * snapshot contains an entry whose provider is `agent-trace`.
 */
export const readSnapshotBinding = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  snapshot: Snapshot,
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): Effect.Effect<
  { readonly encodedArgs: unknown; readonly key: SnapshotKey; readonly entry: SnapshotEntry | undefined },
  Schema.SchemaError | CanonicalJsonError
> =>
  Effect.gen(function* () {
    const encoded = yield* encodeBinding(binding)
    const source = sourceBinding(binding as unknown as UnknownBinding)
    const current = snapshot.entries[encoded.key]
    if (current !== undefined || source.operation.providerId !== 'agent-timeline') {
      return { ...encoded, entry: current }
    }
    const previousKey = yield* snapshotKey(
      { ...source.operation, providerId: 'agent-trace' },
      encoded.encodedArgs,
    )
    const previous = snapshot.entries[previousKey]
    return {
      ...encoded,
      entry:
        previous?.provider === 'agent-trace'
          ? { ...previous, provider: source.operation.providerId }
          : previous,
    }
  })

/**
 * Tagged error raised when a stored snapshot entry fails to decode against the operation's current
 * schema, identifying the provider, operation, key, and failure detail.
 */
export class SchemaMismatch extends Schema.TaggedError<SchemaMismatch>()('SchemaMismatch', {
  provider: Schema.String,
  operation: Schema.String,
  key: SnapshotKey,
  message: Schema.String,
}) {}

/**
 * Tagged error raised when a frozen-mode lookup requests a key that is absent from the loaded
 * snapshot.
 */
export class FrozenEntryMissing extends Schema.TaggedError<FrozenEntryMissing>()('FrozenEntryMissing', {
  key: SnapshotKey,
}) {}

/**
 * Tagged error raised when a subscription operation fails, carrying the provider, operation,
 * snapshot key, and failure message for diagnostics.
 */
export class SubscriptionError extends Schema.TaggedError<SubscriptionError>()('SubscriptionError', {
  provider: Schema.String,
  operation: Schema.String,
  key: SnapshotKey,
  message: Schema.String,
}) {}
