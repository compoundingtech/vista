import {
  bind,
  contract,
  flatMapEdge,
  Operation,
  snapshotKey,
} from '@vista/blocks/internal/data-contract'
import { overview as overviewContract, pty } from '@vista/blocks/internal/provider-contracts'
import { Effect, Schema } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import { describe, expect, it } from 'vitest'

import type { SemanticCaptureBinding } from './app.ts'
import { captureFrozen } from './freeze.ts'
import type { MountedProvider, ProviderRegistry } from './mount.ts'
import overview, { Overview, OverviewApi } from './providers/overview.provider.ts'

const overviewMounted = {
  id: 'overview',
  purity: 'pure',
  group: OverviewApi,
  contract: overviewContract,
  core: overview.core,
  call: (_tag: string, payload: unknown) => overview.core.get(payload as never),
  handler: async () => new Response(),
} as unknown as MountedProvider
const registry = {
  providers: new Map([['overview', overviewMounted]]),
} as unknown as ProviderRegistry

const frozenBinding = (args: {
  readonly repo: string
  readonly pr: number
}): SemanticCaptureBinding => ({
  semanticId: 'overview-card',
  provider: 'overview',
  operation: 'get',
  args,
  policy: { mode: 'frozen' },
})

describe('snapshot capture', () => {
  it('captures every binding into the shared strict snapshot shape', async () => {
    const args = { repo: 'cli/cli', pr: 42 }
    const report = await captureFrozen(registry, [
      frozenBinding(args),
      { ...frozenBinding(args), semanticId: 'live-card', policy: { mode: 'live' } },
    ])
    const key = await Effect.runPromise(snapshotKey(overviewContract.ops.get, args))
    const entry = report.snapshot.entries[key]!

    expect(report.results.map((result) => result._tag)).toEqual(['captured', 'captured'])
    expect(entry.provider).toBe('overview')
    expect(entry.operation).toBe('get')
    const decoded = await Effect.runPromise(
      Schema.decodeUnknownEffect(Overview)(entry.encodedValue),
    )
    expect(decoded.verdict).toBe('small change — looks routine')
  })

  it('canonicalizes payload key order into one snapshot key', async () => {
    const first = await Effect.runPromise(
      snapshotKey(overviewContract.ops.get, { repo: 'cli/cli', pr: 42 }),
    )
    const second = await Effect.runPromise(
      snapshotKey(overviewContract.ops.get, { pr: 42, repo: 'cli/cli' }),
    )
    expect(first).toBe(second)
  })

  it('reports an unknown operation without producing an entry', async () => {
    const report = await captureFrozen(registry, [
      {
        semanticId: 'bad',
        provider: 'overview',
        operation: 'missing',
        args: {},
        policy: { mode: 'frozen' },
      },
    ])
    expect(report.results).toEqual([
      {
        _tag: 'failed',
        blockId: 'bad',
        providerId: 'overview',
        rpcTag: 'missing',
        error: "unknown rpc 'missing'",
      },
    ])
    expect(report.snapshot.entries).toEqual({})
  })

  it('refuses command operations without invoking or snapshotting them', async () => {
    let calls = 0
    const mounted = {
      id: 'pty',
      purity: 'effectful',
      group: pty.group,
      contract: pty,
      core: {},
      call: () =>
        Effect.sync(() => {
          calls += 1
          return undefined
        }),
      handler: async () => new Response(),
    } as unknown as MountedProvider
    const commandRegistry = {
      providers: new Map([['pty', mounted]]),
    } as unknown as ProviderRegistry
    const report = await captureFrozen(commandRegistry, [
      {
        semanticId: 'forged-command-binding',
        provider: 'pty',
        operation: 'attach',
        args: { sessionId: 'session' },
        policy: { mode: 'live', effectfulCapture: 'acknowledged' },
      },
    ])

    expect(report.results).toEqual([
      expect.objectContaining({
        _tag: 'failed',
        error: expect.stringContaining('live-only and cannot be captured'),
      }),
    ])
    expect(report.snapshot.entries).toEqual({})
    expect(calls).toBe(0)
  })

  it('default-denies effectful capture until the policy acknowledges it', async () => {
    let calls = 0
    const effectfulContract = contract({ id: 'effectful', group: OverviewApi })
    const effectful = {
      id: 'effectful',
      purity: 'effectful',
      group: OverviewApi,
      contract: effectfulContract,
      core: {},
      call: (_tag: string, payload: unknown) =>
        Effect.sync(() => {
          calls += 1
          const { repo, pr } = payload as { repo: string; pr: number }
          return new Overview({
            repo,
            pr,
            changedFiles: 1,
            additions: 1,
            deletions: 0,
            verdict: 'captured',
          })
        }),
      handler: async () => new Response(),
    } as unknown as MountedProvider
    const effectfulRegistry = {
      providers: new Map([['effectful', effectful]]),
    } as unknown as ProviderRegistry
    const binding: SemanticCaptureBinding = {
      semanticId: 'effectful-card',
      provider: 'effectful',
      operation: 'get',
      args: { repo: 'a/b', pr: 1 },
      policy: { mode: 'frozen' },
    }

    const refused = await captureFrozen(effectfulRegistry, [binding])
    expect(refused.results.map((result) => result._tag)).toEqual(['effectful-refused'])
    expect(calls).toBe(0)

    const captured = await captureFrozen(effectfulRegistry, [
      { ...binding, policy: { mode: 'frozen', effectfulCapture: 'acknowledged' } },
    ])
    expect(captured.results.map((result) => result._tag)).toEqual(['captured'])
    expect(calls).toBe(1)
  })

  it('blocks a secret in encoded manifest arguments before capture', async () => {
    const SecretApi = RpcGroup.make(
      Rpc.make('read', {
        payload: Schema.Struct({ token: Schema.String }),
        success: Schema.String,
      }),
    )
    const secretContract = contract({ id: 'secret', group: SecretApi })
    let calls = 0
    const mounted = {
      id: 'secret',
      purity: 'pure',
      group: SecretApi,
      contract: secretContract,
      core: {},
      call: () =>
        Effect.sync(() => {
          calls += 1
          return 'not persisted'
        }),
      handler: async () => new Response(),
    } as unknown as MountedProvider
    const secretRegistry = {
      providers: new Map([['secret', mounted]]),
    } as unknown as ProviderRegistry

    const report = await captureFrozen(secretRegistry, [
      {
        semanticId: 'secret-card',
        provider: 'secret',
        operation: 'read',
        args: { token: 'sk-argumentcanary00000000' },
        policy: { mode: 'frozen' },
      },
    ])

    expect(report.results).toEqual([
      expect.objectContaining({
        _tag: 'secret-blocked',
        blockId: 'secret-card',
      }),
    ])
    expect(report.snapshot.entries).toEqual({})
    expect(calls).toBe(0)
  })

  it('strictly decodes encoded manifest arguments once before hashing and invocation', async () => {
    const DatePayload = Schema.Struct({ at: Schema.DateFromString })
    const DateApi = RpcGroup.make(
      Rpc.make('read', {
        payload: DatePayload,
        success: Schema.Struct({ iso: Schema.String }),
      }),
    )
    const dateContract = contract({ id: 'date', group: DateApi })
    const received: unknown[] = []
    const mounted = {
      id: 'date',
      purity: 'pure',
      group: DateApi,
      contract: dateContract,
      core: {},
      call: (_tag: string, payload: unknown) => {
        if (
          typeof payload !== 'object' ||
          payload === null ||
          !('at' in payload) ||
          !(payload.at instanceof Date)
        ) {
          return Effect.die('capture handler received encoded arguments')
        }
        const at = payload.at
        return Effect.sync(() => {
          received.push(payload)
          return { iso: at.toISOString() }
        })
      },
      handler: async () => new Response(),
    } as unknown as MountedProvider
    const dateRegistry = {
      providers: new Map([['date', mounted]]),
    } as unknown as ProviderRegistry
    const encodedAt = '2026-09-20T08:00:00.000Z'

    const report = await captureFrozen(dateRegistry, [
      {
        semanticId: 'date-card',
        provider: 'date',
        operation: 'read',
        args: { at: encodedAt },
        policy: { mode: 'frozen' },
      },
    ])

    expect(report.results).toEqual([expect.objectContaining({ _tag: 'captured' })])
    expect(received).toEqual([{ at: new Date(encodedAt) }])
    expect(Object.values(report.snapshot.entries)[0]?.encodedArgs).toEqual({ at: encodedAt })
  })

  it('captures an identical key once and rejects conflicting material for that key', async () => {
    const SharedApi = RpcGroup.make(
      Rpc.make('read', {
        payload: Schema.Struct({ id: Schema.String }),
        success: Schema.Struct({ sequence: Schema.Finite }),
      }),
    )
    const sharedContract = contract({ id: 'shared', group: SharedApi })
    let firstCalls = 0
    let conflictingCalls = 0
    const first = {
      id: 'first',
      purity: 'pure',
      group: SharedApi,
      contract: sharedContract,
      core: {},
      call: () => Effect.sync(() => ({ sequence: ++firstCalls })),
      handler: async () => new Response(),
    } as unknown as MountedProvider
    const conflicting = {
      id: 'second',
      purity: 'pure',
      group: SharedApi,
      contract: sharedContract,
      core: {},
      call: () => Effect.sync(() => ({ sequence: ++conflictingCalls })),
      handler: async () => new Response(),
    } as unknown as MountedProvider
    const sharedRegistry = {
      providers: new Map([
        ['first', first],
        ['second', conflicting],
      ]),
    } as unknown as ProviderRegistry
    const binding = {
      semanticId: 'first-card',
      provider: 'first',
      operation: 'read',
      args: { id: 'same' },
      policy: { mode: 'frozen' as const },
    }

    const report = await captureFrozen(sharedRegistry, [
      binding,
      { ...binding, semanticId: 'reused-card' },
      { ...binding, semanticId: 'conflict-card', provider: 'second' },
    ])

    expect(report.results.map((result) => result._tag)).toEqual(['captured', 'captured', 'failed'])
    expect(report.results[2]).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('conflicting captured material for snapshot key'),
      }),
    )
    expect(report.recorded).toHaveLength(1)
    expect(Object.keys(report.snapshot.entries)).toHaveLength(1)
    expect(firstCalls).toBe(1)
    expect(conflictingCalls).toBe(0)
  })

  it('captures both constituent entries for a declared flatMap edge', async () => {
    const dependent = Operation.flatMap(
      overviewContract.ops.get,
      (parent) => bind(overviewContract.ops.get, { repo: parent.repo, pr: parent.pr + 1 }),
      { id: 'overview.next/v1', successSchema: Overview },
    )
    const args = { repo: 'cli/cli', pr: 42 }
    const binding = bind(dependent, args)
    const edge = await Effect.runPromise(flatMapEdge(binding))
    if (edge === undefined) throw new Error('expected flatMap edge')

    const report = await captureFrozen(
      registry,
      [
        {
          semanticId: 'dependent-card',
          provider: 'overview',
          operation: 'get',
          args,
          policy: { mode: 'frozen' },
          dependency: { _tag: 'flatMap', id: 'overview.next/v1', edge },
        },
      ],
      {
        flatMapSelectors: new Map([
          [edge, (value: unknown) => dependent.select(Schema.decodeUnknownSync(Overview)(value))],
        ]),
      },
    )
    const parentKey = await Effect.runPromise(snapshotKey(overviewContract.ops.get, args))
    const childArgs = { repo: 'cli/cli', pr: 43 }
    const childKey = await Effect.runPromise(snapshotKey(overviewContract.ops.get, childArgs))

    expect(report.results.map((result) => result._tag)).toEqual(['captured'])
    expect(report.recorded.map(({ key }) => key)).toEqual([parentKey, childKey])
    expect(Object.keys(report.snapshot.entries)).toEqual([parentKey, childKey])
  })
})
