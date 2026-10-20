import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AppRoot, extractSemanticManifest } from '../../authoring.tsx'
import * as semanticOnly from '../../internal-authoring.ts'
import { ChoiceCards, CopyOutcome } from './ChoiceCards.tsx'
import { ContextHeader } from './ContextHeader.tsx'
import { SIZE, layoutMission } from './MissionGraph.tsx'
import { Note } from './Note.tsx'
import { ProgressLanes } from './ProgressLanes.tsx'
import { RankedFindings } from './RankedFindings.tsx'
import { durationScale, formatDuration, prefersLogScale } from './scale.ts'
import { TimeTrack } from './TimeTrack.tsx'

describe('duration scale', () => {
  it('formats durations the way a reader compares them', () => {
    expect([29.5, 93.113, 412.4, 3889.781, 10_700].map(formatDuration)).toEqual([
      '29.5 ms',
      '93.1 ms',
      '412 ms',
      '3.89 s',
      '10.7 s',
    ])
  })

  it('spans whole decades on a log axis and stays proportional on a linear one', () => {
    const log = durationScale([29.5, 3796, 8192], true)
    expect(log.ticks.map((tick) => tick.label)).toEqual(['10 ms', '100 ms', '1 s', '10 s'])
    expect(log.position(1000)).toBeCloseTo(2 / 3)
    expect(durationScale([93, 3890], false).position(93)).toBeCloseTo(93 / 3890)
  })

  it('prefers log only when values are two or more decades apart', () => {
    expect(prefersLogScale([29.5, 8192])).toBe(true)
    expect(prefersLogScale([93, 3890])).toBe(false)
  })
})

