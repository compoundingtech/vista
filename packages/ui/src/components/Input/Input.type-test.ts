import * as stylex from '@stylexjs/stylex'

import type { InputProps } from './Input.tsx'

/** Fails to compile unless `T` is exactly `true`. */
type Assert<T extends true> = T

/** Wrapped in tuples so a union on either side is compared as a whole. */
type Extends<A, B> = [A] extends [B] ? true : false
type DoesNotExtend<A, B> = Extends<A, B> extends true ? false : true

const consumerStyles = stylex.create({
  layout: {
    width: '100%',
    maxWidth: '24rem',
    marginInline: 'auto',
  },
  ownedLayout: {
    flexDirection: 'row',
  },
})

export type InputAcceptsLayoutStyle = Assert<
  Extends<typeof consumerStyles.layout, NonNullable<InputProps['style']>>
>

export type InputRejectsOwnedLayout = Assert<
  DoesNotExtend<typeof consumerStyles.ownedLayout, NonNullable<InputProps['style']>>
>

export type InputRejectsReactInlineStyle = Assert<
  DoesNotExtend<{ width: string }, NonNullable<InputProps['style']>>
>
