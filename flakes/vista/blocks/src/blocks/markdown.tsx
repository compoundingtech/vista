/**
 * `rich-text` prose renderer: complete GFM document semantics on top of
 * `react-markdown` + `remark-gfm`, styled with StyleX and Geist tokens.
 *
 * Three deliberate properties, all covered by `markdown.test.tsx`:
 * - **No raw HTML.** `rehype-raw` is not used and HTML nodes are folded into
 *   literal text, so authored markup is shown, never interpreted.
 * - **Stable heading anchors.** A local rehype pass assigns GitHub-style slugs
 *   in document order and suffixes duplicates (`-1`, `-2`, …), so deep links
 *   and the shell outline stay stable across renders.
 * - **One semantic `h1` per document.** The AppRoot title owns `h1`, so prose
 *   headings render one level down (`#` → `h2`, capped at `h6`).
 */
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components, ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { CodeBlock } from './CodeBlock.tsx'

/**
 * Structural view of the mdast/hast nodes this module's unified passes walk.
 * Written locally so the block does not depend on the `mdast`/`hast` type
 * packages; `ReadableNode` is the read-only shape shared with the hast
 * `Element` react-markdown hands to components.
 */
interface ReadableNode {
  readonly type: string
  readonly value?: string | undefined
  readonly children?: readonly ReadableNode[] | undefined
}

interface TreeNode extends ReadableNode {
  readonly tagName?: string
  readonly children?: TreeNode[]
  properties?: Record<string, unknown>
}

const isHeadingTag = (tagName: string): boolean => /^h[1-6]$/u.test(tagName)
const SAFE_PROTOCOLS: Record<string, true> = {
  'http:': true,
  'https:': true,
  'mailto:': true,
  'tel:': true,
}

/** Concatenated text content of a node — the heading label and anchor source. */
const textOf = (node: ReadableNode | undefined): string => {
  if (node === undefined) return ''
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

/**
 * GitHub's heading-anchor slug: lowercase, drop punctuation, spaces to dashes.
 * Marks and non-latin letters survive, matching GitHub's `\p{L}\p{N}\p{M}` set.
 */
export const slugifyHeading = (text: string): string => {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\-_ ]+/gu, '')
    .replace(/ /gu, '-')
  return slug === '' ? 'section' : slug
}

/**
 * Assigns unique heading ids in document order and marks fenced-code `code`
 * elements so the renderer can tell them from inline code.
 */
const rehypeVistaProse = () => (tree: unknown) => {
  const used = new Map<string, number>()
  const walk = (node: TreeNode) => {
    for (const child of node.children ?? []) {
      if (child.type === 'element' && child.tagName !== undefined) {
        if (isHeadingTag(child.tagName)) {
          const base = slugifyHeading(textOf(child))
          const seen = used.get(base) ?? 0
          used.set(base, seen + 1)
          child.properties = { ...child.properties, id: seen === 0 ? base : `${base}-${seen}` }
        } else if (child.tagName === 'pre') {
          for (const grandchild of child.children ?? []) {
            if (grandchild.type === 'element' && grandchild.tagName === 'code') {
              grandchild.properties = { ...grandchild.properties, dataVistaCodeBlock: '' }
            }
          }
        }
      }
      walk(child)
    }
  }
  // unified hands transformers its own `Node` type; `TreeNode` is the subset
  // this pass reads, so the shape is narrowed here rather than depended upon.
  walk(tree as TreeNode)
}

/**
 * Folds raw-HTML nodes into literal text so authored markup is displayed
 * instead of being parsed. Block-level HTML becomes its own paragraph.
 */
const remarkHtmlAsText = () => (tree: unknown) => {
  const walk = (node: TreeNode) => {
    const children = node.children
    if (children === undefined) return
    const inline = node.type === 'paragraph' || node.type === 'heading' || node.type === 'emphasis'
    children.forEach((child, index) => {
      if (child.type === 'html') {
        const text: TreeNode = { type: 'text', value: child.value ?? '' }
        children[index] = inline ? text : { type: 'paragraph', children: [text] }
        return
      }
      walk(child)
    })
  }
  walk(tree as TreeNode)
}

