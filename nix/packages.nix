{
  pkgs,
  effect-utils,
  root,
  playwrightWebFlake,
  gitRev ? "unknown",
  commitTs ? 0,
  dirty ? false,
}:
let
  requirePath = path: message:
    if builtins.pathExists path then path else throw "vista: ${message}";
  # Generated Buck source closure, never a hand-maintained package inventory.
  sourcePathsFile = requirePath (root + "/nix/buck2-products/source-paths.json")
    "missing owner-generated nix/buck2-products/source-paths.json; provision the standalone Buck source projection before evaluating packages";
  sourcePaths = (builtins.fromJSON (builtins.readFile sourcePathsFile)).packages."flakes/vista";
  lock = requirePath (root + "/pnpm-lock.yaml")
    "missing standalone pnpm-lock.yaml; dependency generation must complete first";
  sidecar = requirePath (root + "/buck2/dependencies/pnpm-lock.sha256.json")
    "missing standalone archive sidecar; run the owning dependency workflow against the real lock";
  # Preserve D's shared capability authority. The original product-native PTY
  # recipe is supplied through nativeStorePackages, not E's different PTY recipe.
  capabilities = effect-utils.packages.${pkgs.stdenv.hostPlatform.system}.buck2-capabilities;
  rootProjection = import ./buck2-consumer-root.nix {
    inherit pkgs effect-utils capabilities;
  };
  pnpmArchives = builtins.seq lock (import "${effect-utils}/nix/buck2-products/pnpm-archives.nix" {
    inherit pkgs;
    sidecarPath = sidecar;
    # Public effect-utils artifacts are already registry URLs in the sidecar.
    # Local @vista/ui is a workspace member, not a private published tarball.
  });
  nodePty = import ./node-pty-native.nix { inherit pkgs; };
  mkProduct = product: extra:
    (effect-utils.lib.mkBuckProductFromSource { inherit pkgs; }) ({
      inherit capabilities pnpmArchives rootProjection sourcePaths;
      repositoryRoot = root;
      product = product // { kind = "javascript"; version = "0.1.0"; };
    } // extra);
  cliProduct = mkProduct {
    name = "vista";
    target = "//flakes/vista:vista-candidate";
    outputName = "vista.mjs";
  } {
    runtimeClosureTarget = "//flakes/vista:vista-runtime-closure";
    nativeStorePackages = [ nodePty ];
  };
  runtimeProduct = mkProduct {
    name = "vista-runtime";
    target = "//flakes/vista:vista-runtime-candidate";
    outputName = "runtime.js";
  } { };
  preflightProduct = mkProduct {
    name = "vista-preflight";
    target = "//flakes/vista:vista-preflight-candidate";
    outputName = "preflight.js";
  } { };
  serviceProduct = mkProduct {
    name = "vista-service";
    target = "//flakes/vista:vista-service-candidate";
    outputName = "vista-service.mjs";
  } { };
  vista = import ../flakes/vista/nix/build.nix {
    inherit pkgs root cliProduct runtimeProduct preflightProduct serviceProduct
      playwrightWebFlake gitRev commitTs dirty;
    buck2 = effect-utils.packages.${pkgs.stdenv.hostPlatform.system}.buck2;
    effectUtilsSrc = "${effect-utils}";
  };
in
{
  inherit vista;
  default = vista;
  # The frozen product recipe installs both executable entry points together.
  vista-service = vista;
  vista-runtime = runtimeProduct;
  vista-preflight = preflightProduct;
  vista-island = vista.telemetryIslandDist;
}
