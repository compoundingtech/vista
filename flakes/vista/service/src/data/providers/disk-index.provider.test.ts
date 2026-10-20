/**
 * Strict schema-v2, multi-host disk-index provider tests. Fixtures exercise the
 * real decode/projection core while endpoint tests pin the Nix-configured host
 * boundary: callers choose a declared key, never a URL or path; omission is
 * accepted only for exactly one configured endpoint; unknown hosts fail on the
 * typed channel.
 */
import { bind, encodeBinding, mappedAtomKey, Operation } from '@vista/blocks/internal/data-contract'
import {
  diskIndex,
  degradedReasons,
  type DiskPerspective,
  DiskProjection,
  DiskSnapshot,
  projectPerspective,
  TreemapArgs,
  TreemapOutcome,
} from '@vista/blocks/internal/provider-contracts'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import diskIndexProvider, {
  buildDiskTreemap,
  decodeEndpointConfig,
  makeDiskIndexFixtureLayer,
  selectEndpoint,
} from './disk-index.provider.ts'

let stagedSnapshotText = ''
const fixtureLayer = makeDiskIndexFixtureLayer(
  () => stagedSnapshotText,
  () => undefined,
  'dev3',
)

/** Stage the publication body the fixture service will decode on its next read. */
const stageSnapshot = (body: string): void => {
  stagedSnapshotText = body
}

// `provider.core` is typed per-rpc off the group (B1) — no hand-casts.
const snapshot = () =>
  diskIndexProvider.core.snapshot({ host: 'dev3' }).pipe(Effect.provide(fixtureLayer))
const projection = (args: Parameters<typeof diskIndexProvider.core.projection>[0]) =>
  diskIndexProvider.core.projection(args).pipe(Effect.provide(fixtureLayer))

const clientTreemap = Operation.map(diskIndex.ops.projection, {
  id: 'disk-index.client-treemap',
  payloadSchema: TreemapArgs,
  successSchema: TreemapOutcome,
  mapArgs: ({ host, perspective, boundaryId }) => ({
    ...(host === undefined ? {} : { host }),
    perspective,
    boundaryId,
  }),
  map: buildDiskTreemap,
})

/** All four lenses — kept in one place so a new perspective forces test updates. */
const PERSPECTIVES: readonly DiskPerspective[] = [
  'physical',
  'tool-artifact',
  'workspace-artifact',
  'service-artifact',
]

/** These fixtures exist to be serialized as raw wire JSON; the provider's strict shape types them. */
type WireJson = Record<string, unknown>

/**
 * One classified facet row in the collector's serde wire shape. Defaults are a
 * sound row: an observed row attributed by device+inode identity carries BOTH
 * byte quantities, names no claim domain (identity is not a domain claim) and
 * belongs to exactly one declared profile owner.
 */
const wireRow = (over: WireJson): WireJson => ({
  object_id: 'row',
  allocated_bytes: 0,
  apparent_bytes: 0,
  path_aliases: [],
  producer_tool: 'tool',
  artifact_role: 'role',
  workspace: 'ws',
  service_owner: 'svc',
  sharing: 'exclusive',
  freshness: 'fresh',
  status: 'observed',
  claim_scope: 'physical-identity',
  claim_domain: '',
  claim_class: '',
  ownership: { kind: 'profile-owner', profile_owner: 'schickling' },
  ...over,
})

/**
 * A sound snapshot: one big boundary with rows that regroup DIFFERENTLY under
 * each lens (two cargo rows of ONE owner merge under tool×artifact but not
 * under workspace×artifact; a null-allocation row contributes 0), plus a second
 * boundary proving denominators follow the SELECTED boundary. This is an ext4
 * boundary, so `shared_bytes` is 0 and the residual is plain `unclassified`.
 */
const validWire = () => ({
  schema_version: 2,
  snapshot_id: 'snap-01',
  generated_at_seconds: 1_756_700_000,
  health: { status: 'complete', complete: true, errors: [] },
  boundaries: [
    {
      id: 'root',
      kind: 'disk',
      mount_path: '/',
      filesystem: 'ext4',
      total_bytes: 1_000_000,
      used_bytes: 600_000,
      available_bytes: 350_000,
      reserved_bytes: 50_000,
      classified_bytes: 450_000,
      residual_bytes: 150_000,
      shared_bytes: 0,
      residual_reason: 'unclassified',
      facets: [
        wireRow({
          object_id: 'nix-store',
          allocated_bytes: 200_000,
          path_aliases: ['/nix/store'],
          producer_tool: 'nix',
          artifact_role: 'store',
          workspace: 'system',
          service_owner: 'nix-daemon',
          sharing: 'shared',
          ownership: { kind: 'profile-owner', profile_owner: 'root' },
        }),
        wireRow({
          object_id: 'pnpm-store',
          allocated_bytes: 120_000,
          path_aliases: ['/home/s/.pnpm-store'],
          producer_tool: 'pnpm',
          artifact_role: 'cache',
          workspace: 'megarepo',
          service_owner: 'dev',
          sharing: 'shared',
        }),
        wireRow({
          object_id: 'target-a',
          allocated_bytes: 80_000,
          path_aliases: ['/home/s/proj-a/target'],
          producer_tool: 'cargo',
          artifact_role: 'build-output',
          workspace: 'proj-a',
          service_owner: 'dev',
          freshness: 'stale',
          status: 'partial',
        }),
        wireRow({
          object_id: 'target-b',
          allocated_bytes: 50_000,
          path_aliases: ['/home/s/proj-b/target'],
          producer_tool: 'cargo',
          artifact_role: 'build-output',
          workspace: 'proj-b',
          service_owner: 'dev',
          freshness: 'stale',
          status: 'partial',
        }),
        // Metadata-only row with no measured allocation: contributes 0 bytes.
        wireRow({
          object_id: 'ghost',
          allocated_bytes: null,
          apparent_bytes: null,
          path_aliases: ['/home/s/ghost'],
          producer_tool: 'unknown-tool',
          artifact_role: 'unknown',
          workspace: 'unknown',
          service_owner: 'unknown',
          freshness: 'unknown',
          status: 'metadata-only',
        }),
      ],
    },
    {
      id: 'scratch',
      kind: 'disk',
      mount_path: '/scratch',
      filesystem: 'xfs',
      total_bytes: 500,
      used_bytes: 300,
      available_bytes: 200,
      reserved_bytes: 0,
      classified_bytes: 300,
      residual_bytes: 0,
      shared_bytes: 0,
      residual_reason: 'unclassified',
      facets: [wireRow({ object_id: 'scratch-cache', allocated_bytes: 300 })],
    },
  ],
  facet_summaries: [
    {
      id: 'root-facets',
      boundary_id: 'root',
      producer_tool: 'cargo',
      artifact_role: 'build-output',
      workspace: 'megarepo',
      service_owner: 'dev',
      sharing: 'exclusive',
      duration_milliseconds: 37,
      status: 'complete',
      timed_out: false,
      stale: false,
      errors: [],
    },
    {
      id: 'scratch-facet',
      boundary_id: 'scratch',
      producer_tool: 'tool',
      artifact_role: 'role',
      workspace: 'ws',
      service_owner: 'svc',
      sharing: 'exclusive',
      duration_milliseconds: 11,
      status: 'partial',
      timed_out: false,
      stale: true,
      errors: ['scan failed'],
    },
  ],
  refresh_attempts: [
    {
      id: 'attempt-1',
      started_at_seconds: 1_756_699_000,
      finished_at_seconds: 1_756_700_000,
      status: 'complete',
      errors: [],
    },
  ],
  last_complete_attempt: {
    id: 'attempt-1',
    started_at_seconds: 1_756_699_000,
    finished_at_seconds: 1_756_700_000,
    status: 'complete',
    errors: [],
  },
})

/**
 * A native-sharing boundary: a ZFS pool whose blocks are stored once and charged
 * to more than one claim, so `used + shared = classified + residual`. Both rows
 * share a path alias and a tool×role, but one is a native aggregate charge and
 * the other an identity claim — they must NEVER land in one group.
 */
