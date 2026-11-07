# Vista

## Build the package

Only Nix is required; the package build resolves its own dependencies:

```sh
nix build .#vista
```

## Development checks

`nix build .#vista` and `nix flake check --no-build` work from a plain clone.
Development commands `pnpm install` and Genie (`genie:run` / `genie:check`)
require the materialized `repos/effect-utils` member; run
`mr apply --worktree-mode auto` first. `megarepo.kdl` declares the member,
and `megarepo.lock` pins its checkout. See the
[fresh-clone bootstrap issue](https://github.com/compoundingtech/vista/issues/6).

```sh
# Materialize megarepo.lock.
mr apply --worktree-mode auto

devenv shell
# Inside the shell:
devenv tasks run pnpm:install
devenv tasks run genie:run
devenv tasks run genie:check
devenv tasks run ts:check
devenv tasks run lint:check
devenv tasks run test:run
```

Current `mr` calls this bootstrap `apply`; `mr sync` is not a supported command.
The tasks are defined by `devenv.nix`, `nix/devenv/vista-tasks.nix`, and the
shared effect-utils task modules. `test:run` runs the blocks and non-browser
service suites; browser proofs are separate tasks.

The changelog compiler, contract, and tests live in
`flakes/vista/service/src/changelog/`, where `@vista/service` declares their
`effect` and `@vista/blocks` dependencies. Authored entries remain in
`flakes/vista/.changelog/` and import the contract from
`../service/src/changelog/contract.ts`. Both the source-worktree task and Nix
package run this compiler; no separate changelog workspace package is needed.

The standing service uses an HTTP/1 listener. Its imperative Vite middleware
bridge requires Node HTTP/1 request and response objects and returns HTTP 505
for HTTP/2 transports, including when platform adapters expose both types.
Draft middleware completion and deferred errors stay inside the route's Promise
boundary. A draft 404 is emitted only for uncommitted fallthrough; a committed
response is finished without another header/body write, and a disconnected
response is left alone. The response-lifecycle regression tests run in
`devenv tasks run test:vista-service`.

Draft Vite servers keep their owner-scoped source root. Policy-public optimizer
seeds use exact-match, policy-checked aliases to the shared service dependency
anchor because Vite's manual seed resolver bypasses ordinary resolver plugins.
Private seeds remain unchanged and unaliased: Vite's optimized pre-alias shortcut
must not grant authored imports access to private dependencies. Their existing
manual-resolution warnings and possible cold-discovery reloads remain a known
limitation. No `node_modules` is added to authored sources.
