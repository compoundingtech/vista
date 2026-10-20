import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { Effect, Schema } from 'effect'

import { encodeOwner, TrailEntry } from '@vista/service/control'
/**
 * CLI-side authoring journal (decisions q12–q14): every `new`, `check`, and
 * `publish` invocation appends one entry to a per-app JSONL file under
 * XDG state. `publish` ships recent entries along with the RPC and the
 * service embeds them as the trail — zero author action, zero new commands.
 *
 * Everything here is fail-open by contract (q14): a journal problem never
 * blocks authoring. Strictness lives at capture time on the service.
 */

/** Entries the journal keeps per app before trimming on write. */
export const JOURNAL_KEEP = 100
/** Entries `publish` ships with the RPC. */
export const SHIP_LIMIT = 30

/** One recorded authoring invocation. */
export interface TrailJournalEntry {
  readonly command: string
  readonly slug: string
  readonly version?: number | undefined
  readonly timestamp: string
  readonly exit: number
  readonly durationMs: number
  readonly message?: string | undefined
}

/** Journal root: explicit override, then `VISTA_TRAIL_DIR`, then XDG state. */
export const trailStateDir = (explicit?: string | undefined): string =>
  explicit ??
  process.env.VISTA_TRAIL_DIR ??
  join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'vista', 'trail')

/** Journal file for one app. Throws on an unencodable owner (caller swallows). */
export const journalPath = (stateDir: string, owner: string, slug: string): string =>
  join(stateDir, encodeOwner(owner), `${slug}.jsonl`)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Tolerant read: missing file reads empty, corrupt lines are skipped. */
export const readJournalEntries = (
  stateDir: string,
  owner: string,
  slug: string,
): ReadonlyArray<TrailJournalEntry> => {
  let raw: string
  try {
    raw = readFileSync(journalPath(stateDir, owner, slug), 'utf8')
  } catch {
    return []
  }
  const entries: TrailJournalEntry[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    try {
      const value: unknown = JSON.parse(trimmed)
      if (!isRecord(value)) continue
      const { command, slug: entrySlug, timestamp, exit, durationMs } = value
      if (
        typeof command !== 'string' ||
        command === '' ||
        typeof entrySlug !== 'string' ||
        typeof timestamp !== 'string' ||
        typeof exit !== 'number' ||
        typeof durationMs !== 'number'
      ) {
        continue
      }
      const entry: TrailJournalEntry = {
        command,
        slug: entrySlug,
        timestamp,
        exit,
        durationMs,
        ...(typeof value['version'] === 'number' ? { version: value['version'] } : {}),
        ...(typeof value['message'] === 'string' ? { message: value['message'] } : {}),
      }
      entries.push(entry)
    } catch {
      continue
    }
  }
  return entries
}

/** Best-effort append plus trim; never throws. */
export const appendJournalEntry = (
  stateDir: string,
  owner: string,
  entry: TrailJournalEntry,
): void => {
  try {
    const path = journalPath(stateDir, owner, entry.slug)
    mkdirSync(join(stateDir, encodeOwner(owner)), { recursive: true })
    const kept = [...readJournalEntries(stateDir, owner, entry.slug), entry].slice(-JOURNAL_KEEP)
    writeFileSync(path, `${kept.map((item) => JSON.stringify(item)).join('\n')}\n`)
  } catch {
    return
  }
}

/** Recent entries for shipping, oldest first. Never throws. */
export const recentJournalEntries = (
  stateDir: string,
  owner: string,
  slug: string,
  limit: number = SHIP_LIMIT,
): ReadonlyArray<TrailJournalEntry> => {
  try {
    return readJournalEntries(stateDir, owner, slug).slice(-limit)
  } catch {
    return []
  }
}


/**
 * Narrow tolerant journal records onto the branded RPC type, dropping what
 * does not validate. The wire re-validates, but a corrupt local line must
 * never fail a publish (q14 fail-open journal).
 */
export const toShippedEntries = (entries: readonly TrailJournalEntry[]): TrailEntry[] => {
  const shipped: TrailEntry[] = []
  for (const entry of entries) {
    try {
      shipped.push(Schema.decodeSync(TrailEntry)(entry))
    } catch {
      continue
    }
  }
  return shipped
}
/**
 * Time an effect, journal the outcome, and re-emit it unchanged. The journal
 * write cannot fail the wrapped effect: recording is inside the success path
 * and every filesystem touch swallows.
 */
export const withTrailEntry = <A, E, R>(
  journal: {
    readonly stateDir?: string | undefined
    readonly owner: string | undefined
    readonly slug: string
    readonly command: string
    readonly message?: string | undefined
  },
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const started = Date.now()
    const exit = yield* Effect.exit(effect)
    if (journal.owner !== undefined) {
      const owner: string = journal.owner
      const stateDir = trailStateDir(journal.stateDir)
      const timestamp = new Date(started).toISOString()
      const durationMs = Date.now() - started
      yield* Effect.sync(() =>
        appendJournalEntry(stateDir, owner, {
          command: journal.command,
          slug: journal.slug,
          timestamp,
          exit: exit._tag === 'Success' ? 0 : 1,
          durationMs,
          ...(journal.message === undefined ? {} : { message: journal.message }),
        }),
      )
    }
    if (exit._tag === 'Failure') return yield* Effect.failCause(exit.cause)
    return exit.value
  })
