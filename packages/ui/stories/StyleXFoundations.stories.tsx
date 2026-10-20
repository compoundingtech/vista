import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { scale, tokens } from '../src/foundations/tokens.stylex.ts'

const styles = stylex.create({
  surface: {
    display: 'grid',
    placeItems: 'center',
    minHeight: '320px',
    padding: scale.space8,
  },
  card: {
    width: 'min(520px, 100%)',
    padding: scale.space6,
    color: 'inherit',
    backgroundColor: tokens['--ds-background-100'],
    borderColor: tokens['--ds-border'],
    borderStyle: 'solid',
    borderWidth: '1px',
    borderRadius: scale.radiusLg,
    boxShadow: tokens['--ds-shadow-medium'],
    ':hover': {
      borderColor: tokens['--ds-border-hover'],
    },
    ':focus-visible': {
      outline: 'none',
      boxShadow: tokens['--ds-focus-ring'],
    },
  },
  headingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
  },
  marker: {
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    color: tokens['--ds-focus-color'],
    backgroundColor: tokens['--ds-background-200'],
    borderRadius: scale.radiusFull,
    fontFamily: scale.fontMono,
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    lineHeight: 1.25,
  },
  copy: {
    marginBlock: scale.space3,
    color: tokens['--ds-foreground-muted'],
    fontSize: '14px',
    lineHeight: 1.5,
  },
  documentValues: {
    display: 'grid',
    gap: scale.space2,
    margin: 0,
    marginTop: scale.space5,
  },
  documentValue: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)',
    gap: scale.space3,
    alignItems: 'baseline',
    padding: scale.space3,
    backgroundColor: tokens['--ds-background-200'],
    borderRadius: scale.radiusSm,
    boxShadow: tokens['--ds-shadow-border'],
  },
  documentLabel: {
    color: tokens['--ds-foreground-muted'],
    fontSize: '12px',
  },
  documentOutput: {
    minWidth: 0,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: scale.fontMono,
    fontSize: '12px',
    textAlign: 'right',
  },
  tokenRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: scale.space3,
    marginTop: scale.space5,
  },
  token: {
    padding: scale.space3,
    backgroundColor: tokens['--ds-background-200'],
    borderRadius: scale.radiusSm,
    boxShadow: tokens['--ds-shadow-border'],
    fontFamily: scale.fontMono,
    fontSize: '12px',
  },
})

const readDocumentFoundation = (): ReadonlyArray<readonly [string, string]> => {
  if (typeof document === 'undefined') return []

  const root = getComputedStyle(document.documentElement)
  const body = getComputedStyle(document.body)

  return [
    ['html / body margin', `${root.margin} / ${body.margin}`],
    ['html / body padding', `${root.padding} / ${body.padding}`],
    ['color scheme', root.colorScheme],
    ['body colors', `${body.backgroundColor} / ${body.color}`],
    ['body typeface', body.fontFamily],
  ]
}

const StyleXFoundations = () => {
  const foundationValues = readDocumentFoundation()

  return (
    <main {...stylex.props(styles.surface)}>
      <article {...stylex.props(styles.card)} tabIndex={0}>
        <div {...stylex.props(styles.headingRow)}>
          <span {...stylex.props(styles.marker)}>FOUNDATION</span>
          <h2 {...stylex.props(styles.title)}>Document and semantic defaults</h2>
        </div>
        <p {...stylex.props(styles.copy)}>
          The document owns the reset, color scheme, typography, and page colors. StyleX adds typed
          token composition.
        </p>
        <dl {...stylex.props(styles.documentValues)}>
          {foundationValues.map(([label, value]) => (
            <div {...stylex.props(styles.documentValue)} key={label}>
              <dt {...stylex.props(styles.documentLabel)}>{label}</dt>
              <dd {...stylex.props(styles.documentOutput)} title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div {...stylex.props(styles.tokenRow)}>
          <span {...stylex.props(styles.token)}>radius + space</span>
          <span {...stylex.props(styles.token)}>border + shadow</span>
        </div>
      </article>
    </main>
  )
}

const meta = {
  title: 'Foundations/StyleX',
  component: StyleXFoundations,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof StyleXFoundations>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
