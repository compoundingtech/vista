import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Expose host-safe Vista blocks and native module compilation',
  summary:
    'Blocks expose schema-only contracts and a shared exploration picker without applying document resets to their host. Optional telemetry and interview runtimes are injected by the host; Vista-owned shells supply service runtimes. Newly published pages honor explicit light/dark theme query parameters. Frozen data queries preserve their decoded seed after atom cache eviction. The service exposes a native AppSource builder that bundles local modules into createVistaApp(runtime), sharing host React, JSX, and Vista blocks, with optional app CSS. Unsupported package imports are rejected. Existing published versions are unchanged; native publication requires compatibility metadata and receipt-backed asset integration; tailnet authors are trusted and the receipt proves byte integrity only (no code-execution permission system). App-owned StyleX compilation is not supported by this builder.',
} satisfies ChangelogEntrySource
