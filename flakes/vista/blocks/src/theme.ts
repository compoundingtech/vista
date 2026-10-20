/**
 * Theme threaded through React context rather than read from the DOM
 * (resolves OQ-MERMAID-THEME). A DOM-`data-theme` read is fragile: the attribute
 * is a single global mutated by whoever owns the document root (the shell, a
 * Storybook decorator, a host app), so a diagram can read a stale/foreign value.
 * Context makes the active theme an explicit, local input to each diagram.
 *
 * `AppShell` provides this and mirrors the value onto `data-theme` as semantic
 * state while applying the corresponding StyleX theme classes. The Mermaid
 * block consumes the context value directly and never reads the DOM.
 */
import { createContext, useContext } from 'react'

import type { Theme } from './model.ts'

const ThemeContext = createContext<Theme>('light')

/** Provides the active theme to a Vista component subtree. */
export const ThemeProvider = ThemeContext.Provider

/** The active theme for the subtree. Defaults to `light` outside a provider. */
export const useTheme = (): Theme => useContext(ThemeContext)

/** Resolve the OS color-scheme to a concrete theme (Mermaid needs a concrete
 * value via context, not a DOM read). SSR-safe: defaults to `light`. */
export const getSystemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
