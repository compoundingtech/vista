# Vista owns its task graph; effect-utils supplies reusable task modules and tools.
{ pkgs, lib, inputs, config, ... }:
let
  system = pkgs.stdenv.hostPlatform.system;
  shared = inputs.effect-utils.devenvModules.tasks;
  effectUtilsPackages = inputs.effect-utils.packages.${system};
  effectTsgo = effectUtilsPackages.effect-tsgo;
  pinnedPnpm = inputs.effect-utils.lib.mkPnpm { inherit pkgs; };
  pnpmNoManagedVersions = pkgs.writeShellScriptBin "pnpm" ''
    exec ${lib.getExe pinnedPnpm} --config.manage-package-manager-versions=false --pm-on-fail=ignore "$@"
  '';
  installContract = builtins.fromJSON (builtins.readFile ./pnpm-install-contract.json);
  rootNodeModulesReadyTask = "pnpm:install:root-node-modules-ready";
  pnpmTaskHelpersScript = "${inputs.effect-utils}/nix/devenv-modules/tasks/shared/pnpm-task-helpers.sh";
  oxlintWithPlugins = import "${inputs.effect-utils}/nix/oxlint-with-plugins.nix" {
    inherit pkgs;
    oxlintNpm = effectUtilsPackages.oxlint-npm;
  };
  packagePaths = [
    "flakes/vista/agent-timeline"
    "flakes/vista/blocks"
    "flakes/vista/cli"
    "flakes/vista/island"
    "flakes/vista/service"
    "packages/ui"
  ];
in
{
  imports = [
    shared.genie
    inputs.playwright.devenvModules.default
    (shared.pnpm {
      packages = packagePaths;
      materialize = true;
      frozenInCi = false;
      globalCache = false;
      pnpmPkg = pnpmNoManagedVersions;
      sourceInputPaths = installContract.workspaceManifestContract.sourceInputPaths;
    })
    (shared.lint-oxc {
      geniePatterns = [ "*.genie.ts" "flakes/vista/**/*.genie.ts" "packages/ui/**/*.genie.ts" "genie/**/*.genie.ts" "nix/buck2-products/*.genie.ts" "buck2/dependencies/*.genie.ts" "pnpm/*.genie.ts" ];
      # Frozen D covers these authored TS/TSX paths, not CSS or handwritten island config.
      genieCoverageDirs = builtins.concatMap (path: [ "${path}/package.json" "${path}/tsconfig.json" ]) (builtins.filter (path: path != "flakes/vista/island") packagePaths);
      lintPaths = [
        "flakes/vista/blocks/src/**/*.ts"
        "flakes/vista/blocks/src/**/*.tsx"
        "flakes/vista/service/src/**/*.ts"
        "flakes/vista/service/src/**/*.tsx"
        "flakes/vista/service/samples/**/*.ts"
        "flakes/vista/service/samples/**/*.tsx"
        "flakes/vista/cli/src/**/*.ts"
        "flakes/vista/cli/src/**/*.tsx"
        "flakes/vista/agent-timeline/src/**/*.ts"
        "flakes/vista/agent-timeline/src/**/*.tsx"
      ];
      oxlintPkg = oxlintWithPlugins;
      denyWarnings = true;
    })
    (shared.test {
      packages = [ ];
      installTask = rootNodeModulesReadyTask;
      extraTests = [ "test:vista-blocks" "test:vista-service" ];
    })
    (shared.check {
      hasMegarepoCheck = false;
      hasNixCheck = false;
      hasPlaywright = false;
      checkQuickTypecheckTask = "ts:check";
      checkAllTypecheckTask = "ts:check:strict";
    })
    (shared.storybook {
      installTask = rootNodeModulesReadyTask;
      packages = [ { path = "flakes/vista/blocks"; name = "vista-blocks"; port = 6006; } ];
    })
    (import ./nix/devenv/vista-tasks.nix {
      inherit lib config effectTsgo pnpmTaskHelpersScript rootNodeModulesReadyTask;
    })
  ];
  cachix.enable = false;
  effectUtils.genie.package = effectUtilsPackages.genie;
  packages = lib.mkBefore [ pnpmNoManagedVersions pkgs.bun pkgs.flock pkgs.nodejs_24 effectTsgo oxlintWithPlugins pkgs.oxfmt effectUtilsPackages.genie effectUtilsPackages.otelite ];
  env.NODE_PRESERVE_SYMLINKS = "1";
  env.PNPM_HOME = "${config.devenv.root}/.devenv/pnpm-home";
  tasks.${rootNodeModulesReadyTask} = {
    description = "Require the materialized root package graph";
    after = [ "pnpm:install" ];
    exec = ''test -d node_modules'';
  };
  tasks."test:run".exec = lib.mkForce null;
  tasks."test:run".after = lib.mkForce [ "test:vista-blocks" "test:vista-service" ];
  tasks."lint:check:oxlint".after = lib.mkAfter [ rootNodeModulesReadyTask "lint:check:genie" ];
  tasks."lint:check:lockfile".exec = lib.mkBefore ''
    set -euo pipefail
    # Task-local install exports do not reach this check; reuse its store selector.
    source ${lib.escapeShellArg pnpmTaskHelpersScript}
    configure_pnpm_storage \
      ${lib.escapeShellArg "${pkgs.nodejs}/bin/node"} \
      ${lib.escapeShellArg config.devenv.root} \
      ${lib.escapeShellArg "${config.devenv.root}/.devenv/pnpm-store-pure-v1"} \
      ${lib.boolToString pkgs.stdenv.hostPlatform.isLinux} \
      false
  '';
  tasks."lint:check:format".after = lib.mkForce [ "lint:check:genie" ];
  tasks."lint:check:genie:coverage".after = lib.mkForce [ "lint:check:genie" ];
}
