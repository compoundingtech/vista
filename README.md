# Vista

## Build the package

Only Nix is required; the package build resolves its own dependencies:

```sh
nix build .#vista
```

## Development checks

Bootstrap the megarepo before installing JavaScript dependencies. `megarepo.kdl`
declares effect-utils, and `megarepo.lock` pins the checkout materialized at
`repos/effect-utils`. The fresh-clone check found that `pnpm install` fails
without this member because the workspace references its packages.

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
