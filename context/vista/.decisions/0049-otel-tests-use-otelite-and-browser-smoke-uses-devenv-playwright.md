# OTel tests use otelite and browser smoke uses devenv Playwright

Status: accepted (Vista misc6 alignment)

## Context

Vista now has a packaged smoke harness that proves service/CLI publish behavior,
browser rendering, fake-provider live telemetry, telemetry islands, remote pinned
imports, and blocked dependency rejection. The first full proof was run by
manually exporting the Nix Playwright browser path, but the repo already has a
devenv Playwright module that exports `PLAYWRIGHT_BROWSERS_PATH` and keeps the
Nix browser driver aligned with `@playwright/test`.

Vista also has two different OTel-related concerns:

- **Provider consumption:** Vista reads Prometheus/Tempo/Pyroscope-compatible
  provider APIs and freezes backend-faithful payloads.
- **Producer instrumentation:** Vista commands/services should eventually emit
  useful spans/attributes around publish, freeze, smoke, provider calls, and
  failures.

These need different harnesses.

## Decision

Vista browser smoke uses the Playwright environment provided by the repo devenv
shell. Browser-mode smoke must not hardcode a browser store path or depend on
ambient downloaded Playwright browsers. Developer and CI callers should use:

```sh
devenv tasks run test:vista-kit-storybook
devenv tasks run vista:packaged-smoke
devenv tasks run vista:packaged-smoke:full
```

`test:vista-kit-storybook` is the local reusable Storybook proof for the Vista
kit. It uses the same devenv Playwright browser driver, fails fast without
`PLAYWRIGHT_BROWSERS_PATH`, and keeps raw `pnpm ... playwright test` invocations
out of the recommended path.

The no-browser path remains available for service/CLI-only proof:

```sh
devenv tasks run vista:packaged-smoke:no-browser
```

For OTel-related tests, Vista uses `otelite` as the default local/CI harness for
producer-side instrumentation assertions. `otelite` is the right tool for emitted
spans, resource attributes, `span.label`, status, redaction, and span-derived
metrics without a live collector stack.

`otelite` does not replace fake provider servers. Fake Mimir/Tempo/Pyroscope
servers remain the right harness for provider-consumption tests because those
prove Vista can read backend-compatible APIs and freeze/render their payloads.

## Consequences

- Packaged browser smoke now fails fast when `PLAYWRIGHT_BROWSERS_PATH` is absent
  and points callers at the devenv task instead of encouraging ad hoc exports.
- Vista kit Storybook E2E now has the same devenv-owned browser boundary through
  `test:vista-kit-storybook`.
- CI promotion should consume the same devenv task surface developers use.
- Future Vista telemetry assertions should add first-class spans first, then
  assert them with `otelite run`/`otelite inspect` or
  `@overeng/utils-dev/otelite` helpers.
- Live Grafana/GCX checks remain separate operator-readback proof, not the default
  local unit/e2e instrumentation harness.
