import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { checkVistaApp } from './preflight.ts'

const roots: string[] = []
const writeApp = (source: string): string => {
  const root = mkdtempSync(join(tmpdir(), 'vista-decision-review-test-'))
  roots.push(root)
  writeFileSync(join(root, 'app.tsx'), source)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const template = `import {
  AppRoot, DecisionCard, MermaidDiagram, decisionVisual, defineDecisions,
} from '@vista/blocks'

const review = defineDecisions([{
  id: 'capacity',
  title: 'Choose capacity',
  situation: 'Demand exceeds the current capacity.',
  visual: decisionVisual(MermaidDiagram, {
    id: 'review-flow',
    source: 'flowchart LR\\n  source[App source] --> check[Local check] --> publish[Publication]',
    caption: 'Authoring flow, not measured data.',
  }),
  options: [
    { label: 'Expand', next: 'Add capacity.', cost: 'Time spent collecting and checking the evidence.' },
    { label: 'Wait', next: 'Keep capacity unchanged.', cost: 'Demand remains unmet.' },
  ],
  recommended: 'Expand',
  why: ['Meet demand.'],
  risk: 'Demand may fall.',
  evidence: <p>Measured demand exceeds capacity.</p>,
  status: 'open',
}])

export default function App() {
  return <AppRoot title="Kit fixture" template="options-comparison" scope="Capacity">
    <review.Overview />
    {review.cards.map((card) => <DecisionCard key={card.id} {...card} />)}
  </AppRoot>
}
`

// Keep each fixture executable TSX: rejection must come from types, not syntax or evaluation.
const violations = [
  [
    'missing cost',
    template.replace("cost: 'Time spent collecting and checking the evidence.'", ''),
  ],
  [
    'handwritten overview',
    template
      .replace('AppRoot, DecisionCard,', 'AppRoot, DecisionOverview, DecisionCard,')
      .replace(
        '<review.Overview />',
        '<DecisionOverview rows={[{ title: "Invented row", recommended: "Go", status: "open" }]} />',
      ),
  ],
  [
    'raw image visual',
    template.replace(
      "visual: decisionVisual(MermaidDiagram, {\n    id: 'review-flow',\n    source: 'flowchart LR\\n  source[App source] --> check[Local check] --> publish[Publication]',\n    caption: 'Authoring flow, not measured data.',\n  })",
      'visual: <img src="./figure.png" alt="Figure" />',
    ),
  ],
] as const

describe('decision-review check admission', () => {
  it('checks a kit-only fixture without owner, service or live state', async () => {
    const root = writeApp(template)
    const previous = {
      ST_AGENT: process.env.ST_AGENT,
      VISTA_URL: process.env.VISTA_URL,
      VISTA_SOURCES: process.env.VISTA_SOURCES,
    }
    delete process.env.ST_AGENT
    delete process.env.VISTA_URL
    delete process.env.VISTA_SOURCES
    try {
      const result = await checkVistaApp(root)
      expect(result).toMatchObject({
        _tag: 'ready',
        title: 'Kit fixture',
        semanticNodes: 4,
        dataRequests: 0,
      })
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })

  it('accepts supported pinned esm.sh imports during source typechecking', async () => {
    // A type-only import exercises module resolution without fetching remote code in this test.
    const root = writeApp(`import type remote from 'https://esm.sh/lodash@4.17.21'\n${template}`)
    expect(await checkVistaApp(root)).toMatchObject({ _tag: 'ready' })
  })

  it.each(violations)(
    'fails vista check for %s with authored line diagnostics',
    async (_label, source) => {
      expect(source).not.toBe(template)
      const root = writeApp(source)
      const result = await checkVistaApp(root)
      expect(result._tag).toBe('failed')
      if (result._tag !== 'failed') return
      expect(result.diagnostic.message).toBe('Vista app source does not typecheck')
      expect(result.diagnostic.consequences.join('\n')).toMatch(/app\.tsx:\d+:\d+: TS\d+/)
      expect(result.diagnostic.consequences.join('\n')).not.toContain('vista-check-')
    },
  )

  it('typechecks the positive and @ts-expect-error negative controls against public exports', async () => {
    const fixture = readFileSync(
      new URL(
        '../../blocks/src/blocks/decision-review/decision-review.type-test.tsx',
        import.meta.url,
      ),
      'utf8',
    )
      .replace("'../MermaidDiagram.tsx'", "'@vista/blocks'")
      .replace("'./DecisionCard.tsx'", "'@vista/blocks'")
      .replace("'./DecisionOverview.tsx'", "'@vista/blocks'")
    const root = writeApp(
      `${fixture}\nimport { AppRoot } from '@vista/blocks'\nexport default function App() { return <AppRoot title="Type controls" template="options-comparison" scope="Types" /> }\n`,
    )
    const result = await checkVistaApp(root)
    expect(result, JSON.stringify(result)).toMatchObject({ _tag: 'ready' })
  })
})
