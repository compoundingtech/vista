import * as React from 'react'

import {
  counterSource,
  counterToken,
  makeInstrumentation,
  makeMeters,
  makeSeries,
  type CounterToken,
  type FpsValue,
  type Instrumentation,
  type NumberValue,
  type Series,
} from '@overeng/meters'
import { darkMeterTheme, frameBlock } from '@overeng/meters/canvas'
import { makeBrowserPlatform } from '@overeng/meters/platform/browser'
import {
  MetersPanel,
  MetersProvider,
  MeterStrip,
  RenderProfiler,
  useSeries,
} from '@overeng/meters/react'
import { frameSource } from '@overeng/meters/sources/frame'

import { MetersTestHost } from './perf-bridge.dev.tsx'

/** One host-scoped counter declaration per actual Scale profiler boundary. */
export const ScaleDiagnostics = ({
  ids,
  children,
}: {
  readonly ids: readonly string[]
  readonly children: React.ReactNode
}) => {
  const [diagnostics] = React.useState(() => {
    const tokens = new Map(
      ['page', ...ids].map((id) => [id, counterToken({ id: `Renders.${id}` })]),
    )
    const instrumentation = makeInstrumentation({ counters: [...tokens.values()], gauges: [] })
    const frames = makeSeries<FpsValue>({ id: 'frames', label: 'FPS', unit: 'fps', capacity: 2600 })
    return {
      frames,
      tokens,
      instrumentation,
      meters: makeMeters({
        platform: makeBrowserPlatform(),
        sources: [
          frameSource({ id: 'frames', series: frames }),
          ...[...tokens].map(([id, token]) =>
            counterSource({
              id: `Renders.${id}`,
              series: makeSeries<NumberValue>({ id, label: id, unit: 'count', capacity: 100 }),
              instrumentation,
              token,
            }),
          ),
        ],
      }),
      blocks: [frameBlock({ id: 'frames', series: frames, widthPx: 100 })],
    }
  })
  const [frozen, setFrozen] = React.useState(false)
  const [selected, setSelected] = React.useState<string | undefined>()
  return (
    <DiagnosticsContext value={diagnostics}>
      <MetersProvider meters={diagnostics.meters}>
        <MetersTestHost meters={diagnostics.meters} />
        <MeterStrip
          meters={diagnostics.meters}
          blocks={diagnostics.blocks}
          theme={darkMeterTheme}
          heightPx={24}
          frozen={frozen}
          onFrozenChange={setFrozen}
          onOpenDetail={({ id }) => setSelected(id)}
        />
        {selected !== undefined && (
          <section aria-label="Scale meter detail">
            <button type="button" onClick={() => setSelected(undefined)}>
              Close meter detail
            </button>
            <MetersPanel
              blocks={diagnostics.blocks}
              theme={darkMeterTheme}
              selected={selected}
              onSelect={({ id }) => setSelected(id)}
              renderDetail={() => <FrameDetail series={diagnostics.frames} />}
            />
          </section>
        )}
        {children}
      </MetersProvider>
    </DiagnosticsContext>
  )
}

/** The host and lens profilers share exactly the registry bound to the session. */
export const ScaleProfiler = ({
  id,
  children,
}: {
  readonly id: string
  readonly children: React.ReactNode
}) => {
  const diagnostics = React.useContext(DiagnosticsContext)
  const token = diagnostics?.tokens.get(id)
  if (diagnostics === undefined || token === undefined) {
    throw new Error(`Undeclared Scale profiler: ${id}`)
  }
  return (
    <RenderProfiler id={id} instrumentation={diagnostics.instrumentation} counter={token}>
      {children}
    </RenderProfiler>
  )
}

const FrameDetail = ({ series }: { readonly series: Series<FpsValue> }) => {
  const sample = useSeries(series)
  return <pre aria-label={series.label}>{JSON.stringify(sample, undefined, 2)}</pre>
}

const DiagnosticsContext = React.createContext<
  | {
      readonly instrumentation: Instrumentation
      readonly tokens: ReadonlyMap<string, CounterToken>
    }
  | undefined
>(undefined)
