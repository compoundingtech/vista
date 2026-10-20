/**
 * The real semantic context every provider-backed data component requires.
 *
 * `useDataBinding` throws unless the component sits beneath a semantic node, so
 * these stories mount the REAL `AppRoot`/`Section`/`Decision` markers rather
 * than a stub context — the component under review runs exactly the code path a
 * published app runs.
 *
 * The fixed empty snapshot exercises the same immutable AppVersion runtime
 * boundary as a publication. Individual presentation stories own loaded fixture
 * review; these provider-backed stories review the typed missing-entry state.
 */
import type { ReactNode } from 'react'

import { DataRuntimeProvider, type Snapshot } from '../data-query.tsx'
import { AppRoot, Section } from '../index.ts'

/**
 * Props for the provider harness, supplying the section heading plus the story content rendered
 * inside the runtime-backed app shell.
 */
export interface ProviderHarnessProps {
  readonly heading: string
  readonly children: ReactNode
}

const storySnapshot: Snapshot = {
  apiVersion: 2,
  frozenAt: '2026-09-19T12:00:00.000Z',
  entries: {},
}

/**
 * Wraps story children in a DataRuntimeProvider, AppRoot, and labeled Section so blocks render
 * with real data-runtime context exactly as in a hosted app.
 */
export const ProviderHarness = ({ heading, children }: ProviderHarnessProps): ReactNode => (
  <DataRuntimeProvider
    appVersionId="storybook/provider-backed/v1"
    snapshot={storySnapshot}
    dataBaseUrl="http://127.0.0.1/_data/"
  >
    <AppRoot title={heading} template="architecture-review" scope="storybook">
      <Section id="provider-section" label={heading}>
        <h2>{heading}</h2>
        {children}
      </Section>
    </AppRoot>
  </DataRuntimeProvider>
)
