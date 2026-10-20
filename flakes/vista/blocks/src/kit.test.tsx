import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import { AppRoot, Evidence, Section, extractSemanticManifest } from './index.ts'

const LocalCard = ({
  id,
  children,
}: {
  readonly id: string
  readonly children: React.ReactNode
}) => (
  <Evidence id={id}>
    <article>{children}</article>
  </Evidence>
)

const DirectApp = () => (
  <AppRoot
    title="Direct components"
    template="architecture-review"
    scope="Ordinary local components"
  >
    <Section id="body">
      <LocalCard id="local">ordinary typed props</LocalCard>
    </Section>
  </AppRoot>
)

test('app-local components have the same semantic and DOM path as curated components', () => {
  const manifest = extractSemanticManifest(<DirectApp />)
  expect(manifest.nodes.map(({ id }) => id)).toEqual(['app', 'body', 'local'])
  const html = renderToStaticMarkup(<DirectApp />)
  expect(html).toContain('data-vista-id="local"')
  expect(html).toContain('ordinary typed props')
})
