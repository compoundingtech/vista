import {
  type LensArgs,
  LensChecked,
  LensEnvelope,
  type LensRead,
  type LensWindow,
  ompUsage,
  OmpUsageApi,
  OmpUsageError,
  OmpUsageHealth,
  ProjectDrilldown,
  SpendByProjectRow,
  SpendByWorktreeRow,
} from '@vista/blocks/internal/provider-contracts'
import { Clock, Config, Context, Duration, Effect, Layer, Schedule, Schema } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'

import { implement, mountProvider } from '../provider.ts'

export { LensChecked, OmpUsageApi, OmpUsageError, OmpUsageHealth, ProjectDrilldown }

const COVERAGE_GATE = 0.95
const REQUEST_TIMEOUT = Duration.seconds(5)
const RETRY_SCHEDULE = Schedule.exponential(Duration.millis(100), 2).pipe(
  Schedule.upTo({ times: 2 }),
)
const STRICT = { onExcessProperty: 'error' } as const

/**
 * Contract for the raw OMP usage backend exposing a health probe and a lens read that both fail
 * with OmpUsageError.
 */
export interface OmpUsageSource {
  readonly health: Effect.Effect<OmpUsageHealth, OmpUsageError>
  readonly lens: (args: LensArgs) => Effect.Effect<LensRead, OmpUsageError>
}

/**
 * Extends the raw source contract with lensChecked, which additionally enforces freshness and
 * policy validation, and projectDrilldown, which returns per-project usage aggregates for a time
 * window.
 */
export interface OmpUsageService extends OmpUsageSource {
  readonly lensChecked: (args: LensArgs) => Effect.Effect<LensChecked, OmpUsageError>
  readonly projectDrilldown: (args: {
    readonly window: LensWindow
  }) => Effect.Effect<ProjectDrilldown, OmpUsageError>
}

/**
 * Effect Context tag 'Vista/OmpUsage' that carries the OmpUsageService contract through the
 * environment.
 */
export class OmpUsage extends Context.Service<OmpUsage, OmpUsageService>()('Vista/OmpUsage') {}

const FRESHNESS_HORIZON: Readonly<Record<LensWindow, number>> = {
  '1d': Duration.toMillis(Duration.days(1)),
  '7d': Duration.toMillis(Duration.days(7)),
  '30d': Duration.toMillis(Duration.days(30)),
  all: Duration.toMillis(Duration.minutes(30)),
}

const policyError = (operation: string, outcome: LensChecked): OmpUsageError =>
  new OmpUsageError({
    reason: 'policy',
    message: `${operation} requires a trusted lens result; received ${outcome._tag}`,
    transient: false,
  })

const projectMatchesWorktree = (project: string, worktreeKey: string): boolean => {
  const branchSeparator = worktreeKey.indexOf('@')
  const repository = branchSeparator === -1 ? worktreeKey : worktreeKey.slice(0, branchSeparator)
  return project === repository
}

/**
 * Builds an OmpUsageService over a raw source whose lensChecked fetches health and lens data
 * concurrently, verifies the response's lens/window identity matches the request, and enforces
 * per-window freshness horizons using the supplied clock (system clock by default), surfacing
 * OmpUsageError on policy, transport, or decode failures.
 */
