/** Theme utilities for dark/light mode */

import * as stylex from '@stylexjs/stylex'

import { colorScheme, lightTheme } from './themes.ts'

export type Theme = 'light' | 'dark' | 'system'

/**
 * Records the user's *choice*, including `'system'`, which the applied classes
 * cannot express — `'system'` resolves to one of the two concrete schemes.
 *
 * No CSS is attached to this attribute. That matters: an attribute-driven
 * override block sitting alongside the variables' `:root` defaults would put two
 * rules at equal specificity, where source order decides and bundler injection
 * order is not safe to depend on. Presentation comes entirely from the theme
 * class; this is state, not style.
 */
const themeAttribute = 'data-theme'

const darkClassName = stylex.props(colorScheme.dark).className ?? ''
const lightClassName = `${stylex.props(lightTheme).className ?? ''} ${stylex.props(colorScheme.light).className ?? ''}`

const schemeClassNames = { dark: darkClassName, light: lightClassName } as const

/**
 * Class names a server renderer must put on the `<html>` element to render a
 * scheme without a flash of the other one.
 *
 * The scheme used to be expressible as a `data-theme` attribute a server could
 * write directly; now that it is a compiled class, the class name is not
 * something a consumer can spell by hand, so it has to be exported.
 */
export const themeClassName = (scheme: 'light' | 'dark'): string => schemeClassNames[scheme]

const prefersDarkQuery = '(prefers-color-scheme: dark)'

const systemScheme = (): 'light' | 'dark' =>
  typeof window !== 'undefined' && window.matchMedia(prefersDarkQuery).matches ? 'dark' : 'light'

const applyScheme = (scheme: 'light' | 'dark'): void => {
  const root = document.documentElement
  for (const className of [darkClassName, lightClassName].flatMap((names) => names.split(' '))) {
    if (className !== '') root.classList.remove(className)
  }
  for (const className of schemeClassNames[scheme].split(' ')) {
    if (className !== '') root.classList.add(className)
  }
}

/**
 * Live subscription for `'system'`, torn down when the user picks a concrete
 * scheme. Without it `'system'` would mean "whatever the OS preference was at
 * the moment the page loaded", which is not what the option says.
 */
let systemListener: (() => void) | undefined

const unsubscribeFromSystem = (): void => {
  systemListener?.()
  systemListener = undefined
}

const subscribeToSystem = (): void => {
  if (systemListener !== undefined || typeof window === 'undefined') return

  const query = window.matchMedia(prefersDarkQuery)
  const onChange = (): void => applyScheme(systemScheme())
  query.addEventListener('change', onChange)
  systemListener = () => query.removeEventListener('change', onChange)
}

/** Set the theme on the document */
export const setTheme = (theme: Theme): void => {
  if (typeof document === 'undefined') return

  document.documentElement.setAttribute(themeAttribute, theme)

  if (theme === 'system') {
    subscribeToSystem()
    applyScheme(systemScheme())
    return
  }

  unsubscribeFromSystem()
  applyScheme(theme)
}

/** Get the current theme from the document */
export const getTheme = (): Theme => {
  if (typeof document === 'undefined') return 'system'

  const attribute = document.documentElement.getAttribute(themeAttribute)
  if (attribute === 'light' || attribute === 'dark') return attribute
  return 'system'
}

/** Get the resolved theme (accounting for system preference) */
export const getResolvedTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark'

  const theme = getTheme()
  if (theme !== 'system') return theme

  return systemScheme()
}
