import confettiModule from 'https://esm.sh/canvas-confetti@1.9.3'
import { useState } from 'react'

/** esm.sh modules are opaque to tsc by design (VST-R65 / `types/esm-sh.d.ts`), so
 * narrow the default export to the shape this component uses at the use site. */
const confetti = confettiModule as (opts: {
  particleCount?: number
  spread?: number
  origin?: { readonly x?: number; readonly y?: number }
}) => void

/**
 * The heavy, browser-only leaf of the {@link ../esm-lazy-app/app.tsx esm-lazy sample}.
 *
 * `canvas-confetti` is NOT in the exposed `vista-deps` closure, so it is reached
 * by a **pinned** `esm.sh/<pkg>@<version>` URL (VST-R65) — no install, no per-app
 * build, no closure change. The library touches browser globals when it loads, so
 * this module is deliberately kept OUT of the app's eager graph: `app.tsx` imports
 * it only through `React.lazy` (decision 0054). The publish-time node projection
 * (SVC-R57) walks the eager graph, so it never evaluates this module — the pinned
 * `esm.sh` dependency is only ever fetched by the browser, behind the lazy boundary.
 */
export default function ConfettiPanel({ label }: { label: string }) {
  const [count, setCount] = useState(0)
  return (
    <button
      type="button"
      onClick={() => {
        void confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 } })
        setCount((c) => c + 1)
      }}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: '1px solid rgba(127,127,127,0.35)',
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      {label}
      {count > 0 ? ` · ${count}×` : ''}
    </button>
  )
}
