# Immutable versioned reviews with a moving latest

Status: accepted

## Context

Vista must support durable review links *and* an evolving narrative ("what
changed since I last looked"). A review is a long-lived artifact that the agent
revises as a design develops. Independent prior art (Claude Code Artifacts,
decision 0003) converged on the same publish/version/same-URL/gallery model.

## Decision

Identity is a **review** (stable slug). Each publish appends an **immutable**
version `vN` carrying metadata `{ author, timestamp, change-summary, parent }`.
A version's content never changes once published, so a reviewer's link to `vN`
keeps showing `vN` even as the agent pushes `vN+1`. A moving **`latest`** pointer
always resolves to the newest version — the canonical "open the current one"
entrypoint. The change-summary is **agent-authored at publish time** (the agent
knows what it changed), not auto-diffed. A version diff view falls out of the
metadata chain.

Reviews can be **retired** (content withheld, durable links return gone) but never
deleted — durable links survive.

## Consequences

- Durable review links for humans; safe concurrent revision by the agent.
- The change-summary metadata gives the evolving-narrative the user wants.
- Concurrent publishes need atomic version allocation (OQ-PUBLISH-RACE).
- See decision 0005 (URL scheme) and 0007 (draft-live / versions-static) for how
  versions are addressed and served.

## Amendment (0061): durability is bounded to one contract version

Immutability here is of **review identity and immutable source** — the slug, the
`vN` metadata chain, and the authored `review.tsx`. That authority is never
migrated and durable links to it survive.

A review's **frozen data snapshot** is a contract-namespaced projection, not
authority (0061, migration-avoidance). It is stamped with the single global
`apiVersion` and read fail-closed. On a (rare) global-version bump, snapshots
published under an older version become **unsupported** and are not migrated: a
previously-published review's frozen data may stop rendering after a bump. This
is an accepted, written data-loss contract — the deliberate price of building no
migration machinery. It narrows "a version's content never changes once
published" to: the *source* never changes; the *frozen-data projection* is
durable only within one contract version. Recorded as a delta against the vision's
"trust the artifact over time" (`vision.md`, human-owned).

## Greenfield amendment: retirement preserves pinned versions

Identity is now canonical owner × owner-local slug (decision 0077), and a
publication is an immutable receipt-backed static version (decision 0075).
Retirement hides only the mutable `draft` and moving `latest` surfaces. Every
receipt-backed pinned `vN` URL and immutable version Resource remains available;
retirement neither deletes nor withholds those versions. The line above saying
durable links return gone is historical and superseded by this amendment.

## Greenfield terminology amendment

An immutable publication is AppVersion. LatestRoute follows the newest
AppVersion; Publish creates its PublicationReceipt and returns its pinned URL.
Retire preserves every pinned AppVersion. Snapshot names frozen Provider data,
never an App lifecycle realization.
