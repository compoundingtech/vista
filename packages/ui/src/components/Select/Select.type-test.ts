import * as stylex from '@stylexjs/stylex'

import type { SelectProps } from './Select.tsx'

/** Fails to compile unless `T` is exactly `true`. */
type Assert<T extends true> = T

/** Wrapped in tuples so a union on either side is compared as a whole. */
type Extends<A, B> = [A] extends [B] ? true : false
type DoesNotExtend<A, B> = Extends<A, B> extends true ? false : true

const consumerStyles = stylex.create({
  vistaLayout: {
    flex: '0 1 16rem',
    width: 'clamp(7rem, 22vw, 16rem)',
    minWidth: 0,
    maxWidth: '100%',
  },
  ownedLayout: {
    display: 'grid',
    flexDirection: 'row',
    gap: '1rem',
  },
})

export type SelectAcceptsVistaLayout = Assert<
  Extends<typeof consumerStyles.vistaLayout, NonNullable<SelectProps<object>['style']>>
>

export type SelectRejectsOwnedLayout = Assert<
  DoesNotExtend<typeof consumerStyles.ownedLayout, NonNullable<SelectProps<object>['style']>>
>

export type SelectRejectsReactInlineStyle = Assert<
  DoesNotExtend<{ width: string }, NonNullable<SelectProps<object>['style']>>
>
