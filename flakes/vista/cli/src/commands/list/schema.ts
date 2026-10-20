/**
 * `vista list` output state (decision 0063 / AGT.CLI-R68).
 *
 * The state IS the machine-output wire schema: an array of `AppRow` — the exact
 * shape the pre-tui-react `--json` branch encoded (`Schema.Array(AppRow)`). The
 * view derives its active/retired split and counts from this at render time, so
 * `--output json` stays byte-identical to the historical contract.
 */
import { AppRow } from '@vista/service/control'
import { Schema } from 'effect'

/** The `vista list` machine-output schema (the `--output json` wire anchor). */
export const ListState = Schema.Array(AppRow)

export type ListStateType = typeof ListState.Type

/** Pre-fetch / empty state: no apps. */
export const listInitial: ListStateType = []
