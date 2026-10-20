import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { Markdown, slugifyHeading } from './markdown.tsx'

const render = (source: string) => renderToStaticMarkup(<Markdown source={source} />)

describe('GFM grammar families', () => {
  test('headings render one level below the document h1 and carry outline metadata', () => {
    const html = render('# Top\n\n## Nested\n\n###### Deepest\n')
    expect(html).toContain('<h2')
    expect(html).not.toContain('<h1')
    expect(html).toContain('<h3')
    // depth 6 stays h6 rather than overflowing past the heading range
    expect(html.match(/<h6/gu)).toHaveLength(1)
    expect(html).toContain('data-vista-heading-level="2"')
    expect(html).toContain('data-vista-label="Nested"')
    expect(html).toContain('data-vista-prose-flow=""')
  })

  test('emphasis, strikethrough, inline code and autolinks', () => {
    const html = render('**bold** _soft_ ~~gone~~ `tok` https://example.com/x\n')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>soft</em>')
    expect(html).toContain('gone</del>')
    expect(html).toContain('>tok</code>')
    expect(html).toContain('href="https://example.com/x"')
  })

  test('fenced code keeps its language and is distinguished from inline code', () => {
    const html = render('`inline`\n\n```ts\nconst a: number = 1\n```\n')
    expect(html).toContain('<pre')
    expect(html).toContain('data-language="ts"')
    expect(html).toContain('const a: number = 1')
    // the inline token is not promoted to a block
    expect(html.match(/<pre/gu)).toHaveLength(1)
  })

  test('tables render header scope and honour column alignment', () => {
    const html = render('| a | b |\n| :- | --: |\n| 1 | 2 |\n')
    expect(html).toContain('<table')
    expect(html).toContain('scope="col"')
    expect(html).toContain('text-align:right')
    expect(html).toContain('<td')
  })

  test('nested and ordered lists keep their structure and start offset', () => {
    const html = render('- one\n  - deep\n\n3. three\n4. four\n')
    expect(html).toContain('<ul')
    expect(html).toMatch(/<ol[^>]*start="3"/u)
    // the nested list lives inside a list item, not as a sibling
    expect(html).toMatch(/<li[^>]*>one\s*<ul/u)
  })

  test('task lists render disabled checkboxes reflecting their state', () => {
    const html = render('- [x] done\n- [ ] pending\n')
    expect(html).toContain('data-vista-task-list=""')
    expect(html.match(/type="checkbox"/gu)).toHaveLength(2)
    expect(html.match(/disabled/gu)).toHaveLength(2)
    expect(html.match(/checked/gu)).toHaveLength(1)
  })

  test('blockquotes and thematic breaks render as their own elements', () => {
    const html = render('> quoted line\n\n---\n\nafter\n')
    expect(html).toContain('<blockquote')
    expect(html).toContain('quoted line')
    expect(html).toContain('<hr')
  })

  test('footnotes render a marked footnote section with its back-reference', () => {
    const html = render('claim[^1]\n\n[^1]: because.\n')
    expect(html).toContain('data-footnotes=""')
    expect(html).toContain('href="#user-content-fn-1"')
    expect(html).toContain('because.')
    // react-markdown internals never leak onto the DOM node
    expect(html).not.toContain('node="')
  })

  test('empty source reports the empty state instead of blank prose', () => {
    const html = render('   \n')
    expect(html).toContain('role="status"')
    expect(html).toContain('No prose recorded.')
  })
})

describe('heading anchors', () => {
  test('slugs are GitHub-style: lowercased, punctuation-stripped, dash-joined', () => {
    expect(slugifyHeading('Set the *process* group!')).toBe('set-the-process-group')
    expect(slugifyHeading('  Spaced   Out  ')).toBe('spaced---out')
    expect(slugifyHeading('***')).toBe('section')
  })

  test('duplicate headings get deterministic numeric suffixes in document order', () => {
    const html = render('## Risks\n\n### Risks\n\n## Risks\n')
    expect(html.match(/id="risks[^"]*"/gu)).toEqual(['id="risks"', 'id="risks-1"', 'id="risks-2"'])
  })
})

describe('untrusted input', () => {
  test('javascript and data URLs are inert, keeping only the link text', () => {
    const html = render('[click](javascript:alert(1)) and ![x](data:text/html;base64,AAA)\n')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('data:text/html')
    expect(html).toContain('data-vista-unsafe-href=""')
    expect(html).toContain('data-vista-unsafe-src=""')
    expect(html).toContain('click')
  })

  test('safe links keep their href; external links opt out of referrer leakage', () => {
    const html = render('[in](#anchor) [out](https://example.com)\n')
    expect(html).toContain('href="#anchor"')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('rel="noreferrer noopener"')
    // internal anchors are not turned into new-tab links
    expect(html.match(/target="_blank"/gu)).toHaveLength(1)
  })

  test('raw HTML is shown as literal text, never interpreted', () => {
    const html = render('<script>alert(1)</script>\n\nmixed <b>bold</b> tag\n')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('mixed')
  })
})

describe('paragraph folding', () => {
  test('hard-wrapped lines fold into one paragraph without forced breaks', () => {
    const html = render('one wrapped\nsentence across\nthree lines\n\nsecond para\n')
    expect(html.match(/<p/gu)).toHaveLength(2)
    expect(html).not.toContain('<br')
    expect(html).toMatch(/one wrapped\ssentence across\sthree lines/u)
  })

  test('an explicit trailing backslash-free double space still yields a break element', () => {
    const html = render('line one  \nline two\n')
    expect(html).toContain('<br')
    expect(html.match(/<p/gu)).toHaveLength(1)
  })
})
