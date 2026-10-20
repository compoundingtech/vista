import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { Icon, type IconName } from './icons.tsx'

/**
 * A stable meaning. Each tone has one colour and one glyph across every vista, so colour
 * never carries a meaning alone (MED.DOC.TASTE-R05).
 */
export type Tone = 'recommend' | 'you' | 'risk' | 'done' | 'unproven' | 'out'

/** Glyph and default label per tone; the kit's components read the same table. */
export const tones: Record<Tone, { readonly icon: IconName; readonly label: string }> = {
  recommend: { icon: 'thumbs-up', label: 'Recommended' },
  you: { icon: 'hand', label: 'Needs you' },
  risk: { icon: 'triangle-alert', label: 'Risk' },
  done: { icon: 'circle-check', label: 'Proven' },
  unproven: { icon: 'circle-dashed', label: 'Not proven' },
  out: { icon: 'ban', label: 'Ruled out' },
}

/** Props for Mark: the meaning, and an optional label replacing the tone's default. */
export interface MarkProps {
  readonly tone: Tone
  readonly children?: ReactNode
}

/** An inline semantic mark: the tone's glyph and ink plus a short label. */
export const Mark = ({ tone, children }: MarkProps) => (
  <span {...stylex.props(styles.mark, inks[tone])} data-vista-tones="" data-tone={tone}>
    <Icon name={tones[tone].icon} size={14} />
    <span>{children ?? tones[tone].label}</span>
  </span>
)

const styles = stylex.create({
  mark: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.8125rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
})

const inks = stylex.create({
  recommend: { color: 'var(--tone-recommend-ink)' },
  you: { color: 'var(--tone-you-ink)' },
  risk: { color: 'var(--tone-risk-ink)' },
  done: { color: 'var(--tone-done-ink)' },
  unproven: { color: 'var(--tone-muted-ink)' },
  out: { color: 'var(--tone-muted-ink)' },
})
