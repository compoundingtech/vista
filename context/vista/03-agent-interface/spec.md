# Agent Interface Spec

The agent interface joins the skill with the CLI. Canonical App terms are in
[ontology.md](../ontology.md).

## Two halves

- **Skill ([02-skill/spec.md](./02-skill/spec.md)):** owns medium selection,
  minimal AppRoot guidance, and browser judgment.
- **CLI ([01-cli/spec.md](./01-cli/spec.md)):** owns optional local check,
  publish, lifecycle operations, and output.

AppSource/AppRoot shape belongs to authoring; the service owns AppVersion,
PublicationReceipt, and immutable hosting.

```text
Agent -> AppSource -> AppRoot -> CLI
CLI -> optional Check | Publish -> AppVersion -> PublicationReceipt
App -> LatestRoute -> AppVersion -> VersionSummary -> AppIndex
```

`vista check [path]` is an optional service-independent iteration loop. Publish
repeats its diagnostics before exposing an AppVersion. Feedback targets
SemanticNodes and is owned by [04-feedback](../04-feedback/requirements.md).
