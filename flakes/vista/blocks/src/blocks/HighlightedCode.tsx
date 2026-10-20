import { File } from '@pierre/diffs/react'
import * as React from 'react'

import { useTheme } from '../theme.ts'
import { codeLayoutCSS, type CodeBlockProps } from './CodeBlock.tsx'
import { ensureVistaDiffThemes, VISTA_DIFF_THEMES, VISTA_DIFF_UNSAFE_CSS } from './pierre-theme.ts'

const aliases: Readonly<Record<string, string>> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  rs: 'rust',
  plain: 'text',
  plaintext: 'text',
}

/** Pierre shares its Shiki instance with diff/inspector and loads grammars on demand. */
const HighlightedCode = React.memo(function HighlightedCode({
  code,
  language,
  filename,
  lineNumbers,
  wrap,
}: CodeBlockProps) {
  const theme = useTheme()
  ensureVistaDiffThemes()
  return (
    <File
      file={{
        name: filename ?? 'snippet.txt',
        contents: code,
        ...(language === undefined ? {} : { lang: aliases[language] ?? language }),
      }}
      options={{
        theme: VISTA_DIFF_THEMES,
        themeType: theme,
        unsafeCSS: `${VISTA_DIFF_UNSAFE_CSS}\n${codeLayoutCSS(':host')}`,
        disableFileHeader: true,
        disableLineNumbers: !lineNumbers,
        overflow: wrap ? 'wrap' : 'scroll',
      }}
      disableWorkerPool
    />
  )
})

export default HighlightedCode
