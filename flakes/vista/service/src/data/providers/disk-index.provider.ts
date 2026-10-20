/**
 * Read-only multi-host provider for strict schema-v2 disk-index publications.
 *
 * Hosts and HTTP endpoints come only from `VISTA_DISK_INDEX_ENDPOINTS`, a
 * Nix-authored JSON object. RPC payloads carry a declared host key, never a URL
 * or filesystem path. A missing host is accepted only for the one-endpoint
 * local configuration; the deployed central configuration has several hosts
 * and therefore fails closed unless the caller selects one explicitly.
 */
import {
  buildTreemapModel,
  decodeSnapshotText,
  DISK_INDEX_HOSTS,
  degradedReasons,
  diskIndex,
  DiskIndexError,
  projectPerspective,
  type DiskIndexHost as DiskIndexHostName,
  type DiskProjection,
  type DiskSnapshot,
  type TreemapArgs,
  type TreemapOutcome,
} from '@vista/blocks/internal/provider-contracts'
import { Config, Context, Duration, Effect, Layer, Schema, Stream } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import type * as HttpClientResponse from 'effect/http/HttpClientResponse'

import { implement, mountProvider } from '../provider.ts'

/** Default single-host endpoint used when no fleet endpoint config is declared. */
export const DEFAULT_ENDPOINTS_JSON = JSON.stringify({
  dev3: 'http://127.0.0.1:41032',
})

const DiskIndexEndpoint = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => /^https?:\/\/[^/]+(?::\d+)?\/?$/u.test(value), {
      message: 'disk-index endpoint must be an HTTP(S) origin with no path',
    }),
  ),
  Schema.annotate({ identifier: 'Vista.DiskIndex.Endpoint' }),
)

const DiskIndexEndpoints = Schema.Record(Schema.String, DiskIndexEndpoint).pipe(
  Schema.annotate({ identifier: 'Vista.DiskIndex.Endpoints' }),
)
export type DiskIndexEndpoints = typeof DiskIndexEndpoints.Type

const isDiskIndexHost = (value: string): value is DiskIndexHostName =>
  DISK_INDEX_HOSTS.some((host) => host === value)

/** Decodes and validates the closed fleet endpoint map. */
export const decodeEndpointConfig = (
  text: string,
): Effect.Effect<DiskIndexEndpoints, DiskIndexError> =>
  Schema.decodeEffect(Schema.fromJsonString(DiskIndexEndpoints))(text).pipe(
    Effect.map((endpoints) =>
      Object.fromEntries(
        Object.entries(endpoints).map(([host, endpoint]) => [host, endpoint.replace(/\/+$/u, '')]),
      ),
    ),
    Effect.flatMap((endpoints) => {
      const unknownHosts = Object.keys(endpoints).filter((host) => !isDiskIndexHost(host))
      if (unknownHosts.length > 0) {
        return new DiskIndexError({
          reason: 'invalid',
          message: `VISTA_DISK_INDEX_ENDPOINTS declares unknown hosts: ${unknownHosts.join(', ')}`,
        })
      }
      return DISK_INDEX_HOSTS.some((host) => endpoints[host] !== undefined)
        ? Effect.succeed(endpoints)
        : new DiskIndexError({
            reason: 'invalid',
            message: 'VISTA_DISK_INDEX_ENDPOINTS declares no hosts',
          })
    }),
    Effect.mapError((cause) =>
      cause instanceof DiskIndexError
        ? cause
        : new DiskIndexError({
            reason: 'invalid',
            message: `VISTA_DISK_INDEX_ENDPOINTS is invalid: ${String(cause)}`,
          }),
    ),
  )

/** Resolves a requested host without accepting caller-controlled URLs. */
export const selectEndpoint = (
  endpoints: DiskIndexEndpoints,
  requestedHost: string | undefined,
): Effect.Effect<
  { readonly host: DiskIndexHostName; readonly endpoint: string },
  DiskIndexError
