import { GhApi, OverviewApi } from '@vista/blocks/internal/provider-contracts'
import { Option } from 'effect'
import { RpcSchema, RpcSerialization } from 'effect/rpc'
import { describe, expect, it } from 'vitest'

import { makeRpcDescriptors } from '@overeng/effect-rpc-explorer'

import { encodeRouteOwner } from './control.ts'
import { connectionIdForRoute, rpcRouteFromPath, syncCaptureDecoder } from './rpc-explorer.ts'

describe('Vista RPC explorer connection identity', () => {
  it('retains the routed owner, app, and version without conflating latest and published pins', () => {
    expect(rpcRouteFromPath(`/r/${encodeRouteOwner('dev3.agent+team')}/demo/draft/_data/gh`)).toBe(
      'dev3.agent+team/demo/draft',
    )
    expect(rpcRouteFromPath('/r/dev3.agent/demo/latest/_data/trace?cursor=1')).toBe(
      'dev3.agent/demo/latest',
    )
    expect(rpcRouteFromPath('/r/dev3.agent/demo/v4/_data/pty/')).toBe('dev3.agent/demo/v4')
    expect(connectionIdForRoute('dev3.agent/demo/v4', 7)).toBe('dev3.agent/demo/v4:7')
    expect(connectionIdForRoute(rpcRouteFromPath('/_rpc/control'), 7)).toBe('control:7')
  })

  it('does not assign a private app identity to unrelated paths or malformed owner encodings', () => {
    expect(rpcRouteFromPath('/_rpc-inspector')).toBeUndefined()
    expect(rpcRouteFromPath('/r/%ZZ/demo/draft/_data/gh')).toBeUndefined()
    expect(rpcRouteFromPath('/r/dev3.agent%2Bteam/demo/draft/_data/gh')).toBeUndefined()
    expect(rpcRouteFromPath('/r/dev3.agent/demo/draft/')).toBeUndefined()
  })
})

describe('Vista synchronous explorer capture', () => {
  it('decodes live RPC success and error schemas through the mounted JSON codec', () => {
    const descriptor = makeRpcDescriptors(OverviewApi)[0]!
    expect(descriptor.live).toBeDefined()
    const live = descriptor.live!
    const success = syncCaptureDecoder(RpcSerialization.json.codecFor(live.successSchema))({
      repo: 'schickling/dotfiles',
      pr: 5989,
      changedFiles: 2,
      additions: 5,
      deletions: 3,
      verdict: 'ready',
    })
    expect(Option.getOrThrow(success)).toMatchObject({
      repo: 'schickling/dotfiles',
      pr: 5989,
      verdict: 'ready',
    })
    const failure = syncCaptureDecoder(RpcSerialization.json.codecFor(live.errorSchema))({
      _tag: 'OverviewError',
      message: 'provider unavailable',
    })
    expect(Option.getOrThrow(failure)).toMatchObject({
      _tag: 'OverviewError',
      message: 'provider unavailable',
    })
  })

  it('decodes a live GitHub checks stream chunk through its mounted NDJSON codec', () => {
    const descriptor = makeRpcDescriptors(GhApi).find(({ kind }) => kind === 'stream')
    expect(descriptor?.live).toBeDefined()
    const schema = descriptor!.live!.successSchema
    if (!RpcSchema.isStreamSchema(schema)) return expect.fail('Expected the live checks stream')

    const wire = {
      _tag: 'CheckUpdated',
      check: {
        source: 'check-run',
        name: 'typecheck',
        status: 'completed',
        conclusion: 'success',
        startedAt: '2026-10-17T00:00:00Z',
        completedAt: '2026-10-17T00:01:00Z',
        url: 'https://github.com/schickling/dotfiles/actions/runs/1',
      },
      cursor: 'checks:1',
    }
    const decodeElement = syncCaptureDecoder(RpcSerialization.ndjson.codecFor(schema.success))
    const chunk = [wire].map((element) => Option.getOrThrow(decodeElement(element)))
    expect(chunk).toEqual([wire])

    const decodeError = syncCaptureDecoder(RpcSerialization.ndjson.codecFor(schema.error))
    expect(
      Option.getOrThrow(decodeError({ _tag: 'GhError', message: 'checks unavailable' })),
    ).toMatchObject({
      _tag: 'GhError',
      message: 'checks unavailable',
    })
  })
})
