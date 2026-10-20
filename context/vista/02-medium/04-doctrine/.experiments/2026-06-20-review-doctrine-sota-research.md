# Experiment: review-doctrine SOTA research synthesis (2026-06-20)

Literature synthesis on what makes a great review/explanation artifact, to ground
the Vista review doctrine. Sources: Bret Victor (Magic Ink, Learnable Programming,
Explorable Explanations), Tufte, Shneiderman, NN/g, Diataxis, C4/arc42/ADR/MADR/RFC,
Google/Amazon doc culture, Google code review, Distill, HBR "workslop". Pairs with
the structural exploration ([2026-06-20-structural-doctrine-exploration.md](./2026-06-20-structural-doctrine-exploration.md)).
Provenance caveats preserved (below) on purpose — to be grilled, not smoothed.

## Root rule (four names, one idea)

**The author absorbs verification cost; the reviewer only confirms, never
reconstructs — and learns the mental model on the way.** Its violation is named
chartjunk / low data-ink (Tufte), extraneous cognitive load (Sweller), bad
information scent (Pirolli/Card), and "workslop" (HBR 2025: "AI generated work
content that masquerades as good work… transfers the effort from creator to
receiver").

## Seven invariants

1. **Lead with the decision and the ask** — first viewport = recommendation + what
   the reviewer should DO (BLUF / inverted pyramid / Amazon narrative).
2. **Overview before detail, persistently** — whole-shape → zoom → details-on-demand,
   overview stays in view (Shneiderman / C4).
3. **Every element earns its place by reducing effort** — "impressive" is a defect
   signal; cut decoration (Tufte / Sweller / scent).
4. **Separate the *why* from the *what*** — Explanation (mental model) vs Reference
   (raw diff/config/metrics) are different modes; don't blur (Diataxis).
5. **Make every fork visible** — ≥2 options, shared decision drivers, rejected
   branches tagged with the driver each failed on (ADR/MADR/Google).
6. **Every load-bearing claim is cross-checkable in place** — number → its query;
   "faster" → a pokeable model; else it's a billboard (Victor / workslop).
7. **Terminate in a concrete, severity-tagged ask** (MUST/SHOULD/MAY, used
   sparingly) — informing without asking is the dashboard pathology (RFC 2119 / Few).

## The seven questions a review must answer (the spine / schema)

1. **What is this?** one scoped sentence. 2. **Why does it exist — and what will it
   explicitly NOT do?** (goals/non-goals). 3. **What changed?** mental model first,
then reference precision. 4. **What forks were hit; which branch chosen; WHY?**
(≥2 options, shared drivers, tagged rejections — the core item). 5. **What's the
evidence / cost?** consequences both signs, risks by priority, measurable not
"should be fast". 6. **What's still open / needs a human?** 7. **What should the
reviewer DO?** explicit severity-tagged ask.

A valid artifact answers all seven; empty sections are emitted-but-empty, never
padded.

## Structural fit (match structure to genre + data shape)

Tree/overview→zoom (C4) → architecture; decision-tree (ADR/MADR) → a decision /
options; question-first/BLUF (Amazon) → high-stakes sign-off; Diataxis
mode-separation → anything mixing teaching + facts; reactive document
(Observable/Idyll) → telemetry / assumption-driven comparison. Misusing the data's
shape (prose for a comparison, boxes for a timeline) is a root cause of slop.

## The static-vs-reactive tension — resolved

Half the sources want static narrative (Amazon banned slides; C4/ADR/BLUF are
read-not-operated); half want reactive exploration (Victor/Observable/Distill).
Resolution (strongest invariant): **narrative is the default and load-bearing;
interactivity is added only where it changes what the reviewer can understand, and
is otherwise cut.** Test = Distill's gate ("does any interactive element change
what the reviewer can understand?") + Victor's default-to-zero-interaction,
derive-context-first. A knob that merely re-displays what a sentence already said
is cut.

## Teaching test

A review teaches when, after reading the top mental-model layer + the
context→decision→consequences spine, the reviewer can *predict* what the reference
layer contains. If they must read the reference layer to understand the decision, it
dumped conclusions. Mechanisms: smallest-runnable mental model up top (flag where it
breaks); worked-example spine; austere reference behind disclosure; every claim
evidence-bound; predict-then-reveal for comparisons.

## Anti-slop essence

Burden inversion, polish-without-substance, the "duck"/chartjunk, no-overview,
wrong-shape-for-data, everything-visible-at-once, vague labels (no scent),
conclusion-buried, mode-mixing, decision-with-no-alternative, false-confidence
(guess at fact weight), fabricated-claim (no citation), flat 10+ list,
display-without-decision, undisclosed provenance. Each maps to one invariant above.

## Inspiration shortlist (steal one thing each)

Victor *Magic Ink* (context hierarchy: environment→history→inference, zero-interaction
default); Distill *Research Debt* (the publication gate); MADR (machine-checkable
fork: shared drivers, tagged rejections); Shneiderman (overview→zoom→details +
data-type→representation); Diataxis (Explanation/Reference split); Amazon 6-pager
(narrative forcing-function); Observable/Idyll (single reactive dataflow binding
prose+figures).

## Provenance caveats (for interview — do not quote as verbatim)

- "3:30 in the morning" BLUF framing — unsourced; use NN/g "readers can stop
  reading at any point" instead.
- C4 "abstractions first, notation second" — paraphrase.
- arc42 "everything optional / cabinet" — community paraphrase; confirmed sections
  §9 decisions, §10 quality, §11 risks/tech-debt.
- Amazon narrative-forcing quote — 2004 Bezos email via Slab, not the 2017 letter.
- Cowan "~4 chunks" — secondary-summary paraphrase.
- Tufte sparklines + Lie Factor — verbatim; other Tufte quotes from transcriptions.
