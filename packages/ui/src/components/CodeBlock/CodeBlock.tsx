/**
 * CodeBlock component built on React Aria
 *
 * @see https://vercel.com/geist/code-block
 */

import * as stylex from '@stylexjs/stylex'
import * as React from 'react'
import { Button as AriaButton } from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

/**
 * The copy button's opacity, published by the root and inherited by the button.
 *
 * This replaces `group-hover:opacity-100`: StyleX deliberately has no ancestor
 * selectors, so the root relays its hover state through an unregistered custom
 * property. The variable remains inheriting, and the capability query preserves
 * Tailwind's protection against sticky hover on touch devices.
 */
const COPY_BUTTON_OPACITY = '--code-block-copy-button-opacity'

const styles = stylex.create({
  root: {
    position: 'relative',
    boxSizing: 'border-box',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusLg,
    backgroundColor: tokens['--ds-gray-100'],
    [COPY_BUTTON_OPACITY]: {
      default: '0',
      ':hover': { default: '0', '@media (hover: hover)': '1' },
    },
  },
  header: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInline: scale.space4,
    paddingBlock: scale.space2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-200'],
  },
  filename: {
    color: tokens['--ds-gray-900'],
    fontFamily: scale.fontMono,
    fontSize: '0.75rem',
    lineHeight: '1rem',
    fontWeight: 500,
  },
  language: {
    paddingInline: scale.space2,
    paddingBlock: '0.125rem',
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-gray-alpha-200'],
    color: tokens['--ds-gray-700'],
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  content: {
    overflowX: 'auto',
    padding: scale.space4,
  },
  pre: {
    margin: 0,
    fontFamily: scale.fontMono,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    whiteSpace: 'pre',
  },
  code: {
    display: 'block',
    fontFamily: 'inherit',
  },
  table: {
    display: 'table',
    width: '100%',
  },
  lineContainer: {
    display: 'table-row',
  },
  lineNumber: {
    display: 'table-cell',
    width: '1%',
    paddingRight: scale.space4,
    color: tokens['--ds-gray-600'],
    textAlign: 'right',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    opacity: 0.5,
  },
  lineContent: {
    display: 'table-cell',
    paddingLeft: scale.space4,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens['--ds-gray-alpha-300'],
  },
  highlightedLine: {
    marginInline: '-1rem',
    paddingInline: scale.space4,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens['--ds-blue-700'],
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  copyButton: {
    position: 'absolute',
    top: scale.space2,
    right: scale.space2,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: scale.space8,
    height: scale.space8,
    margin: 0,
    padding: 0,
    appearance: 'button',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '0.375rem',
    backgroundColor: {
      default: tokens['--ds-gray-200'],
      ':hover': {
        default: tokens['--ds-gray-200'],
        '@media (hover: hover)': tokens['--ds-gray-300'],
      },
    },
    color: tokens['--ds-gray-700'],
    opacity: `var(${COPY_BUTTON_OPACITY}, 0)`,
    outlineWidth: 0,
    outlineStyle: 'none',
    boxShadow: {
      default: null,
      ':focus-visible': `0 0 0 2px ${tokens['--ds-focus-color']}`,
    },
    transitionProperty: 'opacity',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  copyButtonWithHeader: {
    top: scale.space12,
  },
  copyButtonVisible: {
    opacity: 1,
  },
  copyIcon: {
    width: scale.space4,
    height: scale.space4,
  },

  tokenKeyword: { color: tokens['--ds-blue-700'] },
  tokenString: { color: tokens['--ds-green-700'] },
  tokenNumber: { color: tokens['--ds-blue-700'] },
  tokenComment: { color: tokens['--ds-gray-600'], fontStyle: 'italic' },
  tokenFunction: { color: tokens['--ds-purple-700'] },
  tokenOperator: { color: tokens['--ds-gray-900'] },
  tokenPunctuation: { color: tokens['--ds-gray-800'] },
  tokenProperty: { color: tokens['--ds-teal-700'] },
  tokenClassName: { color: tokens['--ds-amber-700'] },
  tokenTag: { color: tokens['--ds-red-700'] },
  tokenAttribute: { color: tokens['--ds-teal-700'] },
  tokenRegex: { color: tokens['--ds-pink-700'] },
  tokenVariable: { color: tokens['--ds-gray-1000'] },
})

/** Supported languages for syntax highlighting */
export type Language =
  | 'javascript'
  | 'typescript'
  | 'jsx'
  | 'tsx'
  | 'html'
  | 'css'
  | 'json'
  | 'bash'
  | 'shell'
  | 'python'
  | 'go'
  | 'rust'
  | 'sql'
  | 'markdown'
  | 'yaml'
  | 'text'

/** Token type for syntax highlighting */
type TokenType =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'function'
  | 'operator'
  | 'punctuation'
  | 'property'
  | 'className'
  | 'tag'
  | 'attribute'
  | 'regex'
  | 'variable'
  | 'text'

interface Token {
  type: TokenType
  value: string
}

/** Token patterns for different languages */
const tokenPatterns: Record<string, Array<{ type: TokenType; pattern: RegExp }>> = {
  javascript: [
    { type: 'comment', pattern: /\/\/.*$|\/\*[\s\S]*?\*\//gm },
    { type: 'string', pattern: /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g },
    { type: 'regex', pattern: /(?![*/])\/(?:\[(?:[^\]\\]|\\.)*\]|[^/\\\n]|\\.)+\/[gimsuy]*/g },
    {
      type: 'number',
      pattern: /\b(?:0x[\da-f]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/gi,
    },
    {
      type: 'keyword',
      pattern:
        /\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/g,
    },
    { type: 'function', pattern: /\b(?!\d)[\w$]+(?=\s*\()/g },
    { type: 'className', pattern: /\b[A-Z][\w$]*\b/g },
    { type: 'operator', pattern: /[+\-*/%=!<>&|^~?:]+|\.{3}/g },
    { type: 'punctuation', pattern: /[{}[\]();,.]/g },
  ],
  typescript: [
    { type: 'comment', pattern: /\/\/.*$|\/\*[\s\S]*?\*\//gm },
    { type: 'string', pattern: /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g },
    {
      type: 'number',
      pattern: /\b(?:0x[\da-f]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/gi,
    },
    {
      type: 'keyword',
      pattern:
        /\b(?:abstract|any|as|asserts|async|await|boolean|break|case|catch|class|const|constructor|continue|debugger|declare|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|infer|instanceof|interface|is|keyof|let|module|namespace|never|new|null|number|object|of|package|private|protected|public|readonly|return|require|set|static|string|super|switch|symbol|this|throw|true|try|type|typeof|undefined|unique|unknown|var|void|while|with|yield)\b/g,
    },
    { type: 'function', pattern: /\b(?!\d)[\w$]+(?=\s*[<(])/g },
    { type: 'className', pattern: /\b[A-Z][\w$]*\b/g },
    { type: 'operator', pattern: /[+\-*/%=!<>&|^~?:]+|\.{3}/g },
    { type: 'punctuation', pattern: /[{}[\]();,.<>]/g },
  ],
  html: [
    { type: 'comment', pattern: /<!--[\s\S]*?-->/g },
    { type: 'tag', pattern: /<\/?[\w-]+/g },
    { type: 'attribute', pattern: /\b[\w-]+(?==)/g },
    { type: 'string', pattern: /(['"])(?:(?!\1)[^\\]|\\.)*\1/g },
    { type: 'punctuation', pattern: /[<>/=]/g },
  ],
  css: [
    { type: 'comment', pattern: /\/\*[\s\S]*?\*\//g },
    { type: 'string', pattern: /(['"])(?:(?!\1)[^\\]|\\.)*\1/g },
    { type: 'property', pattern: /[\w-]+(?=\s*:)/g },
    {
      type: 'number',
      pattern: /#[\da-f]{3,8}\b|\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|deg|s|ms)?\b/gi,
    },
    { type: 'className', pattern: /\.[\w-]+/g },
    { type: 'keyword', pattern: /@[\w-]+\b/g },
    { type: 'punctuation', pattern: /[{}:;,()]/g },
  ],
  json: [
    { type: 'property', pattern: /"(?:[^"\\]|\\.)*"(?=\s*:)/g },
    { type: 'string', pattern: /"(?:[^"\\]|\\.)*"/g },
    { type: 'number', pattern: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi },
    { type: 'keyword', pattern: /\b(?:true|false|null)\b/g },
    { type: 'punctuation', pattern: /[{}[\]:,]/g },
  ],
  bash: [
    { type: 'comment', pattern: /#.*/g },
    { type: 'string', pattern: /(['"])(?:(?!\1)[^\\]|\\.)*\1/g },
    { type: 'variable', pattern: /\$[\w]+|\$\{[^}]+\}/g },
    {
      type: 'keyword',
      pattern:
        /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|in|select|until|return|exit|break|continue|export|source|alias|unalias|readonly|declare|local|typeset)\b/g,
    },
    {
      type: 'function',
      pattern:
        /\b(?:echo|cd|ls|pwd|mkdir|rm|cp|mv|cat|grep|find|sed|awk|sort|head|tail|wc|chmod|chown|sudo|apt|npm|yarn|pnpm|bun|git|docker|curl|wget)\b/g,
    },
    { type: 'operator', pattern: /[|&;><]+/g },
  ],
  python: [
    { type: 'comment', pattern: /#.*/g },
    { type: 'string', pattern: /(['"])(?:(?!\1)[^\\]|\\.)*\1|"""[\s\S]*?"""|'''[\s\S]*?'''/g },
    {
      type: 'number',
      pattern: /\b(?:0x[\da-f]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?j?)\b/gi,
    },
    {
      type: 'keyword',
      pattern:
        /\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|True|False|None)\b/g,
    },
    { type: 'function', pattern: /\b(?!\d)[\w]+(?=\s*\()/g },
    { type: 'className', pattern: /\b[A-Z][\w]*\b/g },
    { type: 'operator', pattern: /[+\-*/%=!<>&|^~@]+/g },
    { type: 'punctuation', pattern: /[{}[\]();:,.]/g },
  ],
  go: [
    { type: 'comment', pattern: /\/\/.*$|\/\*[\s\S]*?\*\//gm },
    { type: 'string', pattern: /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g },
    {
      type: 'number',
      pattern: /\b(?:0x[\da-f]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?i?)\b/gi,
    },
    {
      type: 'keyword',
      pattern:
        /\b(?:break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/g,
    },
    { type: 'function', pattern: /\b(?!\d)[\w]+(?=\s*\()/g },
    { type: 'className', pattern: /\b[A-Z][\w]*\b/g },
    { type: 'operator', pattern: /[+\-*/%=!<>&|^~:]+/g },
    { type: 'punctuation', pattern: /[{}[\]();,.]/g },
  ],
  rust: [
    { type: 'comment', pattern: /\/\/.*$|\/\*[\s\S]*?\*\//gm },
    { type: 'string', pattern: /(['"])(?:(?!\1)[^\\]|\\.)*\1|r#*"[\s\S]*?"#*/g },
    {
      type: 'number',
      pattern:
        /\b(?:0x[\da-f_]+|0b[01_]+|0o[0-7_]+|\d[\d_]*(?:\.[\d_]+)?(?:e[+-]?[\d_]+)?(?:f32|f64|i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize)?)\b/gi,
    },
    {
      type: 'keyword',
      pattern:
        /\b(?:as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while)\b/g,
    },
    { type: 'function', pattern: /\b(?!\d)[\w]+(?=\s*[!<(])/g },
    { type: 'className', pattern: /\b[A-Z][\w]*\b/g },
    { type: 'operator', pattern: /[+\-*/%=!<>&|^~?:]+|\.{2,3}/g },
    { type: 'punctuation', pattern: /[{}[\]();,.<>]/g },
  ],
  sql: [
    { type: 'comment', pattern: /--.*$|\/\*[\s\S]*?\*\//gm },
    { type: 'string', pattern: /(['"])(?:(?!\1)[^\\]|\\.)*\1/g },
    { type: 'number', pattern: /\b\d+(?:\.\d+)?\b/g },
    {
      type: 'keyword',
      pattern:
        /\b(?:SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|DATABASE|SCHEMA|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|CHECK|DEFAULT|CONSTRAINT|CASCADE|UNION|ALL|DISTINCT|BETWEEN|LIKE|EXISTS|CASE|WHEN|THEN|ELSE|END|ASC|DESC|COUNT|SUM|AVG|MIN|MAX|COALESCE|NULLIF|CAST)\b/gi,
    },
    { type: 'function', pattern: /\b(?!\d)[\w]+(?=\s*\()/g },
    { type: 'operator', pattern: /[+\-*/%=!<>&|]+/g },
    { type: 'punctuation', pattern: /[();,.]/g },
  ],
  yaml: [
    { type: 'comment', pattern: /#.*/g },
    { type: 'property', pattern: /^[\w-]+(?=\s*:)/gm },
    { type: 'string', pattern: /(['"])(?:(?!\1)[^\\]|\\.)*\1/g },
    { type: 'number', pattern: /\b\d+(?:\.\d+)?\b/g },
    { type: 'keyword', pattern: /\b(?:true|false|null|yes|no|on|off)\b/gi },
    { type: 'punctuation', pattern: /[:\-[\]{}|>]/g },
  ],
  markdown: [
    { type: 'keyword', pattern: /^#{1,6}\s.*/gm },
    { type: 'string', pattern: /\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|`[^`]+`/g },
    { type: 'tag', pattern: /^\s*[-*+]\s/gm },
    { type: 'number', pattern: /^\s*\d+\.\s/gm },
    { type: 'property', pattern: /\[[^\]]+\]\([^)]+\)/g },
  ],
}

/** Tokenize code based on language */
const tokenize = (code: string, language: Language): Token[][] => {
  const lines = code.split('\n')
  const patterns = tokenPatterns[language] ?? tokenPatterns.javascript ?? []

  return lines.map((line) => {
    if (patterns.length === 0) {
      return [{ type: 'text' as TokenType, value: line }]
    }

    const tokens: Array<{ start: number; end: number; type: TokenType; value: string }> = []

    /* Find all matches for each pattern */
    for (const { type, pattern } of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags)
      let match: RegExpExecArray | null

      while ((match = regex.exec(line)) !== null) {
        tokens.push({
          start: match.index,
          end: match.index + match[0].length,
          type,
          value: match[0],
        })
      }
    }

    /* Sort by start position */
    tokens.sort((a, b) => a.start - b.start)

    /* Remove overlapping tokens (keep first match) */
    const nonOverlapping: typeof tokens = []
    let lastEnd = 0

    for (const token of tokens) {
      if (token.start >= lastEnd) {
        /* Add text before this token */
        if (token.start > lastEnd) {
          nonOverlapping.push({
            start: lastEnd,
            end: token.start,
            type: 'text',
            value: line.slice(lastEnd, token.start),
          })
        }
        nonOverlapping.push(token)
        lastEnd = token.end
      }
    }

    /* Add remaining text */
    if (lastEnd < line.length) {
      nonOverlapping.push({
        start: lastEnd,
        end: line.length,
        type: 'text',
        value: line.slice(lastEnd),
      })
    }

    /* Handle empty line */
    if (nonOverlapping.length === 0) {
      return [{ type: 'text' as TokenType, value: '' }]
    }

    return nonOverlapping.map(({ type, value }) => ({ type, value }))
  })
}

/** Copy icon */
const CopyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
)

/** Check icon for copied state */
const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const TOKEN_CLASS_NAME_BY_TYPE: Record<TokenType, string> = {
  keyword: stylex.props(styles.tokenKeyword).className ?? '',
  string: stylex.props(styles.tokenString).className ?? '',
  number: stylex.props(styles.tokenNumber).className ?? '',
  comment: stylex.props(styles.tokenComment).className ?? '',
  function: stylex.props(styles.tokenFunction).className ?? '',
  operator: stylex.props(styles.tokenOperator).className ?? '',
  punctuation: stylex.props(styles.tokenPunctuation).className ?? '',
  property: stylex.props(styles.tokenProperty).className ?? '',
  className: stylex.props(styles.tokenClassName).className ?? '',
  tag: stylex.props(styles.tokenTag).className ?? '',
  attribute: stylex.props(styles.tokenAttribute).className ?? '',
  regex: stylex.props(styles.tokenRegex).className ?? '',
  variable: stylex.props(styles.tokenVariable).className ?? '',
  text: '',
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type CodeBlockOwnedStyle = OwnedStyle<
  | 'position'
  | 'boxSizing'
  | 'overflow'
  | 'overflowX'
  | 'overflowY'
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderRadius'
  | 'background'
  | 'backgroundColor'
>

export interface CodeBlockProps {
  /** Code to display */
  code: string
  /** Programming language for syntax highlighting */
  language?: Language
  /** File name to display in header */
  filename?: string
  /** Show line numbers */
  showLineNumbers?: boolean
  /** Lines to highlight (1-indexed) */
  highlightLines?: number[]
  /** Show copy button */
  showCopyButton?: boolean
  /** Starting line number (for displaying excerpts) */
  startingLineNumber?: number
  /** Callback when code is copied */
  onCopy?: () => void
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned presentation is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<CodeBlockOwnedStyle>
}

/** Code display with syntax highlighting */
export const CodeBlock = ({
  code,
  language = 'text',
  filename,
  showLineNumbers = false,
  highlightLines = [],
  showCopyButton = true,
  startingLineNumber = 1,
  onCopy,
  className,
  stylexStyle,
}: CodeBlockProps) => {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Failed to copy to clipboard')
    }
  }, [code, onCopy])

  const tokenizedLines = React.useMemo(() => tokenize(code, language), [code, language])

  const highlightSet = React.useMemo(() => new Set(highlightLines), [highlightLines])

  const hasHeader = filename !== undefined

  return (
    <div {...styled(className, styles.root, stylexStyle)}>
      {hasHeader && (
        <div {...styled(undefined, styles.header)}>
          <span {...styled(undefined, styles.filename)}>{filename}</span>
          {language !== 'text' && <span {...styled(undefined, styles.language)}>{language}</span>}
        </div>
      )}
      <div {...styled(undefined, styles.content)}>
        <pre {...styled(undefined, styles.pre)}>
          <code {...styled(undefined, styles.code)}>
            {showLineNumbers ? (
              <div {...styled(undefined, styles.table)}>
                {tokenizedLines.map((tokens, lineIndex) => {
                  const lineNumber = startingLineNumber + lineIndex
                  const isHighlighted = highlightSet.has(lineNumber)

                  return (
                    <div
                      key={lineIndex}
                      {...styled(
                        undefined,
                        styles.lineContainer,
                        isHighlighted && styles.highlightedLine,
                      )}
                    >
                      <span {...styled(undefined, styles.lineNumber)}>{lineNumber}</span>
                      <span {...styled(undefined, styles.lineContent)}>
                        {tokens.map((token, tokenIndex) => (
                          <span key={tokenIndex} className={TOKEN_CLASS_NAME_BY_TYPE[token.type]}>
                            {token.value}
                          </span>
                        ))}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              tokenizedLines.map((tokens, lineIndex) => {
                const lineNumber = startingLineNumber + lineIndex
                const isHighlighted = highlightSet.has(lineNumber)

                return (
                  <div
                    key={lineIndex}
                    {...styled(undefined, isHighlighted && styles.highlightedLine)}
                  >
                    {tokens.map((token, tokenIndex) => (
                      <span key={tokenIndex} className={TOKEN_CLASS_NAME_BY_TYPE[token.type]}>
                        {token.value}
                      </span>
                    ))}
                    {'\n'}
                  </div>
                )
              })
            )}
          </code>
        </pre>
      </div>
      {showCopyButton && (
        <AriaButton
          {...styled(
            undefined,
            styles.copyButton,
            hasHeader ? styles.copyButtonWithHeader : copied ? styles.copyButtonVisible : undefined,
          )}
          onPress={handleCopy}
          aria-label="Copy code to clipboard"
        >
          <span {...styled(undefined, styles.copyIcon)}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </span>
        </AriaButton>
      )}
    </div>
  )
}
