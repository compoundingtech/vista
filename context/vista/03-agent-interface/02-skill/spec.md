# Skill — Spec

This node specifies `/sk-vista`. Requirements are in [requirements.md](./requirements.md);
AppRoot authoring belongs to [01-authoring](../../02-medium/01-authoring/spec.md);
operations belong to [01-cli](../01-cli/spec.md).

## Routing

Use a Vista App when agent-to-human output needs rich, relational, comparative,
or evolving review: architecture/design, plan sign-off, options, live telemetry,
or code changes. Keep simple linear results in the terminal.

Route shipped product release recaps to `.changelog` entries rather than a new
App. An entry may carry a non-empty `contributors` array whose items have an
exact native Smalltalk subject or historical dotted-label `agentId`, optional
verified `name`, and optional short `repo/branch-leaf` `worktree`; absolute paths are invalid. Multiple items record
shared work. The product presents this provenance as expandable **Change
context**. Use an App instead when a release change needs rich review.

## Action guidance

The skill teaches:

1. shipped release recaps use `.changelog` contributor context as specified above;
2. AppSource default-exports a zero-prop AppRoot using `@vista/blocks`;
3. stable IDs identify only addressable SemanticNodes and RuntimeIslands;
4. AppRoot leads with the ask and exposes only bounded choices;
5. optional `vista check [path]` supports iteration;
6. `vista publish <local-slug> --message <summary>` is sufficient;
7. browser-judge the pinned URL returned by publish before sharing.

It does not reproduce Provider, DataBinding, SemanticManifest, publication,
hosting, or lifecycle mechanisms. It composes with `/sk-explainer`,
`/sk-agentation`, and `/sk-interview`.
