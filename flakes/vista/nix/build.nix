{
  pkgs,
  root,
  buck2,
  cliProduct,
  runtimeProduct,
  preflightProduct,
  serviceProduct,
  effectUtilsSrc,
  playwrightWebFlake,
  gitRev ? "unknown",
  commitTs ? 0,
  dirty ? false,
}:
let
  lib = pkgs.lib;
  # The telemetry island is its own pnpm importer; Buck builds its one
  # self-contained chunk from the CLI product's scoped source and pnpm archives.
  telemetryIslandDist =
    let
      watcherPolicies = import "${effectUtilsSrc}/nix/buck2-products/watcher-policies.nix";
      inherit (cliProduct.passthru)
        capabilities
        pnpmArchives
        rootProjection
        source
        ;
      target = "//flakes/vista/island:telemetry-island";
    in
    pkgs.stdenv.mkDerivation {
      pname = "vista-telemetry-island-dist";
      version = "0.1.0";
      src = source;
      passthru.buck2SourceTarget = target;
      nativeBuildInputs = [
        buck2
        pkgs.cacert
      ];
      dontConfigure = true;
      dontFixup = true;
      buildPhase = ''
        runHook preBuild
        export HOME="$TMPDIR/home"
        export XDG_CACHE_HOME="$TMPDIR/cache"
        export XDG_RUNTIME_DIR="$TMPDIR/runtime"
        export SSL_CERT_FILE="${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
        # The product's scoped source carries no Buck root; stage it like the product build.
        cp -R ${rootProjection}/. .
        chmod -R u+w .buck2 buck2 BUCK .buckconfig .buckroot
        mkdir -p "$HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR" .buck2/capabilities
        cp -R ${capabilities}/. .buck2/capabilities
        # Sandbox source is frozen; Watchman's state-directory chmod is forbidden.
        cat >> .buckconfig.local <<'BUCKLOCAL'
        [buck2]
          file_watcher = ${watcherPolicies.immutable-input}
        BUCKLOCAL
        island="$(${buck2}/bin/buck2 --isolation-dir nix-product-vista-telemetry-island build \
          --config nix_store.root=${pnpmArchives} \
          --local-only --no-remote-cache --console simple --show-simple-output \
          ${lib.escapeShellArg target})"
        test -s "$island/island.js"
        cp -R "$island" island
        runHook postBuild
      '';
      installPhase = ''
        runHook preInstall
        mkdir -p "$out"
        cp -R island/. "$out/"
        runHook postInstall
      '';
    };
  playwrightBrowsers = (
    playwrightWebFlake.packages.${pkgs.stdenv.hostPlatform.system}.playwright-driver.browsers.override {
      withWebkit = false;
    }
  );
  buildStamp = builtins.toJSON {
    type = "nix";
    version = "0.1.0";
    rev = gitRev;
    inherit commitTs dirty;
  };
  # The imported Buck product supplies the verified pnpm runtime tree for
  # service, CLI, and blocks. The island ships only its built chunk.
  buckSource = cliProduct.passthru.source;
  importedVista = cliProduct.passthru.importJavaScript {
    expectedProductKind = "cli";
    expectedProductName = "vista";
    expectedModulePath = "vista.mjs";
    expectedRuntimeKind = "bun";
    expectedRuntimeContract = "javascript-esm";
    expectedRuntimeContractVersion = "v1";
    expectedExternalCapabilities = [ ];
    # The descriptor reports bare package imports, not bundler external patterns.
    # Keep */runtime.js external in cli/BUCK.genie.ts: ./runtime.js stays a
    # lazy sibling import, but is not part of the descriptor's package surface.
    expectedExternalModules = [ "@overeng/utils" ];
  };
  changelogSource = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../.changelog
      ../changelog/compiler.ts
      ../changelog/contract.ts
    ];
  };
