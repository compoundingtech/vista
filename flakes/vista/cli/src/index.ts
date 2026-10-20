/**
 * `vista` CLI command tree (decision 0028), built with Effect CLI. Thin
 * (decision 0002): every operational command delegates to {@link VistaClient},
 * which is a thin Effect RPC wrapper over the running Vista service. Inputs are
 * Effect CLI Arguments/Flags, outputs go through the sk-cli-design renderer (or
 * `--json` for agents), and failures are tagged errors on the error channel.
 *
 * Commands:
 *   vista new [slug] [--dry-run]
 *                                             scaffold the caller's canonical source
 *   vista check [path]                    evaluate authored source locally
 *   vista publish <local-slug> --message <summary> [--dry-run]
 *                                             publish the owner's canonical source
 *   vista rehydrate <slug> [version]      restore source into that canonical source
 *   vista list [--json]                   list all apps (the index mirror)
 *   vista open <slug> [version]           print the canonical URL
 *   vista retire <slug>                   retire an app (versions kept, → 410)
 *   vista ask <appId> <question…>      register a structured decision-question
 *   vista await <appId> <questionId>   block (re-arm) until the human answers
 *   vista debug service [--json]          inspect the control-plane RPC service
 *   vista debug paths [--json]            inspect Vista filesystem roots
 *   vista debug app <slug> [--json]        inspect one app through control RPC
 *   vista debug publish-plan <slug>       inspect publish preflight state
 *   vista debug import <specifier>        classify a runtime-policy import
 *
 * `ask`/`await` are the CLI-driven interview round-trip (decision 0032, replacing
 * the dropped `@vista/mcp` server). They use the same typed `VistaControlApi`
 * boundary as publish/list/debug; the re-arm loop (`await`) is how a human's
 * minutes of think-time are spanned by many short server-side windows rather
 * than one long-poll the transport would reset.
 */

import { basename, resolve } from 'node:path'

import { isValidSlug } from '@vista/service/control'
import { DecisionOption, DecisionQuestion } from '@vista/service/interview/contract'
import { Console, Effect, Layer, Schema } from 'effect'
import * as Cli from 'effect/cli'
import React from 'react'

import {
  outputModeLayer,
  outputOption,
  resolveOutputOption,
  type ParsedOutputOption,
} from '@overeng/tui-react/node'

import { CheckApp, CheckView } from './commands/check/mod.ts'
import { AppApp, AppView } from './commands/debug-app/mod.ts'
import { ImportDiagnosticApp, ImportDiagnosticView } from './commands/debug-import/mod.ts'
import { ServicePathsApp, ServicePathsView } from './commands/debug-paths/mod.ts'
import { PublishPlanApp, PublishPlanView } from './commands/debug-publish-plan/mod.ts'
import { RuntimePolicyApp, RuntimePolicyView } from './commands/debug-runtime-policy/mod.ts'
import { ServiceInfoApp, ServiceInfoView } from './commands/debug-service/mod.ts'
import { runView } from './commands/display-app.ts'
import { ListApp, ListView } from './commands/list/mod.ts'
import { NewAppApp, NewAppView } from './commands/new/mod.ts'
import { OpenApp, OpenView } from './commands/open/mod.ts'
import { RehydrateApp, RehydrateView } from './commands/rehydrate/mod.ts'
import { RetireApp, RetireView } from './commands/retire/mod.ts'
import { DEBUG_COMMANDS } from './debug.ts'
import {
  renderAskResult,
  renderAwaitOutcome,
  renderPublishPreview,
  renderPublishResult,
} from './render.ts'
import { reviewVista } from './review.ts'
import {
  appendJournalEntry,
  recentJournalEntries,
  toShippedEntries,
  trailStateDir,
  withTrailEntry,
} from './trail-journal.ts'
import { VersionSummary, InvalidSlug, PublishOk, ServicePaths, VistaClient } from './VistaClient.ts'

export { advisoryReview } from './review.ts'

const encodeRawJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown))

/** A filesystem-safe, sortable default slug when `vista new` is given none. */
const defaultSlug = (): string =>
  `app-${new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14)}`

