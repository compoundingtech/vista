# Reference: BuilderIO visual-plan / agent-native (prior art)

Source: https://github.com/BuilderIO/skills (skill) + `BuilderIO/agent-native`
(`@agent-native/core`, the platform). Studied 2026-06-20. The primary inspiration
for Vista; this records what to embrace and where to diverge.

## Shape

- **Thin skill over a thick platform.** The public skill is ~490 lines of
  prompt-engineering markdown + reference docs; all rendering/data-model/feedback
  machinery lives in a separate product reached over an **MCP server**.
- Tech: MDX authored / canonical JSON runtime; React + Vite renderer; `roughjs`
  (hand-drawn sketch look); shiki/lowlight; tiptap+yjs (collab edit); recharts;
  mermaid; tailwind v4; `@modelcontextprotocol/sdk` + ext-apps (inline MCP App
  rendering). Hosted / local-bridge / self-hosted deployment modes.
- **Blocks in a registry.** `BlockRegistry` keyed by runtime `type` + MDX `tag`;
  registration is last-wins so an app can override a shared block — the ad-hoc
  extension path. Per-block triplet: `.config.ts` (spec), `.tsx` (renderer),
  `.spec.ts` (tests). `get-plan-blocks` returns the live vocabulary so the agent
  never authors from memorized tags.
- **Feedback loop** (the heaviest part): `get-plan-feedback` returns precisely
  anchored comments (element %, wireframe node path, text quotes); the agent
  applies **surgical `contentPatches`** keyed to stable ids rather than
  regenerating. HTML sanitization (linkedom + safe-regex2) because content is
  untrusted/hosted.

## What Vista embraces

- Thin-skill / thick-system split (but our system is **owned**, not third-party).
- The block/registry idea and the live-vocabulary contract; per-block structure.
- **Renderer owns the look; the agent writes only semantic content** — clean
  separation that keeps agent output simple and visual quality consistent.
- Stable-id anchoring as the future feedback hook (our kit already carries ids).

## Where Vista diverges

- **Render-only** (decision 0001): we do *not* build the comment/anchor +
  surgical-patch feedback loop — its heaviest, most fragile machinery.
- **Owned, self-hosted, tailnet-private, provider-neutral** — no hosted
  third-party platform, no MCP-connector/auth tax (their SKILL.md spends ~50
  lines on reconnect/auth troubleshooting).
- **No sanitization** (decision 0009): trusted author + private tailnet.
- **Real-React escape hatch**, not a bounded HTML sandbox; bespoke one-offs
  graduate into the kit.
- **Integrated with our infra** (live OTel/devnet/VRS) and an **explicit review
  doctrine** — neither is BuilderIO's concern.
- We avoid the very large SKILL.md; behavior lives in the system.
