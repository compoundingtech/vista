/**
 * MED.DATA-R31 secret assertion at freeze (decision 0031). The PRIMARY guard is
 * schema-level: a `Redacted`/`Sensitive`-branded field cannot be encoded, so a
 * secret never reaches the snapshot. This module is the value-scan BACKSTOP — it
 * recursively scans the ENCODED payload (the bytes that actually become durable)
 * for credential-shaped strings, catching a buggy provider that interpolates a
 * token into an otherwise-safe field regardless of the schema's intent.
 *
 * The scan is the backstop precisely because the schema annotation depends on
 * the author remembering to annotate; the value scan does not.
 *
 * Harvested from proto-freeze.
 */

/** Patterns that indicate a credential leaked into a value. */
const SECRET_PATTERNS: ReadonlyArray<{ readonly name: string; readonly re: RegExp }> = [
  { name: 'token-like (sk-…)', re: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_]{20,}\b/ },
  { name: 'bearer header', re: /\bBearer\s+[A-Za-z0-9._-]{12,}\b/i },
  { name: 'github pat', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'aws access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
]

/**
 * Describes a single detected secret: its JSON path within the encoded payload, which pattern
 * matched, and a redacted preview that never exposes the full value.
 */
export interface SecretFinding {
  /** JSON path into the encoded payload where the secret was found. */
  readonly path: string
  /** Which pattern matched. */
  readonly pattern: string
  /** A redacted preview (never the full secret). */
  readonly preview: string
}

const redact = (s: string): string =>
  s.length <= 6 ? '***' : `${s.slice(0, 3)}…${s.slice(-2)} (${s.length} chars)`

/** Recursively scan an encoded JSON value for secret-looking strings. */
export const assertNoSecrets = (value: unknown, path = '$'): ReadonlyArray<SecretFinding> => {
  const findings: SecretFinding[] = []
  const visit = (v: unknown, p: string): void => {
    if (typeof v === 'string') {
      for (const { name, re } of SECRET_PATTERNS) {
        const m = re.exec(v)
        if (m) findings.push({ path: p, pattern: name, preview: redact(m[0]) })
      }
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => visit(x, `${p}[${i}]`))
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) visit(x, `${p}.${k}`)
    }
  }
  visit(value, path)
  return findings
}
