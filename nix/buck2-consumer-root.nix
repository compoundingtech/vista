{
  pkgs,
  effect-utils,
  # Supply the shared projection extended with the original consumer-native recipes
  # through effect-utils.lib.mkBuck2Capabilities. Never substitute E's node-pty recipe.
  capabilities,
  extraToolchainsBuck ? "",
  privateProductRoot ? null,
}:

effect-utils.lib.mkConsumerBuckRoot {
  inherit
    pkgs
    capabilities
    extraToolchainsBuck
    privateProductRoot
    ;
  rules = effect-utils.packages.${pkgs.system}.buck2-rules;
  cellName = "vista";
  # Private fleet endpoints are deliberately not part of this standalone authority.
  remoteCacheEnabled = false;
  allowCacheUploads = false;
  projectIgnore = [
    "**/__pycache__"
    "**/dist"
    "**/node_modules"
    "**/target"
    ".devenv"
    ".git"
    "buck-out"
    "node_modules"
    "repos"
    "target"
    "tmp"
  ];
}
