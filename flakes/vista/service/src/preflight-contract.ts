import { Schema } from 'effect'

import { NonNegativeInt } from './api-version.ts'

const NonEmptyTrimmedString = Schema.NonEmptyString.pipe(Schema.check(Schema.isTrimmed()))

/**
 * Schema and inferred type for a single preflight diagnostic, categorizing it as source, import,
 * evaluation, or data and pairing a message with its downstream consequences.
 */
export const VistaCheckDiagnostic = Schema.Struct({
  code: Schema.Literals(['source', 'import', 'evaluation', 'data']),
  message: NonEmptyTrimmedString,
  consequences: Schema.Array(NonEmptyTrimmedString),
}).annotate({ identifier: 'Vista.CheckDiagnostic' })
export type VistaCheckDiagnostic = typeof VistaCheckDiagnostic.Type

/** Advisory authoring feedback; warnings do not change a ready report or block publication. */
export const VistaCheckWarning = Schema.Struct({
  code: Schema.Literals(['scaffold-slots']),
  message: NonEmptyTrimmedString,
}).annotate({ identifier: 'Vista.CheckWarning' })
export type VistaCheckWarning = typeof VistaCheckWarning.Type

/**
 * Tagged 'ready' schema recording a passed preflight check: the app's path, title, and
 * non-negative counts of semantic nodes and data requests.
 */
export const VistaCheckReady = Schema.TaggedStruct('ready', {
  path: NonEmptyTrimmedString,
  title: NonEmptyTrimmedString,
  semanticNodes: NonNegativeInt,
  dataRequests: NonNegativeInt,
  warnings: Schema.Array(VistaCheckWarning),
}).annotate({ identifier: 'Vista.CheckReady' })
export type VistaCheckReady = typeof VistaCheckReady.Type

/**
 * Tagged 'failed' schema pairing the checked file path with the single diagnostic that caused the
 * preflight check to fail.
 */
export const VistaCheckFailed = Schema.TaggedStruct('failed', {
  path: NonEmptyTrimmedString,
  diagnostic: VistaCheckDiagnostic,
}).annotate({ identifier: 'Vista.CheckFailed' })
export type VistaCheckFailed = typeof VistaCheckFailed.Type

/**
 * Union schema and type of the ready and failed check reports, representing the complete outcome
 * of preflighting one app.
 */
export const VistaCheckResult = Schema.Union([VistaCheckReady, VistaCheckFailed]).annotate({
  identifier: 'Vista.CheckResult',
})
export type VistaCheckResult = typeof VistaCheckResult.Type
