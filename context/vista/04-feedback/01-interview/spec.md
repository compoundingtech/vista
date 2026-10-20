# Interview Integration — Spec

Implementation shape for Vista's bounded structured-answer / interview integration —
the staged return path that surfaces the agent's explicit decision-questions and
routes the human's answer back. Builds on the [feedback](../spec.md) node spec, the
root [spec.md](../../spec.md) / [requirements.md](../../requirements.md), and
requirement FDB.IVW-R45; terms per [../../ontology.md](../../ontology.md). Decisions:
[0013](../../.decisions/0013-bounded-structured-answer-for-agent-questions.md),
[0065](../../.decisions/0065-control-plane-rpc-boundary.md),
[0038](../../.decisions/0038-interview-await-is-rpc-rearm-not-streaming.md),
[0039](../../.decisions/0039-interview-answer-channel-is-live-rpc-with-later-receipts.md).

## Interview / bounded structured-answer (staged)

Vista is view-first. Within the feedback subsystem, bounded structured answers
(decision 0013) are its only viewer-input capability. The separately owned
LivePty CommandOp plane is the named terminal-input exception under VST-R01 and
MED.DATA-R84: it controls a declared live terminal under revocable authority and
is not feedback capture. Agent-facing interview operations are typed control
RPCs (decisions 0065, 0038):
`vista.interview.ask(appId, DecisionQuestion)` registers a structured question
and `vista.interview.await(appId, questionId)` performs one short bounded
`awaitOnce` window. The CLI's `vista await` command is the coding agent surface:
it re-issues `awaitOnce` on `pending` until the human answers or the overall
deadline expires.

The browser side is a product bridge into the same in-service interview store:
rendered apps fetch pending questions same-origin and POST the scoped answer
back. These viewer routes exist because published app pages are immutable but
must display live pending questions; they are not command-shaped agent APIs and do
not reopen the legacy HTTP surface rejected by decision 0065.

`DecisionQuestion` = `question` + `options[]{id,label,tradeoff}` + `multiSelect` +
`recommendedDefault` + `evidenceGaps` + `aboutBlockIds`. Only the agent's explicit
structured questions flow back through the canonical machine channel; freeform
feedback stays delegated (VST-R38, FDB.IVW-R45).
