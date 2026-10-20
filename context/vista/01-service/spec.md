# Service Spec

This document specifies the Vista service substrate. It builds on
[requirements.md](./requirements.md); system-level context is in the
[root requirements](../requirements.md) and terms in [ontology.md](../ontology.md).

## Status

Draft. Subsystem mechanism for the substrate; current implementation drift is
tracked in the root [.delta/](../.delta/).

## Architecture

The substrate is one standing service with a Vite/HMR draft authoring surface and a
generic copied-directory static-serving surface for published versions. The CLI
is thin and reaches the service over a loopback control RPC; the service holds the
mounted providers, owns version allocation and the freeze capture, and serves every
`owner × local-slug × version` as an MPA entry under a single canonical tailnet URL.

```text
  vista CLI ──/_rpc/control (loopback)──▶ Standing service (effect-native host, dec 0060)
                                            │  request boundary = @effect/platform HttpRouter
                                            │  upgrade/WS boundary = Vite-owned (HMR)
                                            ▼
                                   draft Vite/HMR + publish builder + static directory server
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼                                    ▼                                    ▼
  /r/<encoded-owner>/<local-slug>/vN/       (immutable static dir)  /r/<encoded-owner>/<local-slug>/draft/
  /r/<encoded-owner>/<local-slug>/latest    (follow-latest)         / and /r/ (browsable app index)

  mutable state: /var/lib/vista/apps/_owned/<storage-owner>/<local-slug>/{_staging,v1,v2,…,latest→vN,RETIRED?}
  immutable deps: vista-deps Nix store closure  ──▶  apps root node_modules symlink
```

Canonical host:
`https://<service>.<tailnet>/r/<encoded-owner>/<local-slug>/<version|latest>/`
(SVC-R55, SVC-R14). `encoded-owner` is `o-` followed by lowercase hex of the
exact owner's UTF-8 bytes. It contains only unreserved ASCII; invalid UTF-8,
noncanonical hex, percent escapes and identities that cannot round-trip are
rejected. All HTTP producers and readers share this codec. Storage and resource
URI keys retain their existing percent encoding and are never route keys.
Safe historical unreserved dotted literal owners receive a method-preserving
308 redirect to the canonical URL. Even literals starting with `o-` are
unambiguous: historical owners require a dot and canonical hex cannot contain one.
Forbidden percent-owner URLs are not aliases. All human-facing URLs are the
canonical Service URL, never the loopback RPC transport.

## Read-only RPC projection (SVC-R59, SVC-R60)

```text
disk AppIndex ──startup scan──▶ service AppIndex ──row projection──▶ /_rpc/read
                               ▲
                     publish / retire refresh
```

Vista owns `VistaReadApi` at `@vista/service/read`. The allowlisted Effect
`RpcGroup` has only `vista.read.apps.list` (`NoPayload → AppRow[]`) and
`vista.read.version.get` (`AppVersionIdentity → VersionSummary`). The former
reuses the `AppRow` schema exported by the control contract; the latter uses
the same version summary, unknown-version and read-failure schemas as control.
The contract imports only Effect and the Vista schema/envelope definitions,
not Vite, runtime policy, or the service entrypoint. RPC payload and success
use the same global `apiVersion` envelope, `layerJson` serialization, and
version-first `wireCall`/`wireHandler` decoding as control; version skew fails
closed. Consumers (including Hub) use this read group and `/_rpc/read`, never
`VistaControlApi` or `/_rpc/control`, for these queries. The read group exposes
no write tags, and its route mounts only read handlers.

The list reads the service-owned in-memory AppIndex seeded by `scanAll()` at
startup. Successful publish and retire call the existing `refreshApp` hook to
re-scan only the affected app; existing discovery/serving routes also refresh
the index. No background timer or independent cache lifetime is introduced.
Disk remains authoritative and restarting reconstructs the whole projection
(SVC-R18). External filesystem edits not observed by a discovery route are
visible after restart or the next discovery scan, not guaranteed on a read
request. The existing control list scans the whole tree and runs `scanSkew`
for snapshot-darkness telemetry on every invocation; it is not the external
read path. This repeated disk/snapshot traversal, rather than merely JSON RPC
serialization, was the avoidable work behind the ~2.2 s control-list median
observed on dev3 (one short batch, not an SLO). Version summary reads retain
the control implementation's per-app scan and verified publication state.

### DQ1 — Control RPC authorization

