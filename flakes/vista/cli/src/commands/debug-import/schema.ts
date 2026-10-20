/**
 * `vista debug import` output state (decision 0063 / AGT.CLI-R68): the
 * classification of a client import specifier against the runtime policy. The
 * state IS the machine-output wire schema (`ImportDiagnosticInfo`), so
 * `--output json` stays byte-identical.
 */
import { ImportDiagnosticInfo } from '@vista/service/control'

/** The `vista debug import` machine-output schema (the `--output json` wire anchor). */
export const ImportDiagnosticState = ImportDiagnosticInfo

export type ImportDiagnosticStateType = typeof ImportDiagnosticState.Type

/** Pre-fetch placeholder (never rendered: fetch precedes render). */
export const importDiagnosticInitial: ImportDiagnosticStateType = {
  specifier: 'x',
  allowed: true,
  classification: { _tag: 'local', specifier: 'x', reason: '' },
  message: '',
  guidance: '',
}