const poolWire = () => ({
  schema_version: 2,
  snapshot_id: 'snap-pool',
  generated_at_seconds: 1_756_700_000,
  health: { status: 'complete', complete: true, errors: [] },
  boundaries: [
    {
      id: 'pool',
      kind: 'pool',
      mount_path: '/tank',
      filesystem: 'zfs',
      total_bytes: 1_000,
      used_bytes: 600,
      available_bytes: 400,
      reserved_bytes: 0,
      shared_bytes: 100,
      classified_bytes: 500,
      residual_bytes: 200,
      residual_reason: 'native-pool-allocation',
      facets: [
        wireRow({
          object_id: 'dataset-a',
          allocated_bytes: 300,
          // A native aggregate reports allocated space only; a logical size here
          // would be a fabrication.
          apparent_bytes: null,
          claim_scope: 'native-aggregate',
          claim_domain: 'zfs',
          claim_class: 'usedbydataset',
          path_aliases: ['/tank/a'],
          producer_tool: 'zfs',
          artifact_role: 'dataset',
        }),
        wireRow({
          object_id: 'file-a',
          allocated_bytes: 200,
          apparent_bytes: 260,
          path_aliases: ['/tank/a'],
          producer_tool: 'zfs',
          artifact_role: 'dataset',
        }),
      ],
    },
  ],
  facet_summaries: [],
  refresh_attempts: [],
  last_complete_attempt: null,
})

/**
 * The full current vocabulary in one document: `exclusive-aggregate`,
 * `non-path-allocation`, the bounded claim domain/class pair and the per-row
 * ownership union. The FacetRow is the ONE byte carrier, so
 * `classified = 200 + 250 + 100 = 550`; the set-owned-pool row carries the
 * shared bytes ONCE and its participants are non-additive metadata beside them.
 */
const currentWire = () => ({
  schema_version: 2,
  snapshot_id: 'snap-current',
  generated_at_seconds: 1_756_700_000,
  health: { status: 'complete', complete: true, errors: [] },
  boundaries: [
    {
      id: 'root',
      kind: 'disk',
      mount_path: '/',
      filesystem: 'ext4',
      total_bytes: 1_000,
      used_bytes: 600,
      available_bytes: 400,
      reserved_bytes: 0,
      // ext4 has no native sharing counters: shared_bytes stays zero.
      shared_bytes: 0,
      classified_bytes: 550,
      residual_bytes: 50,
      residual_reason: 'non-path-allocation',
      facets: [
        wireRow({
          object_id: 'home-schickling',
          allocated_bytes: 200,
          apparent_bytes: 190,
          path_aliases: ['/home/schickling'],
        }),
        wireRow({
          object_id: 'home-schickling-dirs',
          allocated_bytes: 250,
          apparent_bytes: null,
          claim_scope: 'exclusive-aggregate',
          claim_domain: 'posix-subtree',
          claim_class: 'owner-region-exclusive',
          path_aliases: ['/home/schickling'],
        }),
        wireRow({
          object_id: 'hardlink-pool-1',
          // Carries the pool's shared bytes ONCE; participants only say who
          // reaches them, and they OVERLAP by construction (100 + 100 != 100).
          allocated_bytes: 100,
          apparent_bytes: null,
          claim_scope: 'exclusive-aggregate',
          claim_domain: 'posix-subtree',
          claim_class: 'cross-owner-shared',
          path_aliases: ['/nix/store'],
          ownership: {
            kind: 'set-owned-pool',
            pool_id: 'pool-1',
            participants: [
              { owner_id: 'schickling', object_count: 12, participant_bytes: 100 },
              { owner_id: 'root', object_count: 12, participant_bytes: 100 },
            ],
          },
        }),
      ],
    },
  ],
  facet_summaries: [],
  // The bounded list retained nothing of the run history, yet the last SUCCESS
  // is still named — the exact reason `model.rs::Snapshot` carries it in its own
  // required-nullable field.
  refresh_attempts: [],
  last_complete_attempt: {
    id: 'attempt-4',
    started_at_seconds: 1_756_600_000,
    finished_at_seconds: 1_756_600_900,
    status: 'complete',
    errors: [],
  },
})

/** The current snapshot as JSON, with the row at `index` replaced wholesale. */
const withRow = (index: number, row: WireJson): string => {
  const wire = currentWire()
  const boundary = wire.boundaries[0]!
  return JSON.stringify({
    ...wire,
    boundaries: [{ ...boundary, facets: boundary.facets.map((f, i) => (i === index ? row : f)) }],
  })
}

/**
 * A boundary whose rows are DELIBERATELY indistinguishable under every lens:
 * same tool/role/workspace/service and one shared path alias. All that separates
 * them is WHO owns the bytes — two profile owners plus one set-owned pool — so
 * this fixture isolates the ownership half of the grouping key.
 *
 * `classified = 100 + 10 + 40 + 50 = 200`; the pool row carries its shared
 * bytes ONCE beside participants that overlap by construction (50 + 50 != 50).
 */
const ownershipLensWire = () => ({
  schema_version: 2,
  snapshot_id: 'snap-owners',
  generated_at_seconds: 1_756_700_000,
  health: { status: 'complete', complete: true, errors: [] },
  boundaries: [
    {
      id: 'root',
      kind: 'disk',
      mount_path: '/',
      filesystem: 'ext4',
      total_bytes: 1_000,
      used_bytes: 250,
      available_bytes: 750,
      reserved_bytes: 0,
      shared_bytes: 0,
      classified_bytes: 200,
      residual_bytes: 50,
      residual_reason: 'unclassified',
      facets: [
        wireRow({
          object_id: 'alice-1',
          allocated_bytes: 100,
          apparent_bytes: 90,
          path_aliases: ['/home'],
          ownership: { kind: 'profile-owner', profile_owner: 'alice' },
        }),
        wireRow({
          object_id: 'alice-2',
          allocated_bytes: 10,
          apparent_bytes: 8,
          path_aliases: ['/home'],
          ownership: { kind: 'profile-owner', profile_owner: 'alice' },
        }),
        wireRow({
          object_id: 'bob-1',
          allocated_bytes: 40,
          apparent_bytes: 35,
          path_aliases: ['/home'],
          freshness: 'stale',
          ownership: { kind: 'profile-owner', profile_owner: 'bob' },
        }),
        wireRow({
          object_id: 'shared-pool',
          allocated_bytes: 50,
          apparent_bytes: null,
          claim_scope: 'exclusive-aggregate',
          claim_domain: 'posix-subtree',
          claim_class: 'cross-owner-shared',
          path_aliases: ['/home'],
          ownership: {
            kind: 'set-owned-pool',
            pool_id: 'pool-9',
            participants: [
              { owner_id: 'alice', object_count: 3, participant_bytes: 50 },
              { owner_id: 'bob', object_count: 3, participant_bytes: 50 },
            ],
          },
        }),
      ],
    },
  ],
  facet_summaries: [],
  refresh_attempts: [],
  last_complete_attempt: null,
})

