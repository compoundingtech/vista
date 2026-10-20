# Data Sources Requirements

Data-sources owns the **data contract** in the medium composition: the server/data
half (providers) that supplies data-backed blocks, live at view time or frozen at
publish, behind one schema. Within the composition (document → renderer → data →
doctrine) this contract produces what the renderer's data-backed blocks consume by
key.

This is a thin, *generic* contract: the provider shape and the live/frozen freeze
mechanism that any data-backed block relies on. Telemetry-specific detail (live
Mimir/Tempo sources, the Grafana island render path, backend-faithful snapshots,
pixel-durability, licensing containment) is a realization owned by
[05-blocks/05-telemetry](../05-blocks/05-telemetry/requirements.md), not this
contract (decision 0067).

Composite context lives in the [medium requirements](../requirements.md);
system-level context, assumptions, and acceptable tradeoffs in the
[root requirements](../../requirements.md); terms in [glossary.md](./glossary.md).
IDs are path-scoped (`MED.DATA-R*`); each requirement `refines:` its parent — the
02-medium contract (`MED-R*`) or the charter (`VST-R*`).

## Requirements

### Must support dual-mode data

- **MED.DATA-R28 Frozen/live/subscription data interface:** Data-backed Blocks must
  obtain data through one uniform internal interface with author-declared `frozen`
  (default), `live`, or `subscription` mode. A published frozen binding must never
  become live; live and subscription bindings must ship a publish-time Snapshot for
  instant paint and failure fallback. Drafts may resolve every mode live while
  retaining the declaration in their semantic projection.
  `refines: MED-R03`
- **MED.DATA-R46 RPC-first Provider halves:** Every Provider must author one Effect
  `RpcGroup` contract in a client-safe `*.query.ts` module and one server-only
  `*.provider.ts` implementation. Operations, bindings, capture, transport, streams,
  and telemetry must derive from the authored Rpc definitions. `vista check` must
  reject server-only modules from the resolved client graph. Built-in and app-local
  Providers must use the same contract/implementation/mount path, and live and frozen
  values must decode through the same strict Schema.
  `refines: MED-R03`
- **MED.DATA-R47 Subscription continuity:** A subscription Block must paint its
  captured folded state before opening live transport, catch up from a cursor when
  available, retain the last valid value on transport or schema failure, and never
  treat a missing/expired cursor as an empty successful result.
  `refines: MED-R03`
- **MED.DATA-R48 Strict data boundaries:** Snapshot envelopes and entries, encoded
  arguments and values, live responses, stream events, and persisted live-state
  records must reject excess properties. A live or stream schema mismatch must be a
  typed failure that retains the frozen value and requires reload or re-publication;
  the system must not negotiate compatibility or silently drop fields.
  `refines: MED-R03`
- **MED.DATA-R49 Viewer-owned live work:** Live work must be shared per binding
  among viewers, stop making upstream calls when no viewer remains, hibernate after
  a bounded idle interval, resume from strictly decoded persisted state and cursor,
  and tear down when the owning AppVersion Scope closes. A service-scoped PTY
  adapter and terminal fold may be reference-shared by session across AppVersions;
  each AppVersion must own and tear down its own SubscriptionHub borrow, LiveOverlay,
  authorization, and telemetry, and closing one AppVersion Scope must neither extend
  nor terminate another AppVersion's borrow. Remote-provider work must share a
  service-wide quota budget across AppVersions.
  `refines: MED-R03`
- **MED.DATA-R50 Domain-Block-only surface:** Typed domain Blocks must be the only
  App-authoring surface for Provider data. Operation, DataBinding, BindingPolicy,
  DataRuntime, and binding hooks must remain internal, and every captured binding
  must retain its owning SemanticNode.
  `refines: MED-R03`
- **MED.DATA-R84 CommandOps:** CommandOps must be live-only, never captured,
  never a DataBinding or Snapshot entry, and available only through a typed domain
  Block. Command ops and related read operations must derive from the same authored
  RpcGroup and strict Schemas. Actor identity must come from trusted request context,
  never payload. Browser command dispatch must reject requests unless `Origin`
  equals `VISTA_PUBLIC_URL` or an allowed loopback development origin; HTTP command
  requests must additionally carry `Sec-Fetch-Site: same-origin`. Requests without
  browser origin metadata, including non-browser clients, may read but must not
  command. The same allowed-origin check applies before WebSocket upgrade and before
  HTTP command dispatch. Command authority must use a short-lived,
  actor/session-bound single-writer lease. Attach, release, send, and resize must be
  audited without input contents. Read-only viewing must never grant command
  authority.
  `refines: VST-R01`
- **MED.DATA-R85 Manifest-bound resource reads:** A data-backed Block must not read
  a resource the AppVersion did not declare. In particular, a LivePty `screen`
  request is admitted only when that AppVersion's SemanticManifest contains a
  `pty.screen` binding for the requested session id; any other session fails with
  the typed `SessionNotDeclared` error.
  `refines: MED.DATA-R31, MED.DATA-R84`
- **MED.DATA-R29 Snapshot-first publication:** Publishing must capture every
  DataBinding, including live and subscription bindings, into the immutable
  AppVersion. Subscription capture must store folded state and a cursor rather than
  event history. Capture must Schema-encode arguments before identity and
  Schema-encode values before persistence.
  `refines: MED-R03`
- **MED.DATA-R30 Explicit provenance:** Every data-backed Block must make Frozen,
  CatchingUp, Live, and typed degraded/failure state explicit to the viewer without
  implying that a frozen value can be refreshed.
  `refines: MED-R03`
- **MED.DATA-R79 Explicit data-composition shapes:** Data composition must use one
  of three discoverable shapes: a named server Operation for effectful,
  result-dependent, or domain-policy behavior; a pure client Projection that
  inherits its source Snapshot entry; or an explicitly declared DependentBinding
  whose capture stores constituent entries and whose SemanticManifest edge has a
  stable author-declared identity. React render or hook order must not be a data
  dependency graph.
  `refines: MED-R03`
- **MED.DATA-R31 No secrets in artifacts:** Published artifacts must not embed
  credentials or secret-bearing data; live data must be fetched through governed
  surfaces, and any secret use follows `op-proxy` and `CREDENTIALS.md` conventions.
  `refines: MED-R03`