What host binding or authorization boundary should enforce write access at
`/_rpc/control` while preserving local CLI use? Resolve with an explicit
deployment/CLI transport decision and a network-reachability proof; the
read-only route does not change this control-plane boundary.

## Effect-native host boundary

The service host is **Effect-native at the HTTP request boundary** while the
**upgrade/WebSocket boundary stays Vite-owned** (decision 0060).
Request routing is an `@effect/platform` `HttpRouter`/`HttpApp`; the process
entrypoint is `NodeRuntime.runMain`; publish, freeze, registry, provider mount,
and config are Effect with tagged errors and `Config`. The router delegates only
the mutable draft to Vite middleware; receipt-backed `vN` and `latest` requests
use the generic static-file handler.

Two boundaries are preserved as spec invariants (not implementer discretion):

- **Serving stays route-owned, not RPC** (decision 0065). The Effect HTTP router is
  a serving surface; it does not turn app/static serving into procedure calls.
- **The upgrade/WS boundary stays Vite-owned.** The Effect request handler MUST be
  attached via `NodeHttpServer.makeHandler` + manual `server.on('request', handler)`,
  sharing the one `http.Server` with Vite's `hmr.server`. `NodeHttpServer.layer` +
  `serveEffect` is forbidden here — it attaches a competing `upgrade` listener that
  corrupts HMR. A regression test asserts HMR still handshakes.

This is the natural home for the service's OTel tracer layer and for composing the
freeze pass as a single connected, traced Effect.

## Service: hosting, URLs, lifecycle

Single canonical host, path-routed (decisions 0005, 0075). Drafts use the Vite/HMR
authoring surface. Each publish runs one build with the repository-current pinned
Vite toolchain and atomically exposes a copied, self-contained static directory;
published requests use the generic static-file runtime, never source evaluation.

- `/r/<encoded-owner>/<local-slug>/v<n>/` — immutable published directory
  containing canonical React source, a schema-versioned minimal semantic manifest,
  and content-addressed self-contained JS/CSS/assets under `site/`. The build base
  is the canonical version path. A version-local publication receipt records the
  repo-pin-derived toolchain identity, source/manifest inputs, inventory, and output
  hashes. A service-owned publication root stored outside the mutable version
  directory binds that receipt. On every published request, the static runtime
  verifies the pair and serves only an inventory-listed file from `site/`; a
  missing, malformed, or mismatched root or receipt returns HTTP 409, withholds
  the version, and never falls back to Vite. This detects isolated
  version-directory mutation, not an actor able to rewrite both mutable Vista
  state and the service-owned root store.
  During the HTTP owner cutover, a verified legacy receipt may retain its exact
  original percent-encoded base. The server verifies the original trust root,
  receipt, inventory and requested-file digest before projecting scoped base URLs,
  bootstrap route keys and the known old bundled shell route/navigation expressions
  in HTML/JS/CSS responses to the canonical route. No immutable disk bytes,
  authored identities or receipts are migrated; neither source evaluation nor a
  rebuild is involved. Retained native-owner v1 is viewable at the new canonical
  URL without re-publishing. New publishes and receipts use only the new base.
  The old forbidden `%2F` URL is still refused by published-surface; no policy or
  encoded-delimiter rule changes accompany this cutover.
  Receipt-covered semantic manifests are decoded through the publication reader:
  schema 1 validates its historical frozen binding shape and converts it in memory
  to the current binding policy; schema 2 validates the current shape. Both reject
  malformed and excess fields, and unknown versions fail closed. Authoring emits
  only the current schema. Retained immutable bytes, receipt hashes, trust roots,
  and inventory checks are unchanged; serving never rewrites or republishes them.
  The schema-1 reader remains necessary while any admitted service retains an
  indexed, receipt-backed schema-1 publication. A rejected publication logs its
  owner, slug, version, and verification reason server-side. Navigation requests
  receive a non-cacheable service-rendered HTML tombstone identifying the owner,
  app and pinned version, explaining the missing receipt or failed verification,
  and offering republishing guidance, the latest route and the app index.
  It contains no untrusted app code or filesystem diagnostics. Asset and RPC
  failures retain generic non-HTML HTTP 409 responses. Verification failure
  never changes the pinned link's version.
  Serving performs no TSX evaluation and resolves no ambient repo/workspace,
  `node_modules`, or remote dependency.
