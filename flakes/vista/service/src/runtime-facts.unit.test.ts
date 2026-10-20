import { afterEach, describe, expect, it } from 'vitest'

import { actorSource } from './runtime-facts.ts'

const originalLocal = process.env.VISTA_LOCAL_VIEWER_IDENTITIES
const originalTailscale = process.env.VISTA_TRUST_TAILSCALE_IDENTITY_HEADERS

afterEach(() => {
  if (originalLocal === undefined) delete process.env.VISTA_LOCAL_VIEWER_IDENTITIES
  else process.env.VISTA_LOCAL_VIEWER_IDENTITIES = originalLocal
  if (originalTailscale === undefined) delete process.env.VISTA_TRUST_TAILSCALE_IDENTITY_HEADERS
  else process.env.VISTA_TRUST_TAILSCALE_IDENTITY_HEADERS = originalTailscale
})

describe('Vista runtime facts', () => {
  it('defaults to no actor source', () => {
    delete process.env.VISTA_LOCAL_VIEWER_IDENTITIES
    delete process.env.VISTA_TRUST_TAILSCALE_IDENTITY_HEADERS

    expect(actorSource()).toBe('none')
  })

  it('reports only the explicitly enabled actor source', () => {
    process.env.VISTA_LOCAL_VIEWER_IDENTITIES = '1'
    expect(actorSource()).toBe('loopback-dev')

    process.env.VISTA_TRUST_TAILSCALE_IDENTITY_HEADERS = '1'
    expect(actorSource()).toBe('tailscale')
  })
})
