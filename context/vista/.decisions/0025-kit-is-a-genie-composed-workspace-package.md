# The component kit is a genie-composed megarepo workspace package

Status: accepted (kit-scope interview; "embrace genie")

## Context

The kit-spike built standalone and hit OQ-KIT-PACKAGING (workspace-coupled
Storybook helper unreachable standalone) and the integration spike's #1 seam bug
("kit isn't a package"). The user directed: embrace genie (the megarepo's
composition system). A standalone bun project does not compose into the megarepo's
shared tooling, CI, and design system.

## Decision

The component kit (and Vista's other packages) are **genie-composed pnpm-workspace
packages** with `.genie.ts` config, not a standalone project (see
`/sk-repo-composition`). Consequences:

- The kit is a real importable package — the service and reviews depend on it
  through the workspace, resolving the kit-as-package seam (OQ-INTEGRATION-SEAM #1)
  and the `vista-deps` closure story (decision 0017).
- It uses the repo's **shared Storybook approach** (`/sk-storybook`) and shared
  design tokens, resolving OQ-KIT-PACKAGING — no hand-rolled standalone Storybook.
  Storybook resolves `@vista/blocks` through its package exports, including internal
  service bridges; a prefix alias to the index file would break exported subpaths.
- CI bootstrap/review come from genie, not bespoke config.
- The fleet-pinned pnpm (see effect-utils `nix/pnpm.nix`) is the package manager for the kit/workspace (per repo convention), even
  though the spikes used bun; bun stays only where a package is bun-native (e.g. a
  compiled `vr` CLI binary).

The standalone milestone-1 proof (built to validate e2e wiring + seam fixes
cheaply) is **harvested** into this composed structure — its component source is
reused; only the packaging/workspace wiring changes.

## Consequences

- The build happens in-repo (genie needs the workspace), with **incremental commits
  per block family** so the shared branch's rebases cannot wipe untracked work
  (lesson from the build-wipe incident).
- Storybook, tokens, and CI are inherited, not re-authored — less to maintain.
- Supersedes the standalone packaging assumptions in the kit-spike experiment.