- `/r/<encoded-owner>/<local-slug>/latest` — the canonical **follow-latest** route
  (decisions 0035, 0077). It resolves the app's current `latest` pointer at request
  time and serves that version through the same receipt-gated static path, while
  keeping `/latest` as the browser-visible URL. A receiptless latest target returns
  HTTP 409 rather than falling back to Vite. This lets a viewer stay on
  "current latest" across refreshes, shares, and future published versions. The
  shell's app/version selector distinguishes this mode from a pinned `vN`; while
  the viewer is on `/latest`, the service can refresh the route's version metadata
  and advance the rendered version when `latest` moves. While the viewer is pinned
  to `/r/<encoded-owner>/<local-slug>/v<n>/`, the shell must not silently move them; it may surface an
  "open newest" action when the registry reports a newer version than the pinned
  one.
- `/r/<encoded-owner>/<local-slug>/draft/` — the sole live HMR surface. It
  evaluates the same canonical owner-scoped `app.tsx` source publication uses.
  Draft HMR runs over the shared service HTTP server on an App-unique same-origin
  WebSocket path. Frozen-data lookup distinguishes an absent draft snapshot from
  all failure modes: only confirmed absence selects live provider data; network,
  decode, version-skew, integrity, and malformed-data failures render a visible
  unavailable/unsupported state and never silently select live data.
- `/` (and/or `/r/`) — a browsable App index listing every owner/local slug,
  newest immutable static version, status line, Template, and update time.
  Active Apps link to `latest`; retired Apps have no `draft`/`latest` link but
  preserve links to receipt-backed pinned `vN` history. `vista list` mirrors it.
  Each row reserves a 128×80 (8:5) preview with a theme-safe border. A root
  `thumbnail.png` on the latest version selects a lazy-loaded image at
  `/r/<encoded-owner>/<local-slug>/vN/_thumbnail.png`; absent previews render a
  neutral placeholder, never an older version's image.
- `/r/<encoded-owner>/<local-slug>/vN/_thumbnail.png` — serves the version-root
  PNG independently of the executable publication; absence returns 404.
  `thumbnail.png` is a derived, non-executable artifact outside the signed
  receipt inventory (only this root filename is excluded). Successful publish
  smoke captures the existing 1440×900 light-theme page and downsizes it to
  480×300 PNG in the browser canvas; capture and persistence are best effort
  after successful smoke and do not determine publication success.
  One host-side five-second deadline bounds screenshot, evaluation, and downscale
  together; expiry closes the capture page and leaves the proven mount successful.
  Existing versions can be backfilled manually on the service host with
  `vista-service backfill-thumbnails http://127.0.0.1:4178` (or
  `node --experimental-strip-types src/main.ts backfill-thumbnails http://127.0.0.1:4178`
  from the service directory). The command honors local `VISTA_APPS`, accepts
  only loopback HTTP origins, and writes derived previews without rewriting
  receipts or signed publication contents; it is not an automatic live migration.
- `/_rpc/control` — **control operations run in the service**, not the CLI: only
  the standing service holds the mounted providers needed for the freeze capture
  pass (decision 0031), so `vista publish` calls the service-owned
  `VistaControlApi` RPC and the service owns version allocation + capture + secret
  assert. The CLI is thin and **aborts on an unreachable service** rather than
  attempting a local publish (decisions 0028, 0031, 0065). Control operations
  (`publish`, `apps.list`, `app.get`, `app.retire`, interview operations,
  service info, draft eviction) are Effect RPC procedures with Effect Schema
  payloads, success values, and tagged expected errors. Command-shaped HTTP
  compatibility/debug shims are not part of the contract; operator inspection
  belongs under `vista debug ...`, backed by the typed control RPC surface.
  The debug namespace is purpose-built for coding agents rather than a raw
  protocol shell: each command maps through a thin descriptor layer to one or
  more `VistaControlApi` procedures, emits schema-encoded machine output under
  `--json`, and has coverage mechanically checked against
  `VistaControlApi.requests` (decision 0037). The stable surface is `vista debug
  service`, `paths`, `apps`, `runtime-policy`, and `import`; `vista debug app
  <local-slug>` and `publish-plan <local-slug>` derive the owner from `$ST_AGENT`.
  Future diagnostics such as provider mount state should be added as named debug
  commands over typed RPCs, not as HTTP shims.

### Viewer RPC diagnostics (SVC-R17)

```text
trusted-tailnet browser chrome ── POST /_rpc-inspector (NDJSON) ──▶ standing service
                                                           └──▶ sanitized RPC events
```

