# Feedback Spec

The staged human→agent return path. Builds on [requirements.md](./requirements.md),
the root [spec.md](../spec.md) / [requirements.md](../requirements.md), and the
[roadmap](../roadmap.md); terms per [ontology.md](../ontology.md). This spec records
only the shape of the return path and its staging; the one realized mechanism lives
in its child spec.

## Staging

Feedback is delivered in staged scope (roadmap, "Structured feedback capture"):

1. **Bounded structured-answer (the realized capability).** The agent surfaces an
   explicit structured decision-question; the human answers it in place; the agent
   proceeds. This is the interview integration —
   [01-interview/spec.md](./01-interview/spec.md) — driven over the service-owned
   `VistaControlApi` (agent side: `vista await`; viewer side: a same-origin browser
   bridge). Canonical use case: interview sessions hosted in Vista (decision 0013).
2. **General feedback capture (far phase).** Freeform annotation that would subsume
   `agentation` — out of scope until the bounded path proves out (VST-R38,
   decision 0011).

## Attachment point

The return path binds to the medium's **stable per-block and sub-entry IDs**
(VST-R04, root spec "Authoring + content model"): every block already carries a
stable `id` unused by rendering, so a feedback phase attaches to a rendered
app without a data migration. Only the agent's explicit structured questions flow
back; freeform feedback stays delegated (VST-R38). A durable cross-session receipt
layer, if needed, should align with the coding-agents attachment-by-prefix pattern
(FDB.IVW-R45) rather than auto-mirroring into transient chat.
