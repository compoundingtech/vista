/**
 * Design-system tokens as StyleX variables.
 *
 * Every key is a **literal** custom-property name rather than an identifier the
 * compiler is free to hash. Verified against the compiler: a literal key emits
 * the property byte-identically and evaluates to `var(<name>)` in JavaScript,
 * while a camel-cased key next to it hashes. The names are public API outside
 * StyleX — `./document.css` paints the page with `var(--ds-background)` and
 * `var(--ds-foreground)` without a compiler, and downstream code reads them the
 * same way — so they stay literal until the deferred `--ds-*` rename
 * decides what replaces them. A constant is not an option for the same reason:
 * `defineConsts` emits no CSS at all, so nothing outside StyleX could reference
 * it.
 *
 * The semantic aliases below (`--ds-foreground`, `--ds-border`,
 * `--ds-focus-color`, …) point at the ramps through `var()` strings, not typed
 * `tokens[...]` references. StyleX 0.19 rejects a reference into the group being
 * defined ("Only static values are allowed inside of a defineVars() call"), and
 * the only typed alternative — moving the ramps or the aliases into a second
 * group — changes which export owns each key. Consumers read both tiers from
 * `tokens` and override both in a single `createTheme(tokens, …)`, so that split
 * belongs to the rename, which reshapes the export anyway.
 *
 * The baseline is **dark**. Light is a partial override applied as a theme class
 * — see `./themes.ts`. Only 26 of these 102 tokens vary by scheme: the two
 * backgrounds, the neutral and neutral-alpha ramps, the three shadows and the
 * focus ring. The chromatic ramps are scheme-invariant in this package, which
 * makes the set of scheme-varying names small and enumerable rather than
 * "all colours".
 */

import * as stylex from '@stylexjs/stylex'

