import { mountProvider } from '@vista/data/provider'
import {
  diskIndexImplementation,
  makeDiskIndexFixtureLayer,
} from '@vista/data/providers/disk-index.provider'

/**
 * Well-known symbol on globalThis used as a counter key so tests can count invocations of the
 * review disk-index provider.
 */
export const reviewDiskCalls = Symbol.for('vista.samples.review.diskCalls')

const snapshot = JSON.stringify({
  schema_version: 1,
  snapshot_id: 'review-snapshot',
  generated_at_seconds: 1_756_700_000,
  health: { status: 'complete', complete: true, errors: [] },
  boundaries: [
    {
      id: 'bulk',
      kind: 'disk',
      mount_path: '/srv/bulk',
      filesystem: 'ext4',
      total_bytes: 1_000,
      used_bytes: 600,
      available_bytes: 400,
      reserved_bytes: 0,
      classified_bytes: 500,
      residual_bytes: 100,
      shared_bytes: 0,
      residual_reason: 'unclassified',
      facets: [
        {
          object_id: 'vista-cache',
          allocated_bytes: 500,
          apparent_bytes: 500,
          path_aliases: ['/srv/bulk/vista'],
          producer_tool: 'vista',
          artifact_role: 'cache',
          workspace: 'dotfiles',
          service_owner: 'vista',
          sharing: 'exclusive',
          freshness: 'fresh',
          status: 'observed',
          claim_scope: 'physical-identity',
          claim_domain: '',
          claim_class: '',
          ownership: { kind: 'profile-owner', profile_owner: 'schickling' },
        },
      ],
    },
  ],
  facet_summaries: [],
  refresh_attempts: [
    {
      id: 'review-refresh',
      started_at_seconds: 1_756_699_000,
      finished_at_seconds: 1_756_700_000,
      status: 'complete',
      errors: [],
    },
  ],
  last_complete_attempt: {
    id: 'review-refresh',
    started_at_seconds: 1_756_699_000,
    finished_at_seconds: 1_756_700_000,
    status: 'complete',
    errors: [],
  },
})

const layer = makeDiskIndexFixtureLayer(snapshot, () => {
  const previous = Reflect.get(globalThis, reviewDiskCalls)
  Reflect.set(globalThis, reviewDiskCalls, typeof previous === 'number' ? previous + 1 : 1)
})

export default mountProvider(diskIndexImplementation, layer)
