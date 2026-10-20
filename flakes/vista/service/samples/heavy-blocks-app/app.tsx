import {
  AppRoot,
  Evidence,
  PullRequestFiles,
  RuntimeIsland,
  Section,
  type SystemModel,
} from '@vista/blocks'
import { Suspense, lazy } from 'react'

const SystemExplorer = lazy(() =>
  import('@vista/blocks').then(({ SystemExplorer: Component }) => ({ default: Component })),
)
const Diff = lazy(() =>
  import('@vista/blocks').then(({ Diff: Component }) => ({ default: Component })),
)
const FileTree = lazy(() =>
  import('@vista/blocks').then(({ FileTree: Component }) => ({ default: Component })),
)

const systemModel: SystemModel = {
  nodes: [
    { id: 'svc', label: 'Vista service', level: 'context' },
    { id: 'static', label: 'Static versions', level: 'container', parent: 'svc' },
    { id: 'providers', label: 'Providers', level: 'container', parent: 'svc' },
  ],
  edges: [
    { id: 'e1', source: 'static', target: 'providers', aspect: 'dataflow', label: 'captured data' },
  ],
}
const lenses = [
  {
    id: 'overview',
    aspects: ['dataflow'] as const,
    maxLevel: 'container' as const,
    layout: 'layered-right' as const,
  },
]
const patch = `--- a/src/server.ts\n+++ b/src/server.ts\n@@ -1 +1 @@\n-old\n+new\n`
const entries = [
  { path: 'src/server.ts', status: 'modified' as const },
  { path: 'src/publish.ts', status: 'added' as const },
]

const Runtime = ({ children }: { readonly children: React.ReactNode }) => (
  <Suspense fallback={<div role="status">Loading visualization…</div>}>{children}</Suspense>
)

export default function VistaApp() {
  return (
    <AppRoot
      title="Heavy kit blocks — direct typed components"
      template="architecture-review"
      scope="No renderer model"
    >
      <Section>
        <p>Every heavy component receives ordinary typed props.</p>
      </Section>
      <Section>
        <Evidence id="sx">
          <RuntimeIsland id="sx-runtime">
            <Runtime>
              <SystemExplorer id="sx-view" model={systemModel} lenses={lenses} />
            </Runtime>
          </RuntimeIsland>
        </Evidence>
      </Section>
      <Section>
        <Evidence id="d">
          <RuntimeIsland id="d-runtime">
            <Runtime>
              <Diff id="diff" source={{ _tag: 'patch', patch }} />
            </Runtime>
          </RuntimeIsland>
        </Evidence>
      </Section>
      <Section>
        <Evidence id="ft">
          <RuntimeIsland id="ft-runtime">
            <Runtime>
              <FileTree id="tree" entries={entries} />
            </Runtime>
          </RuntimeIsland>
        </Evidence>
      </Section>
      <Section>
        <Evidence id="gh">
          <PullRequestFiles repo="schickling/dotfiles" pr={2910} />
        </Evidence>
      </Section>
    </AppRoot>
  )
}
