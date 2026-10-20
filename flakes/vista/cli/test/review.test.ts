import { Effect, Layer, Stream } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  advisoryReview,
  buildReviewRequest,
  parseReviewResponse,
  readReviewBody,
} from '../src/review.ts'

const finding = {
  rule: 'T1',
  critique: 'Hypothesis: context is unclear.',
  next: 'Add an ELI5 brief.',
}
const completion = (content: string) => ({ choices: [{ message: { content } }] })

describe('advisory review critic contract', () => {
  it('builds an OpenAI multimodal request with both themes and no credentials', () => {
    const request = buildReviewRequest(
      'T1 — Context first.',
      ['light', 'dark'].map((theme) => ({
        theme: theme === 'light' ? 'light' : 'dark',
        screenshot: `${theme}-png`,
        words: 42,
        elements: 12,
        context: true,
      })),
    )
    expect(request.model).toBe('anthropic/claude-opus-5-5')
    expect(request.messages[0]?.content).toContain('T1 — Context first.')
    expect(request.messages[1]?.content).toEqual([
      {
        type: 'text',
        text: 'light, 1440x900 first viewport: 42 words, 12 visible elements, context header/brief: yes.',
      },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,light-png' } },
      {
        type: 'text',
        text: 'dark, 1440x900 first viewport: 42 words, 12 visible elements, context header/brief: yes.',
      },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,dark-png' } },
    ])
    expect(request).not.toHaveProperty('token')
  })

  it('parses plain and fenced JSON without changing the critic ranking', async () => {
    const json =
      '{"findings":[{"rule":"T1","critique":"Hypothesis: context is unclear.","next":"Add an ELI5 brief."}]}'
    for (const content of [json, `\`\`\`json\n${json}\n\`\`\``]) {
      expect(await Effect.runPromise(parseReviewResponse(completion(content)))).toEqual([finding])
    }
  })

  it('caps output at five findings and accepts no findings', async () => {
    const encode = (count: number) =>
      `{"findings":[${Array.from({ length: count }, () => '{"rule":"T1","critique":"Brief missing","next":"Add brief"}').join(',')}]}`
    expect(await Effect.runPromise(parseReviewResponse(completion(encode(8))))).toHaveLength(5)
    expect(await Effect.runPromise(parseReviewResponse(completion(encode(0))))).toEqual([])
  })

  it('rejects malformed envelopes, non-JSON, and missing rule/next fields', async () => {
    for (const value of [
      { choices: [] },
      completion('not JSON'),
      completion('{"findings":[{"critique":"uncited opinion"}]}'),
    ]) {
      await expect(Effect.runPromise(parseReviewResponse(value))).rejects.toBeDefined()
    }
  })

  it('rejects oversized response streams before decoding or consuming more chunks', async () => {
    let consumedAfterLimit = false
    const body = Stream.concat(
      Stream.make(new Uint8Array(128 * 1024), new Uint8Array(128 * 1024 + 1)),
      Stream.fromEffect(
        Effect.sync(() => {
          consumedAfterLimit = true
          return new Uint8Array(1)
        }),
      ),
    )
    await expect(Effect.runPromise(readReviewBody(body))).rejects.toThrow('exceeds 256 KiB')
    expect(consumedAfterLimit).toBe(false)
  })

  it('decodes a bounded response split across network chunks', async () => {
    const wire = '{"choices":[{"message":{"content":"{\\"findings\\":[]}"}}]}'
    const bytes = new TextEncoder().encode(wire)
    const findings = await Effect.runPromise(
      readReviewBody(Stream.make(bytes.slice(0, 17), bytes.slice(17))),
    )
    expect(findings).toEqual([])
  })

  it('keeps layer initialization failures advisory', async () => {
    const program = Effect.void.pipe(
      Effect.provide(Layer.effectDiscard(Effect.fail('private initialization detail'))),
    )
    await expect(Effect.runPromise(advisoryReview(program))).resolves.toBeUndefined()
  })
})
