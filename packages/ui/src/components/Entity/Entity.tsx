/**
 * Entity component built on React Aria
 *
 * @see https://vercel.com/geist/entity
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled, type StyledProps } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

/**
 * Radius provenance differs line by line here, so equal pixel values are not
 * interchangeable. Measured against the emitted stylesheet:
 *
 * - `rounded` names no custom property at all — it emits a literal `0.25rem`.
 * - `rounded-md` reads `--radius-md`, which the package does NOT override, so
 *   it falls through to the framework theme at `0.375rem`. That happens to
 *   equal `--radius` (6px) today; reaching for `scale.radiusDefault` would look
 *   right and silently couple these boxes to a different property.
 * - `rounded-lg` reads `--radius-lg`, which the package DOES override, so
 *   `scale.radiusLg` is the same property and is the correct translation.
 * - `rounded-full` emits `calc(infinity * 1px)` rather than `--radius-full`.
 *   `scale.radiusFull` (9999px) is used anyway, matching the already-merged
 *   Badge and Button convention; both clamp identically on any finite box, and
 *   standing up a second convention for one avatar would be worse than the
 *   stated mismatch.
 */
const styles = stylex.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    color: tokens['--ds-gray-1000'],
  },

  avatar: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scale.radiusFull,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: tokens['--ds-gray-200'],
    color: tokens['--ds-gray-900'],
    fontWeight: 500,
  },
  avatarSm: { height: '1.5rem', width: '1.5rem', fontSize: '0.75rem', lineHeight: '1rem' },
  avatarMd: { height: '2rem', width: '2rem', fontSize: '0.875rem', lineHeight: '1.25rem' },
  avatarLg: { height: '2.5rem', width: '2.5rem', fontSize: '0.875rem', lineHeight: '1.25rem' },
  avatarXl: { height: '3rem', width: '3rem', fontSize: '1rem', lineHeight: '1.5rem' },

  thumbnail: {
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: tokens['--ds-gray-200'],
  },
  thumbnailSm: { height: '1.5rem', width: '2rem', borderRadius: '0.25rem' },
  thumbnailMd: { height: '2rem', width: '2.5rem', borderRadius: '0.375rem' },
  thumbnailLg: { height: '2.5rem', width: '3rem', borderRadius: scale.radiusLg },
  thumbnailXl: { height: '3rem', width: '4rem', borderRadius: scale.radiusLg },

  thumbnailSquare: { borderRadius: scale.radiusLg, aspectRatio: '1 / 1' },
  thumbnailRounded: { borderRadius: '0.375rem' },
  thumbnailVideo: { aspectRatio: '16 / 9', borderRadius: '0.375rem' },

  // Compound size x square overrides, applied after both, exactly as the
  // variant helper's compound entries were.
  thumbnailSquareSm: { height: '1.5rem', width: '1.5rem', borderRadius: '0.25rem' },
  thumbnailSquareMd: { height: '2rem', width: '2rem', borderRadius: '0.375rem' },
  thumbnailSquareLg: { height: '2.5rem', width: '2.5rem', borderRadius: '0.375rem' },
  thumbnailSquareXl: { height: '3rem', width: '3rem', borderRadius: scale.radiusLg },

  content: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
  },

  name: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens['--ds-gray-1000'],
  },
  nameSm: { fontSize: '13px', lineHeight: '1rem' },
  nameMd: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  nameLg: { fontSize: '1rem', lineHeight: '1.5rem' },
  nameXl: { fontSize: '1.125rem', lineHeight: '1.75rem' },

  description: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens['--ds-gray-900'],
  },
  meta: { color: tokens['--ds-gray-700'] },

  // Shared by `description` and `meta`, which carried identical size classes.
  // `text-[13px]` is an arbitrary size and emits a font-size alone, so `md`
  // sets no line-height and keeps inheriting the ratio, as it did before.
  secondarySm: { fontSize: '0.75rem', lineHeight: '1rem' },
  secondaryMd: { fontSize: '13px' },
  secondaryLg: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  secondaryXl: { fontSize: '1rem', lineHeight: '1.5rem' },

  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
    marginLeft: 'auto',
  },

  image: { height: '100%', width: '100%', objectFit: 'cover' },
  fallback: { userSelect: 'none' },
  placeholderIcon: { height: '50%', width: '50%', color: tokens['--ds-gray-700'] },
})

/** Size variants. */
export type EntitySize = 'sm' | 'md' | 'lg' | 'xl'