describe('disk-index provider (declared host, fail-closed)', () => {
  it('is marked effectful (freeze auto-capture refuses it without acknowledgement)', () => {
    expect(diskIndexProvider.id).toBe('disk-index')
    expect(diskIndexProvider.purity).toBe('effectful')
  })

  it('uses an omitted host only for a single endpoint and refuses unknown hosts', async () => {
    const one = await Effect.runPromise(
      selectEndpoint({ dev3: 'http://127.0.0.1:41032' }, undefined),
    )
    expect(one).toEqual({ host: 'dev3', endpoint: 'http://127.0.0.1:41032' })

    const multiple = selectEndpoint(
      { dev3: 'http://127.0.0.1:41032', dev4: 'http://100.124.157.2:41032' },
      undefined,
    )
    let err = await Effect.runPromise(Effect.flip(multiple))
    expect(err.reason).toBe('unknown-host')
    expect(err.message).toContain('host is required')
    expect(
      await Effect.runPromise(
        selectEndpoint(
          { dev3: 'http://127.0.0.1:41032', dev4: 'http://100.124.157.2:41032' },
          'dev4',
        ),
      ),
    ).toEqual({ host: 'dev4', endpoint: 'http://100.124.157.2:41032' })

    err = await Effect.runPromise(
      Effect.flip(selectEndpoint({ dev3: 'http://127.0.0.1:41032' }, 'not-declared')),
    )
    expect(err.reason).toBe('unknown-host')
    expect(err.message).toContain("host 'not-declared' is not configured")
  })

  it('strictly decodes endpoint origins and rejects paths or an empty host set', async () => {
    const decoded = await Effect.runPromise(
      decodeEndpointConfig(
        '{"dev3":"http://127.0.0.1:41032/","dev4":"http://100.124.157.2:41032"}',
      ),
    )
    expect(decoded).toEqual({
      dev3: 'http://127.0.0.1:41032',
      dev4: 'http://100.124.157.2:41032',
    })

    for (const configured of [
      '{}',
      '{"other":"http://127.0.0.1:41032"}',
      '{"dev3":"http://127.0.0.1:41032/snapshot.json"}',
    ]) {
      const error = await Effect.runPromise(Effect.flip(decodeEndpointConfig(configured)))
      expect(error.reason).toBe('invalid')
    }
  })

  it('fails with reason "invalid" for a non-JSON snapshot — never invented values', async () => {
    stageSnapshot('definitely not json {')

    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
  })

  it('gates on schema_version BEFORE shape errors: version 4 → "unsupported-schema"', async () => {
    // Deliberately shape-garbage otherwise: the version gate must win.
    stageSnapshot(JSON.stringify({ schema_version: 4, nonsense: true }))

    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('unsupported-schema')
    expect(err.message).toContain('schema_version 4')
    expect(err.message).toContain('reads only 2')
  })

  it('reads exactly one generation: any other declared version is refused, never decoded', async () => {
    // There is no second reader. A document that is otherwise perfectly shaped
    // but declares another generation is a version statement this build cannot
    // honour, and it must say so instead of guessing at the shape.
    for (const schema_version of [0, 1, 3, 42]) {
      stageSnapshot(JSON.stringify({ ...currentWire(), schema_version }))
      const err = await Effect.runPromise(Effect.flip(snapshot()))
      expect(err.reason).toBe('unsupported-schema')
      expect(err.message).toContain(`schema_version ${schema_version}`)
    }
  })

  it('fails with reason "invalid" when byte accounting does not add up', async () => {
    const wire = validWire()
    const broken = {
      ...wire,
      // used != classified + residual for boundary 'root'.
      boundaries: [{ ...wire.boundaries[0]!, residual_bytes: 0 }, wire.boundaries[1]!],
    }

    stageSnapshot(JSON.stringify(broken))

    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain("boundary 'root'")
  })

  it('rejects duplicate facet summary ids within a boundary', async () => {
    const wire = validWire()
    wire.facet_summaries.push({ ...wire.facet_summaries[0]! })
    stageSnapshot(JSON.stringify(wire))

    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain("duplicate facet summary id 'root-facets'")
  })

  it('decodes a sound snapshot into the camelCase RPC shape', async () => {
    stageSnapshot(JSON.stringify(validWire()))

    const snap = await Effect.runPromise(snapshot())
    expect(snap).toBeInstanceOf(DiskSnapshot)
    expect(snap.schemaVersion).toBe(2)
    expect(snap.snapshotId).toBe('snap-01')
    expect(snap.generatedAtSeconds).toBe(1_756_700_000)
    expect(snap.health.status).toBe('complete')
    expect(snap.boundaries.map((b) => b.id)).toEqual(['root', 'scratch'])
    expect(snap.refreshAttempts).toHaveLength(1)
    expect(snap.refreshAttempts[0]!.status).toBe('complete')
    expect(snap.facetSummaries).toHaveLength(2)
    expect(snap.facetSummaries[0]).toMatchObject({
      id: 'root-facets',
      boundaryId: 'root',
      durationMilliseconds: 37,
      status: 'complete',
      timedOut: false,
      stale: false,
      errors: [],
    })
    // Every row states exactly one owner, and the identity rows name no domain.
    expect(snap.boundaries[0]!.facets[0]!.ownership).toEqual({
      kind: 'profile-owner',
      profileOwner: 'root',
    })
    expect(snap.boundaries[0]!.facets[0]!.claimDomain).toBe('')
    // The null-allocation row survives decode (it is evidence, not noise).
    expect(
      snap.boundaries[0]!.facets.find((f) => f.objectId === 'ghost')?.allocatedBytes,
    ).toBeNull()
  })

  it('preserves a null APFS mount_path in strict schema v2', async () => {
    const wire = validWire()
    stageSnapshot(
      JSON.stringify({
        ...wire,
        boundaries: [{ ...wire.boundaries[0]!, mount_path: null }, ...wire.boundaries.slice(1)],
      }),
    )

    const snap = await Effect.runPromise(snapshot())
    expect(snap.boundaries[0]!.mountPath).toBeNull()
    const projected = await Effect.runPromise(
      projectPerspective(snap, 'physical', snap.boundaries[0]!.id),
    )
    expect(projected.groups).not.toHaveLength(0)
  })

  it('decodes optional row children and defaults omission to no refinement', async () => {
    const wire = currentWire()
    Object.assign(wire.boundaries[0]!.facets[1]!, {
      children: [
        { name: '/home/schickling/cache', allocated_bytes: 120, kind: 'directory' },
        { name: 'other', allocated_bytes: 130, kind: 'other' },
      ],
    })
    stageSnapshot(JSON.stringify(wire))

    const row = (await Effect.runPromise(snapshot())).boundaries[0]!.facets[1]!
    expect(row.children).toEqual([
      { name: '/home/schickling/cache', allocatedBytes: 120, kind: 'directory' },
      { name: 'other', allocatedBytes: 130, kind: 'other' },
    ])

    stageSnapshot(JSON.stringify(currentWire()))
    const older = (await Effect.runPromise(snapshot())).boundaries[0]!.facets[1]!
    expect(older.children).toEqual([])
  })

  it('rejects child refinement that exceeds or repeats within its parent', async () => {
    const wire = currentWire()
    const row = wire.boundaries[0]!.facets[1]!
    Object.assign(row, {
      children: [
        { name: '/cache', allocated_bytes: 200, kind: 'directory' },
        { name: 'other', allocated_bytes: 51, kind: 'other' },
      ],
    })
    stageSnapshot(JSON.stringify(wire))
    let err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('children carry 251 bytes but parent carries 250')

    Object.assign(row, {
      children: [
        { name: '/cache', allocated_bytes: 100, kind: 'directory' },
        { name: '/cache', allocated_bytes: 100, kind: 'directory' },
      ],
    })
    stageSnapshot(JSON.stringify(wire))
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain("duplicate child '/cache'")
  })

  it('builds the treemap operation against an alternate fixture Layer', async () => {
    let reads = 0
    const fixtureLayer = makeDiskIndexFixtureLayer(JSON.stringify(validWire()), () => {
      reads += 1
    })
    const outcome = await Effect.runPromise(
      diskIndexProvider.core
        .treemap({
          host: 'dev3',
          perspective: 'tool-artifact',
          boundaryId: 'root',
          lens: { maxDepth: 2, foldBelowFraction: 0.002 },
        })
        .pipe(Effect.provide(fixtureLayer)),
    )

    expect(outcome._tag).not.toBe('failure')
    if (outcome._tag === 'failure') throw new Error(outcome.message)
    expect(outcome.value.root.label).toBe('root')
    expect(outcome.value.unit).toBe('bytes')
    expect(reads).toBe(1)
    const mapped = bind(clientTreemap, {
      perspective: 'tool-artifact',
      boundaryId: 'root',
      lens: { maxDepth: 2 },
    })
    const alternateLens = bind(clientTreemap, {
      perspective: 'tool-artifact',
      boundaryId: 'root',
      lens: { maxDepth: 3 },
    })
    const source = bind(diskIndex.ops.projection, {
      perspective: 'tool-artifact',
      boundaryId: 'root',
    })
    expect((await Effect.runPromise(encodeBinding(mapped))).key).toBe(
      (await Effect.runPromise(encodeBinding(source))).key,
    )
    expect(await Effect.runPromise(mappedAtomKey(mapped))).not.toBe(
      await Effect.runPromise(mappedAtomKey(alternateLens)),
    )
  })

  it('preserves three hierarchy levels from projection through the disk treemap model', async () => {
    stageSnapshot(JSON.stringify(validWire()))
    const projected = await Effect.runPromise(
      projection({ perspective: 'tool-artifact', boundaryId: 'root' }),
    )
    const cargoGroups = projected.groups.filter((group) => group.key === 'cargo × build-output')
    expect(cargoGroups).not.toHaveLength(0)
    expect(cargoGroups.every((group) => group.path.join('/') === 'cargo/build-output')).toBe(true)

    const outcome = buildDiskTreemap(projected, {
      perspective: 'tool-artifact',
      boundaryId: 'root',
    })
    const cargo = outcome.value.root.children?.find((node) => node.label === 'cargo')
    expect(cargo?.children?.find((node) => node.label === 'build-output')).toBeDefined()
  })

  it('every perspective preserves the selected boundary denominator and only regroups classified bytes', async () => {
    stageSnapshot(JSON.stringify(validWire()))

    for (const perspective of PERSPECTIVES) {
      const proj = await Effect.runPromise(projection({ perspective, boundaryId: 'root' }))
      expect(proj).toBeInstanceOf(DiskProjection)
      expect(proj.perspective).toBe(perspective)
      expect(proj.boundaryId).toBe('root')
      // Denominators verbatim from the boundary — a lens never changes what the disk holds.
      expect(proj.totalBytes).toBe(1_000_000)
      expect(proj.usedBytes).toBe(600_000)
      expect(proj.availableBytes).toBe(350_000)
      expect(proj.reservedBytes).toBe(50_000)
      expect(proj.classifiedBytes).toBe(450_000)
      expect(proj.residualBytes).toBe(150_000)
      // Accounting identities hold under every lens (ext4: no shared bytes).
      expect(proj.usedBytes + proj.availableBytes + proj.reservedBytes).toBe(proj.totalBytes)
      expect(proj.sharedBytes).toBe(0)
      expect(proj.classifiedBytes + proj.residualBytes).toBe(proj.usedBytes + proj.sharedBytes)
      expect(proj.residualReason).toBe('unclassified')
      // Regrouping is exhaustive over classified bytes: Σ groups == classified.
      const grouped = proj.groups.reduce((sum, g) => sum + g.allocatedBytes, 0)
      expect(grouped).toBe(proj.classifiedBytes)
    }
  })

  it('lenses regroup by dimension: one owner merges under a lens and splits under another', async () => {
    stageSnapshot(JSON.stringify(validWire()))

    const byTool = await Effect.runPromise(
      projection({ perspective: 'tool-artifact', boundaryId: 'root' }),
    )
    // Both cargo rows belong to ONE declared owner and agree on every other
    // grouping dimension, so tool×artifact folds them into a single bucket —
    // exactly as query.rs::aggregate keys them.
    const cargo = byTool.groups.filter((g) => g.key === 'cargo × build-output')
    expect(cargo).toHaveLength(1)
    expect(cargo[0]!.allocatedBytes).toBe(130_000)
    expect(cargo[0]!.rowCount).toBe(2)
    expect(cargo[0]!.ownership).toEqual({ kind: 'profile-owner', profileOwner: 'schickling' })
    // Worst-of rollups describe the whole bucket.
    expect(cargo[0]!.worstFreshness).toBe('stale')
    expect(cargo[0]!.worstStatus).toBe('partial')
    // The merge neither loses nor double-counts a byte.
    expect(byTool.groups.reduce((sum, g) => sum + g.allocatedBytes, 0)).toBe(byTool.classifiedBytes)

    const byWorkspace = await Effect.runPromise(
      projection({ perspective: 'workspace-artifact', boundaryId: 'root' }),
    )
    // The same two rows separate again where the lens dimension separates them.
    expect(byWorkspace.groups.find((g) => g.key === 'proj-a × build-output')?.allocatedBytes).toBe(
      80_000,
    )
    expect(byWorkspace.groups.find((g) => g.key === 'proj-b × build-output')?.allocatedBytes).toBe(
      50_000,
    )

    const physical = await Effect.runPromise(
      projection({ perspective: 'physical', boundaryId: 'root' }),
    )
    // Physical keys are the primary path aliases; the null-allocation row shows as a 0-byte group.
    expect(physical.groups.map((g) => g.key)).toContain('/nix/store')
    expect(physical.groups.find((g) => g.key === '/home/s/ghost')?.allocatedBytes).toBe(0)
  })

  it('denominators follow the SELECTED boundary, not the biggest one', async () => {
    stageSnapshot(JSON.stringify(validWire()))

    const proj = await Effect.runPromise(
      projection({ perspective: 'service-artifact', boundaryId: 'scratch' }),
    )
    expect(proj.totalBytes).toBe(500)
    expect(proj.usedBytes).toBe(300)
    expect(proj.residualBytes).toBe(0)
    expect(proj.groups.reduce((sum, g) => sum + g.allocatedBytes, 0)).toBe(300)
  })

  it('fails with reason "unknown-boundary" for a boundary id the snapshot does not have', async () => {
    stageSnapshot(JSON.stringify(validWire()))

    const err = await Effect.runPromise(
      Effect.flip(projection({ perspective: 'physical', boundaryId: 'nope' })),
    )
    expect(err.reason).toBe('unknown-boundary')
    expect(err.message).toContain('root')
  })

  it('projectPerspective is the same pure surface the handler uses (in-process call)', async () => {
    stageSnapshot(JSON.stringify(validWire()))
    const snap = await Effect.runPromise(snapshot())

    const proj = await Effect.runPromise(projectPerspective(snap, 'tool-artifact', 'root'))
    expect(proj.classifiedBytes).toBe(450_000)
    expect(proj.groups.reduce((sum, g) => sum + g.allocatedBytes, 0)).toBe(450_000)
  })

  it('derives no degraded reasons from a healthy snapshot', async () => {
    // Health complete, nothing retained that failed, and no facet summary
    // reporting a scan that did not finish.
    stageSnapshot(JSON.stringify(currentWire()))
    const snap = await Effect.runPromise(snapshot())

    expect(degradedReasons(snap)).toEqual([])
  })

  it('never presents a partial, stale or timed-out facet as healthy', async () => {
    // The snapshot's own health block says complete; one facet scan did not
    // finish. The notice states the facet evidence anyway, in document order.
    stageSnapshot(JSON.stringify(validWire()))
    const snap = await Effect.runPromise(snapshot())

    expect(snap.health.status).toBe('complete')
    expect(snap.health.complete).toBe(true)
    expect(degradedReasons(snap)).toEqual([
      "facet refresh 'scratch-facet' on boundary 'scratch' ended partial",
      "facet refresh 'scratch-facet' on boundary 'scratch' is stale",
      'scan failed',
    ])

    // A timed-out facet is named as such, and one error text shared by two
    // facets is stated ONCE, at its first occurrence — the notice is a
    // deterministic, deduplicated reading of the document.
    const timedOut = validWire()
    stageSnapshot(
      JSON.stringify({
        ...timedOut,
        facet_summaries: [
          {
            ...timedOut.facet_summaries[0]!,
            status: 'partial',
            timed_out: true,
            errors: ['scan failed'],
          },
          timedOut.facet_summaries[1]!,
        ],
      }),
    )
    const withTimeout = await Effect.runPromise(snapshot())
    expect(degradedReasons(withTimeout)).toEqual([
      "facet refresh 'root-facets' on boundary 'root' ended partial",
      "facet refresh 'root-facets' on boundary 'root' timed out",
      'scan failed',
      "facet refresh 'scratch-facet' on boundary 'scratch' ended partial",
      "facet refresh 'scratch-facet' on boundary 'scratch' is stale",
    ])
  })

  it('derives visible degraded reasons from partial health and an interrupted refresh', async () => {
    const wire = {
      ...validWire(),
      health: {
        status: 'partial',
        complete: false,
        errors: ['facet scan /home/s/proj-a timed out'],
      },
      refresh_attempts: [
        ...validWire().refresh_attempts,
        {
          id: 'attempt-2',
          started_at_seconds: 1_756_700_500,
          finished_at_seconds: null,
          status: 'interrupted',
          errors: ['killed by OOM'],
        },
      ],
    }
    stageSnapshot(JSON.stringify(wire))

    const snap = await Effect.runPromise(snapshot())
    const reasons = degradedReasons(snap)
    expect(reasons).toContain("snapshot health is 'partial'")
    expect(reasons).toContain('coverage incomplete: at least one facet scan did not finish')
    expect(reasons).toContain('facet scan /home/s/proj-a timed out')
    expect(reasons).toContain("last refresh attempt 'attempt-2' ended interrupted")
    expect(reasons).toContain('killed by OOM')
  })

  it('decodes shared bytes, the typed residual reason and the native aggregate claim', async () => {
    stageSnapshot(JSON.stringify(poolWire()))

    const snap = await Effect.runPromise(snapshot())
    const pool = snap.boundaries[0]!
    expect(pool.sharedBytes).toBe(100)
    expect(pool.residualReason).toBe('native-pool-allocation')
    // Shared blocks are stored once and charged many times.
    expect(pool.classifiedBytes + pool.residualBytes).toBe(pool.usedBytes + pool.sharedBytes)
    const dataset = pool.facets.find((f) => f.objectId === 'dataset-a')!
    expect(dataset.claimScope).toBe('native-aggregate')
    expect(dataset.allocatedBytes).toBe(300)
    expect(dataset.apparentBytes).toBeNull()
    // The claiming authority is DECLARED on the row, never parsed out of an id.
    expect(dataset.claimDomain).toBe('zfs')
    expect(dataset.claimClass).toBe('usedbydataset')
    expect(dataset.children).toEqual([])
    // A physical row is not a domain claim: identity carries no authority.
    const file = pool.facets.find((f) => f.objectId === 'file-a')!
    expect(file.claimDomain).toBe('')
    expect(file.claimClass).toBe('')
  })

  it('never merges an aggregate charge with an identity claim, and still sums to classified', async () => {
    stageSnapshot(JSON.stringify(poolWire()))

    for (const perspective of PERSPECTIVES) {
      const proj = await Effect.runPromise(projection({ perspective, boundaryId: 'pool' }))
      // Both rows share the lens key under every perspective, yet the scopes stay apart.
      expect(proj.groups).toHaveLength(2)
      expect(proj.groups.map((g) => g.claimScope).toSorted()).toEqual([
        'native-aggregate',
        'physical-identity',
      ])
      expect(proj.groups.every((g) => g.rowCount === 1)).toBe(true)
      expect(proj.groups.find((g) => g.claimScope === 'native-aggregate')?.allocatedBytes).toBe(300)
      // Σ groups == classified, built from ALLOCATED bytes only: the identity row's
      // apparent 260 never leaks into any total.
      expect(proj.groups.reduce((sum, g) => sum + g.allocatedBytes, 0)).toBe(proj.classifiedBytes)
      expect(proj.sharedBytes).toBe(100)
      expect(proj.residualReason).toBe('native-pool-allocation')
    }
  })

  it('rejects the schema-1 residual literal and unknown residual literals', async () => {
    for (const residual_reason of ['zfs-pool-metadata', 'made-up-residual']) {
      const wire = poolWire()
      stageSnapshot(
        JSON.stringify({
          ...wire,
          boundaries: [{ ...wire.boundaries[0]!, residual_reason }],
        }),
      )

      const err = await Effect.runPromise(Effect.flip(snapshot()))
      expect(err.reason).toBe('invalid')
      expect(err.message).toContain('schema-2 decode')
    }
  })

  it('physical projection keeps boundary-relative paths drillable and measured claims as leaves', async () => {
    stageSnapshot(JSON.stringify(poolWire()))
    const projected = await Effect.runPromise(
      projection({ perspective: 'physical', boundaryId: 'pool' }),
    )
    expect(projected.groups.map((group) => [group.key, group.path])).toEqual([
      ['/tank/a', ['a', 'usedbydataset']],
      ['/tank/a', ['a', 'file-a']],
    ])

    const outcome = buildDiskTreemap(projected, {
      perspective: 'physical',
      boundaryId: 'pool',
    })
    const path = outcome.value.root.children?.find((node) => node.label === 'a')
    expect(path?.children?.map((node) => node.label).toSorted()).toEqual([
      'file-a',
      'usedbydataset',
    ])
  })

  it('fails closed when a boundary or row omits a required field', async () => {
    const withoutShared = poolWire()
    const { shared_bytes: _shared, ...noShared } = withoutShared.boundaries[0]!
    stageSnapshot(JSON.stringify({ ...withoutShared, boundaries: [noShared] }))
    let err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('schema-2 decode')

    const withoutReason = poolWire()
    const { residual_reason: _reason, ...noReason } = withoutReason.boundaries[0]!
    stageSnapshot(JSON.stringify({ ...withoutReason, boundaries: [noReason] }))
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('schema-2 decode')

    // Every row-level statement the current generation makes is required: the
    // claim scope, both halves of the label-safe pair, and the owner.
    for (const field of ['claim_scope', 'claim_domain', 'claim_class', 'ownership']) {
      const wire = poolWire()
      const boundary = wire.boundaries[0]!
      const { [field]: _dropped, ...incomplete } = boundary.facets[0]!
      stageSnapshot(
        JSON.stringify({
          ...wire,
          boundaries: [{ ...boundary, facets: [incomplete, boundary.facets[1]!] }],
        }),
      )
      err = await Effect.runPromise(Effect.flip(snapshot()))
      expect(err.reason).toBe('invalid')
      expect(err.message).toContain('schema-2 decode')
    }
  })

  it("rejects excess keys — the collector's structs are deny_unknown_fields", async () => {
    stageSnapshot(JSON.stringify({ ...currentWire(), extra_field: true }))

    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('schema-2 decode')
  })

  it('accepts a partial boundary with shared bytes and no native aggregate rows', async () => {
    const wire = poolWire()
    const boundary = wire.boundaries[0]!
    stageSnapshot(
      JSON.stringify({
        ...wire,
        health: { status: 'partial', complete: false, errors: ['native claim facet unavailable'] },
        boundaries: [
          {
            ...boundary,
            classified_bytes: 200,
            residual_bytes: 500,
            facets: [boundary.facets[1]!],
          },
        ],
      }),
    )

    const partial = await Effect.runPromise(snapshot())
    expect(partial.health.status).toBe('partial')
    expect(partial.boundaries[0]!.sharedBytes).toBe(100)
    expect(partial.boundaries[0]!.facets).toHaveLength(1)

    // Residual classification is an INDEPENDENT fact: a native pool whose
    // unattributed space is non-path allocation is perfectly legal.
    stageSnapshot(
      JSON.stringify({
        ...wire,
        boundaries: [{ ...boundary, residual_reason: 'non-path-allocation' }],
      }),
    )
    const snap = await Effect.runPromise(snapshot())
    expect(snap.boundaries[0]!.sharedBytes).toBe(100)
    expect(snap.boundaries[0]!.residualReason).toBe('non-path-allocation')
  })

  it('fails closed when accounting is wrong in either direction', async () => {
    const wire = poolWire()
    // used + shared (700) != classified + residual (600).
    stageSnapshot(
      JSON.stringify({
        ...wire,
        boundaries: [{ ...wire.boundaries[0]!, classified_bytes: 400, residual_bytes: 200 }],
      }),
    )
    let err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('shared 100')

    // Rows must sum to classified EXACTLY — apparent bytes cannot make up a gap.
    const rowGap = poolWire()
    stageSnapshot(
      JSON.stringify({
        ...rowGap,
        boundaries: [
          {
            ...rowGap.boundaries[0]!,
            facets: [rowGap.boundaries[0]!.facets[0]!],
          },
        ],
      }),
    )
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('classified 500 != facet rows 300')
  })

  it('rejects unsafe charge-identity and facet-row aggregate sums', async () => {
    const wire = poolWire()
    const boundary = wire.boundaries[0]!
    const maxSafe = Number.MAX_SAFE_INTEGER
    stageSnapshot(
      JSON.stringify({
        ...wire,
        boundaries: [
          {
            ...boundary,
            total_bytes: maxSafe,
            used_bytes: maxSafe,
            available_bytes: 0,
            reserved_bytes: 0,
            shared_bytes: 1,
            classified_bytes: maxSafe,
            residual_bytes: 2,
            facets: [{ ...boundary.facets[0]!, allocated_bytes: maxSafe }],
          },
        ],
      }),
    )

    // MAX_SAFE + 1 and MAX_SAFE + 2 both become 9_007_199_254_740_992 if
    // Number rounding is allowed, so the mathematically corrupt identity used
    // to compare equal.
    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('charge identity exceeds the safe integer range')
    expect(err.message).toContain('attributable 9007199254740992')
    expect(err.message).toContain('explained 9007199254740993')

    const facetWire = poolWire()
    const facetBoundary = facetWire.boundaries[0]!
    stageSnapshot(
      JSON.stringify({
        ...facetWire,
        boundaries: [
          {
            ...facetBoundary,
            total_bytes: maxSafe,
            used_bytes: maxSafe,
            available_bytes: 0,
            reserved_bytes: 0,
            shared_bytes: 0,
            classified_bytes: maxSafe,
            residual_bytes: 0,
            facets: [
              { ...facetBoundary.facets[0]!, allocated_bytes: maxSafe },
              { ...facetBoundary.facets[1]!, allocated_bytes: 1 },
            ],
          },
        ],
      }),
    )
    const facetErr = await Effect.runPromise(Effect.flip(snapshot()))
    expect(facetErr.reason).toBe('invalid')
    expect(facetErr.message).toContain('facet row sum 9007199254740992')
    expect(facetErr.message).toContain('exceeds the safe integer range')
  })

  it('rejects a row whose bytes contradict its status and claim scope', async () => {
    const fabricated = poolWire()
    stageSnapshot(
      JSON.stringify({
        ...fabricated,
        boundaries: [
          {
            ...fabricated.boundaries[0]!,
            // A native aggregate never samples a logical size.
            facets: [
              { ...fabricated.boundaries[0]!.facets[0]!, apparent_bytes: 300 },
              fabricated.boundaries[0]!.facets[1]!,
            ],
          },
        ],
      }),
    )

    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('claim scope')
  })

  it('reads the frozen vocabulary and the per-row ownership union', async () => {
    stageSnapshot(JSON.stringify(currentWire()))

    const snap = await Effect.runPromise(snapshot())
    expect(snap.schemaVersion).toBe(2)
    const root = snap.boundaries[0]!
    expect(root.residualReason).toBe('non-path-allocation')
    expect(root.classifiedBytes + root.residualBytes).toBe(root.usedBytes + root.sharedBytes)
    const dirs = root.facets.find((f) => f.objectId === 'home-schickling-dirs')!
    // Directory st_blocks ride in an exclusive aggregate, allocated-only.
    expect(dirs.claimScope).toBe('exclusive-aggregate')
    expect(dirs.ownership).toEqual({ kind: 'profile-owner', profileOwner: 'schickling' })
    const pooled = root.facets.find((f) => f.objectId === 'hardlink-pool-1')!
    // The cross-owner hardlink row carries the shared bytes ONCE, and its
    // participants are non-additive metadata beside them: 100 + 100 != 100.
    expect(pooled.allocatedBytes).toBe(100)
    expect(pooled.claimDomain).toBe('posix-subtree')
    expect(pooled.claimClass).toBe('cross-owner-shared')
    expect(pooled.ownership).toEqual({
      kind: 'set-owned-pool',
      poolId: 'pool-1',
      participants: [
        { ownerId: 'schickling', objectCount: 12, participantBytes: 100 },
        { ownerId: 'root', objectCount: 12, participantBytes: 100 },
      ],
    })

    // Closure holds through a projection: every row is grouped exactly once, and
    // the exclusive aggregate never merges into the identity claim on the same path.
    const proj = await Effect.runPromise(
      projection({ perspective: 'physical', boundaryId: 'root' }),
    )
    expect(proj.groups.reduce((sum, g) => sum + g.allocatedBytes, 0)).toBe(proj.classifiedBytes)
    expect(proj.groups.find((g) => g.key === '/nix/store')?.allocatedBytes).toBe(100)
    const home = proj.groups.filter((g) => g.key === '/home/schickling')
    expect(home.map((g) => g.claimScope).toSorted()).toEqual([
      'exclusive-aggregate',
      'physical-identity',
    ])
  })

  it('carries the last complete attempt verbatim, past the bounded attempt list', async () => {
    stageSnapshot(JSON.stringify(currentWire()))

    const withoutHistory = await Effect.runPromise(snapshot())
    // The retained list is empty, so this success exists ONLY in its own field —
    // a bounded list can never be the source of the last-success answer.
    expect(withoutHistory.refreshAttempts).toEqual([])
    expect(withoutHistory.lastCompleteAttempt).toMatchObject({
      id: 'attempt-4',
      startedAtSeconds: 1_756_600_000,
      finishedAtSeconds: 1_756_600_900,
      status: 'complete',
      errors: [],
    })

    // A failure run longer than the bound: every retained attempt failed, and the
    // older success still reads back exactly, neither dropped nor re-derived.
    stageSnapshot(
      JSON.stringify({
        ...currentWire(),
        refresh_attempts: [
          {
            id: 'attempt-6',
            started_at_seconds: 1_756_699_900,
            finished_at_seconds: 1_756_700_000,
            status: 'interrupted',
            errors: ['killed mid-scan'],
          },
          {
            id: 'attempt-5',
            started_at_seconds: 1_756_698_000,
            finished_at_seconds: 1_756_698_100,
            status: 'partial',
            errors: ['device busy'],
          },
        ],
      }),
    )

    const snap = await Effect.runPromise(snapshot())
    expect(snap.refreshAttempts.map((a) => a.status)).toEqual(['interrupted', 'partial'])
    expect(snap.lastCompleteAttempt?.id).toBe('attempt-4')
    expect(snap.refreshAttempts.some((a) => a.id === 'attempt-4')).toBe(false)
    // The notice still reports the FAILED latest attempt — the carried success is
    // evidence beside it, never a reason to call the snapshot healthy.
    expect(degradedReasons(snap)).toContain("last refresh attempt 'attempt-6' ended interrupted")
  })

  it('requires the last-complete field to be stated: absent or coerced is malformed', async () => {
    // The field is REQUIRED and nullable. An absent key is not a `null`
    // statement, and nothing here re-derives one from the bounded list.
    const { last_complete_attempt: _absent, ...omitted } = currentWire()
    stageSnapshot(JSON.stringify(omitted))
    let err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('schema-2 decode')

    // Present but not an attempt: refused rather than coerced or dropped.
    stageSnapshot(JSON.stringify({ ...currentWire(), last_complete_attempt: 'attempt-4' }))
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('schema-2 decode')

    // A partial attempt object is not an attempt either.
    stageSnapshot(
      JSON.stringify({
        ...currentWire(),
        last_complete_attempt: { id: 'attempt-4', status: 'complete' },
      }),
    )
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('schema-2 decode')

    // An explicit null IS a statement, and it is legal while nothing retained
    // completed: currentWire keeps an empty attempt list.
    stageSnapshot(JSON.stringify({ ...currentWire(), last_complete_attempt: null }))
    const stated = await Effect.runPromise(snapshot())
    expect(stated.lastCompleteAttempt).toBeNull()
    expect(stated.refreshAttempts).toEqual([])
  })

  it('fails closed when the carried last success contradicts the retained attempts', async () => {
    const success = {
      id: 'attempt-6',
      started_at_seconds: 1_756_698_000,
      finished_at_seconds: 1_756_698_500,
      status: 'complete',
      errors: [],
    }
    const stage = (over: WireJson) => stageSnapshot(JSON.stringify({ ...currentWire(), ...over }))

    // Claiming nothing ever completed while still retaining a completed attempt is
    // two contradictory answers about the last success — never silently resolved.
    stage({ last_complete_attempt: null, refresh_attempts: [success] })
    let err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('violates refresh attempt invariants')
    expect(err.message).toContain("retained attempt 'attempt-6' completed")

    // The carried value must look like a completed run: right status, finished,
    // and free of errors.
    stage({ last_complete_attempt: { ...success, status: 'partial', errors: ['half a scan'] } })
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain("last complete attempt 'attempt-6' has status 'partial'")

    stage({ last_complete_attempt: { ...success, finished_at_seconds: null } })
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.message).toContain("last complete attempt 'attempt-6' never finished")

    stage({ last_complete_attempt: { ...success, errors: ['scan aborted'] } })
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.message).toContain('carries errors: scan aborted')

    // A retained success the carried value disagrees with: same question, two answers.
    stage({
      last_complete_attempt: success,
      refresh_attempts: [{ ...success, id: 'attempt-9', started_at_seconds: 1_756_699_000 }],
    })
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.message).toContain(
      "last complete attempt 'attempt-6' contradicts the newest retained complete attempt 'attempt-9'",
    )

    // Agreement is accepted: the carried value IS the newest retained success.
    stage({ last_complete_attempt: success, refresh_attempts: [success] })
    const agreed = await Effect.runPromise(snapshot())
    expect(agreed.lastCompleteAttempt?.id).toBe('attempt-6')
    expect(agreed.refreshAttempts.map((a) => a.id)).toEqual(['attempt-6'])
  })

  it('rejects a carried success whose retained copy has a different ordered error set', async () => {
    const carried = {
      id: 'attempt-errors',
      started_at_seconds: 1_756_698_000,
      finished_at_seconds: 1_756_698_500,
      status: 'complete',
      errors: [],
    }
    stageSnapshot(
      JSON.stringify({
        ...currentWire(),
        last_complete_attempt: carried,
        refresh_attempts: [{ ...carried, errors: ['scan failed'] }],
      }),
    )

    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain(
      "last complete attempt 'attempt-errors' contradicts the newest retained complete attempt 'attempt-errors'",
    )
  })

  it('two ProfileOwners that read identically under a lens produce distinct groups', async () => {
    stageSnapshot(JSON.stringify(ownershipLensWire()))

    const proj = await Effect.runPromise(
      projection({ perspective: 'tool-artifact', boundaryId: 'root' }),
    )
    const owned = proj.groups.filter((g) => g.claimScope === 'physical-identity')
    // Alice's two rows merge; Bob's never joins them, even though every lens
    // dimension, the claim scope and the domain/class pair are identical.
    expect(owned.map((g) => [g.ownership, g.allocatedBytes, g.rowCount])).toEqual([
      [{ kind: 'profile-owner', profileOwner: 'alice' }, 110, 2],
      [{ kind: 'profile-owner', profileOwner: 'bob' }, 40, 1],
    ])
    // The lens LABEL cannot tell them apart — only the ownership key can.
    expect(new Set(owned.map((g) => g.key)).size).toBe(1)
    // Worst-of rollups stay per group: Bob's stale row never ages Alice's.
    expect(owned.map((g) => g.worstFreshness)).toEqual(['fresh', 'stale'])
    expect(proj.groups.reduce((sum, g) => sum + g.allocatedBytes, 0)).toBe(proj.classifiedBytes)
  })

  it('keeps otherwise-identical rows in distinct groups when sharing differs', async () => {
    const wire = ownershipLensWire()
    wire.boundaries[0]!.facets[1]!.sharing = 'shared'
    stageSnapshot(JSON.stringify(wire))

    const projected = await Effect.runPromise(
      projection({ perspective: 'tool-artifact', boundaryId: 'root' }),
    )
    const alice = projected.groups.filter(
      (group) =>
        group.ownership.kind === 'profile-owner' && group.ownership.profileOwner === 'alice',
    )
    expect(alice.map((group) => [group.sharing, group.allocatedBytes, group.rowCount])).toEqual([
      ['exclusive', 100, 1],
      ['shared', 10, 1],
    ])
  })

  it('keeps colliding display labels as two structured dimension groups', async () => {
    const wire = ownershipLensWire()
    const boundary = wire.boundaries[0]!
    const facets = structuredClone(boundary.facets)
    Object.assign(facets[0]!, { producer_tool: 'a × b', artifact_role: 'c' })
    Object.assign(facets[1]!, { producer_tool: 'a', artifact_role: 'b × c' })
    stageSnapshot(
      JSON.stringify({
        ...wire,
        boundaries: [
          {
            ...boundary,
            facets,
          },
        ],
      }),
    )

    const proj = await Effect.runPromise(
      projection({ perspective: 'tool-artifact', boundaryId: 'root' }),
    )
    const collision = proj.groups.filter((group) => group.key === 'a × b × c')
    expect(collision).toHaveLength(2)
    expect(collision.map((group) => [group.allocatedBytes, group.rowCount])).toEqual([
      [100, 1],
      [10, 1],
    ])
    expect(collision.map((group) => group.ownership)).toEqual([
      { kind: 'profile-owner', profileOwner: 'alice' },
      { kind: 'profile-owner', profileOwner: 'alice' },
    ])
  })

  it('a set-owned pool group stays one byte carrier and is never a single owner', async () => {
    stageSnapshot(JSON.stringify(ownershipLensWire()))

    for (const perspective of PERSPECTIVES) {
      const proj = await Effect.runPromise(projection({ perspective, boundaryId: 'root' }))
      const pools = proj.groups.filter((g) => g.ownership.kind === 'set-owned-pool')
      // The pool row passes through as its own group under every lens: it is
      // never folded into a profile owner's bucket, and no lens can turn a set
      // of owners into one.
      expect(pools).toHaveLength(1)
      const pool = pools[0]!
      expect(pool.rowCount).toBe(1)
      expect(pool.allocatedBytes).toBe(50)
      expect(pool.claimDomain).toBe('posix-subtree')
      expect(pool.claimClass).toBe('cross-owner-shared')
      // Participants travel WITH the group and are never summed (50 + 50 != 50).
      expect(pool.ownership).toEqual({
        kind: 'set-owned-pool',
        poolId: 'pool-9',
        participants: [
          { ownerId: 'alice', objectCount: 3, participantBytes: 50 },
          { ownerId: 'bob', objectCount: 3, participantBytes: 50 },
        ],
      })
      // The pool's bytes are counted exactly once in the classified total.
      expect(proj.groups.reduce((sum, g) => sum + g.allocatedBytes, 0)).toBe(proj.classifiedBytes)
    }
  })

  it('fails closed on ownership that is not exactly one closed owner', async () => {
    const { ownership: _dropped, ...orphan } = currentWire().boundaries[0]!.facets[0]!
    const base = currentWire().boundaries[0]!.facets[0]!
    const rows: readonly WireJson[] = [
      // No owner at all.
      orphan,
      // The union is CLOSED at two kinds: there is no third owner kind, and no
      // owner-less row can enter (q15 forbids arbitrary shared owners).
      { ...base, ownership: { kind: 'legacy-row', legacy_row_id: 'home-schickling' } },
      { ...base, ownership: { kind: 'shared', profile_owner: 'schickling' } },
      // An empty subject is not an owner.
      { ...base, ownership: { kind: 'profile-owner', profile_owner: '' } },
      // A pool needs its id AND its participants — the participants live on the row.
      { ...base, ownership: { kind: 'set-owned-pool', pool_id: '', participants: [] } },
      { ...base, ownership: { kind: 'set-owned-pool', pool_id: 'pool-1' } },
    ]

    for (const row of rows) {
      stageSnapshot(withRow(0, row))
      const err = await Effect.runPromise(Effect.flip(snapshot()))
      expect(err.reason).toBe('invalid')
      expect(err.message).toContain('schema-2 decode')
    }
  })

  it('fails closed on non-additive participant metadata that does not hold up', async () => {
    const relation = currentWire().boundaries[0]!.facets[2]!
    const schickling = { owner_id: 'schickling', object_count: 12, participant_bytes: 100 }
    const root = { owner_id: 'root', object_count: 12, participant_bytes: 100 }
    const withParticipants = (participants: readonly unknown[]) => ({
      ...relation,
      ownership: { kind: 'set-owned-pool', pool_id: 'pool-1', participants },
    })

    // A pool that only one owner reaches is an ordinary profile-owner region, and
    // q15 forbids inventing a shared owner for it. Repeating one owner says the
    // same thing twice.
    for (const participants of [[], [schickling], [schickling, schickling]]) {
      stageSnapshot(withRow(2, withParticipants(participants)))
      const err = await Effect.runPromise(Effect.flip(snapshot()))
      expect(err.reason).toBe('invalid')
      expect(err.message).toContain('at least two distinct participants')
    }

    // A participant cannot see more than the row that carries the shared bytes.
    stageSnapshot(withRow(2, withParticipants([{ ...schickling, participant_bytes: 175 }, root])))
    let err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('sees 175 of 100 carried bytes')

    // The row exists because the shared bytes exist: never metadata-only.
    stageSnapshot(withRow(2, { ...relation, allocated_bytes: null, status: 'metadata-only' }))
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('bytes inconsistent')
  })

  it('rejects metadata-only exclusive aggregate rows', async () => {
    const aggregate = currentWire().boundaries[0]!.facets[1]!
    stageSnapshot(withRow(1, { ...aggregate, allocated_bytes: null, status: 'metadata-only' }))

    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('bytes inconsistent')
    expect(err.message).toContain("claim scope 'exclusive-aggregate'")
  })

  it('bounds the label-safe pair: closed vocabularies and the domain/class partition', async () => {
    const rows = currentWire().boundaries[0]!.facets
    const physical = rows[0]!
    const aggregate = rows[1]!
    const relation = rows[2]!

    // Both vocabularies are closed: an unknown member would silently widen the
    // cardinality of the one label-safe pair, so it never reaches decode.
    for (const over of [{ claim_domain: 'btrfs' }, { claim_class: 'made-up' }]) {
      stageSnapshot(withRow(1, { ...aggregate, ...over }))
      const err = await Effect.runPromise(Effect.flip(snapshot()))
      expect(err.reason).toBe('invalid')
      expect(err.message).toContain('schema-2 decode')
    }

    // A physical-identity row is identity, not a domain claim: it names neither
    // half, and an aggregate charge must name both.
    stageSnapshot(withRow(0, { ...physical, claim_domain: 'zfs', claim_class: 'usedbydataset' }))
    let err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('claim taxonomy')

    stageSnapshot(withRow(1, { ...aggregate, claim_class: '' }))
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('claim taxonomy')

    // The class must belong to ITS domain — `usedbydataset` is zfs's, not a
    // posix-subtree class — so a cross-domain pair can never reach a label.
    stageSnapshot(withRow(1, { ...aggregate, claim_class: 'usedbydataset' }))
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('is not a class of that domain')

    // A pool row carries its domain's single shared class.
    stageSnapshot(withRow(2, { ...relation, claim_class: 'owner-region-exclusive' }))
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain("must be class 'cross-owner-shared'")

    // ZFS owns no shared class — its sharing is the boundary's shared_bytes — so
    // a zfs pool row is unrepresentable.
    stageSnapshot(withRow(2, { ...relation, claim_domain: 'zfs', claim_class: 'usedbydataset' }))
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('owns no shared class')
  })

  it('strictly decodes the megarepo-store domain and rejects classes outside its partition', async () => {
    const aggregate = currentWire().boundaries[0]!.facets[1]!
    stageSnapshot(
      withRow(1, {
        ...aggregate,
        claim_domain: 'megarepo-store',
        claim_class: 'owner-region-exclusive',
      }),
    )
    const snap = await Effect.runPromise(snapshot())
    expect(snap.boundaries[0]!.facets[1]).toMatchObject({
      claimDomain: 'megarepo-store',
      claimClass: 'owner-region-exclusive',
    })

    stageSnapshot(
      withRow(1, {
        ...aggregate,
        claim_domain: 'megarepo-store',
        claim_class: 'usedbydataset',
      }),
    )
    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('is not a class of that domain')
  })

  it('rejects duplicate identities in their producer-defined scopes', async () => {
    const duplicateBoundary = validWire()
    duplicateBoundary.boundaries.push({ ...duplicateBoundary.boundaries[1]! })
    stageSnapshot(JSON.stringify(duplicateBoundary))
    let err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.message).toContain("duplicate boundary id 'scratch'")

    const duplicateRow = validWire()
    duplicateRow.boundaries[0]!.facets[1]!.object_id =
      duplicateRow.boundaries[0]!.facets[0]!.object_id
    stageSnapshot(JSON.stringify(duplicateRow))
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.message).toContain("duplicate row object id 'nix-store' in boundary 'root'")

    const duplicatePool = currentWire()
    const rows = duplicatePool.boundaries[0]!.facets
    rows[1] = {
      ...rows[1]!,
      claim_class: 'cross-owner-shared',
      ownership: {
        kind: 'set-owned-pool',
        pool_id: 'pool-1',
        participants: [
          { owner_id: 'schickling', object_count: 12, participant_bytes: 100 },
          { owner_id: 'root', object_count: 12, participant_bytes: 100 },
        ],
      },
    }
    stageSnapshot(JSON.stringify(duplicatePool))
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.message).toContain("duplicate pool id 'pool-1' in boundary 'root'")
  })

  it('allows row and pool identities to repeat across different boundaries', async () => {
    const wire = currentWire()
    wire.boundaries.push({ ...wire.boundaries[0]!, id: 'scratch', mount_path: '/scratch' })
    stageSnapshot(JSON.stringify(wire))

    const snap = await Effect.runPromise(snapshot())
    expect(snap.boundaries).toHaveLength(2)
    expect(snap.boundaries[0]!.facets[2]!.ownership).toEqual(
      snap.boundaries[1]!.facets[2]!.ownership,
    )
  })

  it('rejects Rust u64 fields that cannot be represented exactly as nonnegative numbers', async () => {
    const invalidParticipantWire = currentWire()
    invalidParticipantWire.boundaries[0]!.facets[2]!.ownership = {
      kind: 'set-owned-pool',
      pool_id: 'pool-1',
      participants: [
        { owner_id: 'schickling', object_count: -1, participant_bytes: 100 },
        { owner_id: 'root', object_count: 12, participant_bytes: 100 },
      ],
    }
    const invalidWires = [
      { ...validWire(), generated_at_seconds: -1 },
      { ...validWire(), generated_at_seconds: 1.5 },
      { ...validWire(), generated_at_seconds: Number.MAX_SAFE_INTEGER + 1 },
      { ...validWire(), generated_at_seconds: 8_640_000_000_001 },
      {
        ...validWire(),
        last_complete_attempt: {
          ...validWire().last_complete_attempt!,
          finished_at_seconds: 8_640_000_000_001,
        },
      },
      {
        ...validWire(),
        facet_summaries: [
          {
            ...validWire().facet_summaries[0]!,
            duration_milliseconds: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
      },
      invalidParticipantWire,
    ]

    for (const wire of invalidWires) {
      stageSnapshot(JSON.stringify(wire))
      const err = await Effect.runPromise(Effect.flip(snapshot()))
      expect(err.reason).toBe('invalid')
      expect(err.message).toContain('decode')
    }
  })

  it('accepts every legal domain/class pair the collector can publish', async () => {
    const aggregate = currentWire().boundaries[0]!.facets[1]!
    const legal = [
      ['zfs', 'usedbydataset'],
      ['zfs', 'usedbysnapshots'],
      ['nix', 'rooted-exclusive'],
      ['nix', 'unreachable-exclusive'],
      ['nix', 'cross-path-shared'],
      ['nix', 'dedup-link-residue'],
      ['posix-subtree', 'owner-region-exclusive'],
      ['posix-subtree', 'cross-owner-shared'],
      ['megarepo-store', 'owner-region-exclusive'],
      ['megarepo-store', 'cross-owner-shared'],
    ] as const

    for (const [claim_domain, claim_class] of legal) {
      stageSnapshot(withRow(1, { ...aggregate, claim_domain, claim_class }))
      const snap = await Effect.runPromise(snapshot())
      const row = snap.boundaries[0]!.facets[1]!
      expect([row.claimDomain, row.claimClass]).toEqual([claim_domain, claim_class])
    }
  })

  it('decodes the superseded Nix class from the stored subject identity', async () => {
    const aggregate = currentWire().boundaries[0]!.facets[1]!
    for (const [subject, claimClass] of [
      ['persistent:gc-roots', 'rooted-exclusive'],
      ['unreachable', 'unreachable-exclusive'],
    ] as const) {
      stageSnapshot(
        withRow(1, {
          ...aggregate,
          object_id: `nix:/:${subject}#path-exclusive`,
          claim_domain: 'nix',
          claim_class: 'path-exclusive',
        }),
      )
      const row = (await Effect.runPromise(snapshot())).boundaries[0]!.facets[1]!
      expect([row.claimClass, row.objectId]).toEqual([claimClass, `nix:/:${subject}#${claimClass}`])
    }
  })

  it('drops a zero-byte retired ZFS reservation row and rejects a non-zero one', async () => {
    const wire = currentWire()
    const boundary = wire.boundaries[0]!
    const withRetired = (allocated_bytes: number) =>
      JSON.stringify({
        ...wire,
        boundaries: [
          {
            ...boundary,
            facets: [
              ...boundary.facets,
              {
                ...boundary.facets[1]!,
                object_id: 'zfs:tank:tank/data#usedbyrefreservation',
                claim_domain: 'zfs',
                claim_class: 'usedbyrefreservation',
                allocated_bytes,
              },
            ],
          },
          ...wire.boundaries.slice(1),
        ],
      })

    stageSnapshot(withRetired(0))
    const snap = await Effect.runPromise(snapshot())
    expect(snap.boundaries[0]!.facets.length).toBe(boundary.facets.length)

    stageSnapshot(withRetired(7))
    const err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
  })

  it('lists declared hosts and never accepts a URL in place of a host key', async () => {
    expect(
      await Effect.runPromise(diskIndexProvider.core.hosts().pipe(Effect.provide(fixtureLayer))),
    ).toEqual(['dev3'])

    const error = await Effect.runPromise(
      Effect.flip(
        diskIndexProvider.core
          .snapshot({ host: 'http://100.124.157.2:41032' as never })
          .pipe(Effect.provide(fixtureLayer)),
      ),
    )
    expect(error.reason).toBe('unknown-host')
  })

  it('applies the claim-scope byte rules to a set-owned pool row instead of exempting it', async () => {
    const pool = currentWire().boundaries[0]!.facets[2]!
    // A native aggregate never samples a logical size, and a pool row is no
    // exception: `model.rs` rejects this snapshot, so this seam must too.
    stageSnapshot(withRow(2, { ...pool, claim_scope: 'native-aggregate', apparent_bytes: 120 }))
    let err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('bytes inconsistent with status')

    // An observed physical-identity row must carry BOTH byte quantities.
    stageSnapshot(
      withRow(2, {
        ...pool,
        claim_scope: 'physical-identity',
        claim_domain: '',
        claim_class: '',
      }),
    )
    err = await Effect.runPromise(Effect.flip(snapshot()))
    expect(err.reason).toBe('invalid')
    expect(err.message).toContain('bytes inconsistent with status')

    // The pool row as PUBLISHED (exclusive aggregate, allocated, no apparent
    // size) still passes: the pool additions are on top of the scope rule.
    stageSnapshot(JSON.stringify(currentWire()))
    const snap = await Effect.runPromise(snapshot())
    expect(snap.boundaries[0]!.facets[2]!.allocatedBytes).toBe(100)
  })

  it('calls a document with no numeric schema_version invalid, not unsupported-schema', async () => {
    // `unsupported-schema` states a real fact — the collector is newer than this
    // build. A truncated, empty or wrong file must not send the operator after a
    // version skew that does not exist.
    for (const body of ['{}', JSON.stringify({ schema_version: '1' }), JSON.stringify(null)]) {
      stageSnapshot(body)
      const err = await Effect.runPromise(Effect.flip(snapshot()))
      expect(err.reason).toBe('invalid')
      expect(err.message).toContain('declares no numeric schema_version')
    }

    // A NUMBER this build cannot read keeps the version-skew reason.
    stageSnapshot(JSON.stringify({ schema_version: 4 }))
    const skew = await Effect.runPromise(Effect.flip(snapshot()))
    expect(skew.reason).toBe('unsupported-schema')
    expect(skew.message).toContain('declares schema_version 4')
  })
})
