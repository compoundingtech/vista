/**
 * Design foundations - theme utilities and scheme variation.
 *
 * The StyleX variables themselves are deliberately NOT re-exported here. The
 * compiler only treats an import as a variable reference when the specifier
 * literally contains `.stylex`, so a barrel re-export can never work — import
 * `@vista/ui/tokens.stylex` directly.
 */

export * from './theme.ts'
export * from './themes.ts'
