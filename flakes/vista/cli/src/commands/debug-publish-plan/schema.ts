/**
 * `vista debug publish-plan` output state (decision 0063 / AGT.CLI-R68): the
 * publish preflight state. The state IS the machine-output wire schema
 * (`PublishPlan`), so `--output json` stays byte-identical.
 */
import { PublishPlan } from '@vista/service/control'

/** The `vista debug publish-plan` machine-output schema (the `--output json` wire anchor). */
export const PublishPlanState = PublishPlan

export type PublishPlanStateType = typeof PublishPlanState.Type

/** Pre-fetch placeholder (never rendered: fetch precedes render). */
export const publishPlanInitial: PublishPlanStateType = {
  owner: 'dev3.placeholder',
  slug: '',
  draftExists: false,
  publishable: false,
  latest: null,
  nextVersion: null,
  source: { appTsx: false },
  freeze: {
    total: 0,
    frozen: 0,
    live: 0,
    subscription: 0,
    effectfulAcknowledged: 0,
    unresolved: 0,
    blocks: [],
  },
  providers: { mounted: [], missing: [] },
  problems: [],
}
