# Code Blocks — Glossary

Terms owned by the `code` block family. The `lens` term and `block library` live in
the [block-library glossary](../glossary.md); leitwörter in the
[root ontology](../../../ontology.md).

## Diff block

The [block](../../../ontology.md#block) that renders a code diff (unified/split,
word-level, collapsible hunks), wrapping `@pierre/diffs` behind Vista's typed block
interface so the document stays portable and the dependency swappable.

## File-tree block

The [block](../../../ontology.md#block) that renders a path-first file tree with
per-path `gitStatus`, wrapping `@pierre/trees` behind Vista's typed block interface.

## Pull-request review

The read-only composition of a captured pull request or stack under one shared
review provider. Its header, description, stack navigation, treemap, file rail,
and diff pane are independently placeable parts that share active request,
scope, hidden files, commit focus, selection, and diff layout.

## Scope

The directory subtree currently under review. In a pull-request review the
scope is simultaneously the treemap root and the path boundary applied to the
file rail and diff pane; changing one changes all three.

## Commit focus

The optional restriction of a pull-request review to captured commits. One
focused commit renders that commit's diff; several focused commits render
separate per-commit diffs in capture order rather than a synthesized range.

## Checks waterfall

The Vista-native timeline for the latest GitHub workflow run of a pull request's
current head. Every job occupies one shared axis: hatched time is queue wait,
solid time is execution, and solid colour communicates the job conclusion.
Selecting a job reveals its steps inline without changing the captured run.

## Observed critical path

The job lane with the longest observed interval from GitHub's job creation time
to completion or the run's latest update time. It is evidence of the
wall-dominating lane available from GitHub timing, not a reconstructed workflow
dependency graph.
