# Taste kit and simple authoring defaults

Status: accepted (brief variant pending)

Provenance: Johannes and manager-confirmed Vista owner decisions.

## Context

Vista needs reusable presentation choices and authoring guidance without exposing
its implementation complexity to authors or readers.

## Decision

| Decision                                                                                                                                                                                                                                                                              | Rationale                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Owner model A: only managed seats own new publications, as specified in decision 0100 ([#5589](https://github.com/schickling/dotfiles/pull/5589)).                                                                                                                                    | Seat identity stays independent of host placement.                                                              |
| Ship the `@vista/blocks` taste kit and skill pattern, not a decision-review template ([#5671](https://github.com/schickling/dotfiles/pull/5671), [#5726](https://github.com/schickling/dotfiles/pull/5726)).                                                                          | Reusable blocks guide judgment without imposing a canned page.                                                  |
| Kit picks: H2 header, C1 choice cards, F1, K3, R1 shell ask counter, S2, Comparison, Verdict, DependencyFlow (MissionGraph), ProgressLanes, and RankedFindings; C1's Recommended mark is subtle and never looks selected ([#5726](https://github.com/schickling/dotfiles/pull/5726)). | A shared visual vocabulary reduces copying while keeping recommendation distinct from selection.                |
| Agents try to prove findings before publishing; the kit renders unproven findings as hypotheses with a `next` step.                                                                                                                                                                   | Readers can distinguish evidence from a claim and see how to resolve uncertainty.                               |
| Legend B: Explain overlay, one `<Note text>` wrapper, and a shell-owned toggle shown only when Notes exist and off by default.                                                                                                                                                        | Explanation remains available without cluttering the primary reading path.                                      |
| Mission page A: graph-first.                                                                                                                                                                                                                                                          | Relationships are the entry point for understanding a mission.                                                  |
| Use Opus (`anthropic/claude-opus-5-5`) for Vista design and critic work.                                                                                                                                                                                                              | Design and critique share the chosen model baseline.                                                            |
| `vista review` is advisory and runs only on first versions and structural rewrites.                                                                                                                                                                                                   | Feedback targets consequential changes rather than adding ceremony to every edit.                               |
| Every vista starts with an ELI5 context brief followed by progressive drill-down; brief variant pending ([#5671](https://github.com/schickling/dotfiles/pull/5671)).                                                                                                                  | Readers understand the purpose before encountering detail, without prematurely fixing the presentation variant. |
| Owner byline: display name, full id on hover and keyboard focus, and `legacy session` for dotted owners ([#6064](https://github.com/schickling/dotfiles/pull/6064)).                                                                                                                  | Attribution stays readable while preserving access to the exact identity.                                       |
| Keep things simple overall; Vista must not leak complexity.                                                                                                                                                                                                                           | Authoring and reading should expose the task, not Vista's machinery.                                            |

## Consequences

Authors compose the taste kit using the skill pattern; these defaults guide
presentation rather than prescribing a universal page template. The brief's
presentation variant remains undecided; its context-first contract does not.
