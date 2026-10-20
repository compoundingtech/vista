import type { Decorator, Preview } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { lazy, Suspense, useEffect } from 'react'

import { setTheme } from '@vista/ui/foundations'
import { tokens } from '@vista/ui/tokens.stylex'
import '@vista/ui/styles.css'

// The client entry's presentation CSS (prose headings, semantic chrome). Without
// it, heading styles depended on whether an earlier story imported `index.ts`.
import '../src/document-reset.css'
import '../src/semantic-chrome.css'
import { VistaHostRuntimeProvider } from '../src/host-runtime.tsx'
import { serviceHostRuntime } from '../src/service-host-runtime.ts'
import { ThemeProvider } from '../src/theme.ts'

setTheme('dark')

// Human→agent visual annotation overlay (same lazy mount as AppShell). Off under
// webdriver so play/Playwright runs never see the overlay.
const Agentation = lazy(() =>
  import('agentation').then(({ Agentation }) => ({ default: Agentation })),
)
const showAgentation = typeof navigator !== 'undefined' && !navigator.webdriver

/**
 * Theme context applies the same StyleX theme classes as the platform shell.
 * The client stylesheet below owns the small document reset required by both
 * Storybook and published Vista apps; no utility-CSS pipeline participates.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as 'light' | 'dark') ?? 'dark'
  useEffect(() => {
    setTheme(theme)
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.backgroundColor = 'var(--ds-background-100)'
  }, [theme])
  return (
    <ThemeProvider value={theme}>
      <VistaHostRuntimeProvider value={serviceHostRuntime}>
        <section {...stylex.props(styles.canvas)} data-theme={theme} aria-label="Vista story canvas">
          <Story />
        </section>
      </VistaHostRuntimeProvider>
      {showAgentation ? (
        <Suspense fallback={null}>
          <Agentation />
        </Suspense>
      ) : null}
    </ThemeProvider>
  )
}

/**
 * Reduced-motion review global. Vista blocks animate (chart transitions, the
 * React Flow canvas, the Mermaid pan/zoom), and the published surface must stay
 * legible for a reader who asked the OS to stop moving things. Storybook has no
 * built-in `prefers-reduced-motion` toolbar, and the media query itself is not
 * settable from the page, so the switch is modelled the way the app models it:
 * a document attribute plus a stylesheet that collapses durations. Reviewing
 * this from the toolbar is the only cheap way to see it at all.
 */
const reducedMotionCss = `
*, *::before, *::after {
  animation-delay: 0ms !important;
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-delay: 0ms !important;
  transition-duration: 1ms !important;
  scroll-behavior: auto !important;
}
`

const withMotion: Decorator = (Story, context) => {
  const reduced = context.globals.motion === 'reduced'
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-reduced-motion',
      reduced ? 'reduce' : 'no-preference',
    )
  }, [reduced])
  return (
    <>
      {reduced ? <style>{reducedMotionCss}</style> : null}
      <Story />
    </>
  )
}

/**
 * Review viewports. Named by device class AND size because a review comment
 * that says "broken on mobile" is unactionable without the width it broke at.
 * No viewport is selected initially: the default canvas is the responsive one,
 * so a story that is only ever seen at a fixed width is an opt-in.
 */
const viewportOptions = {
  mobile: { name: 'Mobile — 390×844', styles: { width: '390px', height: '844px' }, type: 'mobile' },
  tablet: {
    name: 'Tablet — 834×1112',
    styles: { width: '834px', height: '1112px' },
    type: 'tablet',
  },
  laptop: {
    name: 'Laptop — 1280×800',
    styles: { width: '1280px', height: '800px' },
    type: 'desktop',
  },
  wide: {
    name: 'Wide — 1728×1080',
    styles: { width: '1728px', height: '1080px' },
    type: 'desktop',
  },
} as const

const preview: Preview = {
  decorators: [withTheme, withMotion],
  /* Storybook 9 removed `globalTypes.defaultValue`; initial global values live
   * here or the toolbar starts undefined and the first render is unthemed. */
  initialGlobals: {
    theme: 'dark',
    motion: 'system',
  },
  globalTypes: {
    theme: {
      description: 'Light / dark theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    motion: {
      description: 'Motion preference (prefers-reduced-motion review switch)',
      toolbar: {
        title: 'Motion',
        icon: 'play',
        items: [
          { value: 'system', title: 'Full motion' },
          { value: 'reduced', title: 'Reduced motion' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    viewport: { options: viewportOptions },
  },
}

export default preview

const styles = stylex.create({
  canvas: {
    minHeight: '100vh',
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
  },
})
