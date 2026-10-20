/**
 * The interview contract (decision 0013): the typed `DecisionQuestion` an agent
 * poses, the closed `DecisionAnswer` the human returns, and the wire-store record
 * that binds the two by `(appId, questionId)` (the decision-0009 scope key).
 *
 * Isomorphic on purpose — `effect/Schema` only, NO node/vite imports. The browser
 * question component, the in-service store + viewer bridge endpoints, the typed
 * control RPC, and the CLI all import this one module, so the question shape can
 * never drift across the faces (the same discipline `app.ts` follows for the
 * freeze descriptor). It is reached by its own subpath, never through the
 * `@vista/service` index barrel, so CLI/test code does not transitively pull in
 * Vite via `server.ts`.
 *
 * Plain `Schema.Struct`s (not `Schema.Class`) so a nested value is built from a
 * plain object literal everywhere — the agent constructs questions, the wire
 * carries plain JSON, and the store holds plain records, with one decode at each
 * trust boundary (`Schema.decodeUnknown*`). The derived `*.Type` aliases give the
 * static types.
 *
 * Boundedness (holds the 0001/0013 line): the answer is the closed shape
 * `{ chosenOptionIds }` over the agent's OWN explicit options — there is no
 * freeform text field. General/freeform annotation stays delegated (agentation /
 * plannotator); Vista captures only the structured decision-question.
 */
import { Schema } from 'effect'

/** One option the agent offers, with the tradeoff that distinguishes it. */
export const DecisionOption = Schema.Struct({
  /** Stable within a question; the answer references these ids. */
  id: Schema.String,
  label: Schema.String,
  /** Why one would pick this branch over the others (the distinguishing cost). */
  tradeoff: Schema.String,
}).annotate({ identifier: 'Vista.DecisionOption' })
export type DecisionOption = typeof DecisionOption.Type

/**
 * A structured decision-question (the app's "ask"). A superset of the three
 * prior-art primitives' shapes: AskUserQuestion's `options`/`multiSelect`,
 * grill-me's `recommendedDefault`/`evidenceGaps`, plus `aboutBlockIds` linking the
 * question to the rendered app's stable block ids (the no-migration attach
 * point, VST-R04 / decision 0008).
 */
export const DecisionQuestion = Schema.Struct({
  question: Schema.String,
  options: Schema.Array(DecisionOption).check(Schema.isMinLength(1)),
  /** Whether more than one option may be chosen. */
  multiSelect: Schema.Boolean,
  /** The option id the agent leans toward (must be one of `options`). */
  recommendedDefault: Schema.optional(Schema.String),
  /** What evidence the agent is still missing — surfaced so the human can weigh it. */
  evidenceGaps: Schema.optional(Schema.Array(Schema.String)),
  /** Stable block ids in the rendered app this question is about (decision 0008). */
  aboutBlockIds: Schema.optional(Schema.Array(Schema.String)),
}).annotate({ identifier: 'Vista.DecisionQuestion' })
export type DecisionQuestion = typeof DecisionQuestion.Type

/**
 * The closed answer: which option ids the human chose. No freeform field — that
 * is the boundedness guarantee (decision 0013 vs 0001). A single-select question
 * yields exactly one id; a `multiSelect` question may yield several.
 */
export const DecisionAnswer = Schema.Struct({
  chosenOptionIds: Schema.Array(Schema.String).check(Schema.isMinLength(1)),
}).annotate({ identifier: 'Vista.DecisionAnswer' })
export type DecisionAnswer = typeof DecisionAnswer.Type

/**
 * A pending or answered question in the store. `questionId` is server-assigned at
 * `ask` time; `(appId, questionId)` is the scope key every face matches on.
 */
export const StoredQuestion = Schema.Struct({
  appId: Schema.String,
  questionId: Schema.String,
  question: DecisionQuestion,
  /** Set once the human answers; `null` while pending. First-write-wins. */
  answer: Schema.NullOr(DecisionAnswer),
  /** Epoch ms the question was registered (for ordering / diagnostics). */
  askedAt: Schema.Int,
  /** Epoch ms the answer landed; `null` while pending. */
  answeredAt: Schema.NullOr(Schema.Int),
}).annotate({ identifier: 'Vista.StoredQuestion' })
export type StoredQuestion = typeof StoredQuestion.Type

/** `vista_ask` payload: the agent registers a question for a app. */
export const AskInput = Schema.Struct({
  appId: Schema.String,
  question: DecisionQuestion,
}).annotate({ identifier: 'Vista.AskInput' })
export type AskInput = typeof AskInput.Type

/** `vista_ask` result: the server-assigned id the agent later awaits. */
export const AskResult = Schema.Struct({
  appId: Schema.String,
  questionId: Schema.String,
}).annotate({ identifier: 'Vista.AskResult' })
export type AskResult = typeof AskResult.Type

/**
 * `vista_await` result. The re-arm transport (decision 0013 / the feasibility
 * spike): a single await call blocks for a SHORT bounded window, then returns
 * either the answer (`answered`) or `pending` — on `pending` the agent simply
 * re-issues, so a human's minutes of think-time are spanned by many short
 * server-side blocks rather than one long-poll Vite/proxy would reset.
 */
export const AwaitResult = Schema.Union([
  Schema.TaggedStruct('answered', {
    appId: Schema.String,
    questionId: Schema.String,
    answer: DecisionAnswer,
  }),
  Schema.TaggedStruct('pending', {
    appId: Schema.String,
    questionId: Schema.String,
  }),
]).annotate({ identifier: 'Vista.AwaitResult' })
export type AwaitResult = typeof AwaitResult.Type

/** The browser POSTs this to `/_answer`; the server scopes it to `(appId, questionId)`. */
export const AnswerInput = Schema.Struct({
  appId: Schema.String,
  questionId: Schema.String,
  answer: DecisionAnswer,
}).annotate({ identifier: 'Vista.AnswerInput' })
export type AnswerInput = typeof AnswerInput.Type
