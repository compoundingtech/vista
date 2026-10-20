import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

import { createStylexVitePlugins } from '@overeng/utils/node/stylex'

const HERE = dirname(fileURLToPath(import.meta.url))
const SERVICE_SRC = join(HERE, 'src')
const BLOCKS_SRC = join(HERE, '..', 'blocks', 'src')
// Vitest has no HTTP server to close. The upstream development hook starts an
// interval that only follows that server lifecycle; tests need its compiler
// transform, not its CSS hot-reload middleware.
const stylexTestPlugins = createStylexVitePlugins({
  externalPackages: ['@vista/ui', '@overeng/agent-timeline'],
  entries: [new URL('./src/index.ts', import.meta.url).pathname],
}).map((plugin) => Object.assign(plugin, { configureServer: undefined }))

/**
 * Mirrors the service's Vite aliases for service-owned modules. The disk-index
 * panel fixture lives outside the service package, so its client-safe contract
 * import cannot discover the service-local workspace symlink; map that one
 * canonical blocks subpath directly to source.
 */
export default defineConfig({
  plugins: stylexTestPlugins,
  resolve: {
    alias: {
      '@vista/blocks/internal/data-contract': join(BLOCKS_SRC, 'data-contract.ts'),
      '@vista/blocks/internal/provider-contracts': join(BLOCKS_SRC, 'provider-contracts.ts'),
      '@vista/data': join(SERVICE_SRC, 'data'),
      '@vista/interview': join(SERVICE_SRC, 'interview'),
      // The island's PURE flamebearer→nested-set helper lives in the standalone
      // island package (outside the service tsconfig `rootDir`), so the fixture
      // test reaches it through this alias — exactly the `@vista/telemetry-island`
      // seam: tsc resolves the ambient `declare module` (types/flamebearer.d.ts),
      // vitest resolves the real source here at runtime.
      '@vista/flamebearer': join(SERVICE_SRC, '..', '..', 'island', 'src', 'flamebearer.ts'),
    },
  },
  test: {
    include: [
      'src/**/*.test.ts',
      '../../disk-index/vista/*.test.tsx',
      '../changelog/*.unit.test.ts',
    ],
    // `ts:build` emits compiled `.test.js` copies into `dist/`; without an
    // explicit exclude vitest would discover and re-run those stale duplicates
    // alongside the real `src/**` TypeScript suite. Pin the suite to source.
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Publication smoke tests run real proof/publish round trips; the 30s
    // default expires on a loaded shared host — a timeout, never an assertion.
    // Fixture hooks start the same Vite-backed service and may publish first.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Several integration files (`control-rpc`, `derive-projection`,
    // `runtime-policy.vite`) each spin up a REAL Vita/Vite dev server; running them
    // as parallel worker files saturates the shared builder and starves the pool,
    // so the fast publish/island files hit the 5s timeout. Serialize test FILES
    // (per-file worker isolation is preserved — each file still freezes its own
    // `VISTA_APPS` via `paths.ts` at import). Deterministic and gentler on the
    // shared dev3 builder than a global timeout bump.
    fileParallelism: false,
    // Retire native allocator arenas at each file's isolated process boundary.
    pool: 'forks',
    isolate: true,
    server: {
      deps: {
        // `mermaid`'s `khroma` dep uses trailing-slash directory imports
        // (`from '../channels/'`) which the node-side ESM resolver mangles into a
        // double-slash path (`channels//index.js`), corrupting the nested
        // relative import. Inlining routes them through Vite's resolver (which
        // normalizes the path), so the kit barrel is node-importable in the test
        // runner — the premise `sample-projection-drift` depends on.
        inline: ['mermaid', 'khroma'],
      },
    },
  },
})
