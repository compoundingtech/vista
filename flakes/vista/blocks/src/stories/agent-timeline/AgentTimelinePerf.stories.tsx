import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { Schema } from 'effect'
import * as React from 'react'

import { AgentTimelineModelSchema, type AgentTimelineModel } from '@overeng/agent-timeline/model'
import { projectAgentTimeline } from '@overeng/agent-timeline/projection'

import { AgentTimeline } from '../../blocks/agent-timeline/AgentTimeline.tsx'
import perf128Json from './perf-128.json' with { type: 'json' }
import perf512Json from './perf-512.json' with { type: 'json' }

const decode = Schema.decodeUnknownSync(AgentTimelineModelSchema)
const REFRESH_SHIFT_MS = 60_000

/** Neutralized 7d captures of the same 9-root actor selection at both actor-filter session caps. */
const perfModels = { 128: decode(perf128Json), 512: decode(perf512Json) } as const

/** Live refresh: the same selection one refresh later, as a new scene object. */
const PerfHarness = ({ model }: { readonly model: AgentTimelineModel }) => {
  const [refreshes, setRefreshes] = React.useState(0)
  const scene = React.useMemo(() => {
    const shift = refreshes * REFRESH_SHIFT_MS
    return projectAgentTimeline({
      ...model,
      windowStart: model.windowStart + shift,
      windowEnd: model.windowEnd + shift,
    })
  }, [model, refreshes])
  return (
    <div {...stylex.props(styles.frame)}>
      <button type="button" onClick={() => setRefreshes((count) => count + 1)}>
        Simulate live refresh ({refreshes})
      </button>
      <AgentTimeline scene={scene} style={styles.trace} />
    </div>
  )
}

const meta = {
  title: 'Vista/Blocks/Agents/Agent Timeline/Performance',
  component: PerfHarness,
  args: { model: perfModels[128] },
  argTypes: { model: { control: false } },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PerfHarness>

export default meta
type Story = StoryObj<typeof meta>

/** The actor-filtered selection at the 128-session cap. */
export const Sessions128: Story = { args: { model: perfModels[128] } }

/** The same selection at the 512-session cap. */
export const Sessions512: Story = { args: { model: perfModels[512] } }

const styles = stylex.create({
  frame: {
    display: 'flex',
    flexDirection: 'column',
    width: '100vw',
    height: '100vh',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  trace: {
    flex: 1,
    minHeight: 0,
  },
})
