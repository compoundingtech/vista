# Managed st v3 subjects own new publications; dotted owners are serve-only

Status: accepted

Provenance: Johannes, live pairing with the Vista owner (agent/dotfiles/vista), 2026-10-11

## Context

Decision 0077 established owner-scoped identity and lossless storage and resource
URI encodings, but described the owner as host-qualified `$ST_AGENT`. In st v3,
the managed subject is `agent/<label>(/<label>)*`: the host is placement, not
identity. Keeping host qualification would attribute the same seat differently
when its placement changes.

Retained publications also have dotted owners such as `dev3.direct.omp.pnfr87q8`.
Their exact identities and durable links must survive without re-attribution
(decision 0077). The collision-free HTTP route from #5413 uses `o-<hex>`, with a
308 redirect from safe dotted literal routes and serve-time rewriting of retained
owner routes. HTTP routing does not require changing storage or resource URIs.

## Options

| Option                                                                          | Tradeoffs                                                                                                                                                               |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — st v3 managed subjects only for new publishes; dotted owners serve-only** | Makes seat identity independent of host placement and leaves retained publications untouched; legacy callers must run as a seat to publish.                             |
| **B — accept managed subjects and dotted owners for new publishes**             | Preserves legacy publish workflows; perpetuates two owner models and allows host placement to keep creating distinct publication identities.                            |
| **C — require host-qualified owners for new publishes**                         | Retains the historical owner model; conflicts with st v3 subject identity and requires deriving placement into attribution rather than using the exact managed subject. |

## Decision

Choose **A**. A new publication's owner is the exact st v3 managed subject in
`$ST_AGENT`, with grammar `^agent(/<label>)+$`. Labels follow
`managedAgentSubjectRegex` in
`nixpkgs/home-manager/modules/ai/session/identity.nix`: lowercase alphanumeric
words joined by single hyphens. No host qualification or normalization is added.
Humans and CI publish through a seat; `person/*` is never a Vista owner.

Dotted legacy owners are read-only. Their retained publications remain viewable
at the canonical `o-<hex>` HTTP URL; the 308 redirect and serve-time rewriting
remain. Publishing under a dotted owner is refused with a hint to run as a seat.
There is no migration of old apps, aliasing, or re-attribution.

The HTTP owner segment is `o-` followed by lowercase hex of the exact owner's
UTF-8 bytes (SVC-R14). Storage and resource-URI encodings retain the separate
lossless contracts from decisions 0005 and 0077.

## Consequences

- SVC-R14, SVC-R55, and AGT.CLI-R56 constrain new publishes to managed seats.
- Authoring resolves owner-scoped source storage without a first-dot split.
- App and version resource profiles use the exact subject without changing their
  RFC 3986 owner encoding.
- Historical publications retain their original owner and canonical view URL.
- OQ-OWNER-REQUIREMENTS is resolved by the explicit requirements revision.

## References

- [Service requirements](../01-service/requirements.md)
- [CLI requirements](../03-agent-interface/01-cli/requirements.md)
- [Authoring spec](../02-medium/01-authoring/spec.md#appsource)
- [Decision 0005](./0005-single-canonical-url-with-path-routing.md)
- [Decision 0077](./0077-owner-scoped-source-with-automatic-typed-receipts.md)
- [Canonical owner routing, #5413](https://github.com/schickling/dotfiles/pull/5413)
