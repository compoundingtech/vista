/**
 * Trace lens exploration (`/sk-explore-variants`). Use the frame's Combined / Side by side
 * switch alongside the pickers; B only affects the combined arrangement.
 *
 * - B bars: B1 stacked before/after thin bars, B2 after bar over a dashed before outline,
 *   B3 delta-only bar centered on zero. Current default: B1.
 * - O ordering: O1 tree order, O2 largest regression first, O3 changed spans only
 *   (tree order). Only sets the initial state of the lens's own sort/filter controls. Current default: O1.
 * - T time axis: T1 absolute ms on one shared axis, T2 each side normalized to its own
 *   trace total. Current default: T1.
 */
import type { Meta, StoryObj } from '@storybook/react'
import * as React from 'react'

import {
  TraceDiff,
  type TraceBarStyle,
  type TraceDiffSort,
  type TraceTimeAxis,
} from '../../../blocks/diff/TraceDiff.tsx'
import { type Variant, VariantPanel, VariantPicker } from '../../../explore.tsx'
import type { TraceData, TraceSpan } from '../../../model.ts'

type BarId = 'B1' | 'B2' | 'B3'
type OrderId = 'O1' | 'O2' | 'O3'
type AxisId = 'T1' | 'T2'

const barVariants: readonly Variant<BarId>[] = [
  { id: 'B1', description: 'Two thin bars per span: before (gray) above after (kind color).' },
  { id: 'B2', description: 'One after bar; the before span is a dashed ghost outline behind it.' },
  {
    id: 'B3',
    description: 'Only the duration delta, growing right (slower) or left (faster) from zero.',
  },
]
const orderVariants: readonly Variant<OrderId>[] = [
  { id: 'O1', description: 'Tree order with indentation; every span visible.' },
  { id: 'O2', description: 'Largest regression first; new errors pinned to the top.' },
  { id: 'O3', description: 'Tree order, unchanged spans hidden.' },
]
const axisVariants: readonly Variant<AxisId>[] = [
  { id: 'T1', description: 'Absolute ms: both sides on the longer trace’s axis.' },
  {
    id: 'T2',
    description: 'Normalized: each side spans 0–100% of its own total, exposing structural shifts.',
  },
]

const barStyle: Readonly<Record<BarId, TraceBarStyle>> = { B1: 'stacked', B2: 'ghost', B3: 'delta' }
const ordering: Readonly<
  Record<OrderId, { readonly sort: TraceDiffSort; readonly changedOnly: boolean }>
> = {
  O1: { sort: 'structure', changedOnly: false },
  O2: { sort: 'regression', changedOnly: false },
  O3: { sort: 'structure', changedOnly: true },
}
const timeAxis: Readonly<Record<AxisId, TraceTimeAxis>> = { T1: 'absolute', T2: 'normalized' }

const ms = (value: number) => String(BigInt(value) * 1_000_000n)
const span = (
  spanId: string,
  parentSpanId: string,
  serviceName: string,
  name: string,
  start: number,
  end: number,
  extra: Partial<TraceSpan> = {},
): TraceSpan => ({
  spanId,
  parentSpanId,
  serviceName,
  name,
  startTimeUnixNano: ms(start),
  endTimeUnixNano: ms(end),
  ...extra,
})
const attrs = (entries: Record<string, string>) =>
  Object.entries(entries).map(([key, value]) => ({ key, value }))

const checkoutBefore: TraceData = {
  traceId: 'synthetic-checkout-before',
  spans: [
    span('root', '', 'gateway', 'POST /checkout', 0, 420),
    span('auth', 'root', 'identity', 'verify token', 5, 30),
    span('cart', 'root', 'cart', 'load cart', 32, 110),
    span('cart-q', 'cart', 'postgres', 'SELECT cart_items', 40, 100, {
      attributes: attrs({ 'db.system': 'postgres', 'db.rows': '12' }),
    }),
    span('price', 'root', 'pricing', 'compute totals', 112, 180),
    span('tax', 'price', 'pricing', 'fetch tax rates', 120, 160, {
      attributes: attrs({ 'tax.region': 'eu' }),
    }),
    span('pay', 'root', 'payments', 'authorize card', 185, 360),
    span('risk', 'pay', 'payments', 'risk check', 190, 230),
    span('psp', 'pay', 'payments', 'provider call', 232, 350, {
      attributes: attrs({ 'payment.provider': 'stripe', 'http.status_code': '200' }),
      statusCode: 'STATUS_CODE_OK',
    }),
    span('order', 'root', 'orders', 'persist order', 362, 400),
    span('order-q', 'order', 'postgres', 'INSERT orders', 365, 395),
    span('notify', 'root', 'notify', 'enqueue receipt', 402, 415),
  ],
}

const checkoutAfter: TraceData = {
  traceId: 'synthetic-checkout-after',
  spans: [
    span('root', '', 'gateway', 'POST /checkout', 0, 610),
    span('auth', 'root', 'identity', 'verify token', 5, 29),
    span('cart', 'root', 'cart', 'load cart', 31, 108),
    span('cart-q', 'cart', 'postgres', 'SELECT cart_items', 38, 98, {
      attributes: attrs({ 'db.system': 'postgres', 'db.rows': '12' }),
    }),
    span('cache', 'root', 'cache', 'GET price cache', 110, 118),
    span('price', 'root', 'pricing', 'compute totals', 120, 330),
    span('tax', 'price', 'pricing', 'fetch tax rates', 128, 310, {
      attributes: attrs({ 'tax.region': 'eu,us' }),
    }),
    span('pay', 'root', 'payments', 'authorize card', 332, 560),
    span('risk', 'pay', 'payments', 'risk check', 335, 372),
    span('psp', 'pay', 'payments', 'provider call', 374, 550, {
      attributes: attrs({ 'payment.provider': 'adyen', 'http.status_code': '502' }),
      statusCode: 'STATUS_CODE_ERROR',
    }),
    span('order', 'root', 'orders', 'persist order', 562, 600),
    span('order-q', 'order', 'postgres', 'INSERT orders', 565, 596),
  ],
}

const TraceExploration = () => {
  const [bar, setBar] = React.useState<BarId>('B1')
  const [order, setOrder] = React.useState<OrderId>('O1')
  const [axis, setAxis] = React.useState<AxisId>('T1')
  return (
    <div>
      <VariantPanel>
        <VariantPicker
          label="Bars (combined)"
          variants={barVariants}
          value={bar}
          onChange={setBar}
        />
        <VariantPicker
          label="Ordering"
          variants={orderVariants}
          value={order}
          onChange={setOrder}
        />
        <VariantPicker label="Time axis" variants={axisVariants} value={axis} onChange={setAxis} />
      </VariantPanel>
      <TraceDiff
        key={order}
        id="explore-trace"
        title="POST /checkout"
        before={{ label: 'main', basis: 'observed', provenance: 'Synthetic trace · main @ 09:12' }}
        after={{
          label: 'PR #412',
          basis: 'observed',
          provenance: 'Synthetic trace · preview deploy @ 09:40',
        }}
        beforeTrace={checkoutBefore}
        afterTrace={checkoutAfter}
        bars={barStyle[bar]}
        timeAxis={timeAxis[axis]}
        defaultSort={ordering[order].sort}
        defaultChangedOnly={ordering[order].changedOnly}
      />
    </div>
  )
}

const meta = {
  title: 'Vista/Blocks/Diff/Explore/TraceDiff',
  component: TraceExploration,
} satisfies Meta
export default meta

/** Pick B/O/T variants above the live trace lens. */
export const Exploration: StoryObj = { render: () => <TraceExploration /> }