/** Thumbnail aspect/corner variants. */
export type EntityThumbnailShape = 'square' | 'rounded' | 'video'

const avatarSizeStyles = {
  sm: styles.avatarSm,
  md: styles.avatarMd,
  lg: styles.avatarLg,
  xl: styles.avatarXl,
} as const

const thumbnailSizeStyles = {
  sm: styles.thumbnailSm,
  md: styles.thumbnailMd,
  lg: styles.thumbnailLg,
  xl: styles.thumbnailXl,
} as const

const thumbnailShapeStyles = {
  square: styles.thumbnailSquare,
  rounded: styles.thumbnailRounded,
  video: styles.thumbnailVideo,
} as const

const thumbnailSquareSizeStyles = {
  sm: styles.thumbnailSquareSm,
  md: styles.thumbnailSquareMd,
  lg: styles.thumbnailSquareLg,
  xl: styles.thumbnailSquareXl,
} as const

const nameSizeStyles = {
  sm: styles.nameSm,
  md: styles.nameMd,
  lg: styles.nameLg,
  xl: styles.nameXl,
} as const

const secondarySizeStyles = {
  sm: styles.secondarySm,
  md: styles.secondaryMd,
  lg: styles.secondaryLg,
  xl: styles.secondaryXl,
} as const

/** Default placeholder icon for avatar */
const PlaceholderIcon = (props: StyledProps) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
)

export interface EntityProps {
  /** Name of the entity */
  name: string
  /** Description or secondary text */
  description?: string
  /** Meta information (timestamp, etc.) */
  meta?: string
  /** Avatar image URL */
  avatarSrc?: string
  /** Avatar fallback text (e.g., initials) */
  avatarFallback?: string
  /** Thumbnail image URL (alternative to avatar) */
  thumbnailSrc?: string
  /** Alt text for avatar/thumbnail images */
  imageAlt?: string
  /** Action elements (buttons, menu trigger, etc.) */
  actions?: ReactNode
  /** Size variant */
  size?: EntitySize | undefined
  /** Thumbnail aspect/corner variant */
  thumbnailShape?: EntityThumbnailShape | undefined
  /** Optional class name override */
  className?: string
}

/** Entity display for users, teams, projects, or any named resource */
export const Entity = ({
  name,
  description,
  meta,
  avatarSrc,
  avatarFallback,
  thumbnailSrc,
  thumbnailShape = 'rounded',
  imageAlt,
  actions,
  size = 'md',
  className,
}: EntityProps) => {
  const hasAvatar = !thumbnailSrc && (!!avatarSrc || !!avatarFallback)
  const hasThumbnail = !!thumbnailSrc

  return (
    <div {...styled(className, styles.root)}>
      {hasThumbnail && (
        <span
          {...styled(
            undefined,
            styles.thumbnail,
            thumbnailSizeStyles[size],
            thumbnailShapeStyles[thumbnailShape],
            thumbnailShape === 'square' ? thumbnailSquareSizeStyles[size] : undefined,
          )}
        >
          <img src={thumbnailSrc} alt={imageAlt ?? name} {...styled(undefined, styles.image)} />
        </span>
      )}
      {hasAvatar && (
        <span {...styled(undefined, styles.avatar, avatarSizeStyles[size])}>
          {avatarSrc ? (
            <img src={avatarSrc} alt={imageAlt ?? name} {...styled(undefined, styles.image)} />
          ) : avatarFallback ? (
            <span {...styled(undefined, styles.fallback)}>{avatarFallback}</span>
          ) : (
            <PlaceholderIcon {...styled(undefined, styles.placeholderIcon)} />
          )}
        </span>
      )}
      {!hasThumbnail && !hasAvatar && (
        <span {...styled(undefined, styles.avatar, avatarSizeStyles[size])}>
          <PlaceholderIcon {...styled(undefined, styles.placeholderIcon)} />
        </span>
      )}
      <div {...styled(undefined, styles.content)}>
        <span {...styled(undefined, styles.name, nameSizeStyles[size])}>{name}</span>
        {description && (
          <span {...styled(undefined, styles.description, secondarySizeStyles[size])}>
            {description}
          </span>
        )}
        {meta && <span {...styled(undefined, styles.meta, secondarySizeStyles[size])}>{meta}</span>}
      </div>
      {actions && <div {...styled(undefined, styles.actions)}>{actions}</div>}
    </div>
  )
}
