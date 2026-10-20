import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  appendJournalEntry,
  journalPath,
  JOURNAL_KEEP,
  readJournalEntries,
  recentJournalEntries,
  SHIP_LIMIT,
  toShippedEntries,
  type TrailJournalEntry,
} from '../src/trail-journal.ts'

const OWNER = 'vista.tests'
const SLUG = 'demo'

const setup = () => mkdtempSync(join(tmpdir(), 'vista-trail-'))

const entry = (overrides: Partial<TrailJournalEntry> = {}): TrailJournalEntry => ({
  command: 'check',
  slug: SLUG,
  timestamp: new Date(0).toISOString(),
  exit: 0,
  durationMs: 12,
  ...overrides,
})

describe('trail journal', () => {
  it('appends and reads entries oldest-first', () => {
    const dir = setup()
    try {
      appendJournalEntry(dir, OWNER, entry({ command: 'check' }))
      appendJournalEntry(dir, OWNER, entry({ command: 'publish', version: 3, message: 'v3' }))
      expect(readJournalEntries(dir, OWNER, SLUG).map((item) => item.command)).toEqual([
        'check',
        'publish',
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reads empty on a missing journal', () => {
    expect(readJournalEntries(setup(), OWNER, 'absent')).toEqual([])
  })

  it('skips corrupt lines without losing the rest', () => {
    const dir = setup()
    try {
      mkdirSync(dirname(journalPath(dir, OWNER, SLUG)), { recursive: true })
      writeFileSync(
        journalPath(dir, OWNER, SLUG),
        ['{not json', JSON.stringify(entry({ command: 'kept' })), '[1,2]', ''].join('\n'),
      )
      expect(readJournalEntries(dir, OWNER, SLUG).map((item) => item.command)).toEqual(['kept'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('trims to the newest entries on write', () => {
    const dir = setup()
    try {
      for (let index = 0; index < JOURNAL_KEEP + 10; index++) {
        appendJournalEntry(dir, OWNER, entry({ command: `run-${index}` }))
      }
      const entries = readJournalEntries(dir, OWNER, SLUG)
      expect(entries).toHaveLength(JOURNAL_KEEP)
      expect(entries[0]?.command).toBe('run-10')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ships at most the ship limit, oldest first', () => {
    const dir = setup()
    try {
      for (let index = 0; index < SHIP_LIMIT + 5; index++) {
        appendJournalEntry(dir, OWNER, entry({ command: `run-${index}` }))
      }
      const shipped = recentJournalEntries(dir, OWNER, SLUG)
      expect(shipped).toHaveLength(SHIP_LIMIT)
      expect(shipped[0]?.command).toBe('run-5')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('never throws on an unencodable owner or a non-directory root', () => {
    const dir = setup()
    try {
      // A regular file fails with ENOTDIR, unlike recursive mkdir on Linux procfs,
      // which can retry ENOENT indefinitely inside Node's native implementation.
      const nonDirectory = join(dir, 'not-a-directory')
      writeFileSync(nonDirectory, '')
      expect(() => appendJournalEntry(dir, '..', entry())).not.toThrow()
      expect(() => appendJournalEntry(nonDirectory, OWNER, entry())).not.toThrow()
      expect(readJournalEntries(nonDirectory, OWNER, SLUG)).toEqual([])
      expect(readJournalEntries(dir, '..', SLUG)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('narrows records onto the RPC type and drops the rest', () => {
    const shipped = toShippedEntries([
      entry({ command: 'publish', version: 2 }),
      { ...entry(), command: '' },
      { ...entry(), exit: 1.5 },
    ])
    expect(shipped).toHaveLength(1)
    expect(shipped[0]).toMatchObject({ command: 'publish', version: 2 })
  })

  it('journal isolation follows owner plus slug', () => {
    const dir = setup()
    try {
      appendJournalEntry(dir, OWNER, entry({ slug: 'a' }))
      appendJournalEntry(dir, 'other.owner', entry({ slug: 'a' }))
      expect(readJournalEntries(dir, OWNER, 'a')).toHaveLength(1)
      expect(readJournalEntries(dir, 'other.owner', 'a')).toHaveLength(1)
      expect(readFileSync(journalPath(dir, OWNER, 'a'), 'utf8')).toContain('"slug":"a"')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
