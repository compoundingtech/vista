import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * Self-contained-CSS plugin (decision 0043, TASK A). The lib build collects ALL
 * CSS (the transitive Grafana/react-table package styles, ~180 KB) into one
 * `telemetry-island.css` asset that NOTHING loads: the host reaches the chunk via
 * a generic `LazyBlock` dynamic `import()` of `dist/island.js` only, so a separate
 * stylesheet is never requested and the metric legend/axis (and trace/flamegraph)
 * render unstyled and overlapping.
 *
 * Rather than add the external `vite-plugin-css-injected-by-js` dependency, this
 * tiny `generateBundle` hook folds the emitted CSS back INTO the JS chunk: it
 * captures the CSS asset, deletes it from the bundle, and prepends a guarded
 * runtime snippet that injects ONE `<style id="vista-telemetry-island-css">` into
 * `document.head` on first module evaluation (idempotent across the three `mount*`
 * paths — one chunk, one stylesheet, browser-cached once). The result is ONE
 * self-contained `dist/island.js` with zero side files, which is also what the
 * 0043 content-addressed publish snapshot pins (a single chunk to content-hash).
 */
const inlineCss = (): Plugin => ({
  name: 'vista-island-inline-css',
  // `post` so we run after Vite has emitted the extracted CSS asset.
  enforce: 'post',
  generateBundle(_options, bundle) {
    const cssFiles = Object.keys(bundle).filter((f) => f.endsWith('.css'))
    if (cssFiles.length === 0) return
    const css = cssFiles
      .map((f) => {
        const asset = bundle[f]
        const source = asset?.type === 'asset' ? asset.source : ''
        delete bundle[f]
        return typeof source === 'string' ? source : new TextDecoder().decode(source)
      })
      .join('\n')

    const entry = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry)
    if (entry === undefined || entry.type !== 'chunk') {
      this.warn('vista-island-inline-css: no entry chunk found; CSS not inlined')
      return
    }
    // `JSON.stringify` escapes the CSS into a safe single-line JS string literal.
    const injector =
      `(() => {\n` +
      `  if (typeof document === 'undefined') return\n` +
      `  const id = 'vista-telemetry-island-css'\n` +
      `  if (document.getElementById(id)) return\n` +
      `  const el = document.createElement('style')\n` +
      `  el.id = id\n` +
      `  el.textContent = ${JSON.stringify(css)}\n` +
      `  document.head.appendChild(el)\n` +
      `})();\n`
    entry.code = injector + entry.code
  },
})

/**
 * The TimeSeries viz subtree. `@grafana/ui`'s `exports` map blocks the deep
 * `dist/esm/graveyard/...` specifier, so we alias an absolute path straight at the
 * file — the seam that lets us pull ONLY the viz subtree (not the barrel). Safe
 * only while `@grafana/ui` is pinned EXACTLY. The package root comes from Node
 * resolution so the alias holds for every install layout (hoisted workspace
 * install, Buck package tree).
 */
const GRAFANA_UI_ENTRY = createRequire(join(HERE, 'package.json')).resolve('@grafana/ui')
const GRAFANA_UI_MARKER = `${join('node_modules', '@grafana', 'ui')}/`
const GRAFANA_TIMESERIES = join(
  GRAFANA_UI_ENTRY.slice(
    0,
    GRAFANA_UI_ENTRY.lastIndexOf(GRAFANA_UI_MARKER) + GRAFANA_UI_MARKER.length,
  ),
  'dist',
  'esm',
  'graveyard',
  'TimeSeries',
  'TimeSeries.mjs',
)

/**
 * The vendored Jaeger trace tree reaches `@grafana/o11y-ds-frontend` for only three
 * span-bar-label constants + two types. The real package drags @grafana/plugin-ui →
 * sql-formatter-plus → @babel/polyfill → core-js@2.6.12 (a deprecated build-script
 * dep that breaks the non-interactive `--ignore-workspace` install under pnpm 11),
 * so we alias it to a tiny local stub and keep it out of the dependency closure.
 */
const O11Y_STUB = join(HERE, 'vendor', 'traceview', 'o11y-ds-frontend.stub.ts')

/**
 * `@grafana/flamegraph` statically imports `OpenAssistantButton` from
 * `@grafana/assistant` (a peer dep) for its header. The real package drags the
 * heavy @grafana/scenes/runtime/rxjs closure and the assistant is irrelevant for
 * Vista's offline review island, so we alias it to a tiny no-op stub — keeping the
 * flamegraph delta over the shared Grafana base minimal.
 */
const ASSISTANT_STUB = join(HERE, 'vendor', 'assistant.stub.ts')

/**
 * Library build for the telemetry island chunk (decision 0046). Produces ONE
 * self-contained ESM file (`dist/island.js`) with React and the Grafana viz
 * subtree INLINED. Zero externals: `rollupOptions.external: []` +
 * `inlineDynamicImports` guarantee the host never has to resolve a bare specifier
 * from the chunk, so the host and this chunk never share a module: each runs its
 * own React instance.
 */
export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' }), inlineCss()],
  resolve: {
    alias: {
      '@vista/grafana-timeseries': GRAFANA_TIMESERIES,
      '@grafana/o11y-ds-frontend': O11Y_STUB,
      '@grafana/assistant': ASSISTANT_STUB,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    minify: true,
    lib: {
      entry: 'src/island.tsx',
      formats: ['es'],
      fileName: () => 'island.js',
    },
    rollupOptions: {
      // Zero externals: bundle react + Grafana into the one chunk.
      external: [],
      output: { inlineDynamicImports: true },
    },
  },
})
