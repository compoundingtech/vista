# Vista Requirements

## Context

These requirements define the constraints for Vista: an agent→human visual medium
where a coding agent publishes an interactive App for a human to explore. Apps are
view-first: only explicit bounded-choice inputs and narrowly declared, authority-gated
live control surfaces are exceptions (decisions 0013, 0096). They build on
[vision.md](./vision.md) and decisions in [.decisions/](./.decisions/). This document is the Vista system
charter: it holds the system-level contract — the shared context, assumptions,
acceptable tradeoffs, and the cross-cutting charter requirements (`VST-R*`) that
bind every subsystem. Vista's VRS is a layered composition (see
[Subsystem requirements](#subsystem-requirements)): a substrate (`01-service`),
the app medium (`02-medium`, composing the authoring/renderer/data/doctrine
contracts with the blocks/templates realizations), the agent interface
(`03-agent-interface`, cli + skill), staged feedback (`04-feedback`),
and cross-cutting observability (`05-observability`). Requirement IDs are
**path-scoped** to their owning node (`SVC-R*`, `MED.AUTH-R*`, `AGT.CLI-R*`, …) so
ownership is self-evident; a descendant requirement declares `refines:` its parent
so the tree reads upward. Numeric directory prefixes carry dependency order only.

Terms are defined in [ontology.md](./ontology.md) and used precisely here.

## Assumptions

- **A01 Single-user, trusted agents:** Apps are authored by our own
  first-party coding agents and viewed by the user. Author and viewer share one
  trust domain.
- **A02 Private tailnet transport:** Apps are served over our Tailscale
  network and are never publicly exposed.
- **A03 Owned standing infrastructure:** Vista may run a long-lived, Nix-managed
  service on a fleet host (e.g. dev3) and serve it via Tailscale Service,
  following existing infra idioms.
- **A04 Existing data surfaces:** Live data is reachable through our existing
  query surfaces (OTel/Prometheus via `gcx`/`axe otel`, GitHub via `gh`), not via
  new bespoke collectors.
- **A05 Provider-neutral agents:** Multiple coding agents/providers exist; Vista
  must not assume a single vendor's host or feature.
- **A06 Existing annotation tooling:** `plannotator` and `agentation` already
  cover human→agent annotation and remain available to compose with Vista.
- **A07 Modern web tooling:** The block library and service may rely on Vite, React,
  StyleX, Storybook, and Bun as the standard toolchain. Tailwind is not part of the
  current Vista App or block-library styling contract.
- **A08 Geist visual system:** Vista may depend on
  `@overeng/geist-design-system` as the canonical product UI system for its block
  library and Storybook surfaces (decision 0036).

## Acceptable Tradeoffs

- **T01 View-first with a named terminal exception:** Vista captures no
  general/freeform feedback and exposes no general-purpose App or document mutation;
  only explicit bounded-choice answers are accepted in an App. The named exception
  is an authority-gated terminal control plane exposed by a typed domain Block under
  VST-R01 and MED.DATA-R84. It cannot mutate App state or publication and cannot
  address a resource the AppVersion did not declare under MED.DATA-R85. Other
  feedback stays in chat or the existing annotation tools (decisions 0001, 0013,
  0096).
- **T02 Gated, not proactive-default:** Vista is used at deliberate moments;
  widening toward a default channel is a trajectory, not an initial obligation
  (decision 0010).
- **T03 Authoring is service-bound:** Draft source depends on the service's shared
  dependency set in exchange for zero-install authoring. Published versions are
  self-contained static directories built by the service (decisions 0006, 0075).
- **T04 Standing-service maintenance:** Owning a long-lived service is a real,
  ongoing cost, accepted to remove per-session ceremony and unlock live data.
- **T06 Freshness vs reproducibility:** Live data is fresh but non-durable; frozen
  snapshots are reproducible but stale. Both are offered and the mode is always
  explicit (decision 0004, data-sources).
- **T07 Dark-first product default:** Vista defaults to dark even when a viewer's
  OS preference is light. Light mode remains supported explicitly, but dark is the
  primary design target (decision 0036).

## Requirements

### Must be a view-first interactive medium

- **VST-R01 View-first with bounded authority:** Vista must render agent→human
  content and must not expose a general-purpose App or document mutation API or
  general/freeform feedback. An App may accept explicit bounded-choice answers to
  the agent's own structured questions. The sole freeform-control exception is an
  authority-gated terminal plane exposed by a typed domain Block under MED.DATA-R84:
  passive viewing is read-only, an identified viewer must explicitly acquire
  bounded and revocable authority, and the plane may mutate neither App state nor
  publication nor any resource the AppVersion did not declare under MED.DATA-R85.
  Other general/freeform feedback remains in chat or annotation tools (decisions
  0001, 0013, 0096).
- **VST-R02 Interactive exploration:** Apps must support interactive exploration
  (e.g. keyboard navigation, expand/collapse, tabs, diagram zoom/pan), not only
  static rendering.
- **VST-R03 General medium:** Vista must serve more than one app purpose
  (architecture/design review, plan sign-off, options comparison, live-telemetry
  exploration, change recap), not a single hardcoded format.
- **VST-R04 Addressable semantic model:** The semantic manifest must carry stable
  identifiers on every semantic node and addressable sub-entry so bounded-choice
  answers and external annotation can attach without reconstructing the UI.

### Must respect trust and privacy boundaries

- **VST-R36 Tailnet-only:** Apps must be served only over the private tailnet and
  must never be publicly exposed (decision 0009, A02).
- **VST-R37 Trusted-author rendering:** Agent-authored content may run without a
  sanitization layer under the trusted-author, tailnet-only model; crossing to a
  public or untrusted-viewer surface must revisit this requirement (decision 0009).

### Must compose with, not duplicate, existing systems

- **VST-R38 Coexist with annotation tools:** Vista must not build its own general
  feedback capture; it composes with `plannotator`/`agentation` for
  human→agent annotation (decision 0011).
- **VST-R39 Self-owned and provider-neutral:** Vista must be self-owned and usable
  across our agents, not dependent on a hosted third-party platform or a single
  vendor's feature (decision 0003).

### Must keep the author-facing surface near-zero ceremony

- **VST-R64 Minimal-ceremony authoring:** An App needs minimal manual setup. The
  common path is the single `vista publish <local-slug> --message <summary>`
  command from the owning agent context; it derives owner identity from
  `$ST_AGENT`, validates AppSource, and produces an AppVersion. During
  iteration, optional service-independent `vista check [path]` runs the same
  AppSource diagnostics without owner, catalog, service, or live state.
  The author writes one zero-prop JSX AppRoot. Vista owns the HTML shell,
  bootstrap, SemanticManifest and DataBinding derivation, dependencies, build,
  AppResource creation, and PublicationReceipt. No scaffold, open, sidecar,
  global stylesheet, or build step is required. Local components and StyleX
  remain ordinary React. Further required agent-facing steps need justification.
  Generalizes AGT.CLI-R06/AGT.CLI-R08/AGT.CLI-R56/AGT.CLI-R78.

- **VST-R65 Closed, zero-install dependency surface:** An app resolves imports only
  three ways: its own local source, a dependency the Vista system **exposes** (the
  shared `vista-deps` closure — VST-R40, decisions 0006/0017), or a **pinned**
  `esm.sh/<pkg>@<version>` URL. An agent must never install, build, or register a
  dependency, and there is no agent-facing path to modify the exposed set. `esm.sh`
  is the universal escape hatch: any dependency not exposed — including heavy,
  browser-only, or interactive-component dependencies — is reached by pinning it
  from `esm.sh` and loading it behind a lazy boundary (MED.AUTH-R59, decision 0054), never
  by an agent-managed build or closure change. Vista performs one generic build at
  publish to create the self-contained version. What Vista exposes may grow over time
  by curation, but that is a system/maintainer concern, fully decoupled from
  authoring: it is never a step in publishing any individual app and never
  gates an app's ceremony (VST-R64). This is what makes dependencies zero-ceremony;
  it is the dependency model, not an exception to minimal ceremony.

### Must follow our infra and VRS idioms

- **VST-R40 First-party packaging:** Vista must be packaged as a first-party flake and
  Nix-managed service. As a _standing_ service it is exposed via
  `managed-tailscale-service.nix` (not the devnet PTY-per-session path) at one
  canonical `https://vista.<tailnet>/…` URL (decision 0017). Dependencies are a
  single read-only Nix store closure (`vista-deps`) shared by the service and all
  apps.
- **VST-R41 VRS is the source of truth:** Durable design intent must live in this VRS
  tree; the implementation must stay consistent with it.

### Must version its contract explicitly

- **VST-R66 Versioned self-describing contract:** Every Vista wire payload and
  every persisted **contract** artifact (the disposable frozen snapshots) must
  carry one global `apiVersion` and be read fail-closed on mismatch. Authored
  IDENTITY (a version's `meta.json`) is authority, not part of the versioned
  contract: it is schema-decoded but never `apiVersion`-gated. This preserves
  version identity across a bump but does not authorize browser serving: only a
  receipt-backed static publication is served, and a receiptless or unverifiable
  version is withheld. Vista must build no migration or coercion machinery; a
  version bump is a namespace cutover with an accepted, written data-loss contract
  for old persisted snapshots (decisions 0061, 0068).
- **VST-R67 Distinct Resource identities:** A durable Vista app and each
  immutable published version must be independently nameable as typed Resource
  URIs. The moving `latest` route must remain navigation rather than Resource
  identity, and the URI authority must identify the logical Vista service
  rather than its current network endpoint.

## Subsystem requirements

Vista's VRS is a **layered composition**. Each node owns its requirements with a
path-scoped ID prefix; numeric directory prefixes encode dependency order (a
higher-numbered node may depend on a lower one, not the reverse). Composite nodes
(`02-medium`, `03-agent-interface`, `04-feedback`) carry their own
`requirements.md`/`spec.md` for what they own and index their children. Each ID is
defined in exactly one file; the full old→new map is in
[.decisions/mapping.md](./.decisions/mapping.md).

| Node | Scope | Requirement IDs |
| --- | --- | --- |
| [01-service](./01-service/requirements.md) | substrate: serving, versioning, lifecycle, render guarantee, canonical URL, effect-native host | `SVC-R05`, `SVC-R09–R21`, `SVC-R55`, `SVC-R57`, `SVC-R58` |
| [02-medium](./02-medium/requirements.md) | the App medium (composite): 4 contracts + 2 realizations | `MED-R*` |
| &nbsp;&nbsp;├ [01-authoring](./02-medium/01-authoring/requirements.md) — *contract* | ordinary React authoring, derived semantic manifest, trusted evaluator | `MED.AUTH-R22–R25`, `MED.AUTH-R59`, `MED.AUTH-R76` |
| &nbsp;&nbsp;├ [02-renderer](./02-medium/02-renderer/requirements.md) — *contract* | canonical React/manifest/DOM equivalence and derived bindings | `MED.REND-R02–R04` |
| &nbsp;&nbsp;├ [03-data-sources](./02-medium/03-data-sources/requirements.md) — *contract* | provider contract satisfying live/frozen semantic bindings | `MED.DATA-R28–R31`, `MED.DATA-R46–R50` |
| &nbsp;&nbsp;├ [04-doctrine](./02-medium/04-doctrine/requirements.md) — *contract* | decision-driving app composition principles | `MED.DOC-R32–R35` |
| &nbsp;&nbsp;├ [05-blocks](./02-medium/05-blocks/requirements.md) — *realize* | curated block library (packaging/Storybook/Geist) + heavy-block subsystems | `MED.BLK-*`, `MED.BLK.CODE-*`, `MED.BLK.MERM-*`, `MED.BLK.SYSX-*`, `MED.BLK.TREE-*`, `MED.BLK.TELEM-*`, `MED.BLK.FORK-*` |
| &nbsp;&nbsp;└ [06-templates](./02-medium/06-templates/requirements.md) — *realize* | per-kind app scaffolds; realize doctrine, compose blocks | `MED.TMPL-R*` |
| [03-agent-interface](./03-agent-interface/requirements.md) | how an agent produces an app (composite) | `AGT-R*` |
| &nbsp;&nbsp;├ [01-cli](./03-agent-interface/01-cli/requirements.md) | the `vista` CLI surface | `AGT.CLI-R06`, `AGT.CLI-R08`, `AGT.CLI-R56`, `AGT.CLI-R67`, `AGT.CLI-R68` |
| &nbsp;&nbsp;└ [02-skill](./03-agent-interface/02-skill/requirements.md) | agent-facing skill and gating | `AGT.SKILL-R07` |
| [04-feedback](./04-feedback/requirements.md) | staged return path (composite) | `FDB-R*` |
| &nbsp;&nbsp;└ [01-interview](./04-feedback/01-interview/requirements.md) | bounded structured-answer / interview integration | `FDB.IVW-R45` |
| [05-observability](./05-observability/requirements.md) | OTel bootstrap, service boundaries, connected trace, metrics | `OBS-R69–R78` |
