# Owner-scoped source with automatic typed receipts

Status: accepted

## Context

Vista source currently follows the caller's working directory, conventionally
`tmp/vista/<slug>`, while published apps live in a global basename-keyed store.
This disconnects source ownership and lifecycle from the agent that authored it.
Requiring every app to mutate the owner's `agent.kdl` would restore generic Resource
visibility, but current st2 updates require full CAS replacement of the Agent Spec
and do not atomically create a resource directory and bind it to an existing seat.

## Options

| Option | Binding | Trade-off |
| --- | --- | --- |
| Mandatory Agent Spec binding | Add every Vista as a direct per-app `agent.kdl` resource | Generic discovery, but creation requires coordinated spec mutation with no current atomic directory-plus-binding transaction |
| Typed folder and receipts | Resolve owner-scoped source through a typed URI and issue receipts automatically | One-command authoring and no spec churn; Vista must provide discovery and provenance |

## Decision

Choose typed folder and receipts. Canonical editable source lives at
`$XDG_STATE_HOME/vista/sources/<host>/<seat>/<local-slug>` in Vista-owned state. It is
addressed as `vista-source://agent/<encoded-owner>/<local-slug>` and resolved
through `$ST_AGENT`; callers do not infer ownership from cwd, an explicit source
path, or a global basename. `encoded-owner` is the lossless RFC 3986 path-segment
encoding of the exact canonical host-qualified `$ST_AGENT` identity, without case
folding, dot rewriting, or inferred host normalization. App identity is
`owner × local-slug`.

Every App-scoped command derives the exact canonical host-qualified owner from
`$ST_AGENT` and accepts the exact owner-local slug. There is no owner flag.
`list` and fleet-wide diagnostics remain global. Managed state lives under
`apps/_owned/<encoded-owner>/<local-slug>`. Pre-cutover unowned `apps/<slug>`
state is cold-archived in a disjoint legacy namespace: current scans, routing,
indexes, and owner-scoped commands never select or serve it.

`vista publish <local-slug>` resolves canonical source and automatically emits a
typed receipt binding `vista-source://agent/<encoded-owner>/<local-slug>` to
`dev.schickling.vista-app://<service-authority>/<encoded-owner>/<local-slug>` and
the resulting
`dev.schickling.vista-version://<service-authority>/<encoded-owner>/<local-slug>/<version>`.
Canonical browser routes use
`/r/<encoded-owner>/<local-slug>/<draft|latest|version>/`. Prior
`/r/<slug>/...` notation is historical only; no slug-only compatibility route or
scan remains. The published static artifact remains service-owned. A direct
per-Vista `agent.kdl` resource declaration is optional and is used only when the
Vista participates in a current-work or dependency relationship.
Mandatory binding is deferred until st2 provides a mediated atomic mutation
contract; track
[compoundingtech/st2#231](https://github.com/compoundingtech/st2/issues/231).

## Evidence and Argument

The author-friction evaluation found that the documented path required three CLI
calls taking 91.099 seconds, with about 30 seconds spent finalizing telemetry after
each call. A one-file `app.tsx` dry-run added `index.html` and `main.tsx`; the
separate scaffolded three-file control was not changed. Dry-run also accepted TODO
content, duplicate IDs, and unknown tags. These failures favor canonical ownership,
one-command publication, validation before planning or mutation, and nonblocking
bounded telemetry finalization.

## Consequences

- The common path is authoring the canonical AppSource's `app.tsx` and running
  exactly one required command,
  `vista publish <local-slug> --message <summary>`.
- `vista new <local-slug>` and `vista rehydrate <local-slug> [version]` target the
  same canonical source as publish; lifecycle and inspection commands target the
  same owner-scoped app.
- Vista discovers ownership from `$ST_AGENT`, validates before returning a publish
  plan or mutating source/service state, and owns generic shell/build work.
- Agent Specs remain authoritative for current-work and dependency bindings without
  becoming a per-app registry Vista must rewrite.
- Reproducing or continuing another agent's App is a publication under the
  publishing agent's own identity and local slug, at its own URL. Ownership is
  never re-attributed and identity is never supplied as an argument, so an
  agent may freely republish work without weakening the owner binding.

## Greenfield amendment: exact identity and cold archive

Owner resolution must reproduce the host-qualified `$ST_AGENT` identity
byte-for-byte and combine it with the exact local slug supplied to the command.
Neither component is normalized or inferred.

### Local-slug grammar

A local slug is exactly `^[a-z0-9]+(?:-[a-z0-9]+)*$`: lowercase ASCII
alphanumeric segments joined by single hyphens, with no leading, trailing, or
doubled hyphen and no other character. Consequences of that grammar:

- **No encoding step.** A valid slug is already one RFC 3986 unreserved path
  segment, so route, filesystem, and Resource-URI use is byte-identical to the
  supplied slug and decoding is the identity function. Only the owner component
  is percent-encoded (`encoded-owner`).
- **Reject, never normalize.** Any other input — uppercase, whitespace, `/`,
  `%`, `.`, `..`, `_`, other punctuation, non-ASCII or differently
  Unicode-normalized text, an empty string, or a hyphen-edged value — is refused
  with a typed invalid-slug error naming the grammar. Vista must not case-fold,
  transliterate, NFC/NFKC-normalize, slugify, truncate, or percent-encode a
  rejected value into a valid one, because that would silently bind work to a
  different identity.
- **Reserved-looking values stay legal.** `latest`, `draft`, and `v3` are valid
  slugs: the slug occupies its own route segment
  (`/r/<encoded-owner>/<local-slug>/<version|latest>/`), so a version-shaped slug
  is never confused with a version selector. Version selectors themselves remain
  exact `vN`, and `latest` is never accepted as a version identity.

### Cold archive and rollback of the pre-cutover namespace

Pre-cutover slug-only state is cold-archived once, as an operator-run migration,
not by the serving path:

- **Destination.** `${stateDir}/archive/legacy-slug-only-v1/apps`, where
  `stateDir` is the parent of the live apps root (for example
  `/var/lib/vista/apps` → `/var/lib/vista/archive/legacy-slug-only-v1/apps`). The
  archive is on the same filesystem as the live root and is disjoint from it, so
  no scan, index, route, receipt lookup, or owner-scoped command can reach it.
- **Transaction.** The service is stopped for the move. The whole legacy root is
  relocated by a single same-filesystem atomic rename — including every version
  directory, `latest` symlink, `RETIRED` marker, publication root, receipt, and
  island pin. Because it is a move rather than a copy, bytes, symlink targets,
  and modes are preserved exactly; no rewriting, re-encoding, or re-receipting of
  archived state is permitted.
- **Fail closed.** If the destination already exists with different content, if
  live and legacy state are mixed in one root, or if the move cannot be atomic on
  one filesystem, the migration aborts and changes nothing. It never merges,
  overwrites, or partially relocates.
- **Idempotent.** Re-running after a completed migration is a no-op: legacy state
  absent from the live root and present in the archive is success, not an error.
- **Rollback.** Reversal is available only while the new `_owned` namespace is
  still empty, which keeps it a pointer reversal rather than a merge. The
  operator stops the service, removes the empty new root, atomically moves the
  archived root back to its original path, and activates the prior Vista closure.
  Once any owner-scoped version has been published, roll-forward is the only
  supported direction.

## Greenfield terminology amendment

The canonical editable carrier is AppSource. The service exposes the durable App
as AppResource and its browsable projection as AppIndex. Publish creates an
AppVersion and its PublicationReceipt, then returns the pinned URL.
