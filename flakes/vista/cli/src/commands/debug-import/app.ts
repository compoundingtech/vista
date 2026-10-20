/** `vista debug import` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { ImportDiagnosticState, importDiagnosticInitial } from './schema.ts'

/**
 * Display app for the import diagnostic command that mounts importInitial state with its schema
 * for the diagnostic screen.
 */
export const ImportDiagnosticApp = makeDisplayApp({
  stateSchema: ImportDiagnosticState,
  initial: importDiagnosticInitial,
})
