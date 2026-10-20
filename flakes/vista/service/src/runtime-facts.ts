import type { ActorSource } from '@vista/blocks/internal/provider-contracts'

/** The service-controlled source from which LivePty may derive a trusted actor. */
export const actorSource = (): ActorSource => {
  // This flag stays fail-closed until the managed Tailscale forwarding path is proven.
  if (process.env.VISTA_TRUST_TAILSCALE_IDENTITY_HEADERS === '1') return 'tailscale'
  if (process.env.VISTA_LOCAL_VIEWER_IDENTITIES === '1') return 'loopback-dev'
  return 'none'
}