in
assert lib.assertMsg (
  toString buckSource == toString runtimeProduct.passthru.source
  && toString buckSource == toString preflightProduct.passthru.source
  && toString buckSource == toString serviceProduct.passthru.source
) "Vista bootstrap, runtime, preflight, and service products must use one Buck source";
pkgs.stdenv.mkDerivation {
  pname = "vista";
  version = "0.1.0";
  src = buckSource;
  nativeBuildInputs = [
    pkgs.bun
    pkgs.makeWrapper
    pkgs.fish
    pkgs.zsh
  ];
  dontConfigure = true;
  dontFixup = true;
  passthru = {
    buck2Product = cliProduct;
    buck2RuntimeProduct = runtimeProduct;
    buck2PreflightProduct = preflightProduct;
    buck2ServiceProduct = serviceProduct;
    inherit telemetryIslandDist;
  };
  buildPhase = ''
    runHook preBuild
    mkdir -p runtime/flakes/vista
    # `root + path` copies only that subtree; `''${root}/path` would make the
    # whole repository (and so every commit) part of this derivation.
    ${lib.concatMapStrings
      (dir: ''
        cp -R ${root + "/flakes/vista/${dir}"} runtime/flakes/vista/${dir}
      '')
      [
        "service"
        "cli"
        "blocks"
        "agent-timeline"
        "genie"
        "island"
      ]
    }
    # Vite follows the staged members' tsconfig references into the private UI
    # workspace; keep its authored source/config beside the other members.
    mkdir -p runtime/packages
    cp -R ${root + "/packages/ui"} runtime/packages/ui
    chmod -R u+w runtime
    ln -s ${importedVista}/libexec/node_modules runtime/node_modules
    ln -s ${importedVista}/libexec/importers/cli/node_modules runtime/flakes/vista/cli/node_modules
    ln -s ../../../node_modules runtime/flakes/vista/service/node_modules
    ln -s ${importedVista}/libexec/importers/blocks/node_modules runtime/flakes/vista/blocks/node_modules
    ln -s ../../../node_modules runtime/flakes/vista/agent-timeline/node_modules
    mkdir -p runtime/flakes/vista/island/dist
    cp -R ${telemetryIslandDist}/. runtime/flakes/vista/island/dist/
    cp -R ${changelogSource}/. runtime/flakes/vista/
    test -s runtime/flakes/vista/island/dist/island.js
    # Bun's source-map scanner also sees unplugin's sourceMappingURL template
    # literal inside the Buck bundle. Emit a real, final linked map so it never
    # interprets that string as the module's map. Keep dependencies external:
    # the verified Buck product and runtime closure still own their contents.
    # Keep source content in the adjacent map, not in the startup-parsed module.
    # Linked-map emission resolves outputs beside its input; stage it writable.
    cp ${importedVista}/libexec/vista.mjs runtime/flakes/vista/cli/vista.mjs
    chmod u+w runtime/flakes/vista/cli/vista.mjs
    cp ${runtimeProduct}/runtime.js runtime/flakes/vista/cli/runtime.js
    chmod u+w runtime/flakes/vista/cli/runtime.js
    cp ${preflightProduct}/preflight.js runtime/flakes/vista/cli/preflight.js
    chmod u+w runtime/flakes/vista/cli/preflight.js
    bun build runtime/flakes/vista/cli/vista.mjs \
      --target=bun --packages=external --external='*/runtime.js' --sourcemap=linked \
      --outfile=runtime/flakes/vista/cli/vista.mjs
    test -s runtime/flakes/vista/cli/vista.mjs.map
    bun build runtime/flakes/vista/cli/runtime.js \
      --target=bun --packages=external --external='*/preflight.js' --sourcemap=linked \
      --outfile=runtime/flakes/vista/cli/runtime.js
    test -s runtime/flakes/vista/cli/runtime.js.map
    bun build runtime/flakes/vista/cli/preflight.js \
      --target=bun --packages=external --sourcemap=linked \
      --outfile=runtime/flakes/vista/cli/preflight.js
    test -s runtime/flakes/vista/cli/preflight.js.map
    # Guard the emitted graph, not just the source-level dynamic import.
    bun -e '
      const imports = new Bun.Transpiler({ loader: "js" }).scanImports(await Bun.file(process.argv[1]).text());
      const compilers = ["vite", "typescript", "lightningcss", "@vitejs/plugin-react"];
      const eager = imports.filter(({ path }) =>
        path === "@effect/platform-node" ||
        compilers.some((name) => path === name || path.startsWith(name + "/")));
      if (eager.length > 0) {
        console.error("Vista runtime eagerly imports evaluator dependencies:", eager);
        process.exit(1);
      }
    ' runtime/flakes/vista/cli/runtime.js
    test -f runtime/node_modules/vite/package.json
    test -f runtime/node_modules/@vista/ui/package.json
    runHook postBuild
  '';
  installPhase = ''
    runHook preInstall
    mkdir -p "$out/bin" "$out/libexec/workspace" "$out/share/vista" \
      "$out/share/fish/vendor_completions.d" \
      "$out/share/bash-completion/completions" "$out/share/zsh/site-functions"
    cp -R runtime/. "$out/libexec/workspace/"
    cp ${serviceProduct}/vista-service.mjs "$out/libexec/workspace/flakes/vista/service/vista-service.mjs"
    cp ${root + "/nixpkgs/ai/skills/vista.md"} "$out/share/vista/review-taste.md"
    # Expose the wrapper's exact interpreter for process identity checks.
    ln -s ${pkgs.bun}/bin/bun "$out/libexec/vista-runtime"
    makeWrapper ${pkgs.bun}/bin/bun "$out/bin/vista" \
      --add-flags "$out/libexec/workspace/flakes/vista/cli/vista.mjs" \
      --set-default VISTA_ROOT "$out/libexec/workspace" \
      --set-default ST_AGENT vista.build \
      --set CLI_BUILD_STAMP ${lib.escapeShellArg buildStamp} \
      --set PLAYWRIGHT_BROWSERS_PATH "${playwrightBrowsers}" \
      --set VISTA_REVIEW_TASTE "$out/share/vista/review-taste.md"
    makeWrapper ${pkgs.bun}/bin/bun "$out/bin/vista-service" \
      --argv0 vista-service \
      --add-flags "$out/libexec/workspace/flakes/vista/service/vista-service.mjs" \
      --set-default VISTA_ROOT "$out/libexec/workspace" \
      --set CLI_BUILD_STAMP ${lib.escapeShellArg buildStamp} \
      --set PLAYWRIGHT_BROWSERS_PATH "${playwrightBrowsers}" \
      --set VISTA_CHANGELOG_MANIFEST "$out/share/vista/changelog.v1.json" \
      --set-default VISTA_RENDER_SMOKE 1
    machine_version="$(VISTA_ROOT="$out/libexec/workspace" CLI_BUILD_STAMP=${lib.escapeShellArg buildStamp} \
      ${pkgs.bun}/bin/bun -e \
      "const { resolveVistaBuildInfo } = await import('$out/libexec/workspace/flakes/vista/service/src/build-info.ts'); process.stdout.write(resolveVistaBuildInfo().machineVersion)")"
    ${pkgs.bun}/bin/bun "$out/libexec/workspace/flakes/vista/changelog/compiler.ts" \
      --source-directory "$out/libexec/workspace/flakes/vista/.changelog" \
      --machine-version "$machine_version" \
      --output "$out/share/vista/changelog.v1.json"
    test -s "$out/share/vista/changelog.v1.json"
    # Exercise the installed artifact: source-only tests cannot catch malformed
    # bundle map directives, and successful exit codes do not catch warnings.
    # The installed bootstrap must report its version without loading the runtime.
    mv "$out/libexec/workspace/flakes/vista/cli/runtime.js" "$TMPDIR/vista-runtime.js"
    "$out/bin/vista" --version 2> "$TMPDIR/vista-version.stderr"
    test ! -s "$TMPDIR/vista-version.stderr"
    mv "$TMPDIR/vista-runtime.js" "$out/libexec/workspace/flakes/vista/cli/runtime.js"
    # Root help must not evaluate the local-check compiler/provider chunk.
    mv "$out/libexec/workspace/flakes/vista/cli/preflight.js" "$TMPDIR/vista-preflight.js"
    help="$("$out/bin/vista" --help 2> "$TMPDIR/vista-help.stderr")"
    test ! -s "$TMPDIR/vista-help.stderr"
    [[ "$help" != *"a app"* ]]
    mv "$TMPDIR/vista-preflight.js" "$out/libexec/workspace/flakes/vista/cli/preflight.js"
    VISTA_ROOT="$out/libexec/workspace" ${pkgs.bun}/bin/bun -e \
      "await import('$out/libexec/workspace/flakes/vista/service/src/server.ts')"
    # Preflight must work against the installed dependency closure, not the
    # checkout's broader node_modules (which also exposes @vista/service).
    (
      export VISTA_ROOT="$out/libexec/workspace"
      export VISTA_CACHE="$TMPDIR/vista-smoke/cache"
      cd "$VISTA_ROOT"
      ${pkgs.bun}/bin/bun -e "
        const { Effect } = await import('effect');
        const { scaffold } = await import('./flakes/vista/service/src/scaffold.ts');
        await Effect.runPromise(scaffold('package-smoke', { appSource: '$TMPDIR/vista-smoke/source' }));
      "
      "$out/bin/vista" check "$TMPDIR/vista-smoke/source"
    )
    "$out/bin/vista" --completions fish > "$out/share/fish/vendor_completions.d/vista.fish"
    "$out/bin/vista" --completions bash > "$out/share/bash-completion/completions/vista"
    "$out/bin/vista" --completions zsh > "$out/share/zsh/site-functions/_vista"
    fish --no-execute "$out/share/fish/vendor_completions.d/vista.fish"
    zsh -n "$out/share/zsh/site-functions/_vista"
    bash -n "$out/share/bash-completion/completions/vista"
    runHook postInstall
  '';
  meta.mainProgram = "vista";
}