export const makeOmpUsageService = (
  source: OmpUsageSource,
  now: Effect.Effect<number> = Clock.currentTimeMillis,
): OmpUsageService => {
  const lensChecked = Effect.fn('vista.provider.omp-usage.lensChecked')(function* (args: LensArgs) {
    const [health, read] = yield* Effect.all([source.health, source.lens(args)], {
      concurrency: 2,
    })
    const readIdentity = read._tag === 'materialized' ? read.envelope : read
    if (readIdentity.lens !== args.lens || readIdentity.window !== args.window) {
      return yield* requestError(
        'decode',
        `OMP Usage returned ${readIdentity.lens}@${readIdentity.window} for ${args.lens}@${args.window}`,
        'lens identity mismatch',
      )
    }
    if (read._tag === 'unmaterialized') {
      return yield* Schema.decodeEffect(
        LensChecked,
        STRICT,
      )({
        _tag: 'unmaterialized',
        lens: read.lens,
        window: read.window,
      }).pipe(
        Effect.mapError((cause) =>
          requestError('decode', 'OMP Usage unmaterialized outcome schema failed', cause),
        ),
      )
    }

    const generation = health.generations.find(
      (candidate) => candidate.lens === args.lens && candidate.window === args.window,
    )
    const currentTime = yield* now
    const computedAt = generation?.computed_at ?? Date.parse(read.envelope.computed_at)
    if (
      generation === undefined ||
      !Number.isFinite(computedAt) ||
      currentTime - computedAt > FRESHNESS_HORIZON[args.window]
    ) {
      return yield* Schema.decodeEffect(
        LensChecked,
        STRICT,
      )({
        _tag: 'stale',
        envelope: read.envelope,
        computedAt: Number.isFinite(computedAt)
          ? new Date(computedAt).toISOString()
          : read.envelope.computed_at,
        window: args.window,
      }).pipe(
        Effect.mapError((cause) =>
          requestError('decode', 'OMP Usage stale outcome schema failed', cause),
        ),
      )
    }

    const accountShare = read.envelope.coverage.account_share
    if (accountShare < COVERAGE_GATE) {
      return yield* Schema.decodeEffect(
        LensChecked,
        STRICT,
      )({
        _tag: 'below-gate',
        envelope: read.envelope,
        accountShare,
      }).pipe(
        Effect.mapError((cause) =>
          requestError('decode', 'OMP Usage below-gate outcome schema failed', cause),
        ),
      )
    }
    return yield* Schema.decodeEffect(
      LensChecked,
      STRICT,
    )({ _tag: 'ok', envelope: read.envelope }).pipe(
      Effect.mapError((cause) =>
        requestError('decode', 'OMP Usage ok outcome schema failed', cause),
      ),
    )
  })

  const projectDrilldown = Effect.fn('vista.provider.omp-usage.projectDrilldown')(function* ({
    window,
  }: {
    readonly window: LensWindow
  }) {
    const [projectsOutcome, worktreesOutcome] = yield* Effect.all(
      [
        lensChecked({ lens: 'spend_by_project', window }),
        lensChecked({ lens: 'spend_by_worktree', window }),
      ],
      { concurrency: 2 },
    )
    if (projectsOutcome._tag !== 'ok') {
      return yield* policyError('projectDrilldown.projects', projectsOutcome)
    }
    if (worktreesOutcome._tag !== 'ok') {
      return yield* policyError('projectDrilldown.worktrees', worktreesOutcome)
    }

    const projects = yield* Schema.decodeUnknownEffect(Schema.Array(SpendByProjectRow))(
      projectsOutcome.envelope.rows,
    ).pipe(
      Effect.mapError((cause) =>
        requestError('decode', 'OMP Usage project rows failed schema decoding', cause),
      ),
    )
    const worktrees = yield* Schema.decodeUnknownEffect(Schema.Array(SpendByWorktreeRow))(
      worktreesOutcome.envelope.rows,
    ).pipe(
      Effect.mapError((cause) =>
        requestError('decode', 'OMP Usage worktree rows failed schema decoding', cause),
      ),
    )
    const rows = projects.map((project) => {
      const matches = worktrees.filter((row) => projectMatchesWorktree(project.key, row.key))
      return {
        project: project.key,
        usd: project.usd,
        requests: project.requests,
        status: matches.length === 0 ? ('un-drilled' as const) : ('drilled' as const),
        worktrees: matches,
      }
    })
    return yield* Schema.decodeEffect(
      ProjectDrilldown,
      STRICT,
    )({
      window,
      projects: rows,
      unDrilled: rows.filter((row) => row.status === 'un-drilled').map((row) => row.project),
    }).pipe(
      Effect.mapError((cause) =>
        requestError('decode', 'OMP Usage project drilldown schema failed', cause),
      ),
    )
  })

  return {
    health: source.health,
    lens: source.lens,
    lensChecked,
    projectDrilldown,
  }
}

/**
 * Creates a Layer that provides the OmpUsage service built from the given source and optional
 * clock effect.
 */
export const makeOmpUsageLayer = (
  source: OmpUsageSource,
  now?: Effect.Effect<number>,
): Layer.Layer<OmpUsage> => Layer.succeed(OmpUsage, makeOmpUsageService(source, now))

const requestError = (
  reason: 'transport' | 'decode',
  message: string,
  cause: unknown,
): OmpUsageError =>
  new OmpUsageError({
    reason,
    message: `${message}: ${String(cause)}`,
    transient: reason === 'transport',
  })

const httpError = (operation: string, status: number): OmpUsageError =>
  new OmpUsageError({
    reason: 'http',
    message: `OMP Usage ${operation} returned HTTP ${status}`,
    status,
    transient: status === 429 || status >= 500,
  })

