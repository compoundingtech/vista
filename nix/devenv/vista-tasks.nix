# Consumer-owned Vista tasks, moved verbatim from frozen dotfiles 05b2f397.
{ lib, config, effectTsgo, pnpmTaskHelpersScript, rootNodeModulesReadyTask }:
let
  vistaTestChangelogManifest = "${config.devenv.root}/.devenv/vista/changelog.v1.json";
in
{
  tasks = {
      "ts:check" = {
        description = "Type check the residual TypeScript workspace without cached diagnostics";
        after = [
          "lint:check:genie"
          rootNodeModulesReadyTask
        ];
        exec = ''
          set -euo pipefail
          # Project references and realpath-resolved package sources need one root identity.
          cd -P .
          # Install and graph changes can leave stale per-file errors in tsbuildinfo.
          # Force every referenced project, including noEmit and dist-local caches.
          ${effectTsgo}/bin/tsgo --build --force tsconfig.check.json
        '';
      };
      "ts:check:strict" = {
        description = "Type check the residual TypeScript workspace without incremental reuse";
        after = [
          "lint:check:genie"
          rootNodeModulesReadyTask
        ];
        exec = ''
          set -euo pipefail
          cd -P .
          ${effectTsgo}/bin/tsgo --build --force tsconfig.check.json
        '';
      };
      "vista:island:build" = {
        description = "Build @vista/telemetry-island → dist/island.js (vite library mode)";
        after = [ rootNodeModulesReadyTask ];
        exec = ''
          set -euo pipefail
          source ${lib.escapeShellArg pnpmTaskHelpersScript}
          run_package_bin vite vite build
        '';
        cwd = "flakes/vista/island";
        # A fresh checkout has no task-cache, so the first run always builds; the
        # gate only suppresses redundant rebuilds when no input changed.
        execIfModified = [
          "flakes/vista/island/src/**"
          # The vendored Jaeger trace tree (decision 0042) is a build input too, so
          # a vendor-only change rebuilds the chunk.
          "flakes/vista/island/vendor/**"
          "flakes/vista/island/vite.config.ts"
          "flakes/vista/island/tsconfig.json"
          "flakes/vista/island/package.json"
          "pnpm-lock.yaml"
        ];
      };
      "vista:changelog:build" = {
        description = "Compile the Vista changelog companion for source-worktree tests";
        after = [ rootNodeModulesReadyTask ];
        exec = ''
          set -euo pipefail
          mkdir -p "$(dirname ${lib.escapeShellArg vistaTestChangelogManifest})"
          machine_version="$(bun -e "const { resolveVistaBuildInfo } = await import('./src/build-info.ts'); process.stdout.write(resolveVistaBuildInfo().machineVersion)")"
          bun ../changelog/compiler.ts \
            --machine-version "$machine_version" \
            --output ${lib.escapeShellArg vistaTestChangelogManifest}
        '';
        cwd = "flakes/vista/service";
      };
      "test:vista-blocks" = {
        description = "Run the Vista blocks Vitest unit suite";
        exec = ''
          set -euo pipefail
          source ${lib.escapeShellArg pnpmTaskHelpersScript}
          CI=1 run_package_bin vitest vitest run
        '';
        cwd = "flakes/vista/blocks";
        after = [ rootNodeModulesReadyTask ];
      };
      "test:vista-service" = {
        description = "Run the Vista service non-browser test suite (vista check:all gate)";
        exec = ''
          set -euo pipefail
          source ${lib.escapeShellArg pnpmTaskHelpersScript}
          export VISTA_CHANGELOG_MANIFEST=${lib.escapeShellArg vistaTestChangelogManifest}
          # Use one worker in this constrained lane (the service uses four):
          # native allocator arenas scale independently of V8's heap cap.
          export ROLLDOWN_WORKER_THREADS=1
          export NODE_OPTIONS="''${NODE_OPTIONS:-} --max-old-space-size=2048"
          CI=1 run_package_bin vitest vitest run --exclude '**/*.browser.test.ts'
        '';
        cwd = "flakes/vista/service";
        after = [
          rootNodeModulesReadyTask
          "vista:island:build"
          "vista:changelog:build"
        ];
      };
      "test:vista-service-browser" = {
        description = "Run the Vista service *.browser.test.ts render proofs with the Nix Playwright browser (R58 guard)";
        exec = ''
          set -euo pipefail
          source ${lib.escapeShellArg pnpmTaskHelpersScript}
          export VISTA_CHANGELOG_MANIFEST=${lib.escapeShellArg vistaTestChangelogManifest}
          test -n "''${PLAYWRIGHT_BROWSERS_PATH:-}" || {
            echo "PLAYWRIGHT_BROWSERS_PATH is missing; run through devenv so Nix supplies browsers." >&2
            exit 1
          }
          # vitest treats positionals as filename SUBSTRING filters (not globs);
          # `browser.test` selects exactly the `*.browser.test.ts` render proofs,
          # the inverse of the non-browser lane's `--exclude '**/*.browser.test.ts'`.
          CI=1 VISTA_REQUIRE_BROWSER=1 run_package_bin vitest vitest run browser.test
        '';
        cwd = "flakes/vista/service";
        after = [
          rootNodeModulesReadyTask
          "vista:island:build"
          "vista:changelog:build"
          "test:vista-service"
        ];
      };
      "test:vista-blocks-storybook" = {
        description = "Run Vista kit Storybook browser smoke with the devenv Playwright browser driver";
        exec = ''
          set -euo pipefail
          source ${lib.escapeShellArg pnpmTaskHelpersScript}
          test -n "''${PLAYWRIGHT_BROWSERS_PATH:-}" || {
            echo "PLAYWRIGHT_BROWSERS_PATH is missing; run through devenv so Nix supplies browsers." >&2
            exit 1
          }
          CI=1 run_package_bin playwright playwright test --config playwright.config.ts
        '';
        cwd = "flakes/vista/blocks";
        after = [ rootNodeModulesReadyTask ];
      };
      "vista:packaged-smoke" = {
        description = "Build/smoke the packaged Vista artifact with browser checks against isolated mutable roots";
        exec = ''
          set -euo pipefail
          node "${config.devenv.root}/flakes/vista/scripts/packaged-smoke.mjs"
        '';
      };
      "vista:packaged-smoke:full" = {
        description = "Build/smoke packaged Vista with browser checks and live telemetry fake-provider coverage";
        exec = ''
          set -euo pipefail
          node "${config.devenv.root}/flakes/vista/scripts/packaged-smoke.mjs" --include-live-telemetry
        '';
      };
      "vista:packaged-smoke:no-browser" = {
        description = "Build/smoke packaged Vista service and CLI paths without browser checks";
        exec = ''
          set -euo pipefail
          node "${config.devenv.root}/flakes/vista/scripts/packaged-smoke.mjs" --no-browser
        '';
      };
  };
}
