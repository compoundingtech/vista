import { Schema } from 'effect'

import { PublishFailed, PublishInput, PublishOk } from './control.ts'

/** Only data crosses this boundary: the worker loads authored capture closures itself. */
export const PublishWorkerRequest = Schema.Struct({
  version: Schema.Literal(1),
  input: PublishInput,
  attemptId: Schema.String,
  renderBaseUrl: Schema.optionalKey(Schema.String),
  parentSpan: Schema.Struct({
    traceId: Schema.String,
    spanId: Schema.String,
    sampled: Schema.Boolean,
  }),
})

export const PublishWorkerResponse = Schema.Union([
  Schema.TaggedStruct('Published', { version: Schema.Literal(1), result: PublishOk }),
  Schema.TaggedStruct('Failed', { version: Schema.Literal(1), error: PublishFailed }),
])

export const PublishWorkerRequestJson = Schema.fromJsonString(PublishWorkerRequest)
export const PublishWorkerResponseJson = Schema.fromJsonString(PublishWorkerResponse)
