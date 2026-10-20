import * as stylex from '@stylexjs/stylex'
import * as React from 'react'
import { Button } from 'react-aria-components'

import { Devbar } from '@overeng/devbar'
import type { DevbarPanel } from '@overeng/devbar'
import { devbarTokens } from '@overeng/devbar/tokens.stylex'
import { RpcExplorer } from '@overeng/effect-rpc-explorer-react'
import type { ExplorerClient } from '@overeng/effect-rpc-explorer'
import { darkExplorerTheme } from '@overeng/effect-rpc-explorer-react/themes'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { makeMeters, makeSeries, type FpsValue, type Series } from '@overeng/meters'
import { darkMeterTheme, frameBlock, lightMeterTheme } from '@overeng/meters/canvas'
import { makeBrowserPlatform } from '@overeng/meters/platform/browser'
import { MetersProvider, MeterStrip, useSeries } from '@overeng/meters/react'
import { frameSource } from '@overeng/meters/sources/frame'

import { type GrafanaTraceConfig, grafanaTraceHref } from './grafana-trace-url.ts'
import { makeVistaExplorerClient } from './rpc-explorer-client.ts'
import { useTheme } from './theme.ts'

const styles = stylex.create({
  panel: { position: 'relative', minWidth: 0, minHeight: 480 },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scale.space2,
    padding: scale.space2,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
  },
  label: { fontWeight: 600, color: tokens['--ds-foreground'] },
  filterButton: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    color: tokens['--ds-foreground'],
    cursor: 'pointer',
    font: 'inherit',
    overflowWrap: 'anywhere',
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  // Fill the devbar's fixed-height panel so only the explorer's own lists scroll.
  explorer: {
    minWidth: 0,
    minHeight: 0,
    flex: '1 1 0%',
    display: 'flex',
    flexDirection: 'column',
  },
  explorerView: { width: '100%', height: 'auto', minHeight: 0, flex: '1 1 0%' },
})

// Keep the shared developer tool neutral; Vista owns the Geist palette at its mount.
const vistaDevbarTheme = stylex.createTheme(devbarTokens, {
  canvas: tokens['--ds-background-100'],
  panel: tokens['--ds-background-200'],
  panelActive: tokens['--ds-gray-alpha-100'],
  border: tokens['--ds-gray-alpha-400'],
  text: tokens['--ds-foreground'],
  mutedText: tokens['--ds-gray-900'],
  focusRing: tokens['--ds-focus-color'],
  fontUi: scale.fontSans,
  fontData: scale.fontMono,
})

/**
 * Operator diagnostics: app-scoped RPC activity (clearable to all Vista traffic)
 * and a frame-rate meter in the same shared developer bar.
 * Records carrying a trace ID link to Grafana Explore when configured.
 */
export const RpcExplorerPanel = ({
  appIdentity,
  clientFactory = makeVistaExplorerClient,
  grafana,
}: {
  readonly appIdentity?: string | undefined
  readonly clientFactory?: ((appIdentity?: string) => ExplorerClient) | undefined
  readonly grafana?: GrafanaTraceConfig | undefined
}): React.ReactNode => {
  const [scope, setScope] = React.useState<'app' | 'all'>('app')
  const [{ meters, frames, blocks }] = React.useState(makeFrameDiagnostics)
  const [openPanel, setOpenPanel] = React.useState<string | undefined>('rpc')
  const [frozen, setFrozen] = React.useState(false)
  const theme = useTheme()
  const activeApp = scope === 'app' ? appIdentity : undefined
  const client = React.useMemo(() => clientFactory(activeApp), [activeApp, clientFactory])
  const traceHref = React.useMemo(() => grafanaTraceHref(grafana), [grafana])
  const panels: readonly DevbarPanel[] = [
    {
      id: 'rpc',
      label: 'RPC Explorer',
      render: () => (
        <div {...stylex.props(styles.explorer)}>
          <div {...stylex.props(styles.toolbar)}>
            <span {...stylex.props(styles.label)}>RPC activity</span>
            {appIdentity === undefined ? (
              <span>All apps</span>
            ) : (
              <Button
                {...stylex.props(styles.filterButton)}
                aria-pressed={scope === 'app'}
                onPress={() => setScope(scope === 'app' ? 'all' : 'app')}
              >
                {scope === 'app' ? `This app: ${appIdentity} ×` : 'All apps'}
              </Button>
            )}
          </div>
          <RpcExplorer
            key={activeApp ?? 'all'}
            client={client}
            presentation={{ style: styles.explorerView }}
            {...(traceHref === undefined ? {} : { traceHref })}
          />
        </div>
      ),
    },
    { id: 'fps', label: 'FPS', render: () => <FrameDetail frames={frames} /> },
  ]
  return (
    <section
      {...stylex.props(styles.panel, vistaDevbarTheme, theme === 'dark' && darkExplorerTheme)}
      aria-label="Vista developer tools"
    >
      <MetersProvider meters={meters}>
        <Devbar
          panels={panels}
          placement="container"
          openPanel={openPanel}
          onOpenPanelChange={setOpenPanel}
          strip={
            <MeterStrip
              meters={meters}
              blocks={blocks}
              theme={theme === 'dark' ? darkMeterTheme : lightMeterTheme}
              heightPx={24}
              frozen={frozen}
              onFrozenChange={setFrozen}
              onOpenDetail={() => setOpenPanel('fps')}
            />
          }
        />
      </MetersProvider>
    </section>
  )
}

/** One session lease for the panel host, shared by strip and selected FPS detail. */
const makeFrameDiagnostics = () => {
  const frames = makeSeries<FpsValue>({
    id: 'frames',
    label: 'FPS',
    unit: 'fps',
    capacity: 2600,
  })
  return {
    frames,
    meters: makeMeters({
      platform: makeBrowserPlatform(),
      sources: [frameSource({ id: 'frames', series: frames })],
    }),
    blocks: [frameBlock({ id: 'frames', series: frames, widthPx: 100 })],
  }
}

const FrameDetail = ({ frames }: { readonly frames: Series<FpsValue> }) => {
  const sample = useSeries(frames)
  return <pre aria-label="Frame diagnostics">{JSON.stringify(sample, undefined, 2)}</pre>
}
