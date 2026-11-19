{ pkgs, effect-utils, root, capabilities, pnpmArchives, rootProjection, sourcePaths }:
let
  cacheUrl = "https://compoundingtech-vista.cachix.org";
  effectProducts = (builtins.fromJSON (builtins.readFile "${effect-utils}/nix/buck2-products/manifest.json")).products;
  effectUrls = builtins.listToAttrs (map (product: {
    name = product.name;
    value = product.artifactUrl;
  }) effectProducts);
  archiveUrl = archive:
    "${cacheUrl}/serve/${builtins.head (pkgs.lib.splitString "-" (builtins.baseNameOf archive))}/${archive.archiveName}";
  mkArchive = { name, packagePath, archiveName, dependencies ? [ ] }:
    let
      manifest = builtins.fromJSON (builtins.readFile (root + "/${packagePath}/package.json"));
      raw = (effect-utils.lib.mkBuckProductFromSource { inherit pkgs; }) {
        inherit capabilities pnpmArchives rootProjection sourcePaths;
        repositoryRoot = root;
        product = {
          inherit name;
          version = manifest.version;
          kind = "package";
          target = "//${packagePath}:dist-package";
          outputName = archiveName;
        };
      };
      urls = effectUrls // builtins.listToAttrs (map (archive: {
        name = archive.packageName;
        value = archiveUrl archive;
      }) dependencies);
    in pkgs.runCommand "${archiveName}-consumer" {
      nativeBuildInputs = [ pkgs.jq pkgs.gnutar pkgs.gzip ];
      passthru = {
        inherit archiveName;
        packageName = name;
        packageVersion = manifest.version;
      };
    } ''
      mkdir stage "$out"
      tar -xzf ${raw}/${archiveName} -C stage
      jq --argjson urls ${pkgs.lib.escapeShellArg (builtins.toJSON urls)} '
        del(.devDependencies, .scripts, .dependenciesMeta, ."$genie", .private) |
        reduce ["dependencies", "optionalDependencies", "peerDependencies"][] as $field (. ;
          if has($field) then .[$field] |= with_entries(
            if $urls[.key] != null then .value = $urls[.key]
            elif (.value | test("^(workspace:|link:|file:)")) then
              error("unpublished dependency: " + .key)
            else . end)
          else . end)
      ' stage/package/package.json > manifest.json
      mv manifest.json stage/package/package.json
      tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner \
        -C stage -cf - package | gzip -n > "$out/${archiveName}"
    '';
  ui = mkArchive {
    name = "@vista/ui";
    packagePath = "packages/ui";
    archiveName = "vista-ui.tgz";
  };
  legacyUi = mkArchive {
    name = "@overeng/geist-design-system";
    packagePath = "packages/ui-legacy-alias";
    archiveName = "overeng-geist-design-system.tgz";
    dependencies = [ ui ];
  };
  timeline = mkArchive {
    name = "@overeng/agent-timeline";
    packagePath = "flakes/vista/agent-timeline";
    archiveName = "overeng-agent-timeline.tgz";
    dependencies = [ ui ];
  };
  blocks = mkArchive {
    name = "@vista/blocks";
    packagePath = "flakes/vista/blocks";
    archiveName = "vista-blocks.tgz";
    dependencies = [ ui legacyUi timeline ];
  };
  service = mkArchive {
    name = "@vista/service";
    packagePath = "flakes/vista/service";
    archiveName = "vista-service.tgz";
    dependencies = [ ui legacyUi timeline blocks ];
  };
in {
  vista-ui-archive = ui;
  vista-ui-legacy-archive = legacyUi;
  vista-agent-timeline-archive = timeline;
  vista-blocks-archive = blocks;
  vista-service-archive = service;
}
