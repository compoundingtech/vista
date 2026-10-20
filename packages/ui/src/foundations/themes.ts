/**
 * Colour-scheme variation.
 *
 * Dark is the baseline declared by `./tokens.stylex.ts`; light is this partial
 * override, applied as a class on the root element. `createTheme` is the single
 * mechanism for every scheme-varying token regardless of property type, which is
 * a deliberate divergence from both StyleX's and Adobe's advice to use
 * `light-dark()`. That function resolves to a *colour* only, and three of the
 * tokens below are shadows; the compiler emits `light-dark()` on a non-colour
 * property without complaint and the browser then rejects it, so the failure
 * would be invisible until someone looked at a rendered shadow.
 *
 * The override wins on specificity, not source order: the theme emits
 * `.<hash>, .<hash>:root`, whose second arm scores (0,2,0) against the
 * variables' (0,1,0) `:root` default.
 */

import * as stylex from '@stylexjs/stylex'

import { tokens } from './tokens.stylex.ts'

/**
 * The 26 tokens that vary by scheme. Everything not listed here — the chromatic
 * ramps — is scheme-invariant in this design system and inherits from the dark
 * baseline unchanged.
 *
 * `--ds-focus-ring` is byte-identical to the baseline definition and is repeated
 * only because the source stylesheet repeated it; its two nested references
 * re-resolve inside the theme scope either way.
 */
export const lightTheme = stylex.createTheme(tokens, {
  /* Backgrounds */
  '--ds-background-100': 'hsl(0 0% 100%)',
  '--ds-background-200': 'hsl(0 0% 98%)',

  /* Gray scale (inverted) */
  '--ds-gray-100': 'hsl(0 0% 95%)',
  '--ds-gray-200': 'hsl(0 0% 92%)',
  '--ds-gray-300': 'hsl(0 0% 90%)',
  '--ds-gray-400': 'hsl(0 0% 87%)',
  '--ds-gray-500': 'hsl(0 0% 78%)',
  '--ds-gray-600': 'hsl(0 0% 56%)',
  '--ds-gray-700': 'hsl(0 0% 52%)',
  '--ds-gray-800': 'hsl(0 0% 49%)',
  '--ds-gray-900': 'hsl(0 0% 40%)',
  '--ds-gray-1000': 'hsl(0 0% 9%)',

  /* Gray alpha */
  '--ds-gray-alpha-100': 'hsl(0 0% 0% / 0.05)',
  '--ds-gray-alpha-200': 'hsl(0 0% 0% / 0.07)',
  '--ds-gray-alpha-300': 'hsl(0 0% 0% / 0.1)',
  '--ds-gray-alpha-400': 'hsl(0 0% 0% / 0.13)',
  '--ds-gray-alpha-500': 'hsl(0 0% 0% / 0.22)',
  '--ds-gray-alpha-600': 'hsl(0 0% 0% / 0.44)',
  '--ds-gray-alpha-700': 'hsl(0 0% 0% / 0.48)',
  '--ds-gray-alpha-800': 'hsl(0 0% 0% / 0.51)',
  '--ds-gray-alpha-900': 'hsl(0 0% 0% / 0.6)',
  '--ds-gray-alpha-1000': 'hsl(0 0% 0% / 0.91)',

  /* Shadows - light mode */
  '--ds-shadow-border': '0 0 0 1px hsl(0 0% 0% / 0.08), 0 0 0 1px hsl(0 0% 100%)',
  '--ds-shadow-small': '0px 1px 2px hsl(0 0% 0% / 0.06)',
  '--ds-shadow-medium': '0px 2px 2px hsl(0 0% 0% / 0.04), 0px 8px 8px -8px hsl(0 0% 0% / 0.06)',

  /* Focus */
  '--ds-focus-ring': '0 0 0 2px var(--ds-background-100), 0 0 0 4px var(--ds-focus-color)',
})

/**
 * `color-scheme` cannot ride along in the token layer. Declaring it inside
 * `defineVars` emits a *custom property* of that name rather than the CSS
 * property, so it needs its own style applied to the root element alongside the
 * theme class — see `./theme.ts`.
 */
export const colorScheme = stylex.create({
  light: { colorScheme: 'light' },
  dark: { colorScheme: 'dark' },
})
