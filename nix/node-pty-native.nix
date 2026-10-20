{ pkgs }:

let
  version = "1.1.0";
  source = pkgs.fetchurl {
    url = "https://registry.npmjs.org/node-pty/-/node-pty-${version}.tgz";
    hash = "sha512-20JqtutY6JPXTUnL0ij1uad7Qe1baT46lyolh2sSENDd4sTzKZ4nmAFkeAARDKwmlLjPx6XKRlwRUxwjOy+lUg==";
  };
  nodeAddonApiVersion = "7.1.1";
  nodeAddonApiSource = pkgs.fetchurl {
    url = "https://registry.npmjs.org/node-addon-api/-/node-addon-api-${nodeAddonApiVersion}.tgz";
    hash = "sha512-5m3bsyrjFWE1xf7nz7YXdN4udnVtXK6/Yfgn5qnahL6bCkf2yKt4k3nuTKAtT4r3IG8JNR2ncsIMdZuAzJjHQQ==";
  };
in
{
  name = "node-pty";
  package = pkgs.stdenv.mkDerivation {
    pname = "node-pty-native";
    inherit version;
    src = source;

    nativeBuildInputs = [
      pkgs.gnumake
      pkgs.node-gyp
      pkgs.nodejs_24
      pkgs.python3
    ];

    unpackPhase = ''
      runHook preUnpack

      mkdir source
      tar -xzf "$src" --strip-components=1 -C source
      cd source

      mkdir -p node_modules/node-addon-api
      tar -xzf ${nodeAddonApiSource} --strip-components=1 -C node_modules/node-addon-api

      runHook postUnpack
    '';

    buildPhase = ''
      runHook preBuild

      export HOME="$TMPDIR"
      export CI=true
      export npm_config_build_from_source=true
      export npm_config_nodedir=${pkgs.nodejs_24}
      export npm_config_python=${pkgs.python3}/bin/python3
      export npm_config_update_notifier=false
      export npm_config_fund=false
      export npm_config_audit=false
      node-gyp rebuild --release

      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall

      mkdir -p "$out"
      cp -R . "$out/"
      rm -rf "$out/node_modules" "$out/package.json"
      printf '%s\n' 'module.exports = require("./lib/index.js");' > "$out/index.js"
      if [ -f "$out/prebuilds/${pkgs.stdenv.hostPlatform.parsed.kernel.name}-${pkgs.stdenv.hostPlatform.parsed.cpu.name}/spawn-helper" ]; then
        chmod +x "$out/prebuilds/${pkgs.stdenv.hostPlatform.parsed.kernel.name}-${pkgs.stdenv.hostPlatform.parsed.cpu.name}/spawn-helper"
      fi
      if [ -f "$out/prebuilds/darwin-arm64/spawn-helper" ]; then chmod +x "$out/prebuilds/darwin-arm64/spawn-helper"; fi
      if [ -f "$out/prebuilds/darwin-x64/spawn-helper" ]; then chmod +x "$out/prebuilds/darwin-x64/spawn-helper"; fi

      runHook postInstall
    '';

    meta = {
      description = "Nix-built node-pty package with Linux native addon";
    };
  };
}
