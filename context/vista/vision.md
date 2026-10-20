# Vista Vision

## Audience

For: humans, agents

| For | Why it exists for them | Surface | Optimizes for |
| --- | --- | --- | --- |
| Humans | Turns complex agent work into durable visual artifacts that make evidence, change, and the needed decision apparent | `ui:vista` | glanceable understanding, confident judgment, durable review |
| Agents | Makes publishing a purpose-built interactive review artifact a near-zero-ceremony command | `cli:vista` | low authoring cost, structured communication, reusable blocks |

Owns tools: vista

## What Vista Is

Vista gives coding agents a second way to talk to humans: not a wall of terminal
text, but a living, visual artifact you can look at and understand.

Today every result an agent produces — an architecture it designed, a set of
options it weighed, a migration it is proposing, the telemetry behind an incident
— arrives as prose scrolling past in a terminal. That medium is fine for simple
answers and quietly fails for everything else. The moment the work becomes
relational, comparative, or evolving, the human is left reconstructing a mental
model from paragraphs and re-reading chat logs to find the one decision that
actually needs them.

Vista replaces that with a medium built for understanding. An agent publishes an
app — a rendered, interactive page with the right view for the situation — and
a human opens a link and *sees* the work: the system as a diagram they can trace,
the options side by side, the decisions that are settled and the ones still open,
the real data behind a claim. The question "what is this and what do you need from
me?" is answered by the medium itself, not left for the reader to dig out.

## What It Enables For Humans

- **Understand complex work at a glance.** Architecture, trade-offs, and change
  are shown in the form that fits them — a map, a comparison, a decision tree —
  so comprehension is immediate instead of reconstructed.
- **Explore instead of read.** Zoom into a component, expand a decision, follow a
  diagram, toggle live data — the reader drives, rather than scrolling a fixed
  transcript.
- **Decide with confidence.** Every app leads with the ask and is structured to
  drive a decision, with the evidence for each claim one click away. Reviewing is
  fast and the verdict is well-founded, not a rubber stamp.
- **See real data, not stale text.** Apps can pull live telemetry from our own
  systems and freeze it into a durable snapshot, so a claim is backed by what is
  actually true now — and stays reproducible later.
- **Trust the artifact over time.** Apps are durable and versioned: a link
  stays stable as the agent revises, and "what changed since I last looked" is
  legible at a glance.

## The Deeper Bet

The compounding value is not any single app — it is a **medium tuned to how we
work**. Over time Vista accrues a block library of well-designed, idiom-specific
components (architecture diagrams, live OTel views, GitHub previews, decision and
option blocks) and a doctrine for what makes an app genuinely good. Each bespoke
artifact an agent builds for a new situation is a candidate that is curated into
that shared library. The medium gets better the more we use it, the way a good
design system does.

The agent's side stays effortless: a thin skill and a one-line command, with an
owned standing service doing all the work of mounting, serving, versioning, and
data access. Authoring a great app should cost the agent almost nothing, so the
choice to communicate visually becomes natural rather than ceremonious.

The aim is that, as the block library matures and publishing approaches zero
ceremony, Vista becomes the default way agents show humans complex work — and that
reviewing what our agents and systems are doing feels less like reading and more
like seeing.

## What This Is Not

- Not a hosted or public platform. Apps live on our private tailnet, are
  self-owned, and work across all our agents — not tied to one vendor or an
  enterprise tier.
- Not a feedback-capture system in its first life. Vista renders for humans;
  collecting structured feedback back to agents is a deliberate later chapter, not
  the founding purpose.
- Not prettier output for its own sake. An app that looks busy but buries the
  decision is a failure; the medium exists to drive understanding and judgment.

## Success Criteria

1. For complex, relational work, a human reviews and acts from a Vista artifact
   faster and with more confidence than from terminal text or a chat log.
2. Every app leads with the ask and is structured, per its situation, to drive
   a decision — judged by how quickly the reviewer knows what is needed of them,
   not by visual richness.
3. Publishing an app is near-zero ceremony for the agent.
4. The block library visibly compounds: new apps reuse existing components, and
   proven one-offs are curated into the shared library.
5. Apps carry durable, immutable, versioned links; a reviewer's link stays
   stable as the agent revises, and what changed is legible.
6. Apps can show real current data and freeze it into a reproducible snapshot,
   with the mode always explicit.
