import * as stylex from '@stylexjs/stylex'

import type { ToggleProps } from './Toggle.tsx'

/** Fails to compile unless `T` is exactly `true`. */
type Assert<T extends true> = T

/** Wrapped in tuples so a union on either side is compared as a whole. */
type Extends<A, B> = [A] extends [B] ? true : false
type DoesNotExtend<A, B> = Extends<A, B> extends true ? false : true

const consumerStyles = stylex.create({
  layout: {
    marginInline: 'auto',
    width: 'fit-content',
  },
  ownedLayout: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  ownedInteraction: {
    cursor: 'default',
  },
})

export type ToggleAcceptsLayoutStyle = Assert<
  Extends<typeof consumerStyles.layout, NonNullable<ToggleProps['style']>>
>

export type ToggleRejectsOwnedLayout = Assert<
  DoesNotExtend<typeof consumerStyles.ownedLayout, NonNullable<ToggleProps['style']>>
>

export type ToggleRejectsOwnedInteraction = Assert<
  DoesNotExtend<typeof consumerStyles.ownedInteraction, NonNullable<ToggleProps['style']>>
>

export type ToggleRejectsReactInlineStyle = Assert<
  DoesNotExtend<{ width: string }, NonNullable<ToggleProps['style']>>
>