/** Parse a `v2`/`2` version selector to an integer, or `undefined` when malformed. */
const parseVersion = (raw: string): number | undefined => {
  const n = Number(raw.replace(/^v/i, ''))
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/** A misuse of `vista ask` caught before any network call (clean message, not a schema dump). */
class AskUsageError extends Schema.TaggedError<AskUsageError>()('Vista.AskUsageError', {
  message: Schema.String,
}) {}

class VersionUsageError extends Schema.TaggedError<VersionUsageError>()('Vista.VersionUsageError', {
  message: Schema.String,
}) {}

/**
 * Parses strings of the form "v1", "v2", ... into a safe positive integer version number,
 * returning undefined for any non-conforming or unsafe input.
 */
export const parseExactVersion = (raw: string): number | undefined => {
  if (!/^v[1-9]\d*$/.test(raw)) return undefined
  const version = Number(raw.slice(1))
  return Number.isSafeInteger(version) ? version : undefined
}

const slugArg = Cli.Argument.String('slug').pipe(Cli.Argument.withDescription('The app slug'))
const optionalSlugArg = Cli.Argument.String('slug').pipe(
  Cli.Argument.withDescription(
    'The app slug (optional; a timestamped slug is generated if omitted)',
  ),
  Cli.Argument.optional,
)
const versionArg = Cli.Argument.String('version').pipe(
  Cli.Argument.withDescription('A specific version (e.g. v2); defaults to latest'),
  Cli.Argument.optional,
)
const exactVersionArg = Cli.Argument.String('version').pipe(
  Cli.Argument.withDescription('The exact immutable version in canonical vN form (e.g. v2)'),
)
const importSpecifierArg = Cli.Argument.String('specifier').pipe(
  Cli.Argument.withDescription('The app import specifier to classify'),
)
const NonEmptyTrimmedString = Schema.NonEmptyString.pipe(Schema.check(Schema.isTrimmed()))
const messageOption = Cli.Flag.String('message').pipe(
  Cli.Flag.withAlias('m'),
  Cli.Flag.withDescription('Required change summary recorded in the version metadata'),
  Cli.Flag.withSchema(NonEmptyTrimmedString),
)
const appDirArg = Cli.Argument.String('local-slug').pipe(
  Cli.Argument.withDescription('The owner-local slug under the configured Vista sources directory'),
)
const publishDryRunOption = Cli.Flag.Boolean('dry-run').pipe(
  Cli.Flag.withDescription(
    'Preview the derived slug, title, version, and canonical URL without publishing',
  ),
  Cli.Flag.withDefault(false),
)
const jsonOption = Cli.Flag.Boolean('json').pipe(
  Cli.Flag.withDescription('Emit machine-readable JSON instead of the formatted view'),
  Cli.Flag.withDefault(false),
)
const timeoutMsOption = Cli.Flag.Int('timeout-ms').pipe(
  Cli.Flag.withDescription('Maximum local await deadline in milliseconds'),
  Cli.Flag.withDefault(600_000),
)
const dryRunOption = Cli.Flag.Boolean('dry-run').pipe(
  Cli.Flag.withDescription('Preview the scaffold writes without creating any files'),
  Cli.Flag.withDefault(false),
)
const localOption = Cli.Flag.Boolean('local').pipe(
  Cli.Flag.withDescription(
    'Emit the loopback URL (marked non-canonical) instead of failing when the canonical tailnet URL cannot be resolved',
  ),
  Cli.Flag.withDefault(false),
)
const checkPathArg = Cli.Argument.String('path').pipe(
  Cli.Argument.withDescription('AppSource directory (defaults to the current directory)'),
  Cli.Argument.optional,
)

const debugDescription = (command: (typeof DEBUG_COMMANDS)[number]['command']) =>
  DEBUG_COMMANDS.find((descriptor) => descriptor.command === command)!.description

/**
 * Vista's default output policy (decision 0063): preserve the pre-tui-react
 * default. A TTY gets the coloured visual render, a pipe/redirect gets the
 * colourless final render, and machine JSON is emitted ONLY when explicitly asked
 * (`--output json`/`ndjson`). We deliberately DON'T route `auto` through
 * machine output unless explicitly opted into (`--json` was always explicit).
 * This matches the old renderer's `useColor = stdout.isTTY` gate exactly.
 */
const vistaOutputLayer = (output: ParsedOutputOption) =>
  Layer.unwrap(
    Effect.map(resolveOutputOption(output), (mode) =>
      mode === 'auto'
        ? outputModeLayer(process.stdout.isTTY === true ? 'tty' : 'log')
        : outputModeLayer(mode),
    ),
  )

const PublishResultJson = Schema.Struct({
  ...PublishOk.fields,
  url: Schema.String,
  // `false` marks a non-canonical loopback URL (emitted only under --local/env);
  // agents must not treat such a URL as a shareable cross-host link (SVC-R55).
  canonical: Schema.Boolean,
})
const PublishPreviewJson = Schema.Struct({
  owner: NonEmptyTrimmedString,
  slug: NonEmptyTrimmedString,
  nextVersion: Schema.Int,
  title: Schema.optional(Schema.String),
  template: Schema.optional(Schema.String),
  url: Schema.String,
  canonical: Schema.Boolean,
})

/** Run the state-free local evaluator and render its schema-owned result. */
export const runCheck = (path = process.cwd()) =>
  Effect.gen(function* () {
    // Check carries no owner identity, so the journal keys off the ambient
    // seat when present and skips otherwise — best-effort either way.
    const started = Date.now()
    const outcome = yield* Effect.exit(
      Effect.promise(async () => {
        // A separate evaluator chunk keeps compiler/provider imports out of non-check startup.
        const { checkVistaApp } = await import('./preflight.js')
        return checkVistaApp(path)
      }),
    )
    const failed = outcome._tag === 'Failure' || outcome.value._tag === 'failed'
    const owner = process.env.ST_AGENT
    if (owner !== undefined) {
      const slug = basename(resolve(path))
      yield* Effect.sync(() =>
        appendJournalEntry(trailStateDir(), owner, {
          command: 'check',
          slug,
          timestamp: new Date(started).toISOString(),
          exit: failed ? 1 : 0,
          durationMs: Date.now() - started,
        }),
      )
    }
    if (outcome._tag === 'Failure') return yield* Effect.failCause(outcome.cause)
    return yield* runView(
      CheckApp,
      React.createElement(CheckView, { stateAtom: CheckApp.stateAtom }),
      outcome.value,
    )
  })

const checkCommand = Cli.Command.make(
  'check',
  { path: checkPathArg, output: outputOption },
  ({ path, output }) =>
    runCheck(path._tag === 'Some' ? path.value : process.cwd()).pipe(
      Effect.provide(vistaOutputLayer(output)),
    ),
).pipe(
  Cli.Command.withDescription(
    'Evaluate authored app.tsx locally without owner identity or a running Vista service',
  ),
)

const newCommand = Cli.Command.make(
  'new',
  { slug: optionalSlugArg, dryRun: dryRunOption, output: outputOption },
  ({ slug, dryRun, output }) => {
    const resolvedSlug = slug._tag === 'Some' ? slug.value : defaultSlug()
    return withTrailEntry(
      { owner: process.env.ST_AGENT, slug: resolvedSlug, command: 'new' },
      Effect.gen(function* () {
        const vista = yield* VistaClient
        const result = yield* vista.newApp(resolvedSlug, { dryRun })
        yield* runView(
          NewAppApp,
          React.createElement(NewAppView, {
            stateAtom: NewAppApp.stateAtom,
            serviceUrl: vista.serviceUrl,
          }),
          result,
        )
      }),
    ).pipe(Effect.provide(vistaOutputLayer(output)))
  },
).pipe(Cli.Command.withDescription('Scaffold a new app draft into its canonical source'))

/**
 * The `publish` flow, extracted so its freeze-before-emit ORDERING is unit
 * testable (see `test/canonical-url.test.ts`). `ensureUrlEmittable` runs BEFORE
 * `publish`: `publish` FREEZES the draft and moves `latest` (irreversible), while
 * the post-publish `urlFor` can fail on a URL misconfiguration. Guarding up front
 * means such a config error fails loud WITHOUT leaving a successful publish
 * behind — otherwise the retry (with `--local`) would publish a SECOND version.
 * Because the precondition is ensured, the post-publish `urlFor` cannot fail.
 */
export const runPublish = ({
  localSlug,
  message,
  local,
  json,
  dryRun,
}: {
  readonly localSlug: string
  readonly message: string
  readonly local: boolean
  readonly json: boolean
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const vista = yield* VistaClient
    const owner = yield* vista.resolveOwner
    if (!isValidSlug(localSlug)) {
      return yield* new InvalidSlug({
        owner,
        slug: localSlug,
        message: `"${localSlug}" is not a valid Vista slug`,
      })
    }
    // The journal ships first: earlier entries (checks, prior publishes) ride
    // along, and this run's own entry is recorded after, for the next publish.
    const stateDir = trailStateDir()
    const shipped = toShippedEntries(recentJournalEntries(stateDir, owner, localSlug))
    const started = Date.now()
    const outcome = yield* Effect.exit(
      Effect.gen(function* () {
        yield* vista.ensureUrlEmittable({ local })
        if (dryRun) {
          const preview = yield* vista.publishPreview(localSlug)
          const { url, canonical } = yield* vista.urlFor(localSlug, `v${preview.nextVersion}`, {
            local,
          })
          const view = {
            owner,
            slug: localSlug,
            nextVersion: preview.nextVersion,
            url,
            canonical,
            ...(preview.title !== undefined ? { title: preview.title } : {}),
            ...(preview.template !== undefined ? { template: preview.template } : {}),
          }
          if (json) {
            yield* Console.log(
              yield* Schema.encodeEffect(Schema.fromJsonString(PublishPreviewJson))(view),
            )
          } else {
            yield* Console.log(renderPublishPreview(view))
          }
          return undefined
        }
        const result = yield* vista.publish(localSlug, message, shipped)
        const { url, canonical } = yield* vista.urlFor(result.slug, `v${result.version}`, { local })
        const view = { ...result, url, canonical }
        if (json) {
          yield* Console.log(
            yield* Schema.encodeEffect(Schema.fromJsonString(PublishResultJson))(view),
          )
        } else {
          yield* Schema.decodeEffect(PublishOk)(result)
          yield* Console.log(renderPublishResult(view))
        }
        return result.version
      }),
    )
    // Best-effort by contract (q14): recording never fails the publish.
    yield* Effect.sync(() =>
      appendJournalEntry(stateDir, owner, {
        command: dryRun ? 'publish --dry-run' : 'publish',
        slug: localSlug,
        ...(outcome._tag === 'Success' && outcome.value !== undefined
          ? { version: outcome.value }
          : {}),
        timestamp: new Date(started).toISOString(),
        exit: outcome._tag === 'Success' ? 0 : 1,
        durationMs: Date.now() - started,
        message,
      }),
    )
    if (outcome._tag === 'Failure') return yield* Effect.failCause(outcome.cause)
    return outcome.value
  })

const publishCommand = Cli.Command.make(
  'publish',
  {
    localSlug: appDirArg,
    message: messageOption,
    local: localOption,
    json: jsonOption,
    dryRun: publishDryRunOption,
  },
  ({ localSlug, message, local, json, dryRun }) =>
    runPublish({
      localSlug,
      message,
      local,
      json,
      dryRun,
    }),
).pipe(Cli.Command.withDescription('Publish owner-scoped AppSource and print its pinned URL'))

const rehydrateCommand = Cli.Command.make(
  'rehydrate',
  { slug: slugArg, version: versionArg, output: outputOption },
  ({ slug, version, output }) =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      let versionNumber: number | undefined
      if (version._tag === 'Some') {
        versionNumber = parseVersion(version.value)
        if (versionNumber === undefined) {
          return yield* new AskUsageError({
            message: `invalid version "${version.value}" — use a positive integer (e.g. v2 or 2)`,
          })
        }
      }
      const result = yield* vista.rehydrate(slug, versionNumber)
      yield* runView(
        RehydrateApp,
        React.createElement(RehydrateView, { stateAtom: RehydrateApp.stateAtom }),
        result,
      )
    }).pipe(Effect.provide(vistaOutputLayer(output))),
).pipe(
  Cli.Command.withDescription(
    'Restore a published version into its canonical source (refuses WIP)',
  ),
)

