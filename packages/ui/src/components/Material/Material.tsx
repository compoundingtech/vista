/**
 * Material component built on React Aria
 *
 * @see https://vercel.com/geist/material
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

/**
 * The translucent variants were `bg-[var(--ds-…)]/NN`, which Tailwind compiles
 * to a pair: the opaque colour, then a `color-mix()` override guarded by
 * `@supports (color: color-mix(in lab, red, red))`. `firstThatWorks` reproduces
 * that exactly — it emits the fallback first and the `color-mix()` second, so a
 * browser that cannot parse `color-mix()` discards the second declaration and
 * keeps the opaque colour, which is the same outcome the `@supports` guard
 * produced.
 *
 * The mix must stay `in oklab`: that is the interpolation space Tailwind uses,
 * while the default for `color-mix()` is `oklch`, which would shift the result.
 * It is spelled out at each site rather than wrapped in a helper because
 * `stylex.create` only accepts statically analyzable values.
 */
const styles = stylex.create({
  base: {
    position: 'relative',
    overflow: 'hidden',
  },

  glass: {
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    backgroundColor: stylex.firstThatWorks<string>(
      `color-mix(in oklab, ${tokens['--ds-background-100']} 70%, transparent)`,
      tokens['--ds-background-100'],
    ),
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: tokens['--ds-gray-alpha-400'],
  },

  frosted: {
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    backgroundColor: stylex.firstThatWorks<string>(
      `color-mix(in oklab, ${tokens['--ds-gray-100']} 80%, transparent)`,
      tokens['--ds-gray-100'],
    ),
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: tokens['--ds-gray-alpha-200'],
  },

  subtle: {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    backgroundColor: stylex.firstThatWorks<string>(
      `color-mix(in oklab, ${tokens['--ds-background-100']} 50%, transparent)`,
      tokens['--ds-background-100'],
    ),
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: tokens['--ds-gray-alpha-200'],
  },

  solid: {
    backgroundColor: tokens['--ds-background-100'],
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: tokens['--ds-gray-alpha-400'],
  },

  // `bg-gradient-to-br` sets only `background-image`, so this variant paints no
  // background colour at all. The `in oklab` and the explicit 0%/100% stops are
  // Tailwind's own defaults for `--tw-gradient-position` and the from/to stop
  // positions, spelled out because the composing custom properties are gone.
  gradient: {
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    backgroundImage: `linear-gradient(to bottom right in oklab, color-mix(in oklab, ${
      tokens['--ds-background-100']
    } 80%, transparent) 0%, color-mix(in oklab, ${tokens['--ds-gray-100']} 60%, transparent) 100%)`,
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: tokens['--ds-gray-alpha-300'],
  },

  radiusNone: { borderRadius: 0 },
  // `rounded-md`, `rounded-xl` and `rounded-2xl` resolve against Tailwind's own
  // radius theme, which this package does not override, so they become literals.
  // `rounded-lg` and `rounded-full` DO resolve to the package's own scale.
  radiusSm: { borderRadius: '0.375rem' },
  radiusMd: { borderRadius: scale.radiusLg },
  radiusLg: { borderRadius: '0.75rem' },
  radiusXl: { borderRadius: '1rem' },
  radiusFull: { borderRadius: scale.radiusFull },

  paddingNone: { padding: 0 },
  paddingSm: { padding: '0.5rem' },
  paddingMd: { padding: '1rem' },
  paddingLg: { padding: '1.5rem' },
  paddingXl: { padding: '2rem' },

  // Tailwind's default shadow scale. The `rgb(0 0 0 / 0.1)` alphas are the
  // `--tw-shadow-color` fallbacks, which is what rendered since no
  // `shadow-<color>` utility was ever set here.
  shadowNone: { boxShadow: 'none' },
  shadowSm: { boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
  shadowMd: { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' },
  shadowLg: { boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' },
  shadowXl: { boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' },
})

const variantStyles = {
  glass: styles.glass,
  frosted: styles.frosted,
  subtle: styles.subtle,
  solid: styles.solid,
  gradient: styles.gradient,
} as const

const radiusStyles = {
  none: styles.radiusNone,
  sm: styles.radiusSm,
  md: styles.radiusMd,
  lg: styles.radiusLg,
  xl: styles.radiusXl,
  full: styles.radiusFull,
} as const

const paddingStyles = {
  none: styles.paddingNone,
  sm: styles.paddingSm,
  md: styles.paddingMd,
  lg: styles.paddingLg,
  xl: styles.paddingXl,
} as const

const shadowStyles = {
  none: styles.shadowNone,
  sm: styles.shadowSm,
  md: styles.shadowMd,
  lg: styles.shadowLg,
  xl: styles.shadowXl,
} as const

/** Surface treatments. */
export type MaterialVariant = 'glass' | 'frosted' | 'subtle' | 'solid' | 'gradient'

/** Corner-radius variants. */
export type MaterialRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

/** Padding variants. */
export type MaterialPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl'

/** Elevation variants. */
export type MaterialShadow = 'none' | 'sm' | 'md' | 'lg' | 'xl'

export interface MaterialProps {
  variant?: MaterialVariant | undefined
  radius?: MaterialRadius | undefined
  padding?: MaterialPadding | undefined
  shadow?: MaterialShadow | undefined
  /** Content to display inside the material container */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** HTML element to render as */
  as?: 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'main'
}

/** Material container with blur/glass effects */
export const Material = ({
  children,
  variant = 'glass',
  radius = 'lg',
  padding = 'md',
  shadow = 'none',
  className,
  as: Component = 'div',
}: MaterialProps) => (
  <Component
    {...styled(
      className,
      styles.base,
      variantStyles[variant],
      radiusStyles[radius],
      paddingStyles[padding],
      shadowStyles[shadow],
    )}
  >
    {children}
  </Component>
)
