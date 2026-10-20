import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { Effect, Schema } from 'effect'

import { SLUG_RE } from './control.ts'

/**
 * Tagged error signaling that scaffolding was attempted for an app whose source directory already
 * contains content, carrying the scaffold slug and the existing path.
 */
export class ScaffoldExists extends Schema.TaggedError<ScaffoldExists>()('Vista.ScaffoldExists', {
  slug: Schema.String,
  path: Schema.String,
}) {}

/**
 * Tagged error signaling that a scaffold slug failed the required format check, carrying the
 * rejected slug for diagnostics.
 */
export class InvalidSlug extends Schema.TaggedError<InvalidSlug>()('Vista.InvalidSlug', {
  slug: Schema.String,
}) {}

/** Authored directories require only the canonical default component. */
export const SCAFFOLD_FILES = ['app.tsx'] as const

const SCAFFOLD_SLOTS = ['context', 'reader-ask', 'primary-focus'] as const

/** Slot comments explicitly mark unfinished authoring; remove each marker when filling its slot. */
export const unfilledScaffoldSlots = (source: string): readonly string[] =>
  SCAFFOLD_SLOTS.filter((slot) => source.includes(`/* vista-scaffold:${slot} `))

const appTsx = (slug: string): string => `import { AppRoot, Ask, Evidence } from '@vista/blocks'

export default function VistaApp() {
  return (
    <AppRoot
      title="${slug}"
      template="architecture-review"
      scope="${slug}"
    >
      {/* vista-scaffold:context — Set the title and scope to what this is and why now. */}
      <Ask id="reader-ask" refs={['primary-focus']}>
        {/* vista-scaffold:reader-ask — State the decision or understanding needed; say when no action is needed. */}
      </Ask>
      <Evidence id="primary-focus">
        {/* vista-scaffold:primary-focus — Author one dominant visual: MermaidDiagram, ChartBlock, a comparison, or a sequence. Put browser-only behavior under a RuntimeIsland. */}
      </Evidence>
    </AppRoot>
  )
}
`

const hasContent = (dir: string): boolean => existsSync(dir) && readdirSync(dir).length > 0

/**
 * Options controlling scaffolding: the target app source directory and a dryRun flag that computes
 * the planned writes without applying them.
 */
export interface ScaffoldOptions {
  readonly dryRun?: boolean
  readonly appSource: string
}

/**
 * Effectful generator that fails with InvalidSlug or ScaffoldExists when the slug is malformed or
 * the source directory already has content, and otherwise writes the minimal authored scaffold
 * files (or reports them without writing when dryRun is set).
 */
export const scaffold = Effect.fn('vista.scaffold')(function* (
  slug: string,
  options: ScaffoldOptions,
) {
  if (!SLUG_RE.test(slug)) return yield* new InvalidSlug({ slug })
  const appSource = options.appSource
  if (hasContent(appSource)) return yield* new ScaffoldExists({ slug, path: appSource })
  const source = appTsx(slug)
  const writes = [{ path: join(appSource, 'app.tsx'), content: source }] as const
  if (options.dryRun !== true) {
    yield* Effect.sync(() => {
      mkdirSync(appSource, { recursive: true })
      for (const write of writes) writeFileSync(write.path, write.content)
    })
  }
  return {
    slug,
    appSource,
    files: SCAFFOLD_FILES,
    dryRun: options.dryRun === true,
    writes: writes.map((write) => write.path),
  } as const
})
