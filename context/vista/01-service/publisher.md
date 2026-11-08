# Protected Cachix publisher

This document specifies distribution of the packaged service (VST-R40), building
on [service requirements](./requirements.md), packaging decision
[0017](../.decisions/0017-nix-packaging-unbundled-service-readonly-deps-closure.md)
and publisher decision [0103](../.decisions/0103-protected-cachix-publisher.md).
Status: proposed; the checked-in workflow is inert until `VISTA_PUBLISH_ENABLED`
is exactly `true`. This is not approval to provision credentials or protection.

## Publication boundary

```text
protected main -> build .#vista -> push runtime closure to Cachix
                              -> App token -> fixed branch -> manifest PR
```

`.github/workflows/publish.yml` accepts pushes to main and manual dispatches on
main only, in `compoundingtech/vista`. It additionally requires
`github.ref_protected` and the enable variable before starting the job. A push
changing only `nix/published/manifest.json` is ignored to avoid a publication/PR
loop. No pull-request event can publish. One publication per ref runs at a time;
`cancel-in-progress: false` never interrupts an active push. GitHub may coalesce
pending runs; this is not a promise to publish every intermediate commit.

The implemented scope is **x86_64-linux on GitHub-hosted ubuntu-24.04**. Darwin
is not included. **DQ1:** recommend approving a separate hosted aarch64-darwin
lane after the Linux contract is proven; public-repository standard hosted macOS
runners are free, but a second platform adds a second build, storage footprint,
and maintenance surface. It does not double a public-repo runner bill. The
flake's `eachDefaultSystem` exports do not imply cache coverage; other systems
continue building from source. No private or organization runner is assumed.

Build `.#vista` with the committed lock and no lock updates, then explicitly
`cachix push compoundingtech-vista` its output paths. Cachix includes their
transitive runtime closure. `default` and `vista-service` alias `vista`;
`vista-runtime`, `vista-preflight`, and `vista-island` are separate exports, not
additional publication roots ([packages.nix](../../../nix/packages.nix#L70-L77)).
The packaged application already references what it needs; do not upload the
whole store, build-only dependencies, a watcher, or an automatic post-build hook.

The cache is public. Its substituter is
`https://compoundingtech-vista.cachix.org`; its trusted public key is
`compoundingtech-vista.cachix.org-1:9sYNnZ7wXzBgPRLOVkhvFAw+8bwc5AMn3v7eI3c5yKA=`.
Store paths and NAR hashes identify immutable outputs; reruns reuse those
identities rather than overwrite a mutable release artifact. The manifest
records the full source revision and the PR body links the producing run.
Cachix eviction can remove availability; there is no retention-pin guarantee.

This serves consumers using Vista's own locked inputs (`nix run
github:compoundingtech/vista` and the portable Home Manager module without input
follows). Dotfiles currently consumes Vista as a **source** flake and follows
its own effect-utils/nixpkgs/flake-utils/playwright inputs. Those derivations do
not match upstream outputs: this publisher does **not** establish substitution
for dotfiles. A future binary-consumption path could use the manifest below.

## Manifest and identity

`nix/published/manifest.json` is a repository-local format owned by Vista:
`schemaVersion` is the integer `1`; `rev` is a full lowercase 40-hex Git commit;
`system` is exactly `x86_64-linux`; `outputs` is a nonempty array of
`{name, storePath, narHash}` for the realized `.#vista` outputs. `name` is the
Nix output name (`out` today), `storePath` an absolute `/nix/store/` path, and
`narHash` the SRI NAR hash from `nix path-info`, or null if unavailable. This is
output metadata, not a complete closure inventory or a portable archive URL.
Future readers must reject unsupported schema versions. **DQ2:** nobody consumes
this manifest yet; consumer choice and validation remain open, not an implicit
change to the source flake or Home Manager module.

Only after successful Cachix push does `compoundingtech-vista-publisher` mint a
short-lived installation token, explicitly selecting owner `compoundingtech`
and repository `vista`. It has Contents write, Pull requests write and implicit
Metadata read; installation 179564595 selects this repository only (App 5656035).
The App authors a commit and creates/edits a PR from fixed branch
`automation/vista-published-manifest` to main, never merges it. Existing branch
history is advanced without force push; merge conflicts fail for human review.
A run whose source revision is no longer main skips proposing a stale manifest;
main can still advance after that check, so review the recorded revision before
merging. App credentials never fall back to `GITHUB_TOKEN`, which has only
`contents: read`. No manifest file is fabricated before a successful publication.

Only the explicit push step receives `CACHIX_AUTH_TOKEN` in its environment: a
Write token scoped to this cache alone. It is never echoed, written to auth
configuration, or given to a build or Cachix action. The action is read-only
(`skipPush: true`). `NIX_PUBLISHER_GITHUB_APP_ID` is a repository variable;
`NIX_PUBLISHER_GITHUB_APP_PRIVATE_KEY` is a repository secret used only by the
token action. Tokens and keys must never be printed or committed. The token
action revokes the installation token at job completion. Rotate/revoke the
private key through App settings and replace the secret; revoke the cache token
through Cachix and replace its secret. Credential owners perform these actions,
not this workflow. Every action is pinned by full commit SHA.

Missing credentials fail before building. Build or push failure fails the job
and prevents a manifest proposal; App/PR failure also fails the job, without
rolling back an already uploaded immutable closure. Rerun main to repair after
the cause is fixed. No silent success or weaker authentication path is allowed.
Disable new publications by clearing the enable variable; an in-progress push
is not cancelled, and existing public objects remain readable.

## Main ruleset proposal — Johannes approval required (q62)

Propose an active branch ruleset targeting `refs/heads/main`: require pull
requests before merging (zero required approving reviews; do not require code
owner approval or approval of the most recent push), block force pushes, and
block deletion. Required status checks: none yet; the repository has no PR CI.
Do not require the post-merge publisher as a PR check. Recommend no bypass
actors, including administrators and the publisher App. An org-admin emergency
bypass is an alternative requiring explicit approval, not the default.

Agent self-merges keep working through a PR with
`gh pr merge --squash --match-head-commit <reviewed-head-sha>` after the existing
exact-head review/local-proof gates: the proposal requires a PR but not another
GitHub approving review. The App can update its automation branch and open PRs,
not push main directly. This is a proposal only; no settings are changed here.

**DQ3 / q62 activation:** Johannes must approve/apply the ruleset, provision the
cache-scoped token as `CACHIX_AUTH_TOKEN`, and only then set
`VISTA_PUBLISH_ENABLED=true`. `github.ref_protected` is defense in depth, not
proof that an arbitrary future ruleset implements this proposal. App variable
and key are already provisioned; the cache token is not yet issued.

## Precedent

The fleet [protected-producer policy](https://github.com/schickling/dotfiles/blob/main/context/builds/01-cache-policy/.decisions/0009-protected-nix-publishers.md)
prefers branch protection over an actor allowlist fallback. This contract follows effect-utils' [protected publisher
identity](https://github.com/overengineeringstudio/effect-utils/blob/main/context/builds/05-product-distribution/02-nix-bridge/spec.md#protected-publisher-identity)
and [App manifest PR workflow](https://github.com/overengineeringstudio/effect-utils/blob/main/.github/workflows/ci.yml#L6819-L6867): immutable Cachix publication
before a repository-scoped App proposal, never workflow-token write fallback.
Vista's missing credentials fail closed rather than silently omit the PR.
