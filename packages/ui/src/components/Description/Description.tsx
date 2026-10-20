/**
 * Description component built on React Aria
 *
 * @see https://vercel.com/geist/description
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'
import { tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  root: {
    display: 'block',
  },
  term: {
    color: tokens['--ds-gray-900'],
    marginBottom: '0.25rem',
  },
  termContent: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  suffix: {
    color: tokens['--ds-gray-700'],
    flexShrink: 0,
  },
  definition: {
    fontWeight: 500,
    color: tokens['--ds-gray-1000'],
  },

  // The `leading-5` these two slots declared never applied. `tailwind-variants`
  // merges through `tailwind-merge`, which treats a `text-<size>` as
  // conflicting with `leading-*` because the size utility sets a line-height
  // too — and the size variant's `text-xs`/`text-sm`/`text-base` was appended
  // after it, so `leading-5` was dropped from the class string every time.
  // What actually rendered is each size's own line-height. Measured against
  // the pre-migration build: 16px, 20px, 24px.
  //
  // Spelled as the resolved length rather than Tailwind's `calc(1 / 0.75)`
  // ratio: the CSS minifier folds that calc to `1.33333` and the element comes
  // out 1/64px short.
  small: { fontSize: '0.75rem', lineHeight: '1rem' },
  default: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  large: { fontSize: '1rem', lineHeight: '1.5rem' },
})

/** Size variants. */
export type DescriptionSize = 'small' | 'default' | 'large'

export interface DescriptionProps {
  /** Size variant */
  size?: DescriptionSize | undefined
  /** Title/label for the description */
  title: ReactNode
  /** Content/value of the description */
  children: ReactNode
  /** Icon or element to display after the title */
  suffix?: ReactNode
  /** Optional class name */
  className?: string
}

/** Description displays a title and content pair, typically used for metadata */
export const Description = ({
  title,
  children,
  suffix,
  size = 'default',
  className,
}: DescriptionProps) => (
  <dl {...styled(className, styles.root)}>
    <dt {...styled(undefined, styles.term, styles[size])}>
      <span {...styled(undefined, styles.termContent)}>
        {title}
        {suffix && <span {...styled(undefined, styles.suffix)}>{suffix}</span>}
      </span>
    </dt>
    <dd {...styled(undefined, styles.definition, styles[size])}>{children}</dd>
  </dl>
)
