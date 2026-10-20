# Rejected branches: shared-driver scoring + named failed-driver, citation advisory

Status: accepted (Q16; recommended default, reversible)

## Context

Making rejected options first-class (decisions 0012, 0020) invites its own slop —
**alternatives theater**: strawman options scored on cherry-picked criteria so the
chosen one looks inevitable. The doctrine needs a guard.

## Decision

In a `fork` block (decision 0020):

- **Shared-driver scoring is structural:** every branch is scored against the
  *same* decision-driver set rooted at the fork. The schema prevents grading one
  branch on a flattering criterion not applied to the others.
- **Each rejected branch must name the driver(s) it failed on** (required field).
- **A citation is advisory:** the slop linter (decision 0012, advisory) warns when
  a rejection rests on a *factual* claim ("3× slower", "breaks invariant X") with
  no `proof_ref`. Honest design-judgment rejections ("adds complexity we don't
  want") are allowed but render visibly *un-cited* — itself useful signal.

This is MADR's machine-checkable fork (shared drivers + tagged rejections) plus
0012's citation invariant, reusing the advisory linter. No hard gate on judgment
calls.

## Consequences

- The `fork` block schema carries the shared driver set + per-branch failed-driver
  + optional `proof_ref`.
- The linter checks: ≥2 branches, every branch scored on the shared drivers, each
  rejection names a failed driver; advisory-warns uncited factual rejections.