`/_rpc-inspector` is a same-origin diagnostics RPC route (snapshot and streaming watch) for
Vista-owned host chrome, not an AppSource import, Provider operation, control
procedure, publication input, or artifact dependency. It works beside the static
`vN` serving path without changing its receipt checks or resolving any mutable
source for the published App. The audience is trusted viewers on the Vista
tailnet host, not arbitrary internet clients; this exception does not authorize
public exposure of the endpoint or access to the loopback control API.

The host shell includes the explorer's compiled StyleX rules in both the draft
entry and immutable published CSS; the published site does not fetch styling
from the draft Vite server.

Capture is service-wide across mounted RPC groups, including built-in and
app-local Providers, rather than limited to the App currently open in a browser.
Each mounted server binds transport and decoded-handler observations to the same
scoped protocol observer, with the service-wide explorer registered through its
capture sink. Connection identity retains the request-local app route; the
inspector's own RPCs remain excluded from capture.
Every captured event omits HTTP and RPC headers and their values entirely.
`PtyApi` retains only the RPC identity, timing, lifecycle, and explicitly omitted
channel outcomes; no terminal request payload, result, typed error, defect, streamed
value, or header content enters the capture buffer or NDJSON output. A capture
listener does not activate a Provider or execute an RPC. The bounded buffer and
stream must handle slow or disconnected viewers without unbounded retained
events; reconnecting viewers receive only retained events, not a durable replay.
App-local RPCs without a curated display mapping still appear under their
actual app/provider and RPC descriptor identities, rather than disappearing
or being relabeled as built-ins.

Mounting a provider registers its contract group's descriptors with the one
service-wide explorer, owned by `<app-version>/<provider>` and held by the
provider mount's Scope. App-local RPCs therefore resolve to Schema-derived
descriptors, and descriptor filters and payload inspection cover them. A
remount (module edit or registry refresh) registers under the same owner
before the old mount closes, which replaces its descriptors instead of
duplicating them. Closing the last mount that holds a descriptor removes it
from the set; connected viewers receive a fresh snapshot on each change.

On-disk layout (mutable state in `/var/lib/vista`, outside the Nix store):
`apps/_owned/<encoded-owner>/<local-slug>/{_staging, v1, v2, …, latest→vN, RETIRED?}`.
The service-owned receipt roots live separately at
`apps/.publication-roots/_owned/<encoded-owner>/<local-slug>/vN.json`.
Pre-cutover slug-only state lives only in the cold archive described below, which
the service does not scan, index, route, or serve. Each `vN` holds canonical source,
publication metadata, the derived semantic manifest and bindings, its publication
receipt, and `site/`. The registry is rebuilt from owned state on restart
(SVC-R18). Version allocation uses an atomic `mkdir vN` claim (SVC-R19). A
`RETIRED` marker hides only `draft` and `latest`; receipt-backed pinned `vN`
routes remain statically servable (SVC-R13).
Process supervision uses systemd `KillMode=control-group` to reap Vite's esbuild
children (decision 0017).

Publication capture failures report the block id, provider id, RPC tag, and the
existing provider cause diagnostic. The transaction removes the claimed version
and leaves `latest` unchanged; effectful-capture refusal and secret-blocked
outcomes retain their distinct diagnostics.

### AppVersion artifact and live-overlay lifetimes (SVC-R10, SVC-R13, SVC-R20)

```text
immutable artifact lifetime: publish ── replacement ── retirement ── retained pinned vN
live-overlay lifetime:       mount   ── active/idle ── Scope close ── unavailable
```

An AppVersion has two independent lifetimes. Its immutable artifact consists of
the receipt-backed version directory and Snapshot; replacement or retirement
does not rewrite or delete it. Its optional live overlay is mutable
standing-service state owned by a closeable AppVersion Scope. The overlay may
outlive an individual viewer, but it never extends the artifact's authority or
changes publication bytes.

`VISTA_LIVE_STATE` names the service-owned overlay persistence root. The
Nix-managed service sets it to `${stateDir}/live-state`; when unset, the service
uses `${VISTA_CACHE}/live-state`. The record and wake contract are owned by the
[data-sources spec](../02-medium/03-data-sources/spec.md).
Neither path is inside an immutable `vN` directory.

