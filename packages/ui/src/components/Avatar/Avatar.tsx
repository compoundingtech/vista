/**
 * Avatar component built on React Aria
 *
 * @see https://vercel.com/geist/avatar
 */

import * as stylex from '@stylexjs/stylex'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  base: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scale.radiusFull,
    overflow: 'hidden',
    backgroundColor: tokens['--ds-gray-200'],
    color: tokens['--ds-gray-900'],
    fontWeight: 500,
    flexShrink: 0,
  },

  // `text-*` set a line-height as well as a font-size; both are carried over.
  // Stated as absolute rem rather than Tailwind's `calc()` ratios: the CSS
  // minifier rounds a bare `calc()` to five decimals and layout floors onto
  // the 1/64 grid, so the ratio form lands fractionally off. Tailwind is
  // immune only because its ratio sits inside an unregistered custom property.
  // Each value is the ratio multiplied by its own font-size, so it is exactly
  // what Tailwind resolves to. Inert here (every box pins `height` and centres
  // its content) but kept correct so it stays correct if the box stops pinning.
  sm: { height: '1.5rem', width: '1.5rem', fontSize: '0.75rem', lineHeight: '1rem' },
  md: { height: '2rem', width: '2rem', fontSize: '0.875rem', lineHeight: '1.25rem' },
  lg: { height: '3rem', width: '3rem', fontSize: '1rem', lineHeight: '1.5rem' },
  xl: { height: '4rem', width: '4rem', fontSize: '1.125rem', lineHeight: '1.75rem' },
  '2xl': { height: '6rem', width: '6rem', fontSize: '1.25rem', lineHeight: '1.75rem' },

  image: { height: '100%', width: '100%', objectFit: 'cover' },

  fallback: { userSelect: 'none' },

  icon: { color: tokens['--ds-gray-700'] },
  iconSm: { height: '0.75rem', width: '0.75rem' },
  iconMd: { height: '1rem', width: '1rem' },
  iconLg: { height: '1.5rem', width: '1.5rem' },
  iconXl: { height: '2rem', width: '2rem' },
  icon2xl: { height: '3rem', width: '3rem' },
})

/** Size variants. */
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const iconSizeStyles = {
  sm: styles.iconSm,
  md: styles.iconMd,
  lg: styles.iconLg,
  xl: styles.iconXl,
  '2xl': styles.icon2xl,
} as const

export interface AvatarProps {
  size?: AvatarSize | undefined
  /** Image source URL */
  src?: string
  /** Alt text for the image */
  alt?: string
  /** Fallback text (e.g., initials) when no image */
  fallback?: string
  /** Optional class name override */
  className?: string
}

/** Default placeholder icon for avatar */
const PlaceholderIcon = ({ size }: { size: AvatarSize }) => (
  <svg
    {...styled(undefined, styles.icon, iconSizeStyles[size])}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
)

/** Avatar for displaying user or team images */
export const Avatar = ({ src, alt, fallback, size = 'md', className }: AvatarProps) => {
  const hasImage = !!src
  const hasFallback = !!fallback

  return (
    <span
      {...styled(className, styles.base, styles[size])}
      role="img"
      aria-label={alt ?? fallback ?? 'Avatar'}
    >
      {hasImage ? (
        <img src={src} alt={alt ?? ''} {...styled(undefined, styles.image)} />
      ) : hasFallback ? (
        <span {...styled(undefined, styles.fallback)}>{fallback}</span>
      ) : (
        <PlaceholderIcon size={size} />
      )}
    </span>
  )
}