/** `undefined` for URLs whose protocol is not on the allow-list. */
const safeUrl = (raw: string | undefined): string | undefined => {
  if (raw === undefined || raw === '') return undefined
  const href = raw.trim()
  if (
    href.startsWith('/') ||
    href.startsWith('#') ||
    href.startsWith('./') ||
    href.startsWith('../')
  )
    return href
  try {
    return SAFE_PROTOCOLS[new URL(href, 'https://vista.invalid').protocol] === true
      ? href
      : undefined
  } catch {
    return undefined
  }
}

type HeadingProps = ComponentPropsWithoutRef<'h2'> & ExtraProps

/**
 * Prose heading: keeps the document's single semantic `h1` on the AppRoot title
 * by shifting markdown depth down one, and carries the DOM metadata the shell
 * outline reads (`data-vista-label`, `data-vista-heading-level`).
 */
const heading = (depth: 1 | 2 | 3 | 4 | 5 | 6) => {
  const level = Math.min(depth + 1, 6)
  const Tag = `h${level}` as 'h2'
  const Heading = ({ node, children }: HeadingProps) => {
    const id = node?.properties?.['id']
    return (
      <Tag
        id={typeof id === 'string' ? id : undefined}
        data-vista-heading=""
        data-vista-heading-level={level}
        data-vista-label={textOf(node)}
      >
        {children}
      </Tag>
    )
  }
  return Heading
}

