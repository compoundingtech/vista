# Telemetry Block — Glossary

Terms owned by the telemetry block. The generic durability tier `data-frozen`, and
`live`/`frozen`/`provider`, live in the
[data-sources glossary](../../03-data-sources/glossary.md); `block library` in the
[block-library glossary](../glossary.md); leitwörter in the
[root ontology](../../../ontology.md).

## Telemetry island

The isolated, lazily-loaded, client-only React root (its own bundled React instance) that renders all telemetry
[blocks](../../../ontology.md#block) (metric time-series, trace waterfall, flamegraph)
via Grafana components inside the React-19 host, mounted through the generic
lazy-block boundary. It is reached only by a dynamic `import()` inside the block
(never re-exported from the block-library barrel) so its React-version, runtime, and
licensing concerns stay contained. The vendored AGPL trace source lives in a separate
unit the library never re-exports.

## Pixel-frozen

The stronger of the two [frozen](../../03-data-sources/glossary.md#frozen) durability
tiers, carried by apps with a heavy/frozen telemetry island. Beyond
[data-frozen](../../03-data-sources/glossary.md#data-frozen) (which inlines the
provider's result bytes), a **pixel-frozen** app additionally pins the island render
chunk as a self-contained, content-addressed built artifact, so the page looks
identical regardless of later library upgrades. The viewer's mode indication must not
claim more than a block actually has.
