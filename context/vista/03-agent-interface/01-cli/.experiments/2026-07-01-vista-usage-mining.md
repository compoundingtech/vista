# Vista usage mining: how agents actually publish reviews

Date: 2026-07-01. Evidence for [decision 0053](../../../.decisions/0053-one-command-publish-with-derived-context.md).
Method: mined past coding-agent session transcripts + the Vista state dir
(objective cross-agent ground truth).

## Sources

Claude Code transcripts (`~/.claude*/projects/**/*.jsonl`, 31 with `vista `),
codex/opencode paste-cache excerpts, and the Vista state dir
(`~/.local/state/schickling/vista/reviews/` — 12 slugs, 26 versions) as the
objective write-side record. State dir is this-host-only, so counts are lower
bounds.

## Findings

**Rework dominates.** `publish : new = 26 : 12` — every review republished ~1.2
extra times, and the two dominant reasons were **title desync** and **blank
render**, not content. `pr-1219-evidence` and `coding-agent-identity` each
reached v7; on both, 3 of 7 versions were pure workaround (`"correct … metadata"`,
`"render evidence page without broken kit bundle"`, `"republish … to dodge …
regression"`).

**Title authored twice → the top friction.** `review.tsx` sets `document.title`
from `doc.meta.title`, but the `vista list` index reads a separate `review.json`
`title` seeded `"TODO: <slug>"`. Agents shipped v1 with the TODO title, saw it in
`list`, hand-edited `review.json`, republished v2 solely to sync metadata.
Eliminating this removes the single most common wasted republish.

**Four-way URL guessing.** `127.0.0.1:5192` (74×), `<host>:5192` (37×), the
Tailscale IP (10×), a stray `5193` (26×) — because nothing emitted a canonical
URL.

**Ceremony without safety.** Every `new` was immediately followed by author +
`publish`; `debug publish-plan` ran as a preflight that never once blocked in
observed flows; `open` was called just to read a URL `publish` already knew. Plus
a large cold-start orientation tax (rediscovering allowed imports / runtime
policy / CSS vocabulary each session) and 7 throwaway "does it even render" slugs
(published then retired) because the render wasn't trusted.

**Derivable-but-typed context:** title (typed twice), slug (hand-invented, often
meaningless — `dev3-shot`, `probe-min`), `-m` messages (often noise), host/URL,
allowed-imports vocabulary, archetype/status counts.

## Verdict (→ decision 0053)

The real workflow is create → author one file → publish → get URL → verify. It
collapses to essentially `vista publish` (implies `new`, derives
slug/title/URL, inline preflight, prints canonical URL) + `vista list`. The
highest-leverage fix is the single metadata source (SVC-R57); combined with the
canonical URL (0051) and render guarantee (0052/SVC-R58), "get the vista url" becomes
"get a working page," retiring the render-probe slugs.
