# Vista Ontology

Canonical terms for Vista. Subsystem detail remains with its owner: Providers in
[03-data-sources](./02-medium/03-data-sources/), Blocks in
[05-blocks](./02-medium/05-blocks/), and doctrine in
[04-doctrine](./02-medium/04-doctrine/spec.md).

## Vista

The view-first medium through which an agent publishes a durable [App](#app) for
human review. _Avoid_: review artifact, document system.

## App

The durable identity `owner × local-slug`, realized by an [AppSource](#appsource)
and a sequence of [AppVersions](#appversion). _Avoid_: artifact, review, source
file.

## AppSource

The mutable canonical authored source for one owner-scoped App.
_Avoid_: app, draft file, catalog entry.

## AppRoot

The zero-prop default JSX component in an AppSource. Its props define the App
metadata and its body composes Blocks and local components. _Avoid_: App,
Scope, document wrapper.

## SemanticNode

One addressable, durable semantic fact emitted by AppRoot composition.
_Avoid_: section, layout node, component instance.

## SemanticManifest

The schema-versioned nonvisual projection of SemanticNodes, their relationships,
and derived bindings. Matching `data-vista-id` targets connect it to the DOM.
_Avoid_: render tree, authored metadata, UI authority.

## RuntimeIsland

A public semantic boundary below which browser-only behavior may vary without
changing SemanticNodes. _Avoid_: Island, runtime component, semantic container.

## AppShell

The Vista-owned chrome around a rendered App: identity, navigation, theme, and
[Outline](#outline). It never interprets App content and holds no heading.
_Avoid_: header, layout, AppRoot.

## Outline

The shell's ordered navigational projection of an App's headings and addressable
[SemanticNodes](#semanticnode). Identity is the section's explicit stable id;
navigation, deep links, and manifest matching key on it. A label is nominal
display text and never an identity.
_Avoid_: table of contents, SemanticManifest, sidebar.

## AskBlock and ForkBlock

Visual Blocks that realize an ask and a comparison. They may emit SemanticNodes
where their content is addressable. _Avoid_: Ask, Fork, generic section.

## CompositionGroup

An authored relationship among sibling content whose shared rhythm cannot be
inferred safely from their individual roles. It owns the spacing between its
members, not their internal layout or semantic identity. _Avoid_: layout
wrapper, SemanticNode, Block.

## BlockViewport

The visible region allocated to a Block whose content may be bounded or
resized. Its rendered extent reconciles authored policy, viewport safety,
content semantics, and a [ResizeIntent](#resizeintent). _Avoid_: Block, browser
viewport, splitter.

## UsefulExtent

The greatest stable BlockViewport extent at which finite content reveals useful
content rather than additional empty space. _Avoid_: authored maximum, content
height, viewport size.

## ResizeIntent

The latent user sizing choice for a BlockViewport: the authored default, an
exact pixel target, the minimum, or the maximum useful extent. It survives
temporary projection into tighter bounds. _Avoid_: rendered size, persisted
preference, resize event.

## DataBinding

The immutable internal `(Operation, Schema-encoded arguments, BindingPolicy)`
record derived by a typed domain Block and attached to its owning SemanticNode.
_Avoid_: authored binding, block prop, DataSource, Query, BoundQuery,
invocation.

## Provider

The internal resolver named by one ProviderContract and one
ProviderImplementation. The contract is client-safe; the implementation and
its capabilities remain server-only. _Avoid_: App component, author
configuration, registry, provider object.

## ProviderContract

The client-safe half of a Provider: an authored RpcGroup plus provider identity
whose Operations are derived by `contract`. It is the only Provider value a
Block may import. _Avoid_: ProviderDefinition, QueryProvider,
ImplementedProvider, descriptor module.

## ProviderImplementation

The server-only half of a Provider: typed handlers, purity, and optional
LiveDrivers produced by `implement` and wired once by `mountProvider`.
_Avoid_: ImplementedProvider, provider object, client contract.

## Operation

One typed capability of a ProviderContract, named by its authored Rpc tag.
Payload, success, error, and stream shape come from the Rpc. _Avoid_: Query,
OperationSpec, procedure, rpc, `op` in durable types.

## BindingPolicy and BindingMode

The internal author-declared policy of a DataBinding. BindingMode is exactly
`frozen` (the default), `live`, or `subscription`; policy also carries
mode-specific cadence and effectful-capture acknowledgement. _Avoid_: capture
options, refresh flag, realtime mode, streaming mode, cached, static.

## LiveDriver

The server-only pollable or subscribable source attached to a subscription
Operation. It supplies an initial state and cursor-relative updates; the
Operation owns the pure fold and cursor contract. _Avoid_: Poller, Watcher,
StreamOperation, subscription, hub.

## CommandOp

A typed, live-only Provider capability that changes a live resource under
explicitly granted viewer authority. It derives from the same authored RpcGroup
as its related read Operations but is not a DataBinding and contributes no
Snapshot entry (MED.DATA-R84, decision 0096). _Avoid_: mutation query, command
binding, captured command.

## AttachLease

Temporary exclusive authority for one identified viewer to issue CommandOps
against one live session; short-lived, actor/session-bound, single-writer.
Viewing a session never implies an AttachLease. _Avoid_: attached flag, viewer
boolean, permanent capability.

## ScreenState

A bounded, self-contained representation of the current logical terminal
screen, renderable without earlier terminal bytes. It is current state, never
history. _Avoid_: byte log, transcript, scrollback history.

## CoalescedFrame

A self-contained ScreenState update produced by combining several upstream
terminal changes, such that a newer frame safely replaces an older unconsumed
one. _Avoid_: PTY packet, byte chunk, replay event.

## Projection

A pure client derivation created by `Operation.map` and represented as a
`MappedOperation`. It adds no Snapshot entry and inherits its source snapshot
key. _Avoid_: DerivedQuery, DerivedValue, derived binding, client map, useMemo.

## DependentBinding

A declared `Operation.flatMap` escape hatch represented as a
`FlatMappedOperation`; its capture stores constituent Snapshot entries and a
SemanticManifest dependency edge. Prefer a named server Operation for durable
domain behavior. _Avoid_: chained query, nested query, DerivedQuery, BoundQuery.

## Resolved

The provenance-tagged success value produced by DataRuntime: Frozen,
CatchingUp, or Live. Failures remain on the AsyncResult error channel.
_Avoid_: ResolvedData, Result, QueryResult, snapshot value.

## LiveOverlay

Service-owned mutable folded state, cursor, and observation time for one
AppVersion data binding. It never mutates an AppVersion or Snapshot. _Avoid_:
live snapshot, cache, persisted state, hub state.

## SubscriptionHub

The AppVersion-owned live-runtime boundary that shares a binding's LiveDriver
among visible viewers and governs its LiveOverlay across active, idle, and
hibernated states. _Avoid_: Provider, global poller, subscription, client
runtime.

## DataRuntime

The per-mounted-AppVersion client runtime containing the decoded Snapshot,
data endpoint, Atom registry, and binding atoms. _Avoid_: QueryClient,
registry, bare runtime, RuntimeIsland.

## Snapshot

The strictly Schema-decoded, immutable set of captured Provider results
embedded in an AppVersion. Each entry retains the Provider and Operation
identity, encoded arguments, encoded value, and capture time. _Avoid_:
AppVersion, published artifact, lifecycle snapshot, live snapshot.

## Block

A typed domain component that contributes review meaning and may emit a
SemanticNode, own a DataBinding, or project a RuntimeIsland. _Avoid_:
component, widget, panel.

## Curation

The deliberate promotion of a proven App-local pattern into Vista’s shared
Block or Template set. _Avoid_: graduation, automatic adoption, registry sync.

## Template

A reusable authored App shape that composes Blocks and doctrine for a recurring
review kind. _Avoid_: archetype, scaffold output, Block.

## Standing Service

The owned long-running Vista process that publishes and serves Apps, mounts
Provider implementations, and owns control and live-runtime resources.
_Avoid_: dev server, Provider, App server.

## AppVersion

An immutable published realization of an App, addressed by `vN`.
_Avoid_: snapshot, artifact, draft.

## LatestRoute

The moving route to an App's newest AppVersion. _Avoid_: latest pointer, alias,
version identity.

## PublicationReceipt

The service-owned proof binding an AppSource to a successfully published
AppVersion. _Avoid_: command output, generic receipt.

## VersionSummary

A compact AppIndex projection naming an App and its newest AppVersion.
_Avoid_: publish result, artifact manifest, publication plan.

## AppResource

The typed resource representing an App. _Avoid_: AppVersion, source directory,
catalog row.

## AppIndex

The browsable projection of Apps. _Avoid_: registry, source of truth.

## Check

The optional, service-independent iteration loop for AppSource diagnostics.
Publish repeats its authored-source checks. _Avoid_: required pre-publish gate.

## Publish

The all-or-nothing transition from AppSource to AppVersion, creating a
PublicationReceipt and advancing LatestRoute. _Avoid_: build step, artifact export.

## Retire

The transition that hides mutable and LatestRoute surfaces while preserving every
pinned AppVersion. _Avoid_: delete, unpublish.

## Structure

```text
Vista -> App
App -> AppSource -> AppRoot -> SemanticNode -> SemanticManifest
AppRoot -> RuntimeIsland
AppRoot -> CompositionGroup -> SemanticNode | typed Block
typed Block -> BlockViewport (when resizable)
finite-scroll BlockViewport -> UsefulExtent
ResizeIntent -> BlockViewport
AppShell -> AppRoot
AppShell -> Outline -> SemanticNode
typed Block -> DataBinding -> Provider -> Snapshot -> AppVersion
Provider -> ProviderContract -> Operation
Provider -> ProviderImplementation -> LiveDriver
DataBinding -> BindingPolicy -> BindingMode
BindingMode(subscription) -> SubscriptionHub -> LiveDriver -> LiveOverlay
Operation.map -> Projection
Operation.flatMap -> DependentBinding -> DataBinding
AppVersion -> DataRuntime -> Resolved -> RuntimeIsland
App -> LatestRoute -> AppVersion -> VersionSummary -> AppIndex
App -> AppResource -> AppIndex
App -> Retire -> pinned AppVersion
```
