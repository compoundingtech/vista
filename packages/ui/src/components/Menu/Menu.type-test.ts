import * as stylex from '@stylexjs/stylex'

import type { MenuItemProps, MenuProps } from './Menu.tsx'

const styles = stylex.create({
  menuLayout: { marginTop: '1rem' },
  menuGeometry: { minWidth: '10rem' },
  itemLayout: { marginLeft: '1rem' },
  itemVisual: { color: 'red' },
})

type Assert<T extends true> = T
type Extends<TValue, TTarget> = [TValue] extends [TTarget] ? true : false
type Rejects<TValue, TTarget> = Extends<TValue, TTarget> extends true ? false : true

type MenuStyle = NonNullable<MenuProps<object>['style']>
type MenuItemStyle = NonNullable<MenuItemProps['style']>

export type MenuAllowsLayoutAdaptation = Assert<Extends<typeof styles.menuLayout, MenuStyle>>
export type MenuRejectsOwnedGeometry = Assert<Rejects<typeof styles.menuGeometry, MenuStyle>>
export type MenuItemAllowsLayoutAdaptation = Assert<
  Extends<typeof styles.itemLayout, MenuItemStyle>
>
export type MenuItemRejectsOwnedVisuals = Assert<Rejects<typeof styles.itemVisual, MenuItemStyle>>
