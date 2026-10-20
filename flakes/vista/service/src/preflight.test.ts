import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { pty } from '@vista/blocks/internal/provider-contracts'
import { Effect } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'

import { clock } from '../samples/checks-app/providers/clock.query.ts'
import type { SemanticCaptureBinding } from './data/app.ts'
import otelProvider from './data/providers/otel.provider.ts'
import { checkVistaApp, validateVistaDataBindings } from './preflight.ts'
import { scaffold } from './scaffold.ts'

const appSource = (body: string): string => `
import { AppRoot, Evidence, MetricQuery, Section } from '@vista/blocks'

export default function VistaApp() {
  return (
    <AppRoot title="Local check" template="architecture-review" scope="preflight">
      ${body}
    </AppRoot>
  )
}
`

const roots: string[] = []
const writeApp = (source: string): string => {
  const root = mkdtempSync(join(tmpdir(), 'vista-preflight-test-'))
  roots.push(root)
  writeFileSync(join(root, 'app.tsx'), source)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('Vista local preflight', () => {
  it('warns about untouched scaffold slots without failing the source check', async () => {
    const root = mkdtempSync(join(tmpdir(), 'vista-scaffold-test-'))
    roots.push(root)
    const created = await Effect.runPromise(scaffold('situation-review', { appSource: root }))

    expect(created.files).toEqual(['app.tsx'])
    expect(await checkVistaApp(root)).toEqual({
      _tag: 'ready',
      path: join(root, 'app.tsx'),
      title: 'situation-review',
      semanticNodes: 3,
      dataRequests: 0,
      warnings: [
        {
          code: 'scaffold-slots',
          message:
            'Unfilled scaffold slots: context, reader-ask, primary-focus. Replace the slot comments with real context, a reader ask, and one primary visual before sharing.',
        },
      ],
    })
  })

  it('clears the scaffold warning once the context, ask, and primary focus are authored', async () => {
    const root = mkdtempSync(join(tmpdir(), 'vista-scaffold-authored-test-'))
    roots.push(root)
    await Effect.runPromise(scaffold('situation-review', { appSource: root }))
    const path = join(root, 'app.tsx')
    const source = readFileSync(path, 'utf8')
      .replace('title="situation-review"', 'title="Cache repeated reads"')
      .replace('scope="situation-review"', 'scope="Repeated origin reads make responses slow."')
      .replace(/\{\/\* vista-scaffold:context[^\n]*\*\/\}/, '')
      .replace(
        /\{\/\* vista-scaffold:reader-ask[^\n]*\*\/\}/,
        '<p>Approve routing repeat reads through the cache.</p>',
      )
      .replace(
        /\{\/\* vista-scaffold:primary-focus[^\n]*\*\/\}/,
        '<svg role="img" aria-label="Repeat reads route through the cache"><path d="M 0 10 H 100" /></svg>',
      )
    writeFileSync(path, source)

    expect(await checkVistaApp(root)).toEqual({
      _tag: 'ready',
      path,
      title: 'Cache repeated reads',
      semanticNodes: 3,
      dataRequests: 0,
      warnings: [],
    })
  })

  it('checks ordinary TSX without owner, sources configuration, service, or Vista-state writes', async () => {
    const previous = {
      VISTA_SOURCES: process.env.VISTA_SOURCES,
      ST_AGENT: process.env.ST_AGENT,
      VISTA_URL: process.env.VISTA_URL,
    }
    delete process.env.VISTA_SOURCES
    delete process.env.ST_AGENT
    delete process.env.VISTA_URL
    const root = writeApp(appSource('<Section><p>Ready</p></Section>'))

    try {
      const result = await checkVistaApp(root)
      expect(result).toEqual({
        _tag: 'ready',
        path: join(root, 'app.tsx'),
        title: 'Local check',
        semanticNodes: 1,
        dataRequests: 0,
        warnings: [],
      })
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })

  it('treats an explicit path as an AppSource directory, never an app.tsx shortcut', async () => {
    const root = writeApp(appSource('<Section><p>Ready</p></Section>'))
    const appPath = join(root, 'app.tsx')

    const result = await checkVistaApp(appPath)
    expect(result).toEqual({
      _tag: 'failed',
      path: appPath,
      diagnostic: {
        code: 'source',
        message: 'Vista AppSource path must be a directory',
        consequences: [],
      },
    })
  })

  it('reports one duplicate-id root with grouped, deduplicated consequences', async () => {
    const root = writeApp(
      appSource(`
        <Evidence id="same">first</Evidence>
        <Evidence id="same">second</Evidence>
      `),
    )

    const result = await checkVistaApp(root)
    expect(result._tag).toBe('failed')
    if (result._tag !== 'failed') return
    expect(result.path).toBe(join(root, 'app.tsx'))
    expect(result.diagnostic.message).toContain('duplicate semantic id "same"')
    expect(new Set(result.diagnostic.consequences).size).toBe(result.diagnostic.consequences.length)
    expect([result.diagnostic.message, ...result.diagnostic.consequences].join('\n')).not.toContain(
      '.papp-',
    )
  })

  it('rejects unknown operations and malformed payloads through RpcGroup payload schemas', () => {
    const binding = (operation: string, args: unknown): SemanticCaptureBinding => ({
      semanticId: 'metric',
      provider: 'otel',
      operation,
      args,
      policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
    })

    const unknownOperation = validateVistaDataBindings(
      [binding('missing', {})],
      [otelProvider.implementation.contract],
    )
    expect(unknownOperation?.consequences).toEqual([
      'metric: provider "otel" has no operation "missing"',
    ])

    const invalidPayload = validateVistaDataBindings(
      [binding('query', { promql: 42, stepSeconds: 'fast', points: [] })],
      [otelProvider.implementation.contract],
    )
    expect(invalidPayload?.message).toBe('1 invalid data request')
    expect(invalidPayload?.consequences[0]).toContain('invalid payload for otel.query')

    const malformedProvider = validateVistaDataBindings(
      [{ ...binding('query', {}), provider: 'broken' }],
      [{ id: 'broken', group: { requests: new Map([['query', {}]]) }, ops: { query: {} } }],
    )
    expect(malformedProvider).toEqual({
      code: 'data',
      message: '1 malformed provider request',
      consequences: ['broken.query: request has no payload Schema'],
    })
  })

  it('rejects unary/subscription mode mismatches during preflight', () => {
    const diagnostic = validateVistaDataBindings(
      [
        {
          semanticId: 'unary-as-subscription',
          provider: 'otel',
          operation: 'query',
          args: {
            promql: 'up',
            range: { kind: 'relative', last: '5m' },
            stepSeconds: 60,
            points: 5,
          },
          policy: { mode: 'subscription', effectfulCapture: 'acknowledged' },
        },
        {
          semanticId: 'subscription-as-live',
          provider: 'clock',
          operation: 'clockStream',
          args: { lane: 'preflight' },
          policy: { mode: 'live' },
        },
      ],
      [otelProvider.implementation.contract, clock],
    )

    expect(diagnostic?.consequences).toEqual([
      'unary-as-subscription: mode "subscription" requires a subscription operation; otel.query is unary',
      'subscription-as-live: subscription operation clock.clockStream requires mode "subscription", not "live"',
    ])
  })

  it('rejects a forged binding to a command operation', () => {
    const diagnostic = validateVistaDataBindings(
      [
        {
          semanticId: 'forged-attach',
          provider: 'pty',
          operation: 'attach',
          args: { sessionId: 'session' },
          policy: { mode: 'live', effectfulCapture: 'acknowledged' },
        },
      ],
      [pty],
    )

    expect(diagnostic?.consequences).toEqual([
      'forged-attach: command operation pty.attach is live-only and cannot be bound or captured',
    ])
  })

  it('checks the typed domain binding emitted by MetricQuery', async () => {
    const root = writeApp(
      appSource(`
        <Evidence id="metric">
          <MetricQuery id="metric-view" query="up" stepSeconds={60} points={30} />
        </Evidence>
      `),
    )

    const result = await checkVistaApp(root)
    expect(result).toEqual(expect.objectContaining({ _tag: 'ready', dataRequests: 1 }))
  })
})
