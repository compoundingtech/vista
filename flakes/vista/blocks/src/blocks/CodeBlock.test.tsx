import { FileRenderer, getSharedHighlighter } from '@pierre/diffs'
import { File } from '@pierre/diffs/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

import { CodeBlock, CodeFallback, codeLayoutCSS } from './CodeBlock.tsx'
import HighlightedCode from './HighlightedCode.tsx'
import { ensureVistaDiffThemes, VISTA_DIFF_THEMES } from './pierre-theme.ts'

vi.mock('@pierre/diffs/react', () => ({ File: vi.fn(() => null) }))

test('defaults highlight, infer filename, hide line numbers and scroll long lines', () => {
  renderToStaticMarkup(<HighlightedCode code="let ready = true" filename="main.rs" />)
  expect(vi.mocked(File).mock.lastCall?.[0]).toMatchObject({
    file: { name: 'main.rs', contents: 'let ready = true' },
    options: {
      disableFileHeader: true,
      disableLineNumbers: true,
      overflow: 'scroll',
      theme: VISTA_DIFF_THEMES,
    },
  })
  expect(vi.mocked(File).mock.lastCall?.[0].file.lang).toBeUndefined()
})

test('explicit grammar, line numbers and wrapping reach the shared renderer', () => {
  renderToStaticMarkup(<HighlightedCode code="const ready = true" language="ts" lineNumbers wrap />)
  expect(vi.mocked(File).mock.lastCall?.[0]).toMatchObject({
    file: { lang: 'typescript' },
    options: { disableLineNumbers: false, overflow: 'wrap' },
  })
})

test('snippet has an icon-only accessible copy action and safe readable SSR fallback', () => {
  const html = renderToStaticMarkup(
    <CodeBlock code={'<script>alert("x")</script>\nlast line'} language="tsx" />,
  )
  expect(html).toContain('aria-label="Copy code"')
  expect(html).toContain('<svg')
  expect(html).not.toContain('>Copy code<')
  expect(html).toContain('&lt;script&gt;')
  expect(html).toContain('last line')
})

test.each([
  { lineNumbers: false, wrap: false },
  { lineNumbers: true, wrap: false },
  { lineNumbers: false, wrap: true },
  { lineNumbers: true, wrap: true },
])(
  'loading and highlighted snippets share structure and layout CSS: %j',
  async ({ lineNumbers, wrap }) => {
    for (const code of [
      '',
      'const text = "' + 'wrapped text '.repeat(30) + '"\n\n\tlast line\n',
      'one\r\ntwo\rthree',
    ]) {
      const fallback = renderToStaticMarkup(
        <CodeFallback code={code} lineNumbers={lineNumbers} wrap={wrap} />,
      )
      renderToStaticMarkup(
        <HighlightedCode code={code} language="ts" lineNumbers={lineNumbers} wrap={wrap} />,
      )
      const options = vi.mocked(File).mock.lastCall?.[0].options
      expect(options?.unsafeCSS).toContain(codeLayoutCSS(':host'))
      expect(fallback).toContain(`<style>${codeLayoutCSS('[data-vista-code-fallback]')}</style>`)
      // Comparing the actual renderer's rows catches blank/trailing-line and gutter
      // mismatches; shared CSS makes their typography and wrapping identical.
      const renderer = new FileRenderer(options)
      const result = await renderer.asyncRender({
        name: 'snippet.ts',
        contents: code,
        lang: 'typescript',
      })
      const highlighted = renderer.renderFullHTML(result)
      for (const attribute of [
        'data-gutter',
        'data-content',
        'data-column-number',
        'data-line-number-content',
        'data-line',
      ]) {
        const selector = new RegExp(` ${attribute}(?:=|[ >])`, 'g')
        expect(fallback.match(selector)?.length ?? 0).toBe(highlighted.match(selector)?.length ?? 0)
      }
      expect(fallback).toContain(`grid-row:span ${result.rowCount}`)
      expect(fallback.includes('data-disable-line-numbers=""')).toBe(!lineNumbers)
      expect(fallback).toContain(`data-overflow="${wrap ? 'wrap' : 'scroll'}"`)
      renderer.cleanUp()
    }
  },
)

test.each([
  ['kdl', 'mission "release" { step "verify" seat="reviewer" }'],
  ['typescript', 'const ready: boolean = true'],
  ['tsx', 'const node = <h2>Ready</h2>'],
  ['json', '{ "ready": true }'],
  ['nix', '{ pkgs, ... }: { packages = [ pkgs.git ]; }'],
  ['bash', 'echo "ready"'],
  ['rust', 'fn main() { let ready = true; }'],
])('shared renderer produces semantic tokens for %s in both themes', async (lang, code) => {
  ensureVistaDiffThemes()
  const highlighter = await getSharedHighlighter({
    langs: [lang],
    themes: Object.values(VISTA_DIFF_THEMES),
  })
  for (const theme of Object.values(VISTA_DIFF_THEMES)) {
    // Grammar correctness must not depend on the shared host's 500ms tokenize deadline.
    const tokens = highlighter.codeToTokensBase(code, { lang, theme, tokenizeTimeLimit: 0 }).flat()
    expect(tokens.map((token) => token.content).join('')).toBe(code)
    expect(
      new Set(tokens.map((token) => token.color)).size,
      JSON.stringify({ lang, theme, tokens }),
    ).toBeGreaterThan(1)
  }
})
