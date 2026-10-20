# Agent Interface Requirements

## Audience

For: agents

| For | Why it exists for them | Surface | Optimizes for |
| --- | --- | --- | --- |
| Humans | Humans consume the resulting app rather than this authoring interface | `none:not-an-audience` | - |
| Agents | Provides the sole operational path to check, publish, inspect, and retire owner-scoped Vista apps | `cli:vista` | low ceremony, safe lifecycle, stable receipts |

Owns tools: none

This node owns how a coding agent produces an App. The CLI is the sole
operational surface; the skill is the guidance/gating surface. App-scoped
operations derive `owner × local-slug` from `$ST_AGENT`; agents author only
AppSource while Vista owns operations and lifecycle.

This composite owns no requirement that a child can own. Child IDs are
path-scoped and refine the root contract.

## Subsystem requirements

| Node | Scope | Requirement IDs |
| --- | --- | --- |
| [01-cli](./01-cli/requirements.md) | optional check, publish, lifecycle, inspection, and output | `AGT.CLI-R06`, `AGT.CLI-R08`, `AGT.CLI-R56`, `AGT.CLI-R67–R69`, `AGT.CLI-R78` |
| [02-skill](./02-skill/requirements.md) | medium selection and concise App action guidance | `AGT.SKILL-R07` |
