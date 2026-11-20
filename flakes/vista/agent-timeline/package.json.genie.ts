// @genie-bootstrap
import {
  catalog,
  packageJson,
  privatePackageDefaults,
} from '../../../genie/repo.ts'
import uiPkg from '../../../packages/ui/package.json.genie.ts'

export default packageJson(
  {
    name: '@overeng/agent-timeline',
    ...privatePackageDefaults,
    license: 'Apache-2.0',
    description: 'Shared agent timeline model, projection, span and compact/detail renderers.',
    sideEffects: false,
    exports: {
      '.': './src/index.ts',
      './model': './src/model.ts',
      './projection': './src/projection.ts',
      './labels': './src/labels.ts',
      './types': './src/types.ts',
      './encodings': './src/encodings.ts',
      './icons': './src/icons.tsx',
      './span': './src/Span.tsx',
      './compact': './src/compact.ts',
      './detail': './src/SpanDetails.tsx',
      './spend': './src/SpendPanel.tsx',
      './package.json': './package.json',
    },
    publishConfig: {
      exports: {
        '.': './dist/src/index.js',
        './model': './dist/src/model.js',
        './projection': './dist/src/projection.js',
        './labels': './dist/src/labels.js',
        './types': './dist/src/types.js',
        './encodings': './dist/src/encodings.js',
        './icons': './dist/src/icons.js',
        './span': './dist/src/Span.js',
        './compact': './dist/src/compact.js',
        './detail': './dist/src/SpanDetails.js',
        './spend': './dist/src/SpendPanel.js',
        './package.json': './package.json',
      },
    },
  },
  catalog.compose({
    workspace: { repoName: 'vista', memberPath: 'flakes/vista/agent-timeline' },
    dependencies: { workspace: [uiPkg] },
    peerDependencies: {
      external: catalog.peers('react', 'effect', '@stylexjs/stylex', 'react-aria-components'),
    },
    devDependencies: {
      external: catalog.pick(
        'react',
        'react-dom',
        'effect',
        '@stylexjs/stylex',
        'react-aria-components',
        '@types/react',
        'typescript',
      ),
    },
    gvsTypeExtensions: {
      'react-aria-components': catalog.pick('@types/react', '@types/react-dom'),
    },
  }),
)
