import * as stylex from '@stylexjs/stylex'

import { tokens } from '../../foundations/tokens.stylex.ts'
import type { TabsProps, TabListProps, TabProps, TabPanelProps } from './Tabs.tsx'

/** Fails to compile unless `T` is exactly `true`. */
type Assert<T extends true> = T

/** Wrapped in tuples so a union on either side is compared as a whole. */
type Extends<A, B> = [A] extends [B] ? true : false
type DoesNotExtend<A, B> = Extends<A, B> extends true ? false : true

const consumerStyles = stylex.create({
  sharedLayout: {
    width: '100%',
    marginInline: 'auto',
  },
  panelLayout: {
    height: '20rem',
    minHeight: '10rem',
    overflowY: 'auto',
  },
  rootOwned: {
    flexDirection: 'row',
  },
  listOwned: {
    borderBottomColor: tokens['--ds-gray-1000'],
  },
  tabOwned: {
    color: tokens['--ds-gray-1000'],
  },
  panelOwned: {
    paddingTop: '1rem',
  },
})

export type TabsAcceptsLayoutStyle = Assert<
  Extends<typeof consumerStyles.sharedLayout, NonNullable<TabsProps['style']>>
>
export type TabListAcceptsLayoutStyle = Assert<
  Extends<typeof consumerStyles.sharedLayout, NonNullable<TabListProps<object>['style']>>
>
export type TabAcceptsLayoutStyle = Assert<
  Extends<typeof consumerStyles.sharedLayout, NonNullable<TabProps['style']>>
>
export type TabPanelAcceptsConsumerLayout = Assert<
  Extends<typeof consumerStyles.panelLayout, NonNullable<TabPanelProps['style']>>
>

export type TabsRejectsOwnedLayout = Assert<
  DoesNotExtend<typeof consumerStyles.rootOwned, NonNullable<TabsProps['style']>>
>
export type TabListRejectsOwnedBorder = Assert<
  DoesNotExtend<typeof consumerStyles.listOwned, NonNullable<TabListProps<object>['style']>>
>
export type TabRejectsOwnedColor = Assert<
  DoesNotExtend<typeof consumerStyles.tabOwned, NonNullable<TabProps['style']>>
>
export type TabPanelRejectsOwnedPadding = Assert<
  DoesNotExtend<typeof consumerStyles.panelOwned, NonNullable<TabPanelProps['style']>>
>
