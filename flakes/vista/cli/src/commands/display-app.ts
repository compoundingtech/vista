import { Effect, Schema } from 'effect'
import type { ReactElement } from 'react'

/**
 * `makeDisplayApp` — the vista CLI's shared `@overeng/tui-react` app factory for
 * *display* commands (decision 0063 / AGT.CLI-R68).
 *
 * Vista's operational commands are fetch-then-render: the handler resolves a
 * payload from the running service, then renders it once. That is a degenerate
 * state machine — a single `SetState` transition — so rather than hand-author an
 * action/reducer per command (the `tui-stories`/`notion-scan` progressive-state
 * pattern), every display command shares this factory. The `stateSchema` is the
 * command's exact machine-output wire schema: in `--output json`/`ndjson` modes
 * `@overeng/tui-react` serialises the final state through it, so the agent-facing
 * contract stays a stable, schema-derived projection independent of the view
 * (AGT.CLI-R68), never the view's internal React state.
 *
 * Fidelity note: because `stateSchema` IS the wire schema the pre-tui-react
 * `--json` branch encoded, the machine output is byte-identical by construction —
 * asserted per command by the `*-render.test.ts` json-mode drift guards.
 */
import { createTuiApp, type OutputModeTag, type TuiApp } from '@overeng/tui-react'

/** The single transition a display command makes: replace the rendered state. */
export type SetState<A> = { readonly _tag: 'SetState'; readonly state: A }

/**
 * Build a `TuiApp` whose state IS the command's wire payload. The lone `SetState`
 * action carries the fetched payload; the reducer returns it verbatim.
 *
 * @param stateSchema the command's machine-output wire schema (the `--output json` wire anchor)
 * @param initial the empty/pre-fetch state rendered before (or absent) a payload
 * @param exitCode optional final-state → process exit-code mapping
 */
export const makeDisplayApp = <A>({
  stateSchema,
  initial,
  exitCode,
}: {
  readonly stateSchema: Schema.Codec<A>
  readonly initial: A
  readonly exitCode?: (state: A) => number | undefined
}): TuiApp<A, SetState<A>> => {
  const actionSchema = Schema.TaggedStruct('SetState', {
    state: stateSchema,
  }) as Schema.Schema<SetState<A>>
  return createTuiApp({
    stateSchema,
    actionSchema,
    initial,
    reducer: ({ action }) => action.state,
    ...(exitCode !== undefined ? { exitCode } : {}),
  })
}

/**
 * Render a fetched payload through the output mode in context (decision 0063).
 * Fetch-first: callers resolve the payload, then hand it here with the view
 * element, so a failed fetch never reaches the render finalizer (stdout stays
 * empty on error, as the pre-tui-react `--json` branch behaved). Scope-discharged
 * internally; the final emit (visual render, or the `--output json` state
 * serialisation) fires as this effect's scope closes. Requires only
 * `OutputModeTag`, so command render programs are exercisable by `runTestCommand`
 * across every mode without a running service.
 */
export const runView = <A>(
  app: TuiApp<A, SetState<A>>,
  view: ReactElement,
  state: A,
): Effect.Effect<void, never, OutputModeTag> =>
  Effect.gen(function* () {
    const tui = yield* app.run(view)
    tui.dispatch({ _tag: 'SetState', state })
  }).pipe(Effect.scoped)
