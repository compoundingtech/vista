/**
 * Snippet component built on React Aria
 *
 * @see https://vercel.com/geist/snippet
 */

import * as stylex from '@stylexjs/stylex'
import * as React from 'react'
import { Button as AriaButton } from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%',
    borderRadius: '0.375rem',
    overflow: 'hidden',
  },
  rootDefault: {
    backgroundColor: tokens['--ds-background-100'],
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
  },
  rootInverted: {
    backgroundColor: tokens['--ds-gray-1000'],
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
  },
  rootSuccess: {
    backgroundColor: tokens['--ds-green-100'],
    boxShadow: `0 0 0 1px ${tokens['--ds-green-400']}`,
  },
  rootWarning: {
    backgroundColor: tokens['--ds-amber-100'],
    boxShadow: `0 0 0 1px ${tokens['--ds-amber-400']}`,
  },
  rootError: {
    backgroundColor: tokens['--ds-red-100'],
    boxShadow: `0 0 0 1px ${tokens['--ds-red-400']}`,
  },
  container: {
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: '0.625rem',
    paddingRight: '3rem',
    paddingBottom: '0.625rem',
    paddingLeft: '0.75rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
  },
  line: {
    overflowX: 'auto',
    whiteSpace: 'nowrap',
  },
  prompt: {
    color: tokens['--ds-gray-900'],
    userSelect: 'none',
  },
  codeDefault: {
    color: tokens['--ds-gray-1000'],
  },
  codeInverted: {
    color: tokens['--ds-background-100'],
  },
  codeSuccess: {
    color: tokens['--ds-green-900'],
  },
  codeWarning: {
    color: tokens['--ds-amber-900'],
  },
  codeError: {
    color: tokens['--ds-red-900'],
  },
  copyButton: {
    position: 'absolute',
    top: '50%',
    right: '0.75rem',
    boxSizing: 'border-box',
    margin: 0,
    padding: '0.25rem',
    transform: 'translateY(-50%)',
    appearance: 'button',
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '0.25rem',
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: 'transparent',
        '@media (hover: hover)': tokens['--ds-gray-alpha-100'],
      },
    },
    color: 'inherit',
    fontFamily: 'inherit',
    fontFeatureSettings: 'inherit',
    fontVariationSettings: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'none',
    opacity: 1,
    cursor: 'pointer',
    outlineWidth: 0,
    outlineStyle: 'none',
    boxShadow: {
      default: null,
      ':focus-visible': `0 0 0 2px ${tokens['--ds-blue-700']}`,
    },
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  copyButtonDefault: {
    color: tokens['--ds-gray-900'],
  },
  copyButtonInverted: {
    color: tokens['--ds-gray-600'],
  },
  copyButtonSuccess: {
    color: tokens['--ds-green-700'],
  },
  copyButtonWarning: {
    color: tokens['--ds-amber-700'],
  },
  copyButtonError: {
    color: tokens['--ds-red-700'],
  },
  copyIcon: {
    width: '0.875rem',
    height: '0.875rem',
  },
})

export type SnippetVariant = 'default' | 'inverted' | 'success' | 'warning' | 'error'

const rootVariantStyles: Record<SnippetVariant, stylex.StyleXStyles> = {
  default: styles.rootDefault,
  inverted: styles.rootInverted,
  success: styles.rootSuccess,
  warning: styles.rootWarning,
  error: styles.rootError,
}

const codeVariantStyles: Record<SnippetVariant, stylex.StyleXStyles> = {
  default: styles.codeDefault,
  inverted: styles.codeInverted,
  success: styles.codeSuccess,
  warning: styles.codeWarning,
  error: styles.codeError,
}

const copyButtonVariantStyles: Record<SnippetVariant, stylex.StyleXStyles> = {
  default: styles.copyButtonDefault,
  inverted: styles.copyButtonInverted,
  success: styles.copyButtonSuccess,
  warning: styles.copyButtonWarning,
  error: styles.copyButtonError,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type SnippetOwnedStyle = OwnedStyle<
  | 'position'
  | 'boxSizing'
  | 'width'
  | 'inlineSize'
  | 'minWidth'
  | 'minInlineSize'
  | 'maxWidth'
  | 'maxInlineSize'
  | 'borderRadius'
  | 'borderStartStartRadius'
  | 'borderStartEndRadius'
  | 'borderEndStartRadius'
  | 'borderEndEndRadius'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderBottomLeftRadius'
  | 'borderBottomRightRadius'
  | 'overflow'
  | 'overflowX'
  | 'overflowY'
  | 'background'
  | 'backgroundColor'
  | 'boxShadow'
>

export interface SnippetProps {
  /** Code text or array of lines */
  text: string | string[]
  /** Visual treatment */
  variant?: SnippetVariant | undefined
  /** Show command prompt symbol */
  prompt?: boolean
  /** Prompt symbol to use */
  promptSymbol?: string
  /** Width of the snippet */
  width?: string | number
  /** Callback when code is copied */
  onCopy?: () => void
  /** Optional class name */
  className?: string
  /** Caller-last root adaptation. Component-owned presentation is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SnippetOwnedStyle>
}

/** Copy icon */
const copyIcon = (
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
const checkIcon = (
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

/** Snippet displays copyable code for the command line */
export const Snippet = ({
  text,
  variant = 'default',
  prompt = true,
  promptSymbol = '$',
  width,
  onCopy,
  className,
  stylexStyle,
}: SnippetProps) => {
  const [copied, setCopied] = React.useState(false)

  const lines = Array.isArray(text) ? text : [text]
  const copyText = lines.join('\n')

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Failed to copy to clipboard')
    }
  }, [copyText, onCopy])

  return (
    <div
      {...styled(
        { className, style: width === undefined ? undefined : { width } },
        styles.root,
        rootVariantStyles[variant],
        stylexStyle,
      )}
    >
      <div {...styled(undefined, styles.container)}>
        {lines.map((line, index) => (
          <div key={index} {...styled(undefined, styles.line)}>
            {prompt && <span {...styled(undefined, styles.prompt)}>{promptSymbol} </span>}
            <span {...styled(undefined, codeVariantStyles[variant])}>{line}</span>
          </div>
        ))}
      </div>
      <AriaButton
        {...styled(undefined, styles.copyButton, copyButtonVariantStyles[variant])}
        onPress={handleCopy}
        aria-label="Copy to clipboard"
      >
        <span {...styled(undefined, styles.copyIcon)}>{copied ? checkIcon : copyIcon}</span>
      </AriaButton>
    </div>
  )
}
