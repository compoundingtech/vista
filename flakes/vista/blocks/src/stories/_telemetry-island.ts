/**
 * The Storybook telemetry-island host (decision 0046). It mirrors EXACTLY what
 * the service's apps provide to `Renderer`/`AppShell`: a `TelemetryRuntimeHost`
 * whose `load()` dynamic-imports the pre-built `@vista/telemetry-island` chunk. The
 * specifier is resolved by the `.storybook/main.ts` Vite alias to
 * `../../island/dist/island.js`, so the telemetry stories exercise the real
 * `block → LazyBlock → load() → import()` path against the real island chunk.
 *
 * Kept out of `_fixtures.ts` so the dynamic-import specifier's blast radius stays
 * narrow: only the telemetry/LazyBlock stories import it.
 */
import type { TelemetryRuntimeHost, TelemetryRuntimeModule } from '../data-feed.ts'

/**
 * Telemetry runtime host that seeds a minimal window.grafanaBootData when absent and then lazily
 * imports the telemetry island module as its runtime implementation.
 */
export const telemetryRuntime: TelemetryRuntimeHost = {
  load: (): Promise<TelemetryRuntimeModule> => {
    if (Reflect.get(window, 'grafanaBootData') === undefined) {
      Reflect.set(window, 'grafanaBootData', {
        assets: { dark: '', light: '' },
        settings: {},
        user: {},
        navTree: [],
      })
    }
    return import('@vista/telemetry-island') as Promise<TelemetryRuntimeModule>
  },
}
