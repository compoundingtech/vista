/**
 * Phone component built on React Aria
 *
 * @see https://vercel.com/geist/phone
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '36px',
    borderWidth: '8px',
    // Tailwind's preflight supplied `solid` for `border-[8px]`; StyleX has to
    // say it. The colour here is always superseded by `frameColor` below,
    // which has no `undefined` case — it is kept only because the base slot
    // declared it.
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-1000'],
    backgroundColor: tokens['--ds-gray-1000'],
    // `shadow-lg`. Tailwind composes the ring/inset/shadow custom properties
    // into one `box-shadow`; nothing on this element sets a ring, so the
    // shadow layers are the whole value.
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  rootSm: { width: '220px' },
  rootMd: { width: '280px' },
  rootLg: { width: '340px' },
  rootDark: {
    borderColor: tokens['--ds-gray-1000'],
    backgroundColor: tokens['--ds-gray-1000'],
  },
  rootLight: {
    borderColor: tokens['--ds-gray-400'],
    backgroundColor: tokens['--ds-gray-400'],
  },
  rootBlue: {
    borderColor: tokens['--ds-blue-700'],
    backgroundColor: tokens['--ds-blue-700'],
  },

  screen: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '28px',
    backgroundColor: tokens['--ds-background-100'],
  },
  screenSm: { height: '440px' },
  screenMd: { height: '560px' },
  screenLg: { height: '680px' },

  notch: {
    position: 'absolute',
    top: 0,
    insetInlineStart: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
  },
  notchSm: {
    width: '80px',
    height: '24px',
    borderBottomLeftRadius: '0.75rem',
    borderBottomRightRadius: '0.75rem',
  },
  notchMd: {
    width: '100px',
    height: '28px',
    borderBottomLeftRadius: '0.75rem',
    borderBottomRightRadius: '0.75rem',
  },
  notchLg: {
    width: '120px',
    height: '32px',
    borderBottomLeftRadius: '1rem',
    borderBottomRightRadius: '1rem',
  },

  dynamicIsland: {
    position: 'absolute',
    top: '0.75rem',
    insetInlineStart: '50%',
    transform: 'translateX(-50%)',
    borderRadius: scale.radiusFull,
    zIndex: 10,
  },
  dynamicIslandSm: { width: '60px', height: '18px' },
  dynamicIslandMd: { width: '80px', height: '24px' },
  dynamicIslandLg: { width: '100px', height: '28px' },

  frameDark: { backgroundColor: tokens['--ds-gray-1000'] },
  frameLight: { backgroundColor: tokens['--ds-gray-400'] },
  frameBlue: { backgroundColor: tokens['--ds-blue-700'] },

  hidden: { display: 'none' },

  statusBar: {
    position: 'absolute',
    top: 0,
    insetInlineStart: 0,
    insetInlineEnd: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInline: '1.5rem',
    paddingTop: '0.75rem',
    color: tokens['--ds-gray-1000'],
    fontSize: '0.75rem',
    // `text-xs` is a scale step and carries a paired line-height. Dropping it
    // measured as a 2px taller status bar. Absolute rather than Tailwind's
    // `calc(1 / 0.75)` ratio: the unitless ratio is quantised to 1/256 and
    // measured 15.98px against Tailwind's 16px, while `1rem` is exact.
    lineHeight: '1rem',
    fontWeight: 500,
    zIndex: 20,
  },
  statusBarIcons: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },

  content: { height: '100%', overflow: 'auto' },

  homeIndicator: {
    position: 'absolute',
    bottom: '0.5rem',
    insetInlineStart: '50%',
    transform: 'translateX(-50%)',
    width: '100px',
    height: '0.25rem',
    borderRadius: scale.radiusFull,
    backgroundColor: tokens['--ds-gray-900'],
    zIndex: 10,
  },
})

/** Size variants. */
export type PhoneSize = 'sm' | 'md' | 'lg'

/** Which cutout the frame renders at the top of the screen. */
export type PhoneNotchVariant = 'none' | 'notch' | 'dynamicIsland'

/** Frame and cutout colour. */
export type PhoneFrameColor = 'dark' | 'light' | 'blue'

const rootSize: Record<PhoneSize, stylex.StyleXStyles> = {
  sm: styles.rootSm,
  md: styles.rootMd,
  lg: styles.rootLg,
}

const rootFrame: Record<PhoneFrameColor, stylex.StyleXStyles> = {
  dark: styles.rootDark,
  light: styles.rootLight,
  blue: styles.rootBlue,
}

const screenSize: Record<PhoneSize, stylex.StyleXStyles> = {
  sm: styles.screenSm,
  md: styles.screenMd,
  lg: styles.screenLg,
}

const notchSize: Record<PhoneSize, stylex.StyleXStyles> = {
  sm: styles.notchSm,
  md: styles.notchMd,
  lg: styles.notchLg,
}

const islandSize: Record<PhoneSize, stylex.StyleXStyles> = {
  sm: styles.dynamicIslandSm,
  md: styles.dynamicIslandMd,
  lg: styles.dynamicIslandLg,
}

const cutoutFrame: Record<PhoneFrameColor, stylex.StyleXStyles> = {
  dark: styles.frameDark,
  light: styles.frameLight,
  blue: styles.frameBlue,
}

export interface PhoneProps {
  size?: PhoneSize | undefined
  notchVariant?: PhoneNotchVariant | undefined
  frameColor?: PhoneFrameColor | undefined
  /** Content to display in the phone screen */
  children: ReactNode
  /** Optional class name for the root element */
  className?: string
  /** Optional class name for the screen area */
  screenClassName?: string
  /** Whether to show the home indicator bar */
  showHomeIndicator?: boolean
  /** Whether to show the status bar */
  showStatusBar?: boolean
  /** Time to display in status bar */
  statusBarTime?: string
}

/** Phone frame mockup for showcasing mobile content */
export const Phone = ({
  children,
  size = 'md',
  notchVariant = 'dynamicIsland',
  frameColor = 'dark',
  className,
  screenClassName,
  showHomeIndicator = true,
  showStatusBar = false,
  statusBarTime = '9:41',
}: PhoneProps) => (
  <div {...styled(className, styles.root, rootSize[size], rootFrame[frameColor])}>
    <div {...styled(screenClassName, styles.screen, screenSize[size])}>
      {/* Both cutouts always render; `notchVariant` hides the one it does not
          select, exactly as the `hidden` utility did. */}
      <div
        {...styled(
          undefined,
          styles.notch,
          notchSize[size],
          cutoutFrame[frameColor],
          notchVariant === 'notch' ? null : styles.hidden,
        )}
        aria-hidden="true"
      />
      <div
        {...styled(
          undefined,
          styles.dynamicIsland,
          islandSize[size],
          cutoutFrame[frameColor],
          notchVariant === 'dynamicIsland' ? null : styles.hidden,
        )}
        aria-hidden="true"
      />
      {showStatusBar && (
        <div {...styled(undefined, styles.statusBar)} aria-hidden="true">
          <span>{statusBarTime}</span>
          <div {...styled(undefined, styles.statusBarIcons)}>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
              <path d="M14 0H2C0.9 0 0 0.9 0 2v8c0 1.1 0.9 2 2 2h12c1.1 0 2-0.9 2-2V2c0-1.1-0.9-2-2-2zm0 10H2V2h12v8z" />
            </svg>
          </div>
        </div>
      )}
      <div {...styled(undefined, styles.content)}>{children}</div>
      {showHomeIndicator && <div {...styled(undefined, styles.homeIndicator)} aria-hidden="true" />}
    </div>
  </div>
)
