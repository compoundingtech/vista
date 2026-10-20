/**
 * `vista open` output state (decision 0063 / AGT.CLI-R68): the canonical-URL
 * payload. The state IS the machine-output wire schema (the exact struct the
 * pre-tui-react `--json` branch encoded), so `--output json` stays byte-identical.
 */
import { Schema } from 'effect'
const NonEmptyTrimmedString = Schema.NonEmptyString.pipe(Schema.check(Schema.isTrimmed()))

/**
 * Validates the open command's state, pairing app slug, version, and resolved URL with a canonical
 * flag that is false for loopback URLs emitted only under --local/env and must not be treated as
 * shareable cross-host links.
 */
export const OpenState = Schema.Struct({
  slug: NonEmptyTrimmedString,
  version: Schema.String,
  url: Schema.String,
  // `false` marks a non-canonical loopback URL (emitted only under --local/env);
  // agents must not treat such a URL as a shareable cross-host link (SVC-R55).
  canonical: Schema.Boolean,
})

export type OpenStateType = typeof OpenState.Type

/** Pre-fetch placeholder (never rendered: fetch precedes render). */
export const openInitial: OpenStateType = { slug: '', version: '', url: '', canonical: true }