const listCommand = Cli.Command.make('list', { output: outputOption }, ({ output }) =>
  // Fetch-then-render (decision 0063): resolve the rows, then hand them to the
  // tui-react app. Because the fetch precedes `run`, a failed fetch never reaches
  // the render finalizer — stdout stays empty and the error surfaces on stderr,
  // exactly as the pre-tui-react `--json` branch behaved. In `--output json` the
  // final state (`AppRow[]`) is serialised through `ListState` == the historical
  // wire schema, so the machine contract is byte-identical (AGT.CLI-R68).
  Effect.gen(function* () {
    const vista = yield* VistaClient
    const rows = yield* vista.list()
    yield* runView(ListApp, React.createElement(ListView, { stateAtom: ListApp.stateAtom }), rows)
  }).pipe(Effect.provide(vistaOutputLayer(output))),
).pipe(Cli.Command.withDescription('List all apps (the CLI mirror of the app index)'))

const openCommand = Cli.Command.make(
  'open',
  { slug: slugArg, version: versionArg, local: localOption, output: outputOption },
  ({ slug, version, local, output }) =>
    Effect.gen(function* () {
      let resolvedVersion = 'latest'
      if (version._tag === 'Some') {
        const parsedVersion = parseExactVersion(version.value)
        if (parsedVersion === undefined) {
          return yield* new VersionUsageError({
            message:
              'version must be an exact canonical vN selector with a positive decimal and no leading zero',
          })
        }
        resolvedVersion = `v${parsedVersion}`
      }
      const vista = yield* VistaClient
      // `get` validates the slug exists (tagged UnknownApp otherwise).
      yield* vista.get(slug)
      const { url, canonical } = yield* vista.urlFor(
        slug,
        resolvedVersion === 'latest' ? undefined : resolvedVersion,
        { local },
      )
      const state = { slug, version: resolvedVersion, url, canonical }
      yield* runView(
        OpenApp,
        React.createElement(OpenView, { stateAtom: OpenApp.stateAtom }),
        state,
      )
    }).pipe(Effect.provide(vistaOutputLayer(output))),
).pipe(Cli.Command.withDescription('Print the canonical URL for an app (default: latest)'))

