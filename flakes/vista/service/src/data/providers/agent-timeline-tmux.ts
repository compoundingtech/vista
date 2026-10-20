import { NodeChildProcessSpawner, NodeFileSystem, NodePath } from '@effect/platform-node'
import { AgentTimelineError } from '@vista/blocks/internal/provider-contracts'
import { Context, Data, Effect, Layer, Schema, Stream } from 'effect'
import { ChildProcess } from 'effect/process'
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner'

/** How long one tmux session's pane-to-agent resolution is reused. */
export const TMUX_RESOLUTION_TTL_MS = 30_000
/** Upper bound for each `tmux` and `pty` subprocess. */
export const TMUX_COMMAND_TIMEOUT_MS = 5_000

const ACTOR_PATH_TAG = 'agent.actor.path'
const HARNESS_SESSION_TAG = 'agent.harness.session.id'

/** A subprocess that could not start, exited non-zero, or ran past its timeout. */
export class AgentTimelineCommandFailure extends Data.TaggedError('AgentTimelineCommandFailure')<{
  readonly command: string
  readonly message: string
}> {}

/** Subprocess boundary for the tmux resolver: runs a command and returns its stdout. */
export interface AgentTimelineCommandRunnerService {
  readonly run: (
    command: string,
    args: ReadonlyArray<string>,
  ) => Effect.Effect<string, AgentTimelineCommandFailure>
}

/** Effect service for the resolver's subprocesses; tests substitute fixture output. */
export class AgentTimelineCommandRunner extends Context.Service<
  AgentTimelineCommandRunner,
  AgentTimelineCommandRunnerService
>()('Vista/AgentTimelineCommandRunner') {}

/** Runs real subprocesses, failing on a non-zero exit or after {@link TMUX_COMMAND_TIMEOUT_MS}. */
export const AgentTimelineCommandRunnerLive = Layer.effect(
  AgentTimelineCommandRunner,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    return AgentTimelineCommandRunner.of({
      run: (command, args) =>
        Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* spawner.spawn(
              ChildProcess.make(command, args, { stderr: 'ignore' }),
            )
            const [stdout, exitCode] = yield* Effect.all(
              [Stream.mkString(Stream.decodeText(handle.stdout)), handle.exitCode],
              { concurrency: 2 },
            )
            if (exitCode !== 0) {
              return yield* new AgentTimelineCommandFailure({
                command,
                message: `exited with code ${exitCode}`,
              })
            }
            return stdout
          }),
        ).pipe(
          Effect.timeoutOrElse({
            duration: TMUX_COMMAND_TIMEOUT_MS,
            orElse: () =>
              Effect.fail(
                new AgentTimelineCommandFailure({
                  command,
                  message: `timed out after ${TMUX_COMMAND_TIMEOUT_MS} ms`,
                }),
              ),
          }),
          Effect.mapError((failure) =>
            failure instanceof AgentTimelineCommandFailure
              ? failure
              : new AgentTimelineCommandFailure({ command, message: 'could not be started' }),
          ),
        ),
    })
  }),
).pipe(
  Layer.provide(
    NodeChildProcessSpawner.layer.pipe(Layer.provide([NodeFileSystem.layer, NodePath.layer])),
  ),
)

/** One tmux pane whose tty is attached to a running agent PTY. */
export interface TmuxAgentPane {
  readonly paneId: string
  readonly tty: string
  readonly ptyName: string
  readonly actorPath: string | null
  readonly harnessSessionId: string
}

/** Agents attached to one tmux session's panes; unmatched panes are counted, not guessed. */
export interface TmuxResolution {
  readonly panes: number
  readonly agents: ReadonlyArray<TmuxAgentPane>
}

const PtyEntry = Schema.Struct({
  name: Schema.String,
  status: Schema.String,
  tags: Schema.optionalKey(Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))),
  clients: Schema.optionalKey(
    Schema.NullOr(
      Schema.Array(Schema.Struct({ tty: Schema.optionalKey(Schema.NullOr(Schema.String)) })),
    ),
  ),
})
const PtyList = Schema.fromJsonString(Schema.Array(PtyEntry))

const resolveError = (message: string): AgentTimelineError =>
  new AgentTimelineError({ reason: 'resolve', message })

