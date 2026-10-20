import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import type { ReactNode } from 'react'

import { Icon } from './icons.tsx'

/** Props for ContextHeader. Omit `you` for an informational vista; `verdict` is the page's bottom line. */
export interface ContextHeaderProps {
  /** What this vista is about. */
  readonly what: ReactNode
  /** Why it matters now. */
  readonly why: ReactNode
  /** What the reader must decide or do. Omitted: “No action needed”. */
  readonly you?: ReactNode
  /** The one bottom-line claim of the page, shown large under the context. */
  readonly verdict?: ReactNode
}

/**
 * The page's opening (MED.DOC.TASTE-R01): what, why now, and the reader's ask, then at most
 * one verdict. Use once per page, first.
 */
export const ContextHeader = ({ what, why, you, verdict }: ContextHeaderProps) => (
  <header {...stylex.props(styles.header)} data-vista-tones="">
    <dl {...stylex.props(styles.rows)}>
      <dt {...stylex.props(styles.term)}>
        <Icon name="package" size={14} />
        What
      </dt>
      <dd {...stylex.props(styles.value)}>{what}</dd>
      <dt {...stylex.props(styles.term)}>
        <Icon name="hourglass" size={14} />
        Why now
      </dt>
      <dd {...stylex.props(styles.value)}>{why}</dd>
      <dt {...stylex.props(styles.term, you !== undefined && styles.termYou)}>
        <Icon name="hand" size={14} />
        You
      </dt>
      <dd {...stylex.props(styles.value, you === undefined ? styles.informational : styles.ask)}>
        {you ?? 'No action needed'}
      </dd>
    </dl>
    {verdict === undefined ? null : <p {...stylex.props(styles.verdict)}>{verdict}</p>}
  </header>
)

const styles = stylex.create({
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    paddingBlock: '0.25rem 1.75rem',
    color: tokens['--ds-gray-1000'],
  },
  rows: {
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(0, 1fr)',
    columnGap: '1rem',
    rowGap: '0.5rem',
    alignItems: 'baseline',
    margin: 0,
  },
  term: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: tokens['--ds-gray-900'],
  },
  termYou: {
    color: 'var(--tone-you-ink)',
  },
  value: {
    margin: 0,
    fontSize: '0.9375rem',
    lineHeight: '1.375rem',
  },
  ask: {
    fontSize: '1.125rem',
    lineHeight: '1.625rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  informational: {
    color: tokens['--ds-gray-900'],
  },
  verdict: {
    margin: 0,
    maxWidth: '40rem',
    fontSize: {
      default: '1.75rem',
      '@media (max-width: 40rem)': '1.375rem',
    },
    lineHeight: 1.15,
    fontWeight: 650,
    letterSpacing: '-0.03em',
    textWrap: 'balance',
  },
})