const retireCommand = Cli.Command.make(
  'retire',
  { slug: slugArg, output: outputOption },
  ({ slug, output }) =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const result = yield* vista.retire(slug)
      yield* runView(
        RetireApp,
        React.createElement(RetireView, { stateAtom: RetireApp.stateAtom }),
        result,
      )
    }).pipe(Effect.provide(vistaOutputLayer(output))),
).pipe(Cli.Command.withDescription('Retire an app (versions preserved, surfaces return 410)'))

const versionGetCommand = Cli.Command.make(
  'get',
  { slug: slugArg, version: exactVersionArg, output: outputOption },
  ({ slug, version }) =>
    Effect.gen(function* () {
      const parsedVersion = parseExactVersion(version)
      if (parsedVersion === undefined) {
        return yield* new VersionUsageError({
          message:
            'version must be an exact canonical vN selector with a positive decimal and no leading zero',
        })
      }
      const vista = yield* VistaClient
      const summary = yield* vista.getVersion(slug, parsedVersion)
      yield* Console.log(yield* Schema.encodeEffect(Schema.fromJsonString(VersionSummary))(summary))
    }),
).pipe(
  Cli.Command.withDescription(
    'Read the immutable content-free summary for one exact published version',
  ),
)

const versionCommand = Cli.Command.make('version').pipe(
  Cli.Command.withSubcommands([versionGetCommand]),
  Cli.Command.withDescription('Read immutable published version metadata'),
)

