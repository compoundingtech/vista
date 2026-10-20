# CLI build identity via the shared build-versioning contract

Status: accepted

## Context

The `vista` CLI resolves its version by hand: `cli.ts` does
`JSON.parse(buildStamp) as { version?: unknown }` and plucks `.version`, used only
for `--version`. It drops the rest of the build stamp (rev, dirty, commit time),
has no machine-vs-display distinction, threads no version into telemetry, and is
the exact "reimplement the formatter" anti-pattern `/sk-build-versioning` names.
Vista had no versioning requirement at any level.

## Evidence and Argument

De-risk came back GREEN as a drop-in. `@overeng/utils` is already in the CLI's
workspace closure, and the build stamp injected by `mk-pnpm-cli`
(`{ type:"nix", version, rev, commitTs, dirty }`) is byte-for-byte what
`@overeng/utils/node/cli-version` `resolveCliBuildIdentity` parses — same
placeholder (`__CLI_BUILD_STAMP__`), same fields. Four shipping CLIs already use
it. No mismatch; the only care-point is choosing `machineVersion` (not display
prose) for telemetry.

## Options

| Option | Tradeoffs |
| --- | --- |
| Adopt `resolveCliBuildIdentity`/`CliVersion` (chosen) | Reuses the shared contract; machine/display split; feeds telemetry; annotates errors. Drop-in — deps already present. |
| Keep bespoke `resolveVersion` | No new code; but loses rev/dirty/machine-version, feeds nothing to telemetry, and diverges from the repo build-versioning doctrine. Rejected. |

## Decision

The CLI derives build identity from the shared contract:

- `resolveCliBuildIdentity({ baseVersion, buildStamp })` from
  `@overeng/utils/node/cli-version`, replacing the bespoke `resolveVersion`.
- `--version` (via `@effect/cli`'s version option, not a raw `process.argv`
  pre-check) prints `displayVersion`.
- OTel `service.version` (0062) is `machineVersion` — stable and parseable — never
  the display prose.
- `CliVersion` is provided into the runtime so tagged-error stderr lines carry the
  `(vista <version>)` suffix.

This is captured as a thin CLI requirement (build identity via the shared
contract), vista's first versioning requirement.

## Consequences

- One build-identity idiom shared with the rest of our CLIs; no bespoke formatter.
- Couples to 0062: telemetry resource version comes from here.
- The Nix build already emits the correct stamp; no packaging change needed.
