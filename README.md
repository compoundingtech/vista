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

The standing service uses an HTTP/1 listener. Its imperative Vite middleware
bridge requires Node HTTP/1 request and response objects and returns HTTP 505
for HTTP/2 transports, including when platform adapters expose both types.