const debugServiceCommand = Cli.Command.make('service', { output: outputOption }, ({ output }) =>
  Effect.gen(function* () {
    const vista = yield* VistaClient
    const info = yield* vista.serviceInfo()
    // Surface both the loopback transport (url/rpc) AND the canonical public base
    // so an operator can diagnose canonical-URL config (decision 0051). These
    // transport URLs are display-only view props — the machine `--output json`
    // stays the raw `ServiceInfo` wire payload (AGT.CLI-R68).
    yield* runView(
      ServiceInfoApp,
      React.createElement(ServiceInfoView, {
        stateAtom: ServiceInfoApp.stateAtom,
        serviceUrl: vista.serviceUrl,
        rpcUrl: vista.rpcUrl,
        publicUrl: vista.publicBaseInfo,
      }),
      info,
    )
  }).pipe(Effect.provide(vistaOutputLayer(output))),
).pipe(Cli.Command.withDescription(debugDescription('service')))

const debugPathsCommand = Cli.Command.make('paths', { output: outputOption }, ({ output }) =>
  Effect.gen(function* () {
    const vista = yield* VistaClient
    const info = yield* vista.serviceInfo()
    const paths = yield* Schema.decodeEffect(ServicePaths)(info.paths)
    yield* runView(
      ServicePathsApp,
      React.createElement(ServicePathsView, { stateAtom: ServicePathsApp.stateAtom }),
      paths,
    )
  }).pipe(Effect.provide(vistaOutputLayer(output))),
).pipe(Cli.Command.withDescription(debugDescription('paths')))

