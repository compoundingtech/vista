# CLI Requirements

The `vista` CLI owns App operations; the [skill](../02-skill/requirements.md)
owns guidance. Canonical terms are in [ontology.md](../../ontology.md). IDs are
path-scoped (`AGT.CLI-R*`).

## Requirements

- **AGT.CLI-R06 Thin CLI:** `vista` is the sole agent operational surface.
  Current commands and options are owned by `vista --help`.
  `refines: VST-R64`
- **AGT.CLI-R08 Near-zero ceremony:** An App needs AppSource and CLI operations,
  with no per-App install, bootstrap, shell, or build step.
  `refines: VST-R64`
- **AGT.CLI-R56 Owner-scoped publish:** `vista publish <local-slug> --message
  <summary>` derives owner from the exact st v3 managed `agent/...` subject in
  `$ST_AGENT`, rejects a missing or empty summary,
  and either creates a complete AppVersion with PublicationReceipt and returns
  its pinned URL or changes nothing. Callers cannot pass owner, catalog, or
  arbitrary AppSource path. Humans and CI publish through a seat; `person/*`
  is never an owner. Publishing under a dotted legacy owner is refused with a
  hint to run as a seat. Retained legacy publications are serve-only, with
  canonical `o-<hex>` URLs and a 308 redirect from safe dotted literal routes
  (SVC-R14).
  `refines: VST-R64`
- **AGT.CLI-R78 Optional service-independent check:** `vista check [path]`
  offers an optional AppSource iteration loop without owner identity, catalog,
  standing service, or live state. Success is compact. Failure is problems-first,
  deduplicated, and names authored paths. Publish remains sufficient because it
  repeats identical diagnostics.
  `refines: VST-R64`
- **AGT.CLI-R69 Identical publication gate:** Publish repeats authored-source
  diagnostics before service build and render checks. Type/schema failures,
  duplicate SemanticNode IDs, invalid references, evaluator failures, and
  build/render failures create no AppVersion. Vista owns generated shell,
  SemanticManifest, DataBindings, and output.
  `refines: VST-R64`
- **AGT.CLI-R67 Shared build identity:** CLI version and telemetry identity use
  the shared build-versioning contract.
  `refines: VST-R40`
- **AGT.CLI-R68 Stable machine output:** Machine output is schema-derived,
  intentionally versioned, and independent of terminal presentation.
  `refines: VST-R66`
