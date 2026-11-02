// @genie-bootstrap
import {
  catalog,
  packageJson,
  privatePackageDefaults,
} from '../../../genie/repo.ts'

/**
 * Pre-built, self-contained Grafana telemetry island (decision 0046). Vite
 * library mode inlines React, the `@grafana/ui` TimeSeries subtree,
 * `@grafana/flamegraph` and the vendored AGPL Jaeger trace view (see
 * `vendor/traceview/PROVENANCE.md`, decisions 0040/0042) into ONE `dist/island.js`
 * that the review host reaches through `LazyBlock`.
 *
 * Grafana stays pinned EXACTLY because the deep `graveyard/TimeSeries` import and
 * the vendored trace tree bypass the package exports map.
 */
const grafanaVersion = '13.2.3'

const composition = catalog.compose({
  mode: 'install',
  workspace: { repoName: 'vista', memberPath: 'flakes/vista/island' },
  dependencies: {
    external: {
      ...catalog.pick('react', 'react-dom'),
      '@emotion/css': '11.13.5',
      '@grafana/data': grafanaVersion,
      '@grafana/e2e-selectors': grafanaVersion,
      '@grafana/flamegraph': grafanaVersion,
      '@grafana/i18n': grafanaVersion,
      '@grafana/runtime': grafanaVersion,
      '@grafana/schema': grafanaVersion,
      '@grafana/ui': grafanaVersion,
      '@opentelemetry/api': '1.9.1',
      classnames: '2.5.1',
      combokeys: '3.0.1',
      dompurify: '3.4.0',
      lodash: '4.18.1',
      'memoize-one': '4.0.3',
      'react-table': '7.8.0',
      // Grafana 13.2 floor; one `@types/js-cookie` companion repository-wide.
      'react-use': '17.6.1',
      reselect: '5.1.1',
      tinycolor2: '1.6.0',
      'tween-functions': '1.2.0',
    },
  },
  devDependencies: {
    external: {
      ...catalog.pick(
        '@types/node',
        '@types/react',
        '@types/react-dom',
        '@vitejs/plugin-react',
        'typescript',
        'vite',
      ),
      '@types/lodash': '4.17.20',
    },
  },
})

export default packageJson(
  {
    name: '@vista/telemetry-island',
    ...privatePackageDefaults,
    license: 'Apache-2.0 AND AGPL-3.0-only',
    description:
      'Pre-built, self-contained Grafana telemetry island chunk for the Vista review host (decision 0046).',
    exports: {
      '.': './dist/island.js',
    },
    scripts: {
      build: 'vite build',
    },
  },
  composition,
)
