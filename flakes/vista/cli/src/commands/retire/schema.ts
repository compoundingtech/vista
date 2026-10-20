/**
 * `vista retire` output state (decision 0063 / AGT.CLI-R68): the retire-ok
 * payload. The state IS the machine-output wire schema (`RetireOk` — the exact
 * struct the pre-tui-react `--json` branch encoded), so `--output json` stays
 * byte-identical.
 */
import { RetireOk } from '@vista/service/control'

/** The `vista retire` machine-output schema (the `--output json` wire anchor). */
export const RetireState = RetireOk

export type RetireStateType = typeof RetireState.Type

/** Pre-fetch placeholder (never rendered: fetch precedes render). */
export const retireInitial: RetireStateType = {
  owner: 'dev3.placeholder',
  slug: '',
}