const debugPublishPlanCommand = Cli.Command.make(
  'publish-plan',
  { slug: slugArg, output: outputOption },
  ({ slug, output }) =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const plan = yield* vista.publishPlan(slug)
      yield* runView(
        PublishPlanApp,
        React.createElement(PublishPlanView, { stateAtom: PublishPlanApp.stateAtom }),
        plan,
      )
    }).pipe(Effect.provide(vistaOutputLayer(output))),
).pipe(Cli.Command.withDescription(debugDescription('publish-plan')))

const debugAppCommand = Cli.Command.make(
  'app',
  { slug: slugArg, output: outputOption },
  ({ slug, output }) =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const row = yield* vista.get(slug)
      yield* runView(AppApp, React.createElement(AppView, { stateAtom: AppApp.stateAtom }), row)
    }).pipe(Effect.provide(vistaOutputLayer(output))),
).pipe(Cli.Command.withDescription(debugDescription('app')))

const debugRuntimePolicyCommand = Cli.Command.make(
  'runtime-policy',
  { output: outputOption },
  ({ output }) =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const runtimePolicy = yield* vista.runtimePolicy()
      yield* runView(
        RuntimePolicyApp,
        React.createElement(RuntimePolicyView, { stateAtom: RuntimePolicyApp.stateAtom }),
        runtimePolicy,
      )
    }).pipe(Effect.provide(vistaOutputLayer(output))),
).pipe(Cli.Command.withDescription(debugDescription('runtime-policy')))

const debugImportCommand = Cli.Command.make(
  'import',
  { specifier: importSpecifierArg, output: outputOption },
  ({ specifier, output }) =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const diagnostic = yield* vista.diagnoseImport(specifier)
      yield* runView(
        ImportDiagnosticApp,
        React.createElement(ImportDiagnosticView, { stateAtom: ImportDiagnosticApp.stateAtom }),
        diagnostic,
      )
    }).pipe(Effect.provide(vistaOutputLayer(output))),
).pipe(Cli.Command.withDescription(debugDescription('import')))

const debugCommand = Cli.Command.make('debug').pipe(
  Cli.Command.withSubcommands([
    debugServiceCommand,
    debugPathsCommand,
    debugAppCommand,
    debugPublishPlanCommand,
    debugRuntimePolicyCommand,
    debugImportCommand,
  ]),
  Cli.Command.withDescription('Operational diagnostics over the Vista control RPC'),
)

// --- Interview round-trip (decisions 0032/0038): ask + await over VistaControlApi ---

const reviewIdArg = Cli.Argument.String('appId').pipe(
  Cli.Argument.withDescription('The app the question is scoped to'),
)

/**
 * Each `--option id:label:tradeoff` declares one closed choice the agent offers.
 * `:` separates the three fields; the label/tradeoff may themselves contain none.
 */
const parseOption = (raw: string): DecisionOption => {
  const [id, label, ...rest] = raw.split(':')
  return DecisionOption.make({
    id: (id ?? '').trim(),
    label: (label ?? '').trim(),
    tradeoff: rest.join(':').trim(),
  })
}

