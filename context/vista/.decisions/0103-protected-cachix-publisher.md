# Protected Cachix publisher

Status: proposed; main ruleset requires Johannes's approval (q62).
Owner: service packaging/distribution (VST-R40), extending decision 0017.

## Context

Vista exports a source flake, but consumers retaining its locked inputs can
reuse public immutable Nix outputs. Publication authority must not reach PR
builds or make the read-only workflow token a repository writer. A source-flake
consumer overriding inputs, such as dotfiles, builds different derivations.

## Decision

Adopt the [publisher contract](../01-service/publisher.md): protected-main-only
publication of `.#vista`'s runtime closure to `compoundingtech-vista`, followed
by a repository-scoped `compoundingtech-vista-publisher` App manifest PR. Keep
writes inert behind `VISTA_PUBLISH_ENABLED` until the approved ruleset and
cache-scoped Write token exist. Start with hosted x86_64 Linux; Darwin inclusion,
the future manifest consumer, and ruleset activation remain explicit questions.
No repository settings are authorized by this record.

## Consequences

The default workflow token stays read-only; App failures cannot select a weaker
writer. Main publication is serialized without cancelling an active push.
Cache publication can succeed before a manifest PR fails; retry is safe for
immutable paths. This adds no binary consumer, retention guarantee, deployment,
or promise of substitution for dotfiles' overridden source inputs. The
actor-allowlist fallback is unnecessary once the proposed protection exists.
