*For: anyone navigating Vista's VRS · Assumes: [vision.md](./vision.md) read · Covers: how the system decomposes and where each concern lives.*

# Vista, as a layered composition

Vista is a medium: an agent publishes an **app** — a rendered, interactive page
— and a human opens a link and *sees* the work. The VRS is organized as the few
layers that produce and serve that medium, each a node with a path-scoped
requirement prefix so ownership is self-evident.

```
                          ┌───────────────────────────────┐
   03-agent-interface ───▶│         02-medium             │  the app artifact
      (AGT-*)             │  contracts + realizations:     │  (MED-*)
   cli · skill            │                                │
   how an agent           │  contracts:                    │
   produces an app        │   01-authoring   (MED.AUTH-*)  │  the document model
                          │   02-renderer    (MED.REND-*)  │  the render contract
                          │   03-data-sources(MED.DATA-*)  │  live/frozen data
                          │   04-doctrine    (MED.DOC-*)   │  composition principles
                          │  realizations:                 │
                          │   05-blocks      (MED.BLK-*)   │  curated block library
                          │   06-templates   (MED.TMPL-*)  │  per-kind app scaffolds
                          └───────────────┬───────────────┘
                                          │ runs on
                          ┌───────────────▼───────────────┐
                          │        01-service (SVC-*)      │  the substrate:
                          │  hosts · serves · versions ·   │  one standing service
                          │  render guarantee · deps       │
                          └───────────────────────────────┘
   04-feedback (FDB-*) ····▶ attaches to the medium's stable block ids (staged)
   05-observability (OBS-*) ·· cross-cutting OTel over cli + service
```

## The seams

- **Substrate vs medium.** `01-service` is the standing machine — it hosts one
  Vite dev server, versions apps immutably, guarantees they render, and owns
  the closed `vista-deps` surface. It knows nothing about *what* an app says.
- **The medium is composed, not monolithic.** `02-medium` is the compounding
  heart, split into **four contracts** and **two realizations** (decision 0067). An
  app is a **document** (`01-authoring`) of typed blocks **drawn by one renderer**
  (`02-renderer`), some **fed by data** (`03-data-sources`), the whole **shaped by
  doctrine** (`04-doctrine`) — those are the contracts. The **block library**
  (`05-blocks`) and the **templates** (`06-templates`) *realize* them: the curated,
  versioned blocks and the per-kind app scaffolds. Each contract is one seam; the
  composite node states what binds them (`MED-R*`), and a realization requirement
  refines whichever contract it specializes.
- **The agent interface is one seam.** `03-agent-interface` is how an app comes
  to exist — the `vista` CLI (the operational surface) and the skill (guidance and
  gating). Minimal ceremony (`VST-R64`) lives here at the charter level.
- **Feedback is staged.** `04-feedback` is the human→agent return path, scoped to
  bounded structured-answer (interview); it attaches to the block ids the medium
  already carries (`VST-R04`), so no data migration is ever needed to turn it on.
- **Observability is horizontal.** `05-observability` cross-cuts the cli and the
  service — telemetry on the shared spine, not a layer in the stack.

## Reading order

Numeric directory prefixes are **dependency order**: a higher-numbered node may
depend on a lower one, not the reverse. Requirement IDs are path-scoped
(`SVC-R*`, `MED.AUTH-R*`, `AGT.CLI-R*`, …); a descendant declares `refines:` its
parent, so the tree reads upward to the charter (`VST-R*`) in
[requirements.md](./requirements.md). The root [spec.md](./spec.md) is the
architecture map only; each node's own `spec.md` holds its mechanism. Decisions
live in [.decisions/](./.decisions/) with a global-number history and an old→new
ID bridge in [.decisions/mapping.md](./.decisions/mapping.md).