describe('RankedFindings', () => {
  const html = renderToStaticMarkup(
    <RankedFindings
      findings={[
        { title: 'Sidebar filter', gap: 29.5, proof: 'p50 of 10 inputs each' },
        { title: 'Session inventory', gap: 8192, next: 'Trace one inventory read · ½ day' },
        { title: 'SSH relay', gap: 3797, proof: 'n=3 per path', start: true },
        { title: 'Host admission' },
      ]}
    />,
  )

  it('ranks by measured gap with unquantified findings last', () => {
    const order = ['Session inventory', 'SSH relay', 'Sidebar filter', 'Host admission'].map(
      (title) => html.indexOf(title),
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('renders a finding as proven only when proof is given, else a hypothesis with its next experiment', () => {
    expect(html).toContain('Measured gap 3.80 s, proven')
    expect(html).toContain('Measured gap 8.19 s, not proven')
    expect(html).toContain('Next: Trace one inventory read · ½ day')
    expect(html).toContain('Start here')
    expect(html).toContain('Not quantified')
  })
})

describe('ContextHeader', () => {
  it('says no action is needed when the reader has no ask', () => {
    const html = renderToStaticMarkup(<ContextHeader what="Fractal slowness" why="55 s load" />)
    expect(html).toContain('No action needed')
  })

  it('shows the verdict after the context', () => {
    const html = renderToStaticMarkup(
      <ContextHeader
        what="Fractal slowness"
        why="55 s load"
        you="Pick a fix"
        verdict="Relay first"
      />,
    )
    expect(html.indexOf('Pick a fix')).toBeLessThan(html.indexOf('Relay first'))
  })
})

describe('TimeTrack', () => {
  it('names every duration for assistive technology', () => {
    const html = renderToStaticMarkup(
      <TimeTrack
        rows={[
          { label: 'SSH relay', ms: 3889.781 },
          { label: 'Direct', ms: 93.113 },
        ]}
      />,
    )
    expect(html).toContain('aria-label="SSH relay 3.89 s, Direct 93.1 ms"')
  })

  it('chooses the log axis for wide spreads without an author setting', () => {
    const html = renderToStaticMarkup(
      <TimeTrack
        rows={[
          { label: 'Inventory', ms: 8192 },
          { label: 'Keystroke', ms: 29.5 },
        ]}
      />,
    )
    expect(html).toContain('10 ms')
    expect(html).toContain('100 ms')
    expect(html).toContain('10 s')
  })
})

describe('ChoiceCards', () => {
  const options = [
    { id: 'accept', label: 'Accept thresholds', recommended: true, cost: '≤ $215' },
    { id: 'revisit', label: 'Revisit thresholds' },
  ]

  it('announces successful copies and only then marks the ask answered', () => {
    const html = renderToStaticMarkup(<CopyOutcome state="copied" />)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Copied')
    expect(html).toContain('data-vista-answered=""')
  })

  it('announces failed copies without completing the ask', () => {
    const html = renderToStaticMarkup(<CopyOutcome state="manual" />)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Copy failed')
    expect(html).not.toContain('data-vista-answered')
  })

  it('keeps a live region mounted before either copy action resolves', () => {
    for (const multiple of [false, true]) {
      const html = renderToStaticMarkup(
        <AppRoot title="Thresholds" template="options-comparison" scope="test">
          <ChoiceCards id="thresholds" options={options} multiple={multiple} />
        </AppRoot>,
      )
      expect(html).toContain('aria-live="polite"')
      expect(html).not.toContain('data-vista-answered')
    }
  })

  it('registers an ask in the client and the node-safe evaluator alike', () => {
    const client = extractSemanticManifest(
      <AppRoot title="Thresholds" template="options-comparison" scope="test">
        <ChoiceCards id="thresholds" label="Hypo thresholds" options={options} />
      </AppRoot>,
    )
    const evaluator = extractSemanticManifest(
      <AppRoot title="Thresholds" template="options-comparison" scope="test">
        <semanticOnly.ChoiceCards id="thresholds" label="Hypo thresholds" options={options} />
      </AppRoot>,
    )
    expect(client.nodes).toEqual(evaluator.nodes)
    expect(client.nodes.find((node) => node.id === 'thresholds')).toMatchObject({
      kind: 'ask',
      label: 'Hypo thresholds',
    })
  })

  it('starts unselected and unanswered, with the recommendation as a quiet mark', () => {
    const html = renderToStaticMarkup(
      <AppRoot title="Thresholds" template="options-comparison" scope="test">
        <ChoiceCards id="thresholds" options={options} />
      </AppRoot>,
    )
    expect(html).toContain('Recommended')
    expect(html).not.toContain('data-vista-answered')
    expect(html).not.toContain('checked=""')
  })
})

describe('MissionGraph layout', () => {
  const steps = [
    { id: 'freeze', assignedTo: 'agent/x/owner', dependsOn: null },
    { id: 'build', assignedTo: 'agent/x/owner', dependsOn: { step: 'freeze', state: 'completed' } },
    {
      id: 'deploy',
      assignedTo: 'agent/x/deployer',
      dependsOn: { step: 'build', state: 'completed' },
    },
  ]
  const overlay = {
    gates: [{ id: 'approve', lane: 'human/you', at: 'deploy', label: 'Approve', to: 'deploy' }],
  }

  it('ranks steps by their dependency path and puts human lanes first', () => {
    const layout = layoutMission(steps, overlay, 'LR')
    expect(layout.lanes.map((lane) => [lane.id, lane.label])).toEqual([
      ['human/you', 'you'],
      ['agent/x/owner', 'owner'],
      ['agent/x/deployer', 'deployer'],
    ])
    expect(layout.nodes.map((node) => [node.id, node.rank])).toEqual([
      ['freeze', 0],
      ['build', 1],
      ['deploy', 2],
      ['approve', 2],
    ])
  })

  it('marks cross-lane dependencies as handoffs and gates as their own edge kind', () => {
    const kinds = layoutMission(steps, overlay, 'LR').edges.map((edge) => [
      edge.id,
      edge.kind,
      edge.sides,
    ])
    expect(kinds).toEqual([
      ['freeze->build', 'depends', ['r', 'l']],
      ['build->deploy', 'handoff', ['r', 'l']],
      ['approve->deploy', 'gate', ['b', 't']],
    ])
  })

  it('is deterministic and swaps axes between directions', () => {
    const wide = layoutMission(steps, overlay, 'LR')
    expect(layoutMission(steps, overlay, 'LR')).toEqual(wide)
    const tall = layoutMission(steps, overlay, 'TB')
    expect(tall.nodes[0]!.cy).toBeLessThan(tall.nodes[1]!.cy)
    expect(wide.nodes[0]!.cx).toBeLessThan(wide.nodes[1]!.cx)
  })

  it('keeps every node inside its lane when lanes stack top to bottom', () => {
    const agentGate = {
      id: 'handoff',
      lane: 'agent/x/deployer',
      at: 'deploy',
      label: 'Accepts handoff',
      actor: 'agent' as const,
    }
    const tall = layoutMission(steps, { gates: [...overlay.gates, agentGate] }, 'TB')
    for (const node of tall.nodes) {
      const lane = tall.lanes.find((candidate) => candidate.id === node.lane)!
      const half = SIZE[node.kind].w / 2
      expect(node.cx - half).toBeGreaterThan(lane.x)
      expect(node.cx + half).toBeLessThan(lane.x + lane.w)
    }
  })

  it.each(['LR', 'TB'] as const)(
    'packs parallel steps and gates without collisions in %s',
    (direction) => {
      const parallel = [
        { id: 'b', assignedTo: 'agent/x', label: 'Second' },
        { id: 'a', assignedTo: 'agent/x', label: 'First' },
        { id: 'c', assignedTo: 'agent/x', dependsOn: { step: 'a', state: 'completed' } },
      ]
      const gates = [
        { id: 'g2', lane: 'agent/x', at: 'a', label: 'Gate two' },
        { id: 'g1', lane: 'agent/x', at: 'a', label: 'Gate one' },
      ]
      const layout = layoutMission(parallel, { gates }, direction)
      const reversed = layoutMission(
        parallel.toReversed(),
        { gates: gates.toReversed() },
        direction,
      )
      for (const node of layout.nodes) {
        const other = reversed.nodes.find((candidate) => candidate.id === node.id)!
        expect([node.cx, node.cy]).toEqual([other.cx, other.cy])
        const lane = layout.lanes.find((candidate) => candidate.id === node.lane)!
        const size = SIZE[node.kind]
        expect(node.cx - size.w / 2).toBeGreaterThanOrEqual(lane.x)
        expect(node.cx + size.w / 2).toBeLessThanOrEqual(lane.x + lane.w)
        expect(node.cy - size.h / 2).toBeGreaterThanOrEqual(lane.y)
        expect(node.cy + size.h / 2).toBeLessThanOrEqual(lane.y + lane.h)
      }
      for (let i = 0; i < layout.nodes.length; i++) {
        for (const b of layout.nodes.slice(i + 1)) {
          const a = layout.nodes[i]!
          const separated =
            Math.abs(a.cx - b.cx) >= (SIZE[a.kind].w + SIZE[b.kind].w) / 2 ||
            Math.abs(a.cy - b.cy) >= (SIZE[a.kind].h + SIZE[b.kind].h) / 2
          expect(separated, `${a.id} overlaps ${b.id}`).toBe(true)
        }
      }
    },
  )

  it('rejects dependency cycles', () => {
    expect(() =>
      layoutMission(
        [
          { id: 'a', assignedTo: 'agent/x', dependsOn: { step: 'b', state: 'completed' } },
          { id: 'b', assignedTo: 'agent/x', dependsOn: { step: 'a', state: 'completed' } },
        ],
        undefined,
        'LR',
      ),
    ).toThrow('dependsOn cycle')
  })
})

describe('ProgressLanes', () => {
  it('names each lane state and gives the waiting lane the you tone', () => {
    const html = renderToStaticMarkup(
      <ProgressLanes
        lanes={[
          { label: 'Mission', state: 'you', detail: 'Ready to publish' },
          { label: 'Serving', state: 'done', detail: 'Tunnel up' },
        ]}
      />,
    )
    expect(html).toContain('aria-label="Waiting on you"')
    expect(html).toContain('aria-label="Done"')
    expect(html).toContain('data-state="you"')
  })
})

describe('Note', () => {
  it('renders only its children outside a shell, in the client and the evaluator', () => {
    const client = renderToStaticMarkup(
      <Note text="Means held">
        <span>Held</span>
      </Note>,
    )
    expect(client).toContain('<span>Held</span>')
    expect(client).not.toContain('Means held')
    const evaluator = renderToStaticMarkup(
      <semanticOnly.Note text="Means held">
        <span>Held</span>
      </semanticOnly.Note>,
    )
    expect(evaluator).toBe('<span>Held</span>')
  })
})
