# 0104 — Consumer package archives

Status: proposed

## Context

Source-flake publication does not supply portable npm packages for independent
consumers. They need immutable archives without workspace-relative dependencies.
[0103](./0103-protected-cachix-publisher.md) establishes protected-main Cachix
publication and leaves the manifest consumer open.

## Decision

Expose Nix archive outputs for `@vista/ui`, `@overeng/agent-timeline`,
`@vista/blocks`, and `@vista/service`. Include `@overeng/geist-design-system`
because the runtime closure still imports the legacy alias of `@vista/ui`.
Use Buck's typechecked `dist-package` targets, as effect-utils does, followed by
one deterministic manifest projection that pins local runtime siblings to their
Cachix serve URLs and effect-utils runtime packages to its pinned public manifest.
Omit development dependencies and scripts; reject unresolved local specifiers.
Exports address emitted JavaScript and declarations. Consumer archives expose
stable consumer contracts, not the runtime server: `@vista/service` advertises
only `./read` and `./wire`, retaining their transitive modules in the archive.
The runtime remains the Nix package. Buck's dist preserves non-TypeScript assets
beside emitted modules. Before archiving, every package's emitted JavaScript and
declarations are checked for unresolved relative imports.

Publish these roots alongside the runtime under 0103's unchanged enable gate,
credential boundary, protected-main guard, and App-authored manifest PR flow.
Manifest version 2 adds package name/version, archive store path and filename,
flat lowercase hex SHA-256, byte size, and the public Cachix serve URL.
Consumers use URL-plus-digest pins through the existing effect-utils
`registryUrl` sidecar / `pnpm-archives.nix` fetchurl mechanism. Do not introduce
another archive transport, an npm registry publication step, or a private-product
manifest adapter.

## Consequences

Archive identity includes exact sibling archive identities, not mutable semver
resolution. The legacy alias remains required until its imports are migrated.
Cache eviction affects availability, not integrity. Publishing does not repoint
consumers, provision credentials, activate publication, or promise cache retention.
The initial publication platform remains x86_64-linux; package payloads are npm
archives rather than a platform-specific runtime executable.

See the [publisher contract](../01-service/publisher.md) for manifest fields and
failure behavior.