const resilient = <TValue>(
  effect: Effect.Effect<TValue, OmpUsageError>,
): Effect.Effect<TValue, OmpUsageError> =>
  effect.pipe(
    Effect.timeout(REQUEST_TIMEOUT),
    Effect.mapError((error) =>
      error instanceof OmpUsageError
        ? error
        : new OmpUsageError({
            reason: 'timeout',
            message: `OMP Usage request timed out after ${Duration.format(REQUEST_TIMEOUT)}`,
            transient: true,
          }),
    ),
    Effect.retry({
      schedule: RETRY_SCHEDULE,
      while: (error) => error.transient,
    }),
  )

const makeLiveSource = Effect.gen(function* () {
  const baseUrl = yield* Effect.orDie(
    Config.String('VISTA_OMP_USAGE_URL').pipe(
      Config.withDefault('http://127.0.0.1:41031'),
      Config.map((value) => value.replace(/\/+$/, '')),
    ),
  )
  const client = yield* HttpClient.HttpClient

  const health = Effect.fn('vista.provider.omp-usage.health')(function* () {
    const response = yield* client
      .get(`${baseUrl}/health`)
      .pipe(
        Effect.mapError((cause) =>
          requestError('transport', 'OMP Usage health request failed', cause),
        ),
      )
    if (response.status < 200 || response.status >= 300) {
      return yield* httpError('health', response.status)
    }
    const json = yield* response.json.pipe(
      Effect.mapError((cause) => requestError('decode', 'OMP Usage health JSON failed', cause)),
    )
    return yield* Schema.decodeUnknownEffect(
      OmpUsageHealth,
      STRICT,
    )(json).pipe(
      Effect.mapError((cause) => requestError('decode', 'OMP Usage health schema failed', cause)),
    )
  })

  const lens = Effect.fn('vista.provider.omp-usage.lens')(function* (args: LensArgs) {
    const url = new URL(`${baseUrl}/api/v1/lens/${encodeURIComponent(args.lens)}`)
    url.searchParams.set('window', args.window)
    if (args.groupBy !== undefined) url.searchParams.set('group_by', args.groupBy)
    const response = yield* client
      .get(url.toString())
      .pipe(
        Effect.mapError((cause) =>
          requestError('transport', `OMP Usage ${args.lens} request failed`, cause),
        ),
      )
    if (response.status === 503) {
      return { _tag: 'unmaterialized', lens: args.lens, window: args.window } as const
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* httpError(`lens ${args.lens}`, response.status)
    }
    const json = yield* response.json.pipe(
      Effect.mapError((cause) =>
        requestError('decode', `OMP Usage ${args.lens} JSON failed`, cause),
      ),
    )
    const envelope = yield* Schema.decodeUnknownEffect(
      LensEnvelope,
      STRICT,
    )(json).pipe(
      Effect.mapError((cause) =>
        requestError('decode', `OMP Usage ${args.lens} schema failed`, cause),
      ),
    )
    return { _tag: 'materialized', envelope } as const
  })

  return {
    health: resilient(health()),
    lens: (args: LensArgs) => resilient(lens(args)),
  } satisfies OmpUsageSource
})

/** Layer that constructs the live OmpUsage service from the live HTTP-backed source. */
export const OmpUsageLive = Layer.effect(
  OmpUsage,
  makeLiveSource.pipe(Effect.map(makeOmpUsageService)),
)

const callLensChecked = (args: LensArgs) =>
  Effect.flatMap(OmpUsage, (service) => service.lensChecked(args))

/**
 * Effectful implementation of the ompUsage capability that delegates health, lens, lensChecked,
 * and projectDrilldown requests to the OmpUsage context service.
 */
export const ompUsageImplementation = implement(ompUsage, {
  purity: 'effectful',
  handlers: {
    health: () => Effect.flatMap(OmpUsage, (service) => service.health),
    lens: (args) => Effect.flatMap(OmpUsage, (service) => service.lens(args)),
    lensChecked: callLensChecked,
    projectDrilldown: (args) =>
      Effect.flatMap(OmpUsage, (service) => service.projectDrilldown(args)),
  },
})

/**
 * Factory that mounts the ompUsage provider implementation onto the supplied layer, with the
 * module default wiring OmpUsageLive over FetchHttpClient.
 */
export const makeOmpUsageProvider = (layer: Layer.Layer<OmpUsage>) =>
  mountProvider(ompUsageImplementation, layer)

export default makeOmpUsageProvider(OmpUsageLive.pipe(Layer.provide(FetchHttpClient.layer)))
