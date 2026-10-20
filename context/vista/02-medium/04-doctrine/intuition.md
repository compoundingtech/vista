# App Doctrine — Intuition

The settled doctrine spine for Vista apps: what makes an app good rather than
"generated slop". Grounded in decisions [0012](../../.decisions/0012-enforce-cheap-doctrine-invariants-guide-the-rest.md)
(enforce cheap invariants, guide the rest) and
[0014](../../.decisions/0014-archetype-is-agent-declared-with-advisory-crosscheck.md)
(template is agent-declared). Open refinements are in
[../../open-questions.md](../../open-questions.md) (OQ-DOCTRINE).

## Root rule

The author absorbs verification cost; the reviewer only confirms, never
reconstructs — and learns the mental model on the way. Its violation is the slop
named, by four independent fields, chartjunk / extraneous cognitive load / bad
information scent / "workslop".

## The invariant skeleton (always present)

1. **HEADER** — title · scope · status line (N locked · M open · K awaiting sign-off).
2. **THE ASK (BLUF)** — what the app needs from the reviewer: recommendations to
   sign off + open questions to resolve, each with a one-line lean and a link to its
   evidence. Empty only for an explicitly *informational* app.
3. **BODY** — template-selected (below). Everything in the body is reachable from
   an ask (or the system map).
4. **SETTLED** — locked decisions, collapsed, context/audit only.

Each decision occupies exactly one status bucket (locked | open | awaiting-sign-off);
placement and the status line are projections of it (decision 0019).

## Template-selected body

The agent declares the template (decision 0014); it selects the body doctrine. The
per-kind body table and the hybrid case are owned by the
[templates](../06-templates/intuition.md), which *realize* these principles for each
kind (decision 0067). Doctrine keeps the principles; the template carries the body.

The doctrine spine is expressed by the dedicated doctrine blocks `ask` /
`status-line` / `settled` and the [`fork`](../05-blocks/06-fork/spec.md) block
(decision 0020).

## The seven questions every app answers

1. What is this? 2. Why does it exist — and what will it explicitly NOT do?
3. What changed? (mental model first, then reference precision). 4. What forks were
hit; which branch chosen; WHY? (≥2 options, shared drivers, tagged rejections — the
core item). 5. What's the evidence/cost? (both signs; measurable, not "should be
fast"). 6. What's still open / needs a human? 7. What should the reviewer DO?
Empty sections are emitted-but-empty, never padded.

## Narrative default; interactivity is a scarce resource

The narrative carries the argument; interactivity is added only where it changes
what the reviewer can *understand* (Distill's gate), starting from a sensible
zero-interaction default and varying only the genuinely independent variables
(Victor). A control that re-displays what a sentence already said is cut. This is
the resolution of the static-vs-reactive tension and the governing rule for the
multi-dimensional system explorer (MED.BLK.SYSX-R42–MED.BLK.SYSX-R44, decision 0018).

## Teaching test

After reading the top mental-model layer + the context→decision→consequences spine,
the reviewer can *predict* what the austere reference layer (diff/config/metrics)
contains. If they must read the reference to understand the decision, the app
dumped conclusions instead of teaching the model.

## What the system enforces vs teaches (decision 0012)

- **Enforced structurally (schema + advisory slop linter):** ask-first /
  explicitly-informational; locked/open as a first-class axis; evidence reachable
  from an ask (orphan sections flagged); a fork invalid with <2 options;
  load-bearing claims carry a citation; a provenance stamp; template declared and
  cross-checked against content shape.
- **Taught (doctrine + kit conventions):** is the mental model good and minimal; is
  each interactive control earned; is the structure the right template; is density
  well-layered rather than cluttered.

The linter is advisory, not blocking — good structure is the path of least
resistance, not a gate.

## Derived authoring helpers

Values that summarize an App's semantics must come from the same semantic React
source rather than a parallel bucket. During trusted publish-time evaluation,
Vista derives status counts, title, Template, references, and data/freeze bindings
into the semantic manifest. The index and rendered shell consume that projection;
the author maintains no metadata sidecar and performs no hand-count consistency
check.
- **Patch validity.** `validatePatch(patch)` checks every hand-written unified
  `@@ -a,b +c,d @@` header against its body line counts. A wrong header renders
  garbled or blank with no error — a coding agent hand-writing patches miscounts
  routinely. Run it on every authored `diff`/`gh-previews` patch; a non-empty
  result is an authoring bug, not a reviewer problem (the root rule: the author
  absorbs verification cost).
