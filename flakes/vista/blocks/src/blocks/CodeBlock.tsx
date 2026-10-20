import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'

/** Source and presentation options for a read-only code snippet. */
export interface CodeBlockProps {
  readonly code: string
  /** Explicit grammar; otherwise inferred from filename. Unlabelled snippets are text. */
  readonly language?: string | undefined
  readonly filename?: string | undefined
  readonly lineNumbers?: boolean | undefined
  readonly wrap?: boolean | undefined
}

const HighlightedCode = React.lazy(() => import('./HighlightedCode.tsx'))

/**
 * One layout contract for the light-DOM loading view and Pierre's shadow DOM.
 * Override Pierre's spacing/scrollbar defaults too: highlighting must change
 * colors, not the available wrapping width or the document height.
 */
export const codeLayoutCSS = (scope: string): string => `
  ${scope} pre {
    margin: 0;
    padding: 12px 48px 12px 0;
    display: block;
    font-family: "SF Mono", Monaco, Consolas, "Ubuntu Mono", "Liberation Mono", "Courier New", monospace;
    font-size: 13px;
    line-height: 20px;
    font-feature-settings: normal;
  }
  ${scope} [data-code] {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    grid-auto-flow: dense;
    padding: 0;
    overflow: auto hidden;
    scrollbar-gutter: auto;
    scrollbar-width: thin;
    tab-size: 2;
    font: inherit;
  }
  ${scope} [data-code]::-webkit-scrollbar { width: 0; height: 6px; }
  ${scope} [data-gutter], ${scope} [data-content] {
    display: grid;
    grid-template-rows: subgrid;
    grid-template-columns: subgrid;
    min-width: 0;
  }
  ${scope} [data-gutter] { grid-column: 1; }
  ${scope} [data-content] { grid-column: 2; }
  ${scope} [data-column-number] {
    box-sizing: content-box;
    padding: 0 1ch 0 2ch;
    border: 0;
    text-align: right;
    user-select: none;
  }
  ${scope} [data-line-number-content] { display: inline-block; min-width: 3ch; }
  ${scope} [data-disable-line-numbers] [data-gutter] { display: none; }
  ${scope} [data-line] {
    display: block;
    padding: 0 1ch;
    min-height: 20px;
    white-space: pre;
  }
  ${scope} [data-overflow="wrap"] [data-line] {
    white-space: pre-wrap;
    word-break: break-word;
  }
`

const fallbackCSS = codeLayoutCSS('[data-vista-code-fallback]')

/** Mirror Pierre's row/subgrid structure, including empty and trailing lines. */
export const CodeFallback = ({ code, lineNumbers = false, wrap = false }: CodeBlockProps) => {
  const lines = code.split(/\r\n|\r|\n/)
  const rows = { gridRow: `span ${lines.length}` }
  return (
    <div data-vista-code-fallback="">
      <style>{fallbackCSS}</style>
      <pre
        data-file=""
        data-disable-line-numbers={lineNumbers ? undefined : ''}
        data-overflow={wrap ? 'wrap' : 'scroll'}
      >
        <code data-code="">
          <div data-gutter="" style={rows} aria-hidden="true">
            {lines.map((_, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- read-only code rows are identified by their line position
              <div key={index} data-column-number="">
                <span data-line-number-content="">{index + 1}</span>
              </div>
            ))}
          </div>
          <div data-content="" style={rows}>
            {lines.map((line, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- read-only code rows are identified by their line position
              <div key={index} data-line="">
                {line}
              </div>
            ))}
          </div>
        </code>
      </pre>
    </div>
  )
}

/** Canonical read-only snippet. The renderer and its grammars load only when used. */
export const CodeBlock = ({
  code,
  language,
  filename,
  lineNumbers = false,
  wrap = false,
}: CodeBlockProps) => {
  const [copy, setCopy] = React.useState<'idle' | 'copied' | 'failed'>('idle')
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }
  return (
    <div {...stylex.props(styles.root)} data-language={language}>
      <button
        type="button"
        {...stylex.props(styles.copy)}
        aria-label={copy === 'copied' ? 'Code copied' : 'Copy code'}
        title={copy === 'copied' ? 'Code copied' : 'Copy code'}
        onClick={copyCode}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {copy === 'copied' ? (
            <path d="m5 12 4 4L19 6" />
          ) : (
            <>
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
            </>
          )}
        </svg>
      </button>
      {copy === 'failed' ? <span role="status">Clipboard unavailable</span> : null}
      <React.Suspense fallback={<CodeFallback code={code} lineNumbers={lineNumbers} wrap={wrap} />}>
        <HighlightedCode
          code={code}
          language={language}
          filename={filename}
          lineNumbers={lineNumbers}
          wrap={wrap}
        />
      </React.Suspense>
    </div>
  )
}

const styles = stylex.create({
  root: {
    position: 'relative',
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-1000'],
  },
  copy: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    display: 'grid',
    placeItems: 'center',
    width: 28,
    height: 28,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: 5,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
  },
})
