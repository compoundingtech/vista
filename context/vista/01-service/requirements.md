# Service Requirements

> **Role.** The **substrate** node of Vista's [layered composition](../requirements.md):
> the standing service everything else runs on. It owns hosting, serving one global
> Vite dev server over the whole `apps/` tree, app versioning, the standing-service
> lifecycle (restart re-discovery, atomic publish, mount eviction), the structural
> render guarantee, canonical URL emission, and the effect-native request boundary.
> The medium (`02-medium`) renders on it, the agent interface (`03-agent-interface`)
> drives it, and feedback (`04-feedback`) attaches through it.

System-level context, assumptions, and acceptable tradeoffs live in the
[root requirements](../requirements.md); terms in [ontology.md](../ontology.md). IDs are
**path-scoped** to this node (`SVC-R*`); each requirement declares `refines:` its charter
(`VST-R*`) parent so the tree reads upward.

## Requirements

### Must keep the agent surface thin and the system thick

- **SVC-R05 System owns operations:** A standing service must own mounting, serving,
  versioning, and dependency provisioning. The agent must not perform per-app
  infrastructure setup (decision 0002). `refines: VST-R64`

### Must address and version apps durably

- **SVC-R09 Stable app identity:** Each app must have a stable, human-legible
  slug as its identity. `refines: VST-R40`
- **SVC-R10 Immutable versions:** Each publish must append an immutable version. The
  authored **source** (`app.tsx`, version metadata) never changes once
  published. A version's **frozen-data projection** is durable within one contract
  version only: it is stamped with the global `apiVersion` and, on a (rare) bump,
  is not migrated and may become unsupported (decisions 0004, 0061). `refines: VST-R66`
- **SVC-R11 Moving latest:** A moving `latest` pointer must always resolve to the
  newest version as the canonical entrypoint. `refines: VST-R40`
- **SVC-R12 Agent-authored change summary:** Each version must record a change summary
  authored at publish time, plus author, timestamp, and parent version. `refines: VST-R40`
- **SVC-R13 Retire, never delete:** An app may be retired (content withheld) but its
  versions must be preserved so durable links survive. `refines: VST-R40`
- **SVC-R14 Single canonical URL:** Apps must be served from one canonical host
  with collision-free owner-scoped path routing
  (`/r/<encoded-owner>/<local-slug>/<version|latest>/`), not a per-app URL/port.
  The HTTP owner segment is `o-` followed by lowercase hex of the exact identity's
  UTF-8 bytes, with strict lossless decoding and no reserved characters. Source,
  storage and resource URI encodings remain separate (decisions 0005, 0077).
  New publishes require the exact st v3 managed `agent/...` subject from
  `$ST_AGENT`; host placement is not owner identity. Humans and CI publish through
  a seat; `person/*` is never an owner. Dotted legacy owners are serve-only:
  their retained publications remain viewable at the canonical `o-<hex>` URL,
  safe historical unreserved dotted literals receive a 308 redirect to it,
  and serving rewrites retained owner routes to that canonical spelling.
  Publishing under a dotted owner is refused with a hint to run as a seat.
  Dotted `o-`-prefixed owners are unambiguous because canonical hex has no dot.
  `refines: VST-R40`
- **SVC-R15 Durable links:** A link to a specific version must keep resolving to that
  version's **identity and immutable source** as the agent publishes newer
  versions. Its **frozen data** renders durably within one contract version;
  across a rare global-`apiVersion` bump it is best-effort, not migrated (decision
  0061). `refines: VST-R66`
- **SVC-R57 Single metadata source:** An app's title, template, and `vista list`
  index projection must derive from its `doc.meta` single source (via a
  publish-time service-side projection), never a separately hand-maintained copy
  that can drift from the rendered app (decision 0053, resolves
  OQ-TITLE-PROJECTION). `refines: VST-R64`

### Must provide bounded-cost read access

- **SVC-R59 Read-only external contract:** Other services must be able to list
  Vista apps and read a published version summary through a versioned, typed,
  read-only service API that cannot invoke Vista control mutations.
  `refines: VST-R40`
- **SVC-R60 Cheap current app listing:** Repeated external app-list reads must
  avoid a full filesystem/snapshot scan per request while reflecting successful
  publish and retire operations and recovering from disk after restart.
  `refines: VST-R40`

### Must serve with low ceremony and bounded cost

- **SVC-R16 Zero-install shared dependencies:** Apps must resolve their
  dependencies (React, Vite, the block library, etc.) from a service-owned shared
  dependency set with no per-app install (decision 0006). `refines: VST-R65`
- **SVC-R17 Static immutable versions:** Each publish must build once with the
  repository-current pinned Vite toolchain. The immutable version must contain
  canonical React source, a derived schema-versioned semantic manifest, and
  content-addressed self-contained JS/CSS/assets. One generic copied-directory
  static runtime serves versions without source evaluation or ambient repository,
  workspace, dependency, or network resolution. The only network exception is
  optional, viewer-initiated, read-only RPC diagnostics in Vista-owned host chrome
  against the standing service on the trusted tailnet; it is not an App dependency
  or a mutable part of the immutable artifact. Publication must verify canonical
  base-path behavior and bind source, manifest, toolchain provenance, inventory, and
  output integrity to an externally trusted root; self-reported artifact metadata
  is insufficient. The draft remains the sole HMR surface (decisions 0075 and
  0076, superseding 0029's published mechanism). `refines: VST-R40`
- **SVC-R18 Restart re-discovery:** The service must rebuild its app registry from
  disk on restart, recovering all versions and `latest` without re-publishing. `refines: VST-R40`
- **SVC-R19 Atomic publish:** Version allocation must be atomic so concurrent
  publishes cannot drop content (resolves OQ-PUBLISH-RACE). `refines: VST-R40`
- **SVC-R20 Reclaimable mounts:** The service must be able to evict retired or stale
  mounts to reclaim watchers and caches over a long uptime (resolves OQ-EVICT). `refines: VST-R40`
- **SVC-R21 Bounded filesystem exposure:** The serving layer must scope filesystem
  access to the shared dependencies and the specific app root, not a broad
  parent directory (resolves OQ-FSALLOW). `refines: VST-R37`

### Must guarantee apps render

- **SVC-R58 Render guarantee:** The serving model must make it structurally
  impossible to serve an app that fails to mount (no raw, un-interop'd module
  can reach the browser), and this guarantee must be backed by a render
  regression test on the real render path that actually runs in CI — not one
  that can be silently skipped (decision 0052). `refines: VST-R01`

### Must emit the canonical URL

- **SVC-R55 Emit the canonical URL:** Every human-facing URL Vista surfaces (`publish`, `open`, `list`, and status/banner output) must be the canonical tailnet Service URL (`https://<service>.<tailnet>/r/<encoded-owner>/<local-slug>/<version|latest>/`), never the loopback RPC transport address. For new publishes, the owner is the exact st v3 managed subject in `$ST_AGENT`, independent of host placement and without normalization. The HTTP `encoded-owner` segment is `o-<hex>` as defined by SVC-R14; storage and resource-URI encodings retain their separate contracts (decisions 0005, 0077). The public/citable URL is a distinct concern from the loopback endpoint the CLI uses to reach its local service. When no canonical URL can be resolved, Vista must not silently emit a loopback URL: it fails unless local mode is explicitly opted into (`--local`/env), in which case the loopback URL is emitted and clearly marked non-canonical (decisions 0051, 0077). `refines: VST-R36`
