import { AppRoot, Decision, Evidence, RuntimeIsland, Section } from '@vista/blocks'
import { Suspense, lazy } from 'react'

const ConfettiPanel = lazy(() => import('./confetti-panel.tsx'))

export default function VistaApp() {
  return (
    <AppRoot
      title="Heavy component via pinned esm.sh + lazy boundary"
      template="code-recap"
      scope="Browser-only code remains below a RuntimeIsland"
    >
      <Section>
        <p>A normal local React component may own a pinned remote dependency.</p>
      </Section>
      <Section>
        <Evidence id="confetti">
          <RuntimeIsland id="confetti-runtime">
            <Suspense fallback={<span style={{ opacity: 0.6 }}>loading…</span>}>
              <ConfettiPanel label="Celebrate" />
            </Suspense>
          </RuntimeIsland>
        </Evidence>
      </Section>
      <Decision id="set-esm-lazy" status="locked">
        Browser-only behavior stays below the stable RuntimeIsland boundary.
      </Decision>
    </AppRoot>
  )
}
