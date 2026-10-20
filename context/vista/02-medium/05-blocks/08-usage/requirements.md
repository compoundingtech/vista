# Usage Blocks — Requirements

The usage block family realizes trust-preserving OMP usage and API-equivalent
cost views over the [data contract](../../03-data-sources/requirements.md).
Builds on the [block-library requirements](../requirements.md) and this node's
[spec.md](./spec.md). IDs are path-scoped (`MED.BLK.USAGE-*`) and globally
numbered across the Vista VRS.

## Requirements

- **MED.BLK.USAGE-R83 Trust-preserving usage views:** The library must provide
  project-spend and usage-over-time Blocks that preserve OMP Usage's materialized,
  freshness, and account-coverage evidence as typed visible outcomes. Below-gate,
  stale, and unmaterialized results must not be presented as trustworthy empty or
  current data. Every materialized cost view must say "API-equivalent cost, not
  billed spend," and trust policy must remain in the Provider rather than being
  reconstructed by a Block.
  `refines: MED.DATA-R30`

## Acceptance

`SpendByProject` and `UsageOverTime` paint a decoded Snapshot before live work,
render materialized data with coverage evidence, visibly distinguish below-gate,
stale, unmaterialized, and typed failure states, and use the exact
"API-equivalent cost, not billed spend" qualification for materialized results.
Refreshing one binding does not advance another.
