/**
 * Kbd component built on React Aria
 *
 * @see https://vercel.com/geist/keyboard-input
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { Keyboard as AriaKeyboard } from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: scale.fontSans,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-1000'],
    // `ring-1 ring-[…]` filled the ring slot of Tailwind's composed
    // `box-shadow`; the other four slots were their `0 0 #0000` initial value
    // and `--tw-ring-offset-width` was `0px`, so the whole declaration
    // resolved to this one layer. Nothing else on this element writes
    // `box-shadow`, so a single property reproduces it exactly — and this is
    // not a focus ring, so `outline` stays reserved.
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
  },

  // `rounded` is a LITERAL `0.25rem` in Tailwind 4.3.1 — it does not read the
  // radius theme namespace. `--radius-sm` is a package override that happens
  // to equal it at a 16px root, so `scale.radiusSm` would render identically
  // today while silently coupling this component to a custom property the
  // original never referenced. Equal values are not the same value.
  default: {
    height: '1.5rem',
    minWidth: '1.5rem',
    paddingInline: '0.375rem',
    fontSize: '0.875rem',
    // `text-sm`'s own line-height; no `leading-*` overrode it. Spelled as the
    // resolved length rather than Tailwind's `calc(1.25 / 0.875)` ratio: the
    // CSS minifier folds that calc to five decimals and the box comes out
    // 1/64px short.
    lineHeight: '1.25rem',
    borderRadius: '0.25rem',
  },
  small: {
    height: '1.25rem',
    minWidth: '1.25rem',
    paddingInline: '0.25rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
    borderRadius: '0.25rem',
  },
})

/** Size variants. */
export type KbdSize = 'default' | 'small'

export interface KbdProps {
  /** Size variant */
  size?: KbdSize | undefined
  /** Key or key combination to display */
  children: ReactNode
  /** Optional class name */
  className?: string
}

/** Common keyboard modifier symbols */
export const KeySymbols = {
  command: '⌘',
  cmd: '⌘',
  shift: '⇧',
  option: '⌥',
  alt: '⌥',
  control: '⌃',
  ctrl: '⌃',
  enter: '↵',
  backspace: '⌫',
  delete: '⌦',
  escape: '⎋',
  esc: '⎋',
  tab: '⇥',
  capslock: '⇪',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  pageup: '⇞',
  pagedown: '⇟',
  home: '↖',
  end: '↘',
  space: '␣',
} as const

/** Kbd displays keyboard input that triggers an action */
export const Kbd = ({ children, size = 'default', className }: KbdProps) => (
  <AriaKeyboard {...styled(className, styles.base, styles[size])}>{children}</AriaKeyboard>
)
