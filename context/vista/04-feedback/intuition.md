# Feedback — Intuition

Vista starts as a one-way medium: the agent renders, the human reads. But an app
is often the setting for a *decision* — and the moment the human decides, that
verdict has to get back to the agent. The feedback node is that return path, and its
guiding rule is **staging**: build only the narrow channel that realized use actually
needs, and leave the wide one delegated.

The narrow channel is a single thing: the **bounded structured-answer**. The
agent doesn't ask for freeform commentary — it poses a specific decision-question
with options and tradeoffs, and the human picks. That structured shape is what keeps
the return path small and typed: the answer is a machine result the agent can act on,
not prose it has to interpret. The canonical case is an interview session hosted
inside a Vista app — the agent renders the complex scenario, poses the question,
and the human answers in place.

Everything freeform stays where it already works: `plannotator` and `agentation` for
human→agent annotation (VST-R38). Vista does not rebuild that. The far-phase
idea — a general capture surface that could subsume those tools — waits until the
bounded path proves out.

The reason this can stay staged without painting us into a corner is a decision made
at the very foundation: **every block already carries a stable id** (VST-R04), unused
by rendering. So whenever a feedback phase ships, it attaches to an existing
rendered app by id — no data migration, no reshaping the content model. The
return path grows by binding to hooks that were laid down from the start.
