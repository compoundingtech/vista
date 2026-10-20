/**
 * The interview integration surface (decision 0013): the bounded structured-answer
 * round-trip. The contract is isomorphic (no node/vite imports); agent commands
 * use the typed VistaControlApi boundary instead of a parallel HTTP client.
 */
export {
  DecisionOption,
  DecisionQuestion,
  DecisionAnswer,
  StoredQuestion,
  AskInput,
  AskResult,
  AwaitResult,
  AnswerInput,
} from './contract.ts'
export {
  createInterviewStore,
  type InterviewStore,
  type AwaitOutcome,
  type SubmitOutcome,
} from './store.ts'
export { handleInterview } from './endpoints.ts'