`VISTA_APPS` names the live apps root. A local checkout defaults it to
`<root>/tmp/vista`. A packaged service or CLI (`VISTA_ROOT` inside the Nix store)
has no default and fails at first use when `VISTA_APPS` is unset, so a process
without the deployment environment cannot grow a second, unmanaged apps root.
The Nix-managed service and CLI session set it to `${stateDir}/apps`. Where
Vista's state roots should converge is
[OQ-STATE-ROOT](../open-questions.md#oq-state-root--one-vista-state-root).

Publishing a replacement closes the currently mounted superseded AppVersion
Scope before it can perform more Provider work. The receipt-backed pinned route
remains available; a later governed data request may mount a fresh,
version-local live Scope without changing its artifact. Retirement closes every
live Scope and the draft mount for the App and prevents new live acquisitions,
while pinned artifacts remain renderable from frozen data. Closing or replacing
a draft follows the same Scope teardown path. Scope close interrupts live
workers, releases subscribers, and flushes the latest valid overlay record
within the service shutdown bound.

### Cold archive of the pre-cutover namespace (decision 0077)

The slug-only namespace is relocated once by an operator-run migration, never by
the serving path:

```text
/var/lib/vista/apps                                  # live owned root
/var/lib/vista/archive/legacy-slug-only-v1/apps      # cold archive
```

The destination is `${stateDir}/archive/legacy-slug-only-v1/apps`, where
`stateDir` is the parent of the live apps root. Mechanism:

- **Service stopped, one atomic move.** The migration runs with the service
  stopped and relocates the whole legacy root with a single same-filesystem
  rename, carrying every version directory, `latest` symlink, `RETIRED` marker,
  publication root, receipt, and island pin. Moving rather than copying preserves
  bytes, symlink targets, and modes exactly; archived state is never rewritten,
  re-encoded, or re-receipted.
- **Fail closed.** A destination that already exists with different content,
  live and legacy state mixed in one root, or a destination on another filesystem
  aborts the migration with nothing changed. It never merges, overwrites, or
  partially relocates.
- **Idempotent.** A rerun after success is a no-op: legacy state absent from the
  live root and present in the archive is the expected end state.
- **Direct rollback while `_owned` is empty.** Reversal is supported only before
  the first owner-scoped publication, keeping it a pointer reversal rather than a
  merge: stop the service, remove the empty new root, atomically move the
  archived root back to its original path, then activate the prior Vista closure.
  After any owner-scoped version exists, roll-forward is the only direction.

Runtime path ownership is split: the relocated Nix workspace/dependency closure is
immutable, while apps and Vite optimize caches are mutable operational state. A
packaged CLI or service may use the store workspace as the dependency root, but it
must not derive default mutable state under that store path. Operator-provided path
overrides must take precedence over wrapper-provided defaults; wrappers may supply
fallbacks for the compiled binary, but those fallbacks must not make `VISTA_ROOT`
non-overridable.

Dependencies: apps `import` React/Vite/kit/mermaid/etc. from the service-owned
runtime composition, not from per-app installs. Bare external packages resolve
from a single service-owned `node_modules` (the read-only `vista-deps` closure)
reached by a symlink at the apps root; first-party workspace/runtime packages
(`@vista/blocks`, Geist, future internal runtime packages) resolve through explicit
source aliases projected from Vista runtime-policy contributions (decision 0044).
`resolve.dedupe:['react','react-dom']` keeps React singleton. Constraint: the apps
root must sit at a location from which Vite's node_modules walk-up reaches the shared
external dep closure — in production the mutable apps root (`/var/lib/vista`)
resolves against the Nix `vista-deps` store closure via its root `node_modules`
symlink (decisions 0006, 0017). Apps are bound to the service's dep set by design
and are not standalone-buildable in isolation. Zero per-app install (AGT.CLI-R08, SVC-R16).

The untransformed service-process value-import graph must not load `.stylex`
sources or the `@stylexjs/stylex` runtime. Schema readers use the node-safe
`@vista/blocks/contract` surface rather than the semantic evaluator's rendering
barrel. `server-import-graph.integration.test.ts` follows value imports and
reexports from `main.ts`, `server.ts`, and `publish.ts`, plus the publish-time
`authoring.tsx` semantic core; type-only edges are excluded. Service-owned client
islands, including `interview/InterviewQuestion.tsx`, belong to Vite's transformed
client graph and may use StyleX without becoming process imports.

The service is the single dep owner through Genie package composition: Genie owns
package deps, workspace deps, injected workspace-package semantics, closure dirs, and
Nix install closure. Vista attaches runtime policy metadata at that same package
boundary under `$vista.runtimePolicy` in generated package JSONs. Package genies
use `vistaRuntimePolicyFromComposition(...)` so public package roots and baseline
optimized roots must be present in the composed dependency/dev/peer closure before
generation can succeed. The service reads the service and kit package
contributions, resolves logical alias targets through runtime roots (`VISTA_ROOT`,
`VISTA_BLOCKS`, `VISTA_ISLAND`), validates the resulting source policy against the
installed service dependency closure, and projects it into Vite
resolve/optimize/fs-allow state plus the import classifier.

Package-level contribution is the deployment ownership unit: `@vista/service` and
`@vista/blocks` contribute provided import roots, optimize deps, CSS imports, remote
import escape hatches, `ssrExternal`, dedupe, and first-party aliases. Within those
package Genie files, named runtime-policy slices keep block families, provider
families, and service bridges explicit before emission: the kit owns `ui-shell`,
`doctrine-blocks`, and `system-explorer-blocks`; the service owns
`effect-control-client`, `app-service-owned-imports`, and
`vite-app-runtime`. The generated package JSON remains the concrete runtime
policy source consumed by the service and preserves those named slices. The
service automatically discovers every `$vista.runtimePolicy` contribution from
the installed workspace closure, flattens emitted slices, and keeps
service-owned roots projected as first-class metadata. This keeps Vista-specific
composition semantics out of generic Genie package composition.
The old standalone `runtime-manifest.ts` authoring model is not a supported
compatibility surface.
Vite dep optimization uses auto-discovery seeded with the Genie-projected
`optimizeInclude` roots; `noDiscovery` is not set and the seed is not a separate
hand-maintained dependency list. The seed includes host-only imports and Effect
reactivity/RPC subpaths reached below the virtual bootstrap, so those imports do
not invalidate dependency URLs already in flight during a cold load. Raw
agent-timeline TSX exports (`detail`, `icons`, `span`) and component barrels remain
source-transformed, while pure optimizable TS subpaths are seeded.
Each owner/slug draft has its own cache directory and Vite root/config hash;
the same draft reuses its on-disk optimizer cache across service restarts.
Mount eviction remains required (SVC-R20): the service must evict retired and
stale draft mounts to reclaim watchers, caches, and HMR listeners over long uptime.
`fs.allow` covers the shared dependency closure plus the exact source app root of
the draft being served — not the whole apps tree and not a broad parent (SVC-R21).
Published versions are served by the generic static-file runtime, which resolves
no ambient filesystem roots at all.

Client import validation is an authoring-time boundary (decision 0045). Draft
serving must reject bare imports outside the composed manifest instead of letting
Vite discover them opportunistically. Allowed imports are local/relative paths,
provided manifest roots, and pinned remote escape-hatch URLs such as
`https://esm.sh/zod@3.25.76`; unpinned remote URLs such as `https://esm.sh/zod` are
rejected. Rejection is an expected typed error: Effect Schema describes the import
classification result, and a `Schema.TaggedError` carries the invalid specifier,
importer/source path when known, allowed roots/patterns summary, and an actionable
message. Publish repeats the validation as a second guard. `vista debug` uses the
same classifier so coding agents can diagnose import failures without a browser.
The hard boundary is a Vite module-resolution plugin; a CLI/debug pre-scan may
provide fast feedback, but it must share the same classifier and tagged error schema.
The validator must explicitly exempt Vite/plugin internals, virtual modules, `node:`
imports, CSS transform internals, and service-owned aliases so the boundary applies
to app-authored client imports rather than to Vite's implementation details.
The source pre-scan selects Babel syntax plugins by extension: TypeScript for
`.ts`/`.tsx`, JSX for `.jsx`/`.tsx`, and neither for `.js`/`.mjs`. This preserves
angle-bracket assertions in `.ts` helpers while scanning genuine JSX modules.

## Packaging + deployment

First-party flake + Nix-managed standing service (VST-R40, decision 0017): Buck
CLI/service JavaScript products run through Bun wrappers. Nix imports the
descriptor-verified CLI runtime closure as the shared read-only dependency tree;
CLI and service products use the same scoped Buck source. Mutable app state stays
outside the store; exposed via `managed-tailscale-service.nix` at one
canonical URL; tailnet-only, trusted-author, no sanitization (decision 0009). The kit
and Vista's other packages are genie-composed pnpm-workspace packages (`.genie.ts`),
not standalone projects, so the kit is a real importable package the service and
apps depend on through the workspace (decision 0025).

The packaged workspace retains service, CLI, blocks, shared agent-timeline, Genie,
and island sources. Package-local dependency links resolve into the imported
runtime tree; Vite transforms first-party StyleX source and Vite-loaded Providers
share the host's external Effect instance. Buck package trees carry both shell
logo SVGs, including the service's blocks dependency view.

The telemetry island is a root-workspace pnpm importer. Buck runs its Vite
library build from the CLI product's scoped source and pnpm archives and Nix
copies the self-contained React-19 chunk into the packaged workspace; it has no
separate island lockfile or fixed-output dependency derivation.

Telemetry frames and the metric, flamegraph, and trace host wrappers belong to
the blocks graph, not the prebuilt island. The draft server and publication
builder compile their StyleX source; rebuilding the island alone cannot repair
uncompiled host styles. StyleX component barrels, including the `.ts` entry
`@overeng/agent-timeline/compact`, stay out of explicit dependency-optimizer seeds:
prebundling also bypasses compilation of their transitive TSX components.
`telemetry-stylex.integration.test.ts` exercises the draft compiler and compact
import boundaries without a browser or island build. The three telemetry
browser proofs cover published and draft rendering and reject StyleX runtime
compiler errors alongside React module errors.

The heavy-blocks browser proof publishes and freezes the sample's recorded
GitHub provider through the same provider registry and static builder used in
production. Its sample mounts `GhCommandFixture` via the real GitHub provider
implementation and queries the fixture's recorded pull request, so render
coverage does not depend on GitHub credentials, live network calls, or rate limits.

### Home Manager deployment

```text
services.vista → desired bundle → hold-aware convergence → vista.service
sourcesRootMigration → writer fence → source preflight/rename → unit/process gates
```

`services.vista.sourcesDir` is the absolute AppSource root, defaulting to
`${xdg.stateHome}/vista/sources`; both CLI sessions and the service receive
`VISTA_SOURCES`. `stateDir` owns `apps`, `cache`, and `live-state`; `port`,
`tailnetSuffix`, the closed `diskIndexEndpoints` host map, and Grafana URL/Tempo
datasource options supply the deployment environment.

The `vista` service bundle and `vista-cli` override bundle are independent.
A held service bundle prevents source migration and service convergence during a
full switch: no service drop-in rewrite, daemon reload, or restart. The systemd
unit disables automatic restart-on-change and uses `KillMode=control-group`;
only the hold-aware convergence boundary owns replacement.

The forward-only source bridge preflights the retired catalog and already
relocated host/seat sources before moving any App into
`sources/_owned.v1/<encoded-owner>/<local-slug>`. It refuses collisions and mixed
states and preserves authored bytes, modes, and symlinks. Separate root and
owned-layout completion markers make reruns idempotent. Admission remains paused
behind a durable start fence until the unmasked/reloaded unit matches the desired
package and sources root and the running process matches its interpreter, argv,
and environment. Failed gates retain the pause and remask the service; a
running-process mismatch also stops it. Generation rollback does not reverse
source renames.

### Native AppSource compilation

```text
AppSource/local modules → buildNativeApp → app.mjs:createVistaApp(runtime)
                                      └→ optional app.css
```

`buildNativeApp({ appSource, outDir })` compiles local modules and local lazy
imports into one factory using injected `react`, `react/jsx-runtime`, and
`@vista/blocks` namespaces, keeping host contexts singleton. Other package imports,
code outside the real AppSource root (including `node_modules`), unresolved
imports, and non-CSS emitted assets fail with `Vista.NativeAppBuildFailed`.
It emits at most one stylesheet and supports inline assets. App-owned StyleX
requires the publication compiler and is not compiled by this builder.
This callable builder is separate from static publication; it does not modify
existing versions or advertise native compatibility in publication metadata.
Native integration must bind compatibility metadata and emitted assets into the
receipt-backed inventory. Receipts establish byte integrity, not permission to
execute code from trusted tailnet authors.

Vite is a draft and publish-time dependency, not a published serve-time dependency.
Publication freezes source/data/manifest, builds the static directory, verifies its
base-path/reference/integrity closure, then atomically exposes it (decision 0075).

### Home Manager deployment

The Linux `vista.service` declares `GH_CONFIG_DIR` from
`services.vista.ghConfigDir`, defaulting to the managed
`~/.config/gh-assistant` login for `schickling-assistant`. Evaluation rejects a
missing, empty, relative, human, or non-canonical path (`//`, `/./`, `/../`, or
a trailing `/`). A pre-start realpath check also rejects a symlink to the human
config; the service never inherits
`~/.config/gh`. `VISTA_GH_BIN` pins the provider to `${pkgs.gh}/bin/gh`, bypassing
agent-policy PATH wrappers, and `GH_PROMPT_DISABLED=1` keeps it non-interactive.
Both deployment paths compare these three GitHub environment variables with the
running process, so credential-only changes trigger a restart even when the
Vista package is unchanged.
A missing login returns `GhError` naming the declared config path. The provider
only reads GitHub data, but the shared assistant PAT retains its own scopes
([credential inventory](../../../CREDENTIALS.md#agent-github-pat-schickling-assistant)).

### Packaged proof and test harnesses

The packaged artifact has a first-class smoke boundary (decisions 0048, 0049). The
smoke builds or accepts the Nix `vista` package, starts the packaged
`vista-service`, drives the packaged `vista` CLI, and keeps mutable state outside the
store:

```text
/nix/store/...-vista/
  bin/vista
  bin/vista-service
  libexec/workspace/        # immutable packaged workspace + node_modules

/tmp/vista-packaged-smoke-*/
  apps/                     # mutable draft/version state
  sources/                  # mutable canonical AppSources
  cache/                    # mutable Vite optimize cache
  island-store/             # mutable content-addressed island pins
  logs/
```

The default developer surface is through the repo devenv shell, which provides the
Nix-managed Playwright browser environment:

```sh
devenv tasks run test:vista-kit-storybook
devenv tasks run vista:packaged-smoke
devenv tasks run vista:packaged-smoke:full
devenv tasks run vista:packaged-smoke:no-browser
```

`test:vista-kit-storybook` is the reusable local Storybook browser proof for the
Vista kit. It runs the kit Storybook smoke through the devenv Playwright module,
fails fast if `PLAYWRIGHT_BROWSERS_PATH` is absent, and covers theme globals,
Recharts chart blocks, and the React Flow system-explorer scenario.
`vista:packaged-smoke` runs browser checks against the deterministic smoke set.
`vista:packaged-smoke:full` also enables fake-provider live telemetry coverage.
`vista:packaged-smoke:no-browser` is the service/CLI fallback. Browser mode fails
fast when `PLAYWRIGHT_BROWSERS_PATH` is absent; callers should use the devenv tasks
rather than manually exporting browser store paths or downloading Playwright
browsers.

The smoke must cover:

| Boundary | Smoke evidence |
| --- | --- |
| service reachability | packaged `vista-service` answers `vista debug service --json` |
| immutable/mutable roots | `VISTA_ROOT` points at the store workspace while apps/sources/cache/island-store point at temp roots |
| publish/freeze | scaffold, doctrine, pure overview freeze, and live Mimir-backed data freeze publish successfully |
| runtime policy | pinned `https://esm.sh/zod@...` succeeds and blocked `lodash` fails |
| heavy kit closure | heavy system-explorer/diff app renders a React Flow node |
| telemetry island | trace, flamegraph, and metric island apps render through the prebuilt island chunk |

Fake provider servers prove Vista's **provider-consumption** contract: the service
can read backend-compatible APIs and freeze/render their payloads. OTel
**producer-instrumentation** tests use `otelite` instead. When Vista emits
first-class spans around publish, freeze, smoke, provider calls, or failures, local
and CI tests assert those spans with `otelite run`/`otelite inspect` or
`@overeng/utils-dev/otelite` helpers. Provider spans and freeze capture spans carry
stable `span.label` attributes, and the packaged smoke emits named phase diagnostics
so CI logs identify the failing boundary. Live Grafana/GCX checks remain separate
operator-readback proof.

Runtime policy is generated from package Genie composition through
`vistaRuntimePolicyFromComposition(...)`. The helper accepts named
`VistaRuntimePolicySlice`s so block families, provider families, and service
bridges can contribute public roots, service-owned aliases, CSS imports, optimized
subpaths, remote import rules, SSR externals, and dedupe requirements while each
slice is validated against the composed package closure. The kit uses slices
for `ui-shell`, `doctrine-blocks`, and `system-explorer-blocks`; the service
uses slices for Effect control-client imports, service-owned app aliases, and
Vite app runtime helpers. Generated package JSON preserves those slices, and
the service discovers `$vista.runtimePolicy` contributions from the workspace
closure rather than from a fixed package list.
</content>
</invoke>
