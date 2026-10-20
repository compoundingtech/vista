import { expect, test } from 'vitest'

import { draftCapture, emptyCapture, fullCapture } from './stories/_app-source-fixtures.ts'
import { isSelfSourcePayload, SELF_CAPTURE_FILENAME, selfSourceUrl } from './self-inspection.ts'

test('an owner route resolves to the version-local capture file', () => {
  expect(
    selfSourceUrl('/r/vista.tests/demo/v3/', 'https://vista.example/r/vista.tests/demo/v3/'),
  ).toBe('https://vista.example/r/vista.tests/demo/v3/vista-self.json')
  expect(SELF_CAPTURE_FILENAME).toBe('vista-self.json')
})

test('the latest alias resolves the same way — the alias target serves its own capture', () => {
  expect(
    selfSourceUrl('/r/vista.tests/demo/latest', 'https://vista.example/r/vista.tests/demo/latest'),
  ).toBe('https://vista.example/r/vista.tests/demo/latest/vista-self.json')
})

test('off-route pathnames resolve to no toggle', () => {
  expect(selfSourceUrl('/', 'https://vista.example/')).toBeUndefined()
  expect(selfSourceUrl('/_vista/apps', 'https://vista.example/_vista/apps')).toBeUndefined()
})

test('a full capture and a draft capture both satisfy the structural guard', () => {
  expect(isSelfSourcePayload(fullCapture)).toBe(true)
  expect(isSelfSourcePayload(draftCapture)).toBe(true)
  expect(isSelfSourcePayload(emptyCapture)).toBe(true)
})

test('the guard rejects non-captures without schema verdicts', () => {
  expect(isSelfSourcePayload(undefined)).toBe(false)
  expect(isSelfSourcePayload(null)).toBe(false)
  expect(isSelfSourcePayload({})).toBe(false)
  expect(isSelfSourcePayload({ ...fullCapture, files: 'app.tsx' })).toBe(false)
  expect(
    isSelfSourcePayload({
      ...fullCapture,
      files: [{ path: 'app.tsx', contents: 42 }],
    }),
  ).toBe(false)
  expect(isSelfSourcePayload({ ...fullCapture, version: 0 })).toBe(false)
  expect(isSelfSourcePayload({ ...fullCapture, version: 'v3' })).toBe(false)
})
