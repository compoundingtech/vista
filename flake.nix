{
  description = "Vista review-publishing service";

  inputs = {
    effect-utils.url = "github:overengineeringstudio/effect-utils/fd01f8ee6c97beec34a8a80284039e297a9a5317";
    nixpkgs.follows = "effect-utils/nixpkgs";
    flake-utils.follows = "effect-utils/flake-utils";
    playwright = {
      url = "github:overengineeringstudio/effect-utils/fd01f8ee6c97beec34a8a80284039e297a9a5317?dir=nix/playwright-flake";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.playwright-web-flake.inputs.flake-utils.follows = "flake-utils";
    };
    playwright-web-flake.follows = "playwright/playwright-web-flake";
  };

  outputs =
    {
      self,
      effect-utils,
      nixpkgs,
      flake-utils,
      playwright-web-flake,
      ...
    }:
    (flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        packages = import ./nix/packages.nix {
          inherit pkgs effect-utils;
          root = ./.;
          playwrightWebFlake = playwright-web-flake;
          gitRev = self.rev or "unknown";
          commitTs = self.lastModified or 0;
          dirty = !(self ? rev);
        };
      }
    ))
    // {
      homeManagerModules.default = { lib, pkgs, ... }: {
        imports = [ ./nix/home-manager.nix ];
        services.vista.package = lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}.vista;
      };
    };
}
