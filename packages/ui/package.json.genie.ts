// @genie-bootstrap
import {
  catalog,
  effectUtilsArtifacts,
  packageJson,
  privatePackageDefaults,
  type PackageJsonData,
} from '../../genie/repo.ts'

const peerDepNames = ['react', 'react-dom', 'react-aria-components', '@stylexjs/stylex'] as const

const composition = catalog.compose({
  workspace: { repoName: 'vista', memberPath: 'packages/ui' },
  dependencies: {
    external: {
      ...catalog.pick('clsx'),
    },
  },
  devDependencies: {
    external: {
      ...catalog.pick(
        ...peerDepNames,
        '@effect/language-service',
        '@internationalized/date',
        '@types/react',
        '@types/react-dom',
        'typescript',
        'storybook',
        '@storybook/react',
        '@storybook/react-vite',
        'vite',
        '@vitejs/plugin-react',
        // Story-gate stack; see @overeng/utils-storybook/gate. The gate
        // runner invokes this package's own `node_modules/.bin/vitest`, so
        // `vitest` has to be a direct dependency rather than an inherited one.
        '@storybook/addon-a11y',
        '@vitest/browser',
        '@vitest/browser-playwright',
        'playwright',
        'vitest',
      ),
      ...effectUtilsArtifacts(
        '@overeng/otel-contract',
        '@overeng/utils',
        '@overeng/utils-storybook',
      ),
    },
  },
  peerDependencies: {
    external: catalog.pick(...peerDepNames),
  },
  gvsTypeExtensions: {
    'react-aria-components': catalog.pick('@types/react', '@types/react-dom'),
    '@storybook/react': catalog.pick(
      'react',
      'react-dom',
      'storybook',
      'typescript',
      '@types/react',
      '@types/react-dom',
    ),
  },
})

export default packageJson(
  {
    name: '@vista/ui',
    ...privatePackageDefaults,
    license: 'Apache-2.0',
    exports: {
      '.': './src/mod.ts',
      './components': './src/components/mod.ts',
      './foundations': './src/foundations/mod.ts',
      './styles.css': './src/foundations/styles.css',
      './document.css': './src/foundations/document.css',
      // The specifier must literally contain `.stylex` for the compiler to
      // treat the import as a variable reference; a subpath spelled any other
      // way silently resolves to plain values.
      './tokens.stylex': './src/foundations/tokens.stylex.ts',
    },
    // The Buck package archive projects these targets over source-only exports.
    publishConfig: {
      exports: {
        '.': { types: './dist/src/mod.d.ts', default: './dist/src/mod.js' },
        './components': {
          types: './dist/src/components/mod.d.ts',
          default: './dist/src/components/mod.js',
        },
        './foundations': {
          types: './dist/src/foundations/mod.d.ts',
          default: './dist/src/foundations/mod.js',
        },
        './styles.css': './src/foundations/styles.css',
        './document.css': './src/foundations/document.css',
        './tokens.stylex': {
          types: './dist/src/foundations/tokens.stylex.d.ts',
          default: './dist/src/foundations/tokens.stylex.js',
        },
      },
    },
    scripts: {
      prepare: 'effect-language-service patch',
      storybook: 'storybook dev -p 6006',
      'build-storybook': 'storybook build',
    },
  } satisfies PackageJsonData,
  composition,
)