> => {
  const hosts = DISK_INDEX_HOSTS.filter((host) => endpoints[host] !== undefined)
  if (requestedHost !== undefined && !isDiskIndexHost(requestedHost)) {
    return new DiskIndexError({
      reason: 'unknown-host',
      message: `disk-index host '${requestedHost}' is not configured; configured hosts: ${hosts.join(', ')}`,
    })
  }
  const host = requestedHost ?? (hosts.length === 1 ? hosts[0] : undefined)
  if (host === undefined) {
    return new DiskIndexError({
      reason: 'unknown-host',
      message: `disk-index host is required; configured hosts: ${hosts.join(', ')}`,
    })
  }
  const endpoint = endpoints[host]
  return endpoint === undefined
    ? new DiskIndexError({
        reason: 'unknown-host',
        message: `disk-index host '${host}' is not configured; configured hosts: ${hosts.join(', ')}`,
      })
    : Effect.succeed({ host, endpoint })
}
const REQUEST_TIMEOUT = Duration.seconds(15)
const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024

const readBoundedSnapshot = (
  response: HttpClientResponse.HttpClientResponse,
  host: DiskIndexHostName,
  url: string,
): Effect.Effect<string, DiskIndexError> =>
  response.stream.pipe(
    Stream.runFoldEffect(
      () => ({ bytes: 0, chunks: [] as Uint8Array[] }),
      (state, chunk) => {
        const bytes = state.bytes + chunk.byteLength
        return bytes > MAX_SNAPSHOT_BYTES
          ? Effect.fail(
              new DiskIndexError({
                reason: 'unreadable',
                message: `disk-index publication for '${host}' at ${url} exceeds ${MAX_SNAPSHOT_BYTES} bytes`,
              }),
            )
          : Effect.succeed({ bytes, chunks: [...state.chunks, chunk] })
      },
    ),
    Effect.map(({ bytes, chunks }) => {
      const body = new Uint8Array(bytes)
      let offset = 0
      for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.byteLength
      }
      return new TextDecoder().decode(body)
    }),
    Effect.timeout(REQUEST_TIMEOUT),
    Effect.mapError((cause) =>
      cause instanceof DiskIndexError
        ? cause
        : new DiskIndexError({
            reason: 'unreadable',
            message: `disk-index publication for '${host}' at ${url} could not be read within ${Duration.format(REQUEST_TIMEOUT)}: ${String(cause)}`,
          }),
    ),
  )

const fetchSnapshot = Effect.fn('vista.provider.disk-index.fetch-snapshot')(function* (
  client: HttpClient.HttpClient,
  host: DiskIndexHostName,
  endpoint: string,
) {
  const url = `${endpoint}/snapshot.json`
  yield* Effect.annotateCurrentSpan({ 'disk_index.host': host, 'disk_index.endpoint': endpoint })
  const response = yield* client.get(url).pipe(
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: 'manual' }),
    Effect.timeout(REQUEST_TIMEOUT),
    Effect.mapError(
      (cause) =>
        new DiskIndexError({
          reason: 'unreachable',
          message: `disk-index publication for '${host}' at ${url} is unreachable within ${Duration.format(REQUEST_TIMEOUT)}: ${String(cause)}`,
        }),
    ),
  )
  if (response.status === 404) {
    return yield* new DiskIndexError({
      reason: 'missing',
      message: `disk-index publication for '${host}' has no snapshot at ${url}`,
    })
  }
  if (response.status < 200 || response.status >= 300) {
    return yield* new DiskIndexError({
      reason: 'unreachable',
      message: `disk-index publication for '${host}' returned HTTP ${response.status} from ${url}`,
    })
  }
  const text = yield* readBoundedSnapshot(response, host, url)
  return yield* decodeSnapshotText(text, `${host} (${url})`)
})

/**
 * Service contract exposing a single snapshot effect that yields the decoded disk snapshot or
 * fails with a DiskIndexError.
 */
export interface DiskIndexService {
  readonly hosts: readonly DiskIndexHostName[]
  readonly snapshot: (host?: DiskIndexHostName) => Effect.Effect<DiskSnapshot, DiskIndexError>
}

/**
 * Effect Context.Service tag registered under 'Vista/DiskIndex' for requesting the
 * DiskIndexService from the environment.
 */
export class DiskIndex extends Context.Service<DiskIndex, DiskIndexService>()('Vista/DiskIndex') {}

