# Experiment: review-structure doctrine exploration (2026-06-20)

Design exploration of *what makes a good review* (content structure, not
rendering), grounded in the `cl2-storm` arch-review content. Compared three
structural doctrines and synthesized a recommended skeleton. (Spike mock was under
`tmp/proto-doctrine/`, since reclaimed.) Pairs with the SOTA-principles research;
both feed decisions 0012/0014/0019/0020.

## Why the current arch-review app "isn't very helpful yet"

It navigates **by artifact type** (5 views, a flat decisions log, an options tab)
— organization-by-data-shape. Consequences: the *ask* is never surfaced (5 open
decisions + 2 recommendations awaiting sign-off are scattered/flat); evidence is
detached from the question it serves; no completion semantics. Discriminating
metric: **interactions-to-the-ask** (how many clicks until the reviewer knows what
is being asked of them). Current app ≈ 2 nav clicks + manual filtering.

## Three doctrines compared

- **T1 Question-first / BLUF** — the first screen *is* the ask (sign-offs + open
  questions, each with a one-line lean + evidence link); locked items collapsed.
  Interactions-to-ask: **0**. Mode: decide. Risk: mushy questions degrade it to a
  TOC; rubber-stamping.
- **T2 Decision-tree / forks** — the review is settled forks (chosen branch, rivals
  collapsed) + live forks (reviewer picks); diagrams hang off the fork they inform.
  Interactions-to-ask: ~1. Mode: choose-with-rationale; "why not X" first-class.
  Risk: alternatives theater; deep trees hide the ask.
- **T3 Overview→zoom (C4-like)** — system map → component → detail; decisions
  surface at the level they apply. Interactions-to-ask: ~3+. Mode: comprehend;
  best teaching/mental-model. Risk: **reproduces the current failure** — ask buried
  in component leaves; rewards completeness over judgment.

Key finding: T3 is comprehension-first, which is the *same* structural failure as
the current app. **Structure must match the review's purpose, and Vista's dominant
purpose is decision-driving** — so comprehension-first is the wrong default.

## Recommended doctrine: fixed BLUF skeleton + archetype-selected body

ALWAYS present (the invariant skeleton):
1. **HEADER** — title · scope · status line (N locked · M open · K awaiting sign-off).
2. **THE ASK (BLUF)** — recommendations seeking sign-off + open questions needing a
   verdict, each with a one-line lean + link to evidence. Empty only for explicitly
   *informational* reviews.
3. **BODY** — archetype-selected (below). Everything in the body is reachable from
   an ask (or the system map).
4. **SETTLED** — locked decisions, collapsed, context/audit only.

Body archetype (selected per review):

| Archetype | Body doctrine |
| --- | --- |
| architecture-review | overview→zoom (T3) under a BLUF ask |
| options-comparison | decision-tree (T2) — rejected branches first-class |
| plan / sign-off | flat ask list (T1), thin body |
| telemetry-exploration | dashboard / overview→zoom; ask may be informational-empty |
| code-change recap | diff-narrative (what changed, why, risk); ask = approve/request-changes |

`cl2-storm` is an architecture+options **hybrid**: one BLUF ask on top, a
decision-tree for the two option axes, an overview→zoom map for the views. The app
had the body material but no skeleton.

## Candidate schema (the new layer; reuses existing leaf types)

A `Review` adds `archetype`, `status`, an `Ask` (`decisions` | `informational`),
a `Body` (tagged: `overview-zoom` | `decision-tree` | `plan` | `dashboard` |
`diff-narrative` | `hybrid`), and `settled[]`. Existing `View`/`Decision`/`Option`/
`InterfaceRow`/`ResponsibilityRow` are reused unchanged as leaf evidence. Three
invariants the schema enforces: (1) ask-first or explicitly-informational; (2)
locked/open is a first-class axis, not a buried status string; (3) evidence is
reachable from an ask (`evidenceRefs`) — an orphan body node is a slop smell the
renderer can flag.

## Open doctrine questions (→ OQ-DOCTRINE)

1. Is decision-first the right *global* default, or per-archetype? Is the
   informational escape hatch too easy an out?
2. Should a sign-off require an "evidence opened?" gate to prevent rubber-stamping?
3. Completion semantics on a view-only artifact — where does the verdict go? →
   resolved (decision 0013).
4. Hybrid bodies: one ask vs ask-per-axis? → resolved (decision 0019).
5. Force a `proof_ref`-style citation on every rejected branch (Q16)?
6. Archetype detection: agent-declared / human-selected / inferred? → resolved
   (decision 0014).
