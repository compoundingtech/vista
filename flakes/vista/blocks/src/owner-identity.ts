/**
 * Native managed-subject grammar authority:
 * nixpkgs/home-manager/modules/ai/session/identity.nix managedAgentSubjectRegex.
 * Vista preserves the exact subject; its layout encoder never normalizes identity.
 */
const MANAGED_AGENT_SUBJECT_RE = /^agent(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/u
const LEGACY_OWNER_RE = /^[^./\\\p{Cc}]+\.(?!\.{1,2}$)[^/\\\p{Cc}]+$/u
const DOTTED_CONTRIBUTOR_RE = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*\.)+[a-z0-9]+(?:-[a-z0-9]+)*$/u

const isNonEmptyTrimmed = (value: string): boolean => value.length > 0 && value.trim() === value

/** Native subjects accept one or more lowercase label segments, without aliases. */
export const isManagedAgentSubject = (owner: string): boolean =>
  isNonEmptyTrimmed(owner) && MANAGED_AGENT_SUBJECT_RE.test(owner)

/** Historical Vista owners retain their broad, exact first-dot namespace contract. */
export const isLegacyOwnerIdentity = (owner: string): boolean =>
  isNonEmptyTrimmed(owner) && LEGACY_OWNER_RE.test(owner)

/** Servable owners include retained legacy identities; only managed subjects may publish. */
export const isValidOwnerIdentity = (owner: string): boolean =>
  isManagedAgentSubject(owner) || isLegacyOwnerIdentity(owner)

/** Contributor attribution retains the historical strict dotted-label boundary. */
export const isValidContributorIdentity = (identity: string): boolean =>
  isManagedAgentSubject(identity) || (isNonEmptyTrimmed(identity) && DOTTED_CONTRIBUTOR_RE.test(identity))

/** Lossless RFC 3986 segment for exact owners in source/storage and resource URI layouts. */
export const encodeOwner = (owner: string): string => {
  if (!isValidOwnerIdentity(owner)) throw new Error(`invalid Vista owner identity: ${owner}`)
  return encodeURIComponent(owner).replace(
    /[!'()*]/g,
    (character) => `%${character.codePointAt(0)!.toString(16).toUpperCase()}`,
  )
}

const ownerUtf8Encoder = new TextEncoder()
const ownerUtf8Decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/** Canonical HTTP owner segment: exact UTF-8 bytes, with no reserved characters. */
export const encodeRouteOwner = (owner: string): string => {
  if (!isValidOwnerIdentity(owner)) throw new Error(`invalid Vista owner identity: ${owner}`)
  const bytes = ownerUtf8Encoder.encode(owner)
  if (ownerUtf8Decoder.decode(bytes) !== owner) throw new Error('Vista owner is not lossless UTF-8')
  return `o-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Decode only the captured HTTP segment, never percent-decode an owner. Historical
 * unreserved dotted literals remain readable. Canonical o-hex contains no dot,
 * so even legacy owners starting with o- are unambiguous.
 */
export const decodeRouteOwner = (segment: string): string | undefined => {
  if (/^o-(?:[0-9a-f]{2})+$/.test(segment)) {
    try {
      const hex = segment.slice(2)
      const bytes = Uint8Array.from(
        { length: hex.length / 2 },
        (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
      )
      const owner = ownerUtf8Decoder.decode(bytes)
      return encodeRouteOwner(owner) === segment ? owner : undefined
    } catch {
      return undefined
    }
  }
  return /^[A-Za-z0-9._~-]+$/.test(segment) && isLegacyOwnerIdentity(segment)
    ? segment
    : undefined
}