const askCommand = Cli.Command.make(
  'ask',
  {
    appId: reviewIdArg,
    question: Cli.Argument.String('question').pipe(
      Cli.Argument.withDescription('The decision-question text'),
      Cli.Argument.variadic,
    ),
    options: Cli.Flag.String('option').pipe(
      Cli.Flag.withAlias('o'),
      Cli.Flag.withDescription('A closed choice as `id:label:tradeoff` (repeat for each)'),
      Cli.Flag.atLeast(0),
    ),
    multiSelect: Cli.Flag.Boolean('multi-select').pipe(
      Cli.Flag.withDescription('Allow more than one option to be chosen'),
      Cli.Flag.withDefault(false),
    ),
    recommended: Cli.Flag.String('recommended').pipe(
      Cli.Flag.withDescription('The option id the agent leans toward'),
      Cli.Flag.optional,
    ),
    json: jsonOption,
  },
  ({ appId, question, options, multiSelect, recommended, json }) =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      // Fail fast with a clean message before posting: an `ask` is a CLOSED
      // structured question — an empty option set is a footgun (the human gets
      // nothing to choose), and an orphan question against an unknown app is
      // never rendered. Validate both here rather than dumping a raw schema
      // ParseError or silently creating an orphan.
      if (options.length === 0) {
        return yield* new AskUsageError({
          message:
            'an ask needs at least one --option (id:label:tradeoff). A Vista ask is a closed choice, not freeform — give the human something to pick.',
        })
      }
      // `get` raises a tagged UnknownApp if the slug does not exist.
      yield* vista.get(appId)
      if (
        recommended._tag === 'Some' &&
        !options.some((o) => parseOption(o).id === recommended.value)
      ) {
        return yield* new AskUsageError({
          message: `--recommended "${recommended.value}" is not one of the --option ids (${options.map((o) => parseOption(o).id).join(', ')})`,
        })
      }
      const decisionQuestion = yield* Schema.decodeEffect(DecisionQuestion)({
        question: question.join(' '),
        options: options.map(parseOption),
        multiSelect,
        ...(recommended._tag === 'Some' ? { recommendedDefault: recommended.value } : {}),
      })
      const result = yield* vista.ask({ appId, question: decisionQuestion })
      if (json) {
        // Until a schema-derived wire contract exists, the identity codec preserves
        // the existing JSON bytes without reshaping the payload.
        yield* Console.log(encodeRawJson(result))
      } else {
        yield* Console.log(renderAskResult(result))
      }
    }),
).pipe(
  Cli.Command.withDescription('Register a structured decision-question for an app (decision 0032)'),
)

const awaitCommand = Cli.Command.make(
  'await',
  {
    appId: reviewIdArg,
    questionId: Cli.Argument.String('questionId').pipe(
      Cli.Argument.withDescription('The question id returned by `vista ask`'),
    ),
    timeoutMs: timeoutMsOption,
    json: jsonOption,
  },
  ({ appId, questionId, timeoutMs, json }) =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      // The re-arm loop: `awaitAnswered` re-issues a short bounded `awaitOnce`
      // window until the human answers in the browser (or the deadline elapses).
      const outcome = yield* vista.awaitAnswered(appId, questionId, timeoutMs)
      if (json) {
        // Same as `ask`: the identity codec preserves the existing JSON bytes
        // until the outcome has a schema-derived wire contract.
        yield* Console.log(encodeRawJson(outcome))
      } else {
        yield* Console.log(renderAwaitOutcome(appId, questionId, outcome))
      }
    }),
).pipe(
  Cli.Command.withDescription(
    'Block until the human answers a `vista ask` question (re-arm; decision 0032)',
  ),
)

const reviewCommand = Cli.Command.make(
  'review',
  {
    target: Cli.Argument.String('slug|url').pipe(
      Cli.Argument.withDescription(
        'A published Vista slug or an HTTP(S) published/local-preview URL',
      ),
    ),
  },
  ({ target }) =>
    Effect.gen(function* () {
      const url = /^https?:\/\//i.test(target)
        ? target
        : (yield* (yield* VistaClient).urlFor(target)).url
      yield* reviewVista(url)
    }).pipe(
      Effect.catchCause(() =>
        Console.log('Vista review unavailable — could not resolve the Vista URL (advisory only).'),
      ),
    ),
).pipe(
  Cli.Command.withDescription(
    'Advisory taste critique; run on first versions and structural rewrites only',
  ),
)

/** The root `vista` command. */
export const vistaCommand = Cli.Command.make('vista').pipe(
  Cli.Command.withSubcommands([
    newCommand,
    checkCommand,
    publishCommand,
    rehydrateCommand,
    listCommand,
    openCommand,
    reviewCommand,
    retireCommand,
    versionCommand,
    debugCommand,
    askCommand,
    awaitCommand,
  ]),
  Cli.Command.withDescription(
    'Vista — render-only visual apps (check/publish/new/rehydrate/list/open/review/retire/version/debug/ask/await)',
  ),
)

/** Minimal root used by the binary for `vista check`, with no VistaClient dependency. */
export const vistaCheckCommand = Cli.Command.make('vista').pipe(
  Cli.Command.withSubcommands([checkCommand]),
  Cli.Command.withDescription('Vista — locally validate authored app.tsx'),
)
