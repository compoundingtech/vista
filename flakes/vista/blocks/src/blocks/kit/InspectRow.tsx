import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import type { ReactNode } from 'react'
import { Button, Disclosure, DisclosurePanel } from 'react-aria-components'

import { Icon, type IconName } from './icons.tsx'

/** Props for InspectRow: a title, optional quiet meta and icon, and the detail it opens. */
export interface InspectRowProps {
  readonly title: ReactNode
  /** Short right-aligned summary, e.g. `3 raw records`. */
  readonly meta?: ReactNode
  readonly icon?: IconName
  readonly children: ReactNode
}

/**
 * A closed row that opens its detail in place (inspect on demand). Consecutive rows stack into
 * one ruled list.
 */
export const InspectRow = ({ title, meta, icon, children }: InspectRowProps) => (
  <Disclosure {...stylex.props(styles.row)}>
    {({ isExpanded }) => (
      <>
        <Button slot="trigger" {...stylex.props(styles.trigger)}>
          <span {...stylex.props(styles.chevron, isExpanded && styles.chevronOpen)}>
            <Icon name="chevron-right" size={15} />
          </span>
          {icon === undefined ? null : <Icon name={icon} size={15} />}
          <span {...stylex.props(styles.title)}>{title}</span>
          {meta === undefined ? null : <span {...stylex.props(styles.meta)}>{meta}</span>}
        </Button>
        <DisclosurePanel>
          <div {...stylex.props(styles.body)}>{children}</div>
        </DisclosurePanel>
      </>
    )}
  </Disclosure>
)

const styles = stylex.create({
  row: {
    borderTopWidth: { default: 0, ':first-child': '1px' },
    borderBottomWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-200'],
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    minHeight: '2.5rem',
    paddingBlock: '0.5rem',
    paddingInline: '0.25rem',
    borderWidth: 0,
    backgroundColor: {
      default: 'transparent',
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    font: 'inherit',
    fontSize: '0.8125rem',
    color: tokens['--ds-gray-900'],
    textAlign: 'left',
    cursor: 'pointer',
    outline: {
      default: 'none',
      ':focus-visible': `2px solid ${tokens['--ds-focus-color']}`,
    },
    outlineOffset: '2px',
  },
  chevron: {
    display: 'inline-flex',
    transitionProperty: 'transform',
    transitionDuration: '150ms',
  },
  chevronOpen: {
    transform: 'rotate(90deg)',
  },
  title: {
    color: tokens['--ds-gray-1000'],
    fontWeight: 500,
  },
  meta: {
    marginLeft: 'auto',
    fontSize: '0.75rem',
    color: tokens['--ds-gray-800'],
    fontVariantNumeric: 'tabular-nums',
  },
  body: {
    paddingBlock: '0.5rem 1.25rem',
    paddingInline: '1.75rem 0.25rem',
    fontSize: '0.8125rem',
    lineHeight: '1.3rem',
    color: tokens['--ds-gray-1000'],
  },
})
