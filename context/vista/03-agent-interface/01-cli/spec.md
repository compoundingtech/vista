# CLI — Spec

The `vista` CLI owns App operations. Requirements are in
[requirements.md](./requirements.md); AppSource/AppRoot are owned by
[authoring](../../02-medium/01-authoring/spec.md); current syntax by `vista --help`.

## Optional check

```text
vista check [path]
```

Check is service-independent and optional. It validates AppSource and its
deterministic SemanticManifest with the diagnostic schema Publish also uses.
Success is compact; failure is problems-first, deduplicated, and points to
authored paths.

## Publish

```text
vista publish <local-slug> --message <summary>
```

Publish derives owner from `$ST_AGENT`; the summary is required and
noninteractive. It is sufficient: service validation repeats Check diagnostics,
then applies build and render gates. Success creates an immutable AppVersion and
PublicationReceipt, then returns its pinned URL. The caller browser-verifies it.

Source resolution uses the service-owned `VISTA_SOURCES` root and the single
encoded-owner layout specified by [authoring](../../02-medium/01-authoring/spec.md#appsource).
Scaffold and rehydrate target that same AppSource; the CLI does not resolve a
catalog directory or reinterpret the owner's host.

No per-App install, bootstrap, shell, global stylesheet, or build step is author
work. AppRoot owns App metadata; App-local StyleX is valid AppSource.

## Lifecycle and output

LatestRoute, retire, AppResource, and AppIndex operations are self-documented by
`vista --help`. Retire preserves pinned AppVersions. Human-facing output follows
`/sk-cli-design`; machine output remains schema-derived and
presentation-independent.
