# Agent Interface — Intuition

How does an agent actually *use* Vista? Through the thinnest possible seam. The
agent's job is to author an app's content — its `app.tsx`, any bespoke
component or provider it declares — and nothing else. Everything generic (the HTML
shell, dependency resolution, serving, versioning, freezing) is the system's.

The seam has exactly two parts, and keeping them separate is the whole point:

- **The CLI is the hands.** One command, `vista publish`, turns an authored app
  into a working canonical URL. The CLI holds no cleverness of its own: it calls
  the standing service, which owns the mounted providers, version allocation, and
  the freeze pass. If the service is down, the CLI refuses rather than faking a
  local publish. This is why the operational surface stays a handful of thin,
  self-documenting commands no matter how much the system grows underneath.

- **The skill is the judgment.** It answers *when* to reach for Vista — the
  deliberate moments where output is relational, comparative, or evolving and a
  wall of terminal text would degrade it — and *when not to* (a single value, a
  short status). It carries no operational detail, because that would duplicate the
  CLI and the service and drift. The skill stays small and stable; the system
  underneath it gets richer.

The reason for the split is that the two kinds of knowledge change on different
clocks and want different homes. Operational behavior wants to live where it can be
tested and evolved (the CLI and service). Routing judgment wants to live in a small
prompt an agent reads. Fusing them would make each worse. The charter's
minimal-ceremony constraint (VST-R64) is what both halves ultimately serve: the
cheapest possible path from an authored app to a URL a human can open.