/** Semantic design-system tokens. Dark is the baseline; see `./themes.ts`. */
export const tokens = stylex.defineVars({
  /* Backgrounds */
  '--ds-background-100': 'hsl(0 0% 4%)',
  '--ds-background-200': 'hsl(0 0% 0%)',

  /* Gray scale */
  '--ds-gray-100': 'hsl(0 0% 10%)',
  '--ds-gray-200': 'hsl(0 0% 12%)',
  '--ds-gray-300': 'hsl(0 0% 16%)',
  '--ds-gray-400': 'hsl(0 0% 18%)',
  '--ds-gray-500': 'hsl(0 0% 27%)',
  '--ds-gray-600': 'hsl(0 0% 53%)',
  '--ds-gray-700': 'hsl(0 0% 56%)',
  '--ds-gray-800': 'hsl(0 0% 49%)',
  '--ds-gray-900': 'hsl(0 0% 63%)',
  '--ds-gray-1000': 'hsl(0 0% 93%)',

  /* Gray alpha */
  '--ds-gray-alpha-100': 'hsl(0 0% 100% / 0.06)',
  '--ds-gray-alpha-200': 'hsl(0 0% 100% / 0.09)',
  '--ds-gray-alpha-300': 'hsl(0 0% 100% / 0.13)',
  '--ds-gray-alpha-400': 'hsl(0 0% 100% / 0.14)',
  '--ds-gray-alpha-500': 'hsl(0 0% 100% / 0.24)',
  '--ds-gray-alpha-600': 'hsl(0 0% 100% / 0.51)',
  '--ds-gray-alpha-700': 'hsl(0 0% 100% / 0.54)',
  '--ds-gray-alpha-800': 'hsl(0 0% 100% / 0.47)',
  '--ds-gray-alpha-900': 'hsl(0 0% 100% / 0.61)',
  '--ds-gray-alpha-1000': 'hsl(0 0% 100% / 0.92)',

  /* Blue scale */
  '--ds-blue-100': 'hsl(216 50% 12%)',
  '--ds-blue-200': 'hsl(214 59% 15%)',
  '--ds-blue-300': 'hsl(213 71% 20%)',
  '--ds-blue-400': 'hsl(212 78% 23%)',
  '--ds-blue-500': 'hsl(211 86% 27%)',
  '--ds-blue-600': 'hsl(206 100% 50%)',
  '--ds-blue-700': 'hsl(212 100% 48%)',
  '--ds-blue-800': 'hsl(212 100% 41%)',
  '--ds-blue-900': 'hsl(210 100% 66%)',
  '--ds-blue-1000': 'hsl(206 100% 96%)',

  /* Red scale */
  '--ds-red-100': 'hsl(357 37% 12%)',
  '--ds-red-200': 'hsl(357 46% 16%)',
  '--ds-red-300': 'hsl(356 54% 22%)',
  '--ds-red-400': 'hsl(357 55% 26%)',
  '--ds-red-500': 'hsl(357 60% 32%)',
  '--ds-red-600': 'hsl(358 75% 59%)',
  '--ds-red-700': 'hsl(358 75% 59%)',
  '--ds-red-800': 'hsl(358 69% 52%)',
  '--ds-red-900': 'hsl(358 100% 69%)',
  '--ds-red-1000': 'hsl(353 90% 96%)',

  /* Amber scale */
  '--ds-amber-100': 'hsl(35 100% 8%)',
  '--ds-amber-200': 'hsl(32 100% 10%)',
  '--ds-amber-300': 'hsl(33 100% 15%)',
  '--ds-amber-400': 'hsl(35 100% 17%)',
  '--ds-amber-500': 'hsl(35 91% 22%)',
  '--ds-amber-600': 'hsl(39 85% 49%)',
  '--ds-amber-700': 'hsl(39 100% 57%)',
  '--ds-amber-800': 'hsl(35 100% 52%)',
  '--ds-amber-900': 'hsl(39 90% 50%)',
  '--ds-amber-1000': 'hsl(40 94% 93%)',

  /* Green scale */
  '--ds-green-100': 'hsl(136 50% 9%)',
  '--ds-green-200': 'hsl(137 50% 12%)',
  '--ds-green-300': 'hsl(136 50% 14%)',
  '--ds-green-400': 'hsl(135 70% 16%)',
  '--ds-green-500': 'hsl(135 70% 23%)',
  '--ds-green-600': 'hsl(135 70% 34%)',
  '--ds-green-700': 'hsl(131 41% 46%)',
  '--ds-green-800': 'hsl(132 43% 39%)',
  '--ds-green-900': 'hsl(131 43% 57%)',
  '--ds-green-1000': 'hsl(136 73% 94%)',

  /* Teal scale */
  '--ds-teal-100': 'hsl(169 78% 7%)',
  '--ds-teal-200': 'hsl(170 74% 9%)',
  '--ds-teal-300': 'hsl(171 75% 13%)',
  '--ds-teal-400': 'hsl(171 85% 13%)',
  '--ds-teal-500': 'hsl(172 85% 20%)',
  '--ds-teal-600': 'hsl(172 85% 32%)',
  '--ds-teal-700': 'hsl(173 80% 36%)',
  '--ds-teal-800': 'hsl(173 83% 30%)',
  '--ds-teal-900': 'hsl(174 90% 41%)',
  '--ds-teal-1000': 'hsl(166 71% 93%)',

  /* Purple scale */
  '--ds-purple-100': 'hsl(283 30% 12%)',
  '--ds-purple-200': 'hsl(281 38% 16%)',
  '--ds-purple-300': 'hsl(279 44% 23%)',
  '--ds-purple-400': 'hsl(277 46% 28%)',
  '--ds-purple-500': 'hsl(274 49% 35%)',
  '--ds-purple-600': 'hsl(272 51% 54%)',
  '--ds-purple-700': 'hsl(272 51% 54%)',
  '--ds-purple-800': 'hsl(272 47% 45%)',
  '--ds-purple-900': 'hsl(275 80% 71%)',
  '--ds-purple-1000': 'hsl(281 73% 96%)',

  /* Pink scale */
  '--ds-pink-100': 'hsl(335 32% 12%)',
  '--ds-pink-200': 'hsl(335 43% 16%)',
  '--ds-pink-300': 'hsl(335 47% 21%)',
  '--ds-pink-400': 'hsl(335 51% 22%)',
  '--ds-pink-500': 'hsl(335 57% 27%)',
  '--ds-pink-600': 'hsl(336 75% 40%)',
  '--ds-pink-700': 'hsl(336 80% 58%)',
  '--ds-pink-800': 'hsl(336 74% 51%)',
  '--ds-pink-900': 'hsl(341 90% 67%)',
  '--ds-pink-1000': 'hsl(333 90% 96%)',

  /* Semantic colors */
  '--ds-foreground': 'var(--ds-gray-1000)',
  '--ds-foreground-muted': 'var(--ds-gray-900)',
  '--ds-background': 'var(--ds-background-100)',

  /* Borders */
  '--ds-border': 'var(--ds-gray-400)',
  '--ds-border-hover': 'var(--ds-gray-500)',

  /* Focus */
  '--ds-focus-color': 'var(--ds-blue-900)',
  '--ds-focus-ring': '0 0 0 2px var(--ds-background-100), 0 0 0 4px var(--ds-focus-color)',

  /* Shadows */
  '--ds-shadow-border': '0 0 0 1px hsl(0 0% 100% / 0.15), 0 0 0 1px hsl(0 0% 0%)',
  '--ds-shadow-small': '0px 1px 2px hsl(0 0% 0% / 0.16)',
  '--ds-shadow-medium': '0px 2px 2px hsl(0 0% 0% / 0.32), 0px 8px 8px -8px hsl(0 0% 0% / 0.16)',
})

/**
 * Typography, radius, spacing and form-height scales, owned by
 * `./document.css`.
 *
 * These are constants, not variables: the framework-free document layer is the
 * single definition, since consumers load it without StyleX. A constant inlines
 * the `var()` reference and emits no CSS, so it adds typed access without a
 * second declaration competing with the stylesheet in the cascade.
 */
export const scale = stylex.defineConsts({
  fontSans: 'var(--font-sans)',
  fontMono: 'var(--font-mono)',
  radiusDefault: 'var(--radius)',
  radiusSm: 'var(--radius-sm)',
  radiusLg: 'var(--radius-lg)',
  radiusFull: 'var(--radius-full)',
  space1: 'var(--space-1)',
  space2: 'var(--space-2)',
  space3: 'var(--space-3)',
  space4: 'var(--space-4)',
  space5: 'var(--space-5)',
  space6: 'var(--space-6)',
  space8: 'var(--space-8)',
  space10: 'var(--space-10)',
  space12: 'var(--space-12)',
  formHeightSm: 'var(--form-height-sm)',
  formHeightMd: 'var(--form-height-md)',
  formHeightLg: 'var(--form-height-lg)',
})
