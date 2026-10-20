/**
 * MED.DATA-R31 secret value-scan backstop (decision 0031): the encoded payload that lands
 * durably is scanned for credential-shaped strings. A planted `sk-…` canary must
 * be caught (proven load-bearing in the freeze spike), and a clean payload must
 * produce no findings.
 */
import { describe, expect, it } from 'vitest'

import { assertNoSecrets } from './secrets.ts'

describe('assertNoSecrets', () => {
  it('catches key-shaped sk- tokens without treating skill names as credentials', () => {
    const plainToken = `sk-${'a'.repeat(24)}`
    const projectToken = `sk-proj-${'b'.repeat(24)}`
    const findings = assertNoSecrets({
      nested: { plainToken, projectToken },
      prose: ['sk-address-pr-reviews', 'skill://sk-pr'],
    })
    expect(findings).toHaveLength(2)
    expect(findings.map((finding) => finding.path)).toEqual([
      '$.nested.plainToken',
      '$.nested.projectToken',
    ])
    expect(findings.every((finding) => finding.pattern === 'token-like (sk-…)')).toBe(true)
    expect(findings[0]!.preview).not.toContain(plainToken)
    expect(findings[1]!.preview).not.toContain(projectToken)
  })

  it('catches a github PAT and a bearer header across an array', () => {
    const findings = assertNoSecrets([
      'authorization: Bearer abcdefghijklmnop',
      'ghp_0123456789abcdefghij0',
    ])
    expect(findings.map((f) => f.pattern).sort()).toEqual(['bearer header', 'github pat'])
  })

  it('passes a clean encoded payload', () => {
    expect(assertNoSecrets({ repo: 'cli/cli', pr: 42, files: ['a.ts', 'b.ts'] })).toEqual([])
  })
})
