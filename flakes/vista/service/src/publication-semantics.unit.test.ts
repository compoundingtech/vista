import { decodeSemanticManifestJson } from '@vista/blocks/internal/authoring'
import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import { decodePublicationSemanticManifestJson } from './publication-semantics.ts'

const app = {
  id: 'app',
  title: 'Retained publication',
  template: 'architecture-review',
  scope: 'publication compatibility',
  status: { locked: 1, open: 0, awaiting: 0 },
}
const binding = { provider: 'overview', operation: 'get', args: { repo: 'owner/repo', pr: 42 } }
const manifestV1 = {
  schemaVersion: 1,
  app,
  nodes: [
    { id: 'app', kind: 'app', refs: [], bindings: [] },
    {
      id: 'decision',
      kind: 'decision',
      parentId: 'app',
      label: 'Decision',
      provenance: 'test',
      status: 'locked',
      refs: ['app'],
      bindings: [
        { ...binding, requestedMode: 'frozen' },
        { ...binding, requestedMode: 'frozen', freezeEffectful: true },
        { ...binding, requestedMode: 'frozen', freezeEffectful: false },
      ],
    },
    ...['section', 'ask', 'fork', 'evidence', 'island'].map((kind) => ({
      id: kind,
      kind,
      parentId: 'app',
      refs: [],
      bindings: [],
    })),
  ],
}
const manifestV2 = {
  schemaVersion: 2,
  app,
  nodes: [
    { id: 'app', kind: 'app', refs: [], bindings: [{ ...binding, policy: { mode: 'live' } }] },
  ],
}

const decode = (manifest: unknown) =>
  decodePublicationSemanticManifestJson(JSON.stringify(manifest))

describe('immutable publication semantic reader', () => {
  it('carries every historical node and frozen binding into the current shape without mutating input', () => {
    const encoded = JSON.stringify(manifestV1)
    const result = decodePublicationSemanticManifestJson(encoded)
    expect(Result.isSuccess(result)).toBe(true)
    if (!Result.isSuccess(result)) return
    expect(result.success).toEqual({
      ...manifestV1,
      schemaVersion: 2,
      nodes: manifestV1.nodes.map((node) => ({
        ...node,
        bindings:
          node.id === 'decision'
            ? [
                { ...binding, policy: { mode: 'frozen' } },
                { ...binding, policy: { mode: 'frozen', effectfulCapture: 'acknowledged' } },
                { ...binding, policy: { mode: 'frozen' } },
              ]
            : [],
      })),
    })
    expect(JSON.stringify(manifestV1)).toBe(encoded)
  })

  it('keeps the current reader and authoring schema strict', () => {
    const result = decode(manifestV2)
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) expect(result.success).toEqual(manifestV2)
    expect(Result.isFailure(decodeSemanticManifestJson(JSON.stringify(manifestV1)))).toBe(true)
  })

  it.each([
    ['unknown version', { ...manifestV1, schemaVersion: 3 }],
    ['excess manifest field', { ...manifestV1, extra: true }],
    [
      'invalid decision status',
      { ...manifestV1, nodes: [{ ...manifestV1.nodes[1], status: 'settled' }] },
    ],
    [
      'missing decision status',
      { ...manifestV1, nodes: [{ id: 'decision', kind: 'decision', refs: [], bindings: [] }] },
    ],
    ['v2 binding in v1', { ...manifestV1, nodes: manifestV2.nodes }],
    ['v1 binding in v2', { ...manifestV2, nodes: manifestV1.nodes }],
    [
      'non-frozen v1 binding',
      {
        ...manifestV1,
        nodes: [
          { id: 'app', kind: 'app', refs: [], bindings: [{ ...binding, requestedMode: 'live' }] },
        ],
      },
    ],
    [
      'malformed acknowledgement',
      {
        ...manifestV1,
        nodes: [
          {
            id: 'app',
            kind: 'app',
            refs: [],
            bindings: [{ ...binding, requestedMode: 'frozen', freezeEffectful: 'yes' }],
          },
        ],
      },
    ],
    [
      'excess binding field',
      {
        ...manifestV1,
        nodes: [
          {
            id: 'app',
            kind: 'app',
            refs: [],
            bindings: [{ ...binding, requestedMode: 'frozen', extra: true }],
          },
        ],
      },
    ],
  ])('rejects %s rather than stripping or guessing', (_name, manifest) => {
    expect(Result.isFailure(decode(manifest))).toBe(true)
  })

  it('rejects malformed JSON', () => {
    expect(Result.isFailure(decodePublicationSemanticManifestJson('{'))).toBe(true)
  })
})
