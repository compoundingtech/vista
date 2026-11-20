"""Preserve package-relative runtime assets beside TypeScript-emitted modules."""

load("@rules//buck2:hermetic.bzl", "hermetic_bun_command", "ts_action", "ts_action_attrs")
load("@rules//buck2/platforms:defs.bzl", "cache_guarded_rule", "ts_action_cache_eligible", "ts_action_execution_constraints")
load("@rules//buck2/toolchains:defs.bzl", "BunToolchainInfo")
load("@rules//buck2:typescript.bzl", original_tsgo_emit = "tsgo_emit")

def _dist_assets_impl(ctx):
    dist = ctx.attrs.dist[DefaultInfo].default_outputs[0]
    output = ctx.actions.declare_output("dist", dir = True)
    inputs = [dist, ctx.attrs._runner] + ctx.attrs.assets.values()
    args = cmd_args([
        hermetic_bun_command(ctx, ctx.attrs._bun[BunToolchainInfo].executable, sandbox_inputs = inputs),
        ctx.attrs._runner,
        dist,
        output.as_output(),
    ])
    for destination in sorted(ctx.attrs.assets.keys()):
        args.add(destination, ctx.attrs.assets[destination])
    ts_action(
        ctx,
        args,
        inputs = inputs,
        outputs = [output],
        category = "typescript_dist_assets",
        identifier = ctx.attrs.name,
        local_only = True,
    )
    return [DefaultInfo(default_output = output)]

_dist_assets = cache_guarded_rule(
    cache_eligible = ts_action_cache_eligible,
    impl = _dist_assets_impl,
    attrs = dict(ts_action_attrs(), **{
        "dist": attrs.dep(providers = [DefaultInfo]),
        "assets": attrs.dict(attrs.string(), attrs.source(), sorted = True),
        "_runner": attrs.default_only(attrs.source(default = "//buck2:dist-assets.mjs")),
        "_bun": attrs.default_only(attrs.exec_dep(
            default = "@rules//buck2/toolchains:bun",
            providers = [BunToolchainInfo],
        )),
    }),
)

def tsgo_emit(name, assets, **kwargs):
    """Compose the canonical emitter with an extension-independent asset overlay."""
    emitted = name + "__typescript"
    original_tsgo_emit(name = emitted, **kwargs)
    _dist_assets(
        name = name,
        dist = ":" + emitted,
        assets = assets,
        visibility = kwargs.get("visibility", []),
        exec_compatible_with = ts_action_execution_constraints(kwargs.get("exec_compatible_with", [])),
    )
