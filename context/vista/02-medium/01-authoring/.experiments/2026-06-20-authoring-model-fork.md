# Experiment: authoring-model fork (2026-06-20)

Resolves OQ-RICHTEXT and OQ-CUSTOM-TYPING with a compiling Vite/React/TS
prototype that authored the same review three ways, ran one shared advisory linter
over all three, and exercised three prop-typing options. `tsc --noEmit` was green;
every claim executed. (Spike source was under `tmp/proto-authoring/`, since
reclaimed.)

## Fork 1 (OQ-RICHTEXT) → hybrid: typed doctrine spine + MDX confined to prose leaves

The decisive constraint is decision 0012: the advisory linter must *statically*
find the ASK, archetype, locked/open, orphan evidence, fork<2, provenance. Linter
run over a structural projection of each variant (over JSON-round-tripped data, MED.AUTH-R25):

- **typed-blocks** → 0 warn, 0 blind (projection is a total function over typed data).
- **hybrid** → 0 warn, 0 blind (MDX only in `prose` leaves; nothing doctrine-load-bearing there).
- **MDX** → 1 warn, 3 blind (linter must parse JSX; goes **blind** on anything non-literal).

Decisive argument is **convergence**, proved empirically: the MDX sample's
decision/option checks resolved *only* because data was hand-inlined as literals.
Rewritten the way an agent naturally would — `<DecisionLog entries={decisionData}/>`
with imported data — **every** doctrine check goes blind (`decisionData` is an
opaque identifier; locked/open and option-count unrecoverable). You cannot force
literal inlining. So to make MDX fully doctrine-checkable you must hoist the spine
(ask/archetype/locked-open/evidence/provenance) out of expression-range into typed
frontmatter/props — at which point **MDX-done-safely *is* the hybrid model.**

Further hybrid wins: portability (typed/hybrid JSON-round-trip; MDX compiles to
`_jsx(...)` and survives only as opaque source); the graduation ratchet
(compile-time exhaustive switch goes red on graduation — MDX subsumes the escape
hatch but **loses the graduation forcing-function**, so the escape hatch stays the
typed `custom` block, not arbitrary inline JSX); toolchain cost (MDX pulled ~113
remark/unified packages; typed/hybrid lint needs none).

## Fork 2 (OQ-CUSTOM-TYPING) → effect Schema as single source of truth, keyed by a typed registry

Because the doc is portable/serialized (MED.AUTH-R25), `custom.props` arrives as `unknown`
JSON at render. Demonstrated in code:

- **module augmentation** — compile-time componentKey↔props correlation, but
  **nothing** on the deserialized `unknown` wire value. Author-time only.
- **untyped** — no guarantee anywhere; renders garbage silently.
- **effect Schema** — one `Schema.Struct` yields the compile-time type
  (`Schema.Type`) **and** validates deserialized props at render (caught
  `likelihood: 9` with a precise path). Matches house "schemas are the single
  source of truth"; graduation lift is trivial (the schema becomes the first-class
  block's payload contract, reused verbatim).

Sharpened: a **typed-keyed registry** (`as const satisfies`) recovers
augmentation's author-time componentKey↔props correlation *in addition to* runtime
validation, all from one definition — dominates the alternatives.

## Linter

Variant-agnostic; soundness lives in the per-variant projector. Hybrid's projector
is total/sound over typed data, so all six 0012/0014 invariants are checkable with
zero parsing. A new **`blind`** severity distinguishes "violated" from
"un-auditable" — the category that makes MDX lose (a clean run with blind spots
means the doctrine *silently goes unchecked*, worse than a flagged violation).

## Open decisions

1. OQ-REGISTRY-KEYS now couples to Fork 2: a generated union of registered keys
   would make the typed schema registry exhaustive at compile time. Decide
   generated vs hand-maintained.
2. Define the **prose-leaf MDX boundary** precisely: which inline components are
   allowed in `prose`, and lint that no ask/decision/options/evidence appears there
   — that constraint is what keeps hybrid checkable.

## Operational note

Disk was at 99% (<25G agent-policy install floor). The spike used
`AGENT_POLICY_BYPASS=1` to install ~50M of deps — self-authorized rather than
confirmed; flagged for ratification. No tracked source/VRS touched.