const stringTag = (
  tags: Readonly<Record<string, unknown>> | null | undefined,
  key: string,
): string | null => {
  const value = tags?.[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/** Parses `tmux list-panes -F '#{pane_id}\t#{pane_tty}'` output into pane id and tty pairs. */
export const parseTmuxPanes = (
  stdout: string,
): ReadonlyArray<{ readonly paneId: string; readonly tty: string }> =>
  stdout.split('\n').flatMap((line) => {
    const [paneId, tty, ...rest] = line.trim().split('\t')
    return paneId === undefined ||
      paneId === '' ||
      tty === undefined ||
      tty === '' ||
      rest.length > 0
      ? []
      : [{ paneId, tty }]
  })

/**
 * Joins tmux panes to running PTYs by attached client tty. A pane resolves only when exactly one
 * running PTY has a client on its tty and that PTY carries a harness session tag; everything else
 * is skipped. A pty that omits `clients` predates `--clients` and fails as `unsupported`.
 */
export const matchTmuxAgents = (
  panesStdout: string,
  ptyStdout: string,
): Effect.Effect<TmuxResolution, AgentTimelineError> =>
  Schema.decodeEffect(PtyList)(ptyStdout).pipe(
    Effect.mapError(() => resolveError('pty list --json --clients returned unexpected output')),
    Effect.flatMap((entries) => {
      const running = entries.filter((entry) => entry.status === 'running')
      if (running.some((entry) => !('clients' in entry))) {
        return Effect.fail(
          new AgentTimelineError({
            reason: 'unsupported',
            message: 'pty does not report attached clients (needs pty with --clients)',
          }),
        )
      }
      const panes = parseTmuxPanes(panesStdout)
      const seen = new Set<string>()
      const agents = panes.flatMap((pane): ReadonlyArray<TmuxAgentPane> => {
        const owners = running.filter(
          (entry) => entry.clients?.some((client) => client.tty === pane.tty) === true,
        )
        const owner = owners.length === 1 ? owners[0] : undefined
        if (owner === undefined) return []
        const harnessSessionId = stringTag(owner.tags, HARNESS_SESSION_TAG)
        if (harnessSessionId === null || seen.has(harnessSessionId)) return []
        seen.add(harnessSessionId)
        return [
          {
            paneId: pane.paneId,
            tty: pane.tty,
            ptyName: owner.name,
            actorPath: stringTag(owner.tags, ACTOR_PATH_TAG),
            harnessSessionId,
          },
        ]
      })
      return Effect.succeed({ panes: panes.length, agents })
    }),
  )

/** Resolves a tmux session name to the agents attached to its panes. */
export interface AgentTimelineTmuxResolverService {
  readonly resolve: (
    tmuxSession: string,
  ) => Effect.Effect<TmuxResolution & { readonly cached: boolean }, AgentTimelineError>
}

/**
 * Creates a resolver over the given command runner that reuses each session's successful
 * resolution for {@link TMUX_RESOLUTION_TTL_MS}. Failures are never cached.
 */
export const makeAgentTimelineTmuxResolver = ({
  runner,
  now,
}: {
  readonly runner: AgentTimelineCommandRunnerService
  readonly now: () => number
}): AgentTimelineTmuxResolverService => {
  const cache = new Map<string, { readonly expiresAt: number; readonly value: TmuxResolution }>()
  const run = (command: string, args: ReadonlyArray<string>) =>
    runner
      .run(command, args)
      .pipe(Effect.mapError((failure) => resolveError(`${failure.command} ${failure.message}`)))
  return {
    resolve: (tmuxSession) =>
      Effect.gen(function* () {
        const at = now()
        const hit = cache.get(tmuxSession)
        if (hit !== undefined && hit.expiresAt > at) return { ...hit.value, cached: true }
        const [panesStdout, ptyStdout] = yield* Effect.all(
          [
            // `=` makes tmux match the session name exactly instead of by prefix.
            run('tmux', [
              'list-panes',
              '-t',
              `=${tmuxSession}`,
              '-s',
              '-F',
              '#{pane_id}\t#{pane_tty}',
            ]),
            run('pty', ['list', '--json', '--clients']),
          ],
          { concurrency: 2 },
        )
        const value = yield* matchTmuxAgents(panesStdout, ptyStdout)
        for (const [key, entry] of cache) {
          if (entry.expiresAt <= at) cache.delete(key)
        }
        cache.set(tmuxSession, { expiresAt: at + TMUX_RESOLUTION_TTL_MS, value })
        return { ...value, cached: false }
      }),
  }
}
