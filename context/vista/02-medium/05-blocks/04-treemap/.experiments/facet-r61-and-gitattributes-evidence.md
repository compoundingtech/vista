# Evidence: facet default-hide is R61-compatible, and the source of truth already exists

Validation backing [decision 0068](../../../../.decisions/0068-treemap-classifies-by-categorical-facet-git-provenance-hidden-by-lens.md).
Two load-bearing claims were checked against kit source and the repo before the
design was accepted.

## Claim 1 — the "N hidden" resting affordance already exists (R61 is cheap)

The R61 tension was: does default-hiding generated files misrepresent the
zero-interaction default as complete? It does **not**, because the treemap toolbar
already renders a resting incompleteness badge whenever the exclusion set is
non-empty — no new UI is needed.

Kit source (`@vista/blocks` treemap): `FilterPanel` renders the toolbar trigger
with a live badge:

```
// blocks/src/blocks/treemap/FilterPanel.tsx
const hiddenLeaves = excludedIds.size
…
<Button className={`vista-treemap__filter-btn${hiddenLeaves > 0 ? ' is-active' : ''}`}>
  <span>Filter</span>
  {hiddenLeaves > 0 ? <span className="vista-treemap__filter-badge">{hiddenLeaves} hidden</span> : null}
</Button>
```

Seeding this same `excludedIds` set from a lens `hiddenFacets` therefore lights up
the `"N hidden"` badge at rest and inherits the existing REMOVE+RE-SUM filter
(counted, drillable, searchable, one-click reveal). Conclusion: default-hide is a
lens projection MED.BLK.TREE-R61 already governs — no new honesty requirement.

## Claim 2 — `.gitattributes linguist-generated` is the pre-existing source of truth

Generated-ness is not something the treemap must hand-list; git resolves it per
path. The repo root `.gitattributes` already marks it (and it already drives
GitHub's own PR-diff collapsing):

```
**/package.json          linguist-generated=true
**/tsconfig.json         linguist-generated=true
**/pnpm-workspace.yaml   linguist-generated=true
.github/workflows/*.yml  linguist-generated=true
.github/labels.json      linguist-generated=true
context/agent-ecosystem/01-scg/generated/** linguist-generated=true
**/*.generated.ts        linguist-generated=true
```

Resolved per path by one batched `git check-attr linguist-generated -- <paths>`;
`unspecified` → `authored`; `linguist-vendored` → `vendored` for free. Conclusion:
reuse it — no parallel registry.

## Design surface

The options were compared with the operator in a published Vista proposal
(options-comparison template) and settled via `/sk-vrs-interview`:
`/r/treemap-generated-provenance/latest`. Three forks resolved: (1) lens projection
under R61; (2) agnostic facet + separate git binding; (3) thin Vista-local shell +
shared `FileChange` contract.