const components: Components = {
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  h5: heading(5),
  h6: heading(6),
  p: ({ children }) => <p>{children}</p>,
  a: ({ href, children }) => {
    const safe = safeUrl(href)
    if (safe === undefined)
      return (
        <span {...stylex.props(styles.unsafeLink)} data-vista-unsafe-href="">
          {children}
        </span>
      )
    const external = /^[a-z][a-z\d+\-.]*:/iu.test(safe) && !safe.startsWith('mailto:')
    return (
      <a
        {...stylex.props(styles.link)}
        href={safe}
        {...(external ? { rel: 'noreferrer noopener', target: '_blank' } : {})}
      >
        {children}
      </a>
    )
  },
  img: ({ src, alt, title }) => {
    const safe = safeUrl(typeof src === 'string' ? src : undefined)
    if (safe === undefined)
      return (
        <span {...stylex.props(styles.unsafeLink)} data-vista-unsafe-src="">
          {alt ?? ''}
        </span>
      )
    return (
      <img
        {...stylex.props(styles.image)}
        src={safe}
        alt={alt ?? ''}
        title={title}
        loading="lazy"
        decoding="async"
      />
    )
  },
  ul: ({ children, className }) => (
    <ul
      {...stylex.props(styles.list, className === 'contains-task-list' && styles.taskList)}
      data-vista-task-list={className === 'contains-task-list' ? '' : undefined}
    >
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol {...stylex.props(styles.list)} start={start}>
      {children}
    </ol>
  ),
  li: ({ children, className }) => (
    <li {...stylex.props(styles.listItem, className === 'task-list-item' && styles.taskItem)}>
      {children}
    </li>
  ),
  input: ({ checked, type }) =>
    type === 'checkbox' ? (
      <input {...stylex.props(styles.checkbox)} type="checkbox" checked={checked} disabled />
    ) : null,
  blockquote: ({ children }) => (
    <blockquote {...stylex.props(styles.blockquote)}>{children}</blockquote>
  ),
  hr: () => <hr {...stylex.props(styles.rule)} />,
  pre: ({ children }) => <>{children}</>,
  code: ({ node, className, children }) => {
    const isBlock = node?.properties['dataVistaCodeBlock'] !== undefined
    const language = /language-([\w+#.-]+)/u.exec(className ?? '')?.[1]
    return isBlock ? (
      <CodeBlock code={String(children).replace(/\n$/u, '')} language={language} />
    ) : (
      <code {...stylex.props(styles.inlineCode)}>{children}</code>
    )
  },
  table: ({ children }) => (
    <div {...stylex.props(styles.tableScroll)}>
      <table {...stylex.props(styles.table)}>{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th {...stylex.props(styles.tableHeaderCell)} style={style} scope="col">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td {...stylex.props(styles.tableCell)} style={style}>
      {children}
    </td>
  ),
  del: ({ children }) => <del {...stylex.props(styles.strike)}>{children}</del>,
  section: ({ children, className }) =>
    className === 'footnotes' ? (
      <section {...stylex.props(styles.footnotes)} data-footnotes="">
        {children}
      </section>
    ) : (
      <section>{children}</section>
    ),
}

/**
 * A `rich-text` block: GFM prose (headings, lists, task lists, tables, fenced
 * code, blockquotes, rules, strikethrough, footnotes, autolinks).
 */
export const Markdown = ({
  source,
  style,
}: {
  source: string
  style?: StyleXStylesWithout<{ position: 'absolute' }>
}): ReactNode => {
  if (source.trim() === '') {
    return (
      <div {...stylex.props(styles.prose, style)} role="status">
        No prose recorded.
      </div>
    )
  }

  return (
    <div {...stylex.props(styles.prose, style)} data-vista-prose-flow="">
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm, remarkHtmlAsText]}
        rehypePlugins={[rehypeVistaProse]}
        urlTransform={(url) => url}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}

const styles = stylex.create({
  prose: {
    minWidth: 0,
  },
  list: {
    marginInline: 0,
    paddingInlineStart: scale.space5,
  },
  listItem: {
    marginBlock: scale.space1,
  },
  taskList: {
    listStyle: 'none',
    paddingInlineStart: 0,
  },
  taskItem: {
    display: 'flex',
    alignItems: 'baseline',
    gap: scale.space2,
  },
  checkbox: {
    accentColor: tokens['--ds-blue-700'],
    margin: 0,
    flex: '0 0 auto',
  },
  blockquote: {
    marginBlock: scale.space3,
    marginInline: 0,
    paddingBlock: 0,
    paddingInline: scale.space3,
    borderInlineStartWidth: 2,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: tokens['--ds-gray-alpha-400'],
    color: tokens['--ds-gray-900'],
  },
  rule: {
    marginBlock: scale.space5,
    marginInline: 0,
    borderWidth: 0,
    borderBlockStartWidth: 1,
    borderBlockStartStyle: 'solid',
    borderBlockStartColor: tokens['--ds-gray-alpha-400'],
  },
  inlineCode: {
    fontFamily: scale.fontMono,
    // A tinted chip, not a box: at ten-plus identifiers per paragraph, borders
    // and vertical padding shred the line into a ransom note.
    backgroundColor: tokens['--ds-gray-alpha-100'],
    paddingBlock: 0,
    paddingInline: '0.25rem',
    borderRadius: scale.radiusSm,
    fontSize: '0.88em',
    overflowWrap: 'anywhere',
  },
  tableScroll: {
    display: 'block',
    marginBlock: scale.space3,
    maxWidth: '100%',
    overflowX: 'auto',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--ds-gray-alpha-400) transparent',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: '0.88rem',
  },
  tableHeaderCell: {
    textAlign: 'left',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    color: tokens['--ds-gray-800'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
  },
  tableCell: {
    paddingBlock: scale.space2,
    paddingInline: scale.space3,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    verticalAlign: 'top',
  },
  image: {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
    borderRadius: scale.radiusSm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
  },
  strike: {
    color: tokens['--ds-gray-800'],
  },
  footnotes: {
    marginBlockStart: scale.space5,
    paddingBlockStart: scale.space2,
    borderBlockStartWidth: 1,
    borderBlockStartStyle: 'solid',
    borderBlockStartColor: tokens['--ds-gray-alpha-400'],
    fontSize: '0.85rem',
    color: tokens['--ds-gray-900'],
  },
  unsafeLink: {
    color: tokens['--ds-gray-900'],
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textUnderlineOffset: '0.16rem',
  },
  link: {
    color: tokens['--ds-blue-700'],
    borderRadius: scale.radiusSm,
    textUnderlineOffset: '0.16rem',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineStyle: {
      default: 'none',
      ':focus-visible': 'solid',
    },
    outlineWidth: {
      default: '0',
      ':focus-visible': '2px',
    },
    outlineOffset: {
      default: '0',
      ':focus-visible': '2px',
    },
  },
})
