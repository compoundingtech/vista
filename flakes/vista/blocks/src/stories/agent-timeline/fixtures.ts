import { Schema } from 'effect'

import {
  AgentTimelineModelSchema,
  type AgentTimelineHorizon,
  type AgentTimelineModel,
} from '@overeng/agent-timeline/model'

import oneDayJson from './1d.json' with { type: 'json' }
import oneHourJson from './1h.json' with { type: 'json' }
import sevenDaysJson from './7d.json' with { type: 'json' }

const decode = Schema.decodeUnknownSync(AgentTimelineModelSchema, { onExcessProperty: 'error' })
const oneHour = decode(oneHourJson)
const oneDay = decode(oneDayJson)
const sevenDays = decode(sevenDaysJson)

/** Synthetic ledger fixtures: neutral identities and tasks, representative timing and load. */
export const agentTimelineFixtures: Record<AgentTimelineHorizon, AgentTimelineModel> = {
  '1h': oneHour,
  '1d': oneDay,
  '7d': sevenDays,
}