/** Production layer backed by the declared fleet endpoints. */
const makeDiskIndexLive = Effect.gen(function* () {
  const encoded = yield* Config.String('VISTA_DISK_INDEX_ENDPOINTS').pipe(
    Config.withDefault(DEFAULT_ENDPOINTS_JSON),
    Effect.orDie,
  )
  const endpoints = yield* decodeEndpointConfig(encoded)
  const client = yield* HttpClient.HttpClient
  return {
    hosts: DISK_INDEX_HOSTS.filter((host) => endpoints[host] !== undefined),
    snapshot: (requestedHost?: DiskIndexHostName) =>
      selectEndpoint(endpoints, requestedHost).pipe(
        Effect.flatMap(({ host, endpoint }) => fetchSnapshot(client, host, endpoint)),
      ),
  } satisfies DiskIndexService
})

/** Production disk-index layer backed by the declared fleet endpoints. */
export const DiskIndexLive = Layer.effect(DiskIndex, Effect.orDie(makeDiskIndexLive))

/**
 * Builds a test layer for DiskIndex that decodes the given snapshot text on demand and invokes the
 * onRead callback each time the snapshot is requested, enabling assertion of access counts.
 */
export const makeDiskIndexFixtureLayer = (
  snapshotText: string | (() => string),
  onRead: () => void = () => undefined,
  host: DiskIndexHostName = 'dev3',
): Layer.Layer<DiskIndex> =>
  Layer.succeed(DiskIndex, {
    hosts: [host],
    snapshot: (requestedHost?: DiskIndexHostName) =>
      selectEndpoint({ [host]: 'http://fixture.invalid' }, requestedHost).pipe(
        Effect.tap(() => Effect.sync(onRead)),
        Effect.flatMap(() =>
          decodeSnapshotText(
            typeof snapshotText === 'function' ? snapshotText() : snapshotText,
            `${host} (<fixture>)`,
          ),
        ),
      ),
  })

const sourceSnapshot = (host?: DiskIndexHostName) =>
  Effect.flatMap(DiskIndex, (source) => source.snapshot(host))

/**
 * Projects a disk projection into a ready treemap outcome by mapping each group's path and
 * allocated bytes (with row-count metrics and facets) through the treemap model builder using the
 * supplied arguments.
 */
export const buildDiskTreemap = (
  projection: DiskProjection,
  args: TreemapArgs,
): Extract<TreemapOutcome, { readonly _tag: 'ready' }> => {
  const model = buildTreemapModel(
    projection.groups.map((group) => ({
      path: group.path,
      value: group.allocatedBytes,
      metrics: {
        rows: group.rowCount,
      },
      facets: {
        sharing: group.sharing,
        freshness: group.worstFreshness,
        status: group.worstStatus,
      },
    })),
    {
      rootLabel: projection.boundaryId,
      unit: 'bytes',
      valueNoun: 'allocated size',
      ...(args.lens?.maxDepth === undefined ? {} : { maxDepth: args.lens.maxDepth }),
      ...(args.lens?.foldBelowFraction === undefined
        ? {}
        : { foldBelowFraction: args.lens.foldBelowFraction }),
    },
  )
  return { _tag: 'ready', value: model }
}

const treemap = (args: TreemapArgs): Effect.Effect<TreemapOutcome, never, DiskIndex> =>
  Effect.gen(function* () {
    const snapshot = yield* sourceSnapshot(args.host)
    const projection = yield* projectPerspective(snapshot, args.perspective, args.boundaryId)
    const outcome = buildDiskTreemap(projection, args)
    const reasons = degradedReasons(snapshot)
    return reasons.length === 0
      ? outcome
      : { _tag: 'degraded' as const, value: outcome.value, reasons }
  }).pipe(
    Effect.catchTag('DiskIndexError', (error) =>
      Effect.succeed({
        _tag: 'failure' as const,
        reason: error.reason,
        message: error.message,
      }),
    ),
  )

/**
 * Effectful provider implementation for the disk index RPC group whose snapshot handler reads the
 * source snapshot and whose projection handler derives perspective-based projections from it.
 */
export const diskIndexImplementation = implement(diskIndex, {
  purity: 'effectful',
  handlers: {
    hosts: () => Effect.map(DiskIndex, (source) => source.hosts),
    snapshot: ({ host }) => sourceSnapshot(host),
    projection: ({ host, perspective, boundaryId }) =>
      Effect.flatMap(sourceSnapshot(host), (snapshot) =>
        projectPerspective(snapshot, perspective, boundaryId),
      ),
    treemap,
  },
})

export default mountProvider(
  diskIndexImplementation,
  DiskIndexLive.pipe(Layer.provide(FetchHttpClient.layer)),
)
