// @genie-bootstrap
import {
  catalog,
  effectUtilsArtifactUrls,
  packageJson,
  privatePackageDefaults,
} from '../../../genie/repo.ts'
import servicePkg from '../service/package.json.genie.ts'

/**
 * The `vista` CLI (decision 0028) — the agent's only operational surface (AGT.CLI-R06,
 * decision 0002). Thin by design: publish/retire are imported from
 * `@vista/service` (one source of truth for the on-disk registry + atomic-mkdir
 * publish + freeze); `list`/`open` read the same registry / hit the running
 * service. Commands: `vista check [path]`, `vista publish <slug> -m`,
 * `vista list`, `vista open <slug> [version]`, `vista retire <slug>`.
 *
 * May ship as a compiled Bun binary under Nix; here it runs from source.
 */
const composition = catalog.compose({
  mode: 'install',
  workspace: { repoName: 'vista', memberPath: 'flakes/vista/cli' },
  dependencies: {
    // `@overeng/utils` backs the CLI build identity (`resolveCliBuildIdentity`,
    // decision 0064) and the OTel bootstrap (`makeOtelCliLayer` +
    // re-exported `ServiceIdentity`, decision 0062) wired in `cli.ts`.
    // `@overeng/tui-react` (+ `tui-core`) is the CLI presentation lib (decision
    // 0063 / AGT.CLI-R68): commands compute `<Box>`/`<Text>` view components and
    // render via output-mode presets. Dependency-clean per 0063 — the heavy
    // `@xterm`/`@opentui` modules are lazy imports, so the compiled Bun binary
    // ships only yoga/react-reconciler, never the terminal-emulator surface.
    workspace: [servicePkg],
    external: {
      ...catalog.pick('effect', '@effect/platform-node'),
      // Babel resolves this preset by package name while bundling the CLI's
      // StyleX preflight; expose the service's pinned preset at the CLI farm root.
      '@babel/preset-typescript': servicePkg.data.dependencies['@babel/preset-typescript'],
      lightningcss: '1.33.0',
      '@overeng/tui-core': effectUtilsArtifactUrls['@overeng/tui-core'],
      '@overeng/tui-react': effectUtilsArtifactUrls['@overeng/tui-react'],
      '@overeng/utils': effectUtilsArtifactUrls['@overeng/utils'],
    },
  },
  // tui-react's React runtime + storybook peers. Mirrors other Effect 4
  // tui-react consumers (`@effect/atom-react` in dev + peer): the compiled binary
  // resolves them from the install closure, and stories/render-tests need the
  // storybook + reconciler toolchain.
  devDependencies: {
    external: catalog.pick(
      '@effect/atom-react',
      '@effect/platform-node',
      '@effect/vitest',
      '@opentui/core',
      '@opentui/react',
      '@storybook/react',
      '@storybook/react-vite',
      '@types/node',
      '@types/react',
      '@types/react-reconciler',
      '@vitejs/plugin-react',
      'oxlint',
      'react',
      'react-dom',
      'react-reconciler',
      'storybook',
      'typescript',
      'vite',
      'vitest',
    ),
  },
  peerDependencies: {
    external: catalog.pick(
      '@effect/atom-react',
      '@effect/platform-node',
      '@opentui/core',
      '@opentui/react',
      'effect',
      'react',
      'react-dom',
      'react-reconciler',
    ),
  },
})

export default packageJson(
  {
    name: '@vista/cli',
    ...privatePackageDefaults,
    license: 'Apache-2.0',
    description:
      'The `vista` CLI: check/publish/list/open/retire — the agent operational surface (decisions 0002, 0028).',
    exports: {
      '.': './src/index.ts',
      './package.json': './package.json',
    },
    bin: {
      vista: './src/cli.ts',
    },
    scripts: {
      typecheck: 'tsc -p tsconfig.json',
    },
  },
  composition,
)
