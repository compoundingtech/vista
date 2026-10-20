# Packaged Vista smoke and runtime-policy projection

## Question

Can misc6 prove the packaged Vista artifact through an isolated service/CLI smoke
while moving runtime-policy authority closer to package-level metadata?

## Method

Implemented a developer smoke harness:

```sh
node flakes/vista/scripts/packaged-smoke.mjs --package <vista-out>
```

The harness runs the packaged `vista-service` and `vista` CLI from the Nix output
against temporary roots under `/tmp`:

- `VISTA_ROOT=<out>/libexec/workspace`
- `VISTA_REVIEWS=<tmp>/reviews`
- `VISTA_CACHE=<tmp>/cache`
- `VISTA_ISLAND_STORE=<tmp>/island-store`
- `VISTA_DEPS=<out>/libexec/workspace/node_modules`

It publishes:

- a service-scaffolded review (`vista new` then `vista publish`);
- a pure-provider freeze review using the built-in `overview` provider;
- doctrine, heavy-kit, trace-island, and flamegraph-island samples copied from
  the packaged workspace;
- optionally, with `--include-live-telemetry`, the Mimir-backed data-panel sample
  and telemetry metric island sample;
- a pinned `https://esm.sh/zod@3.25.76` review;
- a blocked `lodash` import review, expected to fail through the runtime policy.

The harness's fake Mimir runs as a child process, not in the harness event loop:
the harness invokes the packaged `vista` CLI synchronously, so an in-process HTTP
server deadlocked when `vista publish data-smoke` tried to query Mimir during
freeze capture.

Runtime policy was changed so package JSON metadata under `$vista.runtimePolicy`
contributes public import roots, optimize deps, CSS imports, aliases, remote import
rules, `ssrExternal`, and React dedupe. The service projects those contributions
into the existing Vite/import policy and still resolves logical targets through
runtime roots (`VISTA_ROOT`, `VISTA_KIT`, `VISTA_ISLAND`).

Follow-up misc6 work made the metadata slice-preserving and closure-discovered:
generated package JSON now keeps named `slices`, and the service scans the
installed workspace closure for every package JSON carrying `$vista.runtimePolicy`.
The projector flattens those emitted slices at runtime and carries
`serviceOwnedImportRoots` as first-class projected metadata.

## Result

Package build:

```sh
nix build .#vista --no-link --print-out-paths
```

passed after Evergreen reconciled the Vista root deps fixed-output hash:

```text
/nix/store/rj7cdmjnycb9w213ipy8mjaxi543n8gw-vista
```

Smoke command:

```sh
devenv tasks run vista:packaged-smoke:full --mode single --show-output
```

returned:

```json
{
  "package": "/nix/store/rj7cdmjnycb9w213ipy8mjaxi543n8gw-vista",
  "serviceUrl": "http://127.0.0.1:44957",
  "browser": true,
  "includeLiveTelemetry": true,
  "status": "ok"
}
```

This task consumed the repo devenv Playwright environment. No manual
`PLAYWRIGHT_BROWSERS_PATH` export was needed.

Intermediate root-cause experiment:

```sh
VISTA_SMOKE_KEEP=1 node flakes/vista/scripts/packaged-smoke.mjs \
  --package /nix/store/d0wakjfkb2znfla8znmh2ps0i363d1v4-vista \
  --include-live-telemetry \
  --no-browser
```

timed out in `vista publish data-smoke`. The fake Mimir server was then rerun in
a separate Python process against the kept root, and `vista publish data-smoke`
completed immediately. That proved the hang was harness-local event-loop
starvation, not provider/freeze behavior.

Focused service verification:

```sh
pnpm --dir flakes/vista/service exec vitest run \
  src/control-rpc.test.ts \
  src/runtime-policy.test.ts \
  src/runtime-policy.vite.test.ts \
  src/paths.test.ts \
  --exclude '**/*.browser.test.ts'
```

passed: 4 files, 15 tests.

`git diff --check`, package JSON validation, and `node --check` for the smoke
harness passed.

## Limits

The live telemetry leg is still opt-in (`--include-live-telemetry`) so the default
developer smoke remains smaller while the harness is young. It is now proven in
this shell with browser checks enabled and an isolated fake Mimir child process.

The broad `devenv tasks run test:vista-service` path was not useful for this
milestone because it spent several minutes in unrelated package install fanout
before reaching Vista. Targeted package build, smoke, and focused service tests
were used instead.

## VRS Impact

- Supports decision 0048: packaged smoke and runtime-policy cleanup should advance
  together.
- Proves emitted package metadata preserves named slices and the service discovers
  runtime-policy contributions from the workspace closure.
- Proves draft and publish import validation works through the projected policy
  with typed import diagnostics and `vista debug import`.
- Supports decision 0049: browser smoke uses the devenv-provided Playwright
  environment, and future OTel producer-side tests should use `otelite`.
- Keeps #1214's packaged-smoke workstream as developer-task-first; browser and live
  telemetry are now locally proven, leaving CI promotion as the next ratchet.
