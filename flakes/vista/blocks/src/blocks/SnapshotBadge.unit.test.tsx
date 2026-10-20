import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SnapshotBadge } from './SnapshotBadge.tsx'

afterEach(() => vi.useRealTimers())

describe('SnapshotBadge freshness', () => {
  it('reports relative live age and retained degraded age through the shared badge', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-22T12:00:30Z'))

    const live = renderToStaticMarkup(<SnapshotBadge mode="live" asOf="2026-09-22T12:00:20Z" />)
    const degraded = renderToStaticMarkup(
      <SnapshotBadge mode="degraded" asOf="2026-09-22T12:00:00Z" />,
    )

    expect(live).toContain('LIVE · 10 s ago')
    expect(degraded).toContain('DEGRADED · 30 s ago')
    expect(degraded).toContain('data-vista-badge="degraded"')
  })
})
