# Skill Requirements

Subsystem-scoped requirements for Vista's agent-facing skill — the guidance/gating
half of the [agent interface](../requirements.md) (the [CLI](../01-cli/requirements.md)
is the operational half). The skill carries the when-to-use judgment and the gating
discipline; it holds no operational detail. System-level context, assumptions, and
acceptable tradeoffs live in the [root requirements](../../requirements.md); terms in
[ontology.md](../../ontology.md). Requirement IDs are **path-scoped** to this node
(`AGT.SKILL-R*`); each declares `refines:` the charter requirement it specializes so
the tree reads upward.

## Requirements

### Must keep the agent surface thin and the system thick

- **AGT.SKILL-R07 Thin skill with gating:** The agent-facing skill must stay minimal and
  carry concrete when-to-use / when-not-to-use guidance rather than operational
  detail; a user-invocable `/vista` entry must also exist (decisions 0002, 0010).
  `refines: VST-R64`
