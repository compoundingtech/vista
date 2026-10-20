{ config, lib, pkgs, ... }:
let
  inherit (lib) mkEnableOption mkIf mkOption types;
  cfg = config.services.vista;
  absolutePath = types.addCheck types.str (value: lib.hasPrefix "/" value);
  workspace = "${cfg.package}/libexec/workspace";
  serviceBin = "${cfg.package}/bin/vista-service";
  runtimePath = lib.concatStringsSep ":" [
    "${config.home.profileDirectory}/bin"
    "/run/wrappers/bin"
    "/etc/profiles/per-user/${config.home.username}/bin"
    "/run/current-system/sw/bin"
    "/nix/var/nix/profiles/default/bin"
    "/usr/local/bin"
    "/usr/bin"
    "/bin"
  ];
  environment = cfg.environment // {
    HOME = config.home.homeDirectory;
    VISTA_PORT = toString cfg.port;
    VISTA_ROOT = workspace;
    VISTA_BLOCKS = "${workspace}/flakes/vista/blocks";
    VISTA_DEPS = "${workspace}/node_modules";
    VISTA_APPS = "${cfg.stateDir}/apps";
    VISTA_CACHE = "${cfg.stateDir}/cache";
    VISTA_LIVE_STATE = "${cfg.stateDir}/live-state";
    VISTA_SOURCES = cfg.sourcesDir;
    PATH = cfg.path;
    ROLLDOWN_WORKER_THREADS = "4";
  } // lib.optionalAttrs (cfg.publicUrl != null) {
    VISTA_PUBLIC_URL = cfg.publicUrl;
  };
  # Preserve the frozen Linux service's explicit credential boundary. No login
  # directory is selected or provisioned by the portable module.
  validGhConfigDir = cfg.ghConfigDir != null
    && lib.hasPrefix "/" cfg.ghConfigDir
    && !(lib.hasSuffix "/" cfg.ghConfigDir)
    && !(lib.any (part: lib.hasInfix part cfg.ghConfigDir) [ "//" "/./" "/../" ])
    && !(builtins.elem cfg.ghConfigDir [
      "${config.home.homeDirectory}/.config/gh"
      "${config.xdg.configHome}/gh"
    ]);
  ghConfigCheck = pkgs.writeShellScript "vista-gh-config-check" ''
    set -eu
    declared="$(${pkgs.coreutils}/bin/realpath -m -- "''${GH_CONFIG_DIR:?vista: GH_CONFIG_DIR must be declared}")"
    human="$(${pkgs.coreutils}/bin/realpath -m -- "$HOME/.config/gh")"
    if [ "$declared" = "$human" ]; then
      echo "vista: refusing GH_CONFIG_DIR=$GH_CONFIG_DIR: resolves to human gh config $HOME/.config/gh" >&2
      exit 1
    fi
  '';
  linuxEnvironment = environment // {
    GH_CONFIG_DIR = cfg.ghConfigDir;
    GH_PROMPT_DISABLED = "1";
    VISTA_GH_BIN = "${cfg.ghPackage}/bin/gh";
  };
in
{
  options.services.vista = {
    enable = mkEnableOption "Vista review-publishing service";
    package = mkOption {
      type = types.package;
      description = "Vista package containing bin/vista-service and libexec/workspace.";
    };
    port = mkOption {
      type = types.port;
      description = "Explicit service port (VISTA_PORT); no fleet port registry is imported.";
    };
    stateDir = mkOption {
      type = absolutePath;
      default = "${config.xdg.stateHome}/vista-standalone";
      description = "Mutable runtime state root. The standalone default does not adopt a dotfiles-managed Vista state directory.";
    };
    sourcesDir = mkOption {
      type = absolutePath;
      default = "${cfg.stateDir}/sources";
      description = "AppSource root. No legacy source relocation or owner conversion is performed.";
    };
    logDir = mkOption {
      type = absolutePath;
      default = "${cfg.stateDir}/logs";
      description = "Darwin launchd stdout/stderr directory.";
    };
    path = mkOption {
      type = types.str;
      default = runtimePath;
      description = "Service PATH; defaults to the frozen user-profile/system search order.";
    };
    environment = mkOption {
      type = types.attrsOf types.str;
      default = { };
      description = "Explicit runtime environment, including caller-owned endpoint and telemetry policy. Port, package paths, state paths, HOME and PATH are set by the dedicated options. Do not place secrets in the Nix store.";
    };
    publicUrl = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Optional canonical publication URL. No hostname or ingress policy is inferred.";
    };
    ghConfigDir = mkOption {
      type = types.nullOr absolutePath;
      default = null;
      description = "Explicit non-human GitHub CLI credential directory required by the Linux service. Does not provision credentials; Darwin retains the original environment-only behavior.";
    };
    ghPackage = mkOption {
      type = types.package;
      default = pkgs.gh;
      description = "GitHub CLI used by the Linux service.";
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = !pkgs.stdenv.isLinux || validGhConfigDir;
        message = "services.vista.ghConfigDir must declare an absolute, non-human gh config directory on Linux";
      }
    ];
    home.packages = [ cfg.package ];

    home.sessionVariables = {
      VISTA_APPS = "${cfg.stateDir}/apps";
      VISTA_SOURCES = cfg.sourcesDir;
      VISTA_URL = "http://127.0.0.1:${toString cfg.port}";
    };

    # Directory preparation only: no mutable-state adoption, migrations, unit
    # restarts, credentials, public-url config or CLI wrapper activation.
    home.activation.vistaDirectories = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
      ${pkgs.coreutils}/bin/install -d -m 700 ${lib.escapeShellArgs ([
        cfg.stateDir
        "${cfg.stateDir}/apps"
        "${cfg.stateDir}/cache"
        "${cfg.stateDir}/live-state"
        cfg.sourcesDir
      ] ++ lib.optional pkgs.stdenv.isDarwin cfg.logDir)}
    '';

    systemd.user.services.vista = mkIf pkgs.stdenv.isLinux {
      Unit = {
        Description = "Vista review-publishing service";
        After = [ "default.target" ];
        # Preserve external restart ownership: fleet adapters must keep their
        # convergence/hold logic; standalone operators explicitly restart changes.
        X-RestartIfChanged = false;
      };
      Service = {
        ExecStart = serviceBin;
        ExecStartPre = "${ghConfigCheck}";
        Restart = "always";
        RestartSec = 5;
        KillMode = "control-group";
        Environment = lib.mapAttrsToList (name: value: "${name}=${value}") linuxEnvironment;
      };
      Install.WantedBy = [ "default.target" ];
    };

    launchd.agents.vista = mkIf pkgs.stdenv.isDarwin {
      enable = true;
      config = {
        Label = "com.vista.service";
        ProgramArguments = [ serviceBin ];
        EnvironmentVariables = environment;
        RunAtLoad = true;
        KeepAlive = true;
        StandardOutPath = "${cfg.logDir}/stdout.log";
        StandardErrorPath = "${cfg.logDir}/stderr.log";
      };
    };
  };
}
