# Delta: durability narrowed to one contract version (vision update pending)

Decisions 0061 and the 0004 amendment bound frozen-snapshot durability to a single
global `apiVersion`: on a (rare) contract bump, older-version snapshots become
unsupported and are not migrated (deliberate migration-avoidance; accepted
data-loss contract).

`vision.md` still states the stronger, unqualified promise:
- "Trust the artifact over time. Reviews are durable and versioned: a link stays…"
- "…freeze it into a durable snapshot, so a claim is backed by what is."

These remain true for **review identity and immutable source**, but no longer for
the **frozen-data projection across a contract bump**. `vision.md` is human-owned;
this delta flags that its durability language should be softened to match 0061
(e.g. "durable within a contract version; frozen data is not migrated across rare
global-version bumps"). Until the owner updates the vision, the decision layer is
the precise contract.
