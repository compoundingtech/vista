import { Schema } from 'effect'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  decodeRouteOwner,
  encodeOwner,
  encodeRouteOwner,
  OwnerIdentity,
  PublishableOwnerIdentity,
} from './read-contract.ts'

describe('HTTP owner codec', () => {
  it('separates managed publication owners from retained servable owners', () => {
    for (const owner of ['agent/x/y', 'agent/author']) {
      expect(Schema.is(PublishableOwnerIdentity)(owner)).toBe(true)
      expect(Schema.is(OwnerIdentity)(owner)).toBe(true)
    }
    for (const owner of ['dev3.direct.omp.pnfr87q8', 'dev3.owner!']) {
      expect(Schema.is(PublishableOwnerIdentity)(owner)).toBe(false)
      expect(Schema.is(OwnerIdentity)(owner)).toBe(true)
    }
    for (const owner of ['person/johannes', 'bogus', 'agent', 'agent/', 'agent/A/b']) {
      expect(Schema.is(PublishableOwnerIdentity)(owner)).toBe(false)
      expect(Schema.is(OwnerIdentity)(owner)).toBe(false)
    }
  })

  it('round-trips exact owners without changing storage keys or introducing reserved bytes', () => {
    for (const owner of [
      'agent/compoundingtech/st-ios',
      'agent/author',
      'dev3.agent%2Fvista%2Fauthor',
      'dev3.owner~seat',
      'dev3.雪😀',
      'o-6162.owner',
      'dev3.\uFEFFowner',
    ]) {
      const segment = encodeRouteOwner(owner)
      expect(segment).toMatch(/^o-(?:[0-9a-f]{2})+$/)
      expect(decodeRouteOwner(segment)).toBe(owner)
      expect(decodeURIComponent(encodeOwner(owner))).toBe(owner)
    }
    expect(encodeRouteOwner('agent/compoundingtech/st-ios')).toBe(
      'o-6167656e742f636f6d706f756e64696e67746563682f73742d696f73',
    )
    expect(encodeOwner('agent/compoundingtech/st-ios')).toBe('agent%2Fcompoundingtech%2Fst-ios')
  })

  it('is injective and lossless across arbitrary historical owner UTF-8 suffixes', () => {
    const suffix = fc
      .array(
        fc
          .integer({ min: 0x21, max: 0x10ffff })
          .filter(
            (point) =>
              point !== 0x2f &&
              point !== 0x5c &&
              !(point >= 0x7f && point <= 0x9f) &&
              !(point >= 0xd800 && point <= 0xdfff),
          ),
        { minLength: 1, maxLength: 40 },
      )
      .map((points) => `dev3.${points.map((point) => String.fromCodePoint(point)).join('')}x`)
    fc.assert(
      fc.property(suffix, suffix, (left, right) => {
        expect(decodeRouteOwner(encodeRouteOwner(left))).toBe(left)
        expect(encodeRouteOwner(left) === encodeRouteOwner(right)).toBe(left === right)
      }),
    )
  })

  it('rejects malformed, noncanonical, invalid UTF-8 and percent-encoded routes', () => {
    for (const segment of [
      'o-',
      'o-0',
      'o-FF',
      'o-ff',
      'o-c080',
      'o-eda080',
      'o-f4908080',
      'o-6167656e742f',
      'o-6167656e742f617574686f72%2F',
      'agent%2Fcompoundingtech%2Fst-ios',
      'agent%252Fcompoundingtech',
      'dev3.agent%25author',
      'dev3.owner/seat',
      'dev3.owner!seat',
      '.',
      '..',
    ])
      expect(decodeRouteOwner(segment)).toBeUndefined()
    expect(() => encodeRouteOwner('dev3.\uD800')).toThrow('lossless UTF-8')
    expect(() => encodeRouteOwner('owner')).toThrow('invalid Vista owner')
  })

  it('accepts only unreserved legacy dotted literals, including an unambiguous o- namespace', () => {
    for (const owner of ['dev3.owner', 'dev3.owner~seat', 'o-6162.owner', 'o-.owner']) {
      expect(decodeRouteOwner(owner)).toBe(owner)
      expect(decodeRouteOwner(encodeRouteOwner(owner))).toBe(owner)
      expect(encodeRouteOwner(owner)).not.toBe(owner)
    }
    expect(decodeRouteOwner('o-6162')).toBeUndefined()
  })
})
