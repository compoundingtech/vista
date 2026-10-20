import * as stylex from '@stylexjs/stylex'

import type { CommandMenuProps } from './CommandMenu.tsx'

const styles = stylex.create({
  rootLayout: { marginInline: '1rem' },
  ownedOverlay: { position: 'absolute', backgroundColor: 'transparent' },
})

type Assert<T extends true> = T
type Extends<TValue, TTarget> = [TValue] extends [TTarget] ? true : false
type Rejects<TValue, TTarget> = Extends<TValue, TTarget> extends true ? false : true

type CommandMenuStyle = NonNullable<CommandMenuProps['style']>

export type CommandMenuAllowsRootLayoutAdaptation = Assert<
  Extends<typeof styles.rootLayout, CommandMenuStyle>
>
export type CommandMenuRejectsOwnedOverlay = Assert<
  Rejects<typeof styles.ownedOverlay, CommandMenuStyle>
>
export type CommandMenuRejectsReactInlineStyle = Assert<
  Rejects<{ marginInline: string }, CommandMenuStyle>
>
