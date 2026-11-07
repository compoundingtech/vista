# Universal context section

Status: accepted (authoring guidance; §9 text budget proposed/open)

Provenance: Johannes's Axe q1–q13 decisions in the Vista context-section
interview. Question → answer record handles are listed below; q11 explicitly
leaves the numerical text-budget proposal open.

## Context

A cold reader needs subject, current situation, reader ask, and history before
leaving the first screen at 1440×900. Decision
[0101](./0101-taste-kit-and-simple-authoring-defaults.md) established the
context-first brief but left its presentation variant pending. The reference
scenarios resolve that presentation without pretending the kit component exists.

## Decision

Every Vista page opens with the fixed context section under its title: frame,
H2 breadcrumb and chips, About/Situation/Ask card group, one visual alongside a
structured story, and collapsed Terms and Sources. S2 uses a headline plus 2–3
sentences. One question uses A1 option rows; multiple questions use a full-row
Ask card of compact A1 blocks (A4), grouped by answer destination. Rings remain
empty: a recommendation is not a selected answer. Source honesty markers and
the fixed nothing-needed line are mandatory.

Explain is one page-wide toggle, off by default. Story descriptions remain
visible; per-step provenance expands, the last 5 steps show initially, and
Earlier steps plus Open all / Collapse all disclose the rest. Time combines a
browser-computed relative value and short date. The section stacks without
horizontal scroll at 390px.

The [authoring skill](../../../nixpkgs/ai/skills/vista.md#universal-context-section)
owns the full guidance and exact strings; the
[doctrine spec](../02-medium/04-doctrine/spec.md#universal-context-section)
owns the brief composition contract. These are authoring rules now, not a
claim that a `ContextSection` export has shipped.

### Interview provenance

| Axe question | Question → answer   | Settled outcome                                                                               |
| ------------ | ------------------- | --------------------------------------------------------------------------------------------- |
| q1           | `b9tpkg` → `a86moc` | Reframe as a universal context section.                                                       |
| q2           | `9q4wuh` → `nxt7tl` | Exercise five reference scenarios.                                                            |
| q3           | `pz6kca` → `aqsvxi` | Card group, structured expandable story, overlay annotations.                                 |
| q4           | `w1o7wb` → `hydgr3` | Whole-page Explain toggle.                                                                    |
| q5           | `ndisr2` → `qe0od8` | Headlines, per-item expand, Open all.                                                         |
| q6           | `bqr8st` → `b8p9pl` | Explain off by default.                                                                       |
| q7           | `5thacy` → `385h4c` | Last 5 steps plus Earlier steps.                                                              |
| q8           | `h5234q` → `uyw5vy` | Relative time plus short date.                                                                |
| q9           | `z7rv2j` → `l5kkmq` | Four anchor categories: repository, labels, agents, linked work; hosts accompany them.        |
| q10          | `hg74iv` → `gzaura` | Explore in the reference scenarios now; kit later.                                            |
| q11          | `3r9v74` → `qfiju1` | Consider a text budget after variants; **§9 remains proposed, not decided**.                  |
| q12          | `3yrmot` → `xms73y` | H2 anchors and S2 card text. Johannes's direct answer supersedes the relayed H2/S3/A3 choice. |
| q13          | `9n0cpo` → `24fok5` | A1 rows, stacked as A4 for multiple asks.                                                     |

### Open proposal

**§9 is a proposal, not an accepted decision.** Its candidate word, chip, and
visible-question limits and page-splitting rule are not enforcement gates.
Existing settled bounds repeated there (2–4 options and last 5 story steps)
remain settled independently. Doctrine DQ1 tracks Johannes's text-budget choice.

## Consequences

- This resolves 0101's pending brief presentation, not its other kit choices.
- Decisions [0020](./0020-doctrine-block-additions-ask-fork-statusline-settled.md)
  and [0022](./0022-ask-first-global-default-informational-must-be-declared.md)
  still require a visible ask before supporting detail and an explicit
  informational declaration when no ask exists. The context section realizes
  that order; it does not introduce a silent informational default.
- Context ask rows preview the source's question and link to its answer
  destination. They must not register a second addressable Ask. Existing
  addressable answer controls and status partitioning remain unchanged.
- Authors compose existing kit pieces and local React pending a dedicated kit
  component. The six kit gaps and observed narrow-screen defects are tracked
  separately, not implemented by this documentation change.
- Vision and requirements remain unchanged: this specifies presentation under
  MED.DOC-R32/R34 rather than adding a new product requirement.
