import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import {
  ResizableSplit,
  projectResizeIntent,
  projectUsefulExtentBounds,
  resizeDeltaForMove,
  resizeIntentStorageKey,
  type AppVersionPreferenceIdentity,
  type ResizeIntent,
  resolveMeasuredSplitSize,
  resolveSplitBounds,
} from './ResizableSplit.tsx'

test('renders two panes with an accessible separator controlling the first pane', () => {
  const html = renderToStaticMarkup(
    <ResizableSplit
      id="review-split"
      direction="horizontal"
      initialSize="18rem"
      minSize="12rem"
      maxSize="40rem"
      first={<nav>Files</nav>}
      second={<main>Diff</main>}
    />,
  )

  expect(html).toContain('id="review-split-first-pane"')
  expect(html).toContain('id="review-split-second-pane"')
  expect(html).toContain('role="separator"')
  expect(html).toContain('aria-orientation="vertical"')
  expect(html).toContain('aria-controls="review-split-first-pane"')
  expect(html).toContain('tabindex="0"')
  expect(html).toContain('Files')
  expect(html).toContain('Diff')
  expect(html).toContain('Reset size')
})

test('omitting the second pane renders a separator on the first pane edge', () => {
  const html = renderToStaticMarkup(
    <ResizableSplit
      id="review-edge"
      direction="vertical"
      initialSize="34rem"
      minSize="16rem"
      first={<main>Rail and diff</main>}
    />,
  )

  expect(html).toContain('id="review-edge-first-pane"')
  expect(html).not.toContain('id="review-edge-second-pane"')
  expect(html).toContain('role="separator"')
  expect(html).toContain('aria-orientation="horizontal"')
  expect(html).toContain('aria-controls="review-edge-first-pane"')
  expect(html).toContain('Rail and diff')
})

test('settling layout re-adopts the responsive default until the user resizes', () => {
  const transientBounds = { min: 256, max: 256 }
  const settledBounds = { min: 256, max: 341 }

  const transientSize = resolveMeasuredSplitSize(undefined, 648, transientBounds, false)
  expect(transientSize).toBe(256)
  expect(resolveMeasuredSplitSize(transientSize, 648, settledBounds, false)).toBe(341)
  expect(resolveMeasuredSplitSize(300, 648, settledBounds, true)).toBe(300)
})

test('a nested responsive default can shrink after its parent settles', () => {
  expect(resolveMeasuredSplitSize(160, 136, { min: 128, max: 340 }, false)).toBe(136)
})

test('an edge split can grow beyond the viewport remainder when it declares a maximum', () => {
  expect(
    resolveSplitBounds({
      containerSize: 300,
      viewportSize: 340,
      configuredMin: 256,
      configuredMax: 1_200,
      isEdge: true,
    }),
  ).toEqual({ min: 256, max: 1_200 })
  expect(
    resolveSplitBounds({
      containerSize: 300,
      viewportSize: 340,
      configuredMin: 256,
      configuredMax: undefined,
      isEdge: true,
    }),
  ).toEqual({ min: 256, max: 339 })
})

test('keyboard movement uses 16px steps and 64px shifted steps on the split axis', () => {
  expect(
    resizeDeltaForMove({
      direction: 'horizontal',
      deltaX: 1,
      deltaY: 0,
      pointerType: 'keyboard',
      shiftKey: false,
    }),
  ).toBe(16)
  expect(
    resizeDeltaForMove({
      direction: 'horizontal',
      deltaX: -1,
      deltaY: 0,
      pointerType: 'keyboard',
      shiftKey: true,
    }),
  ).toBe(-64)
  expect(
    resizeDeltaForMove({
      direction: 'vertical',
      deltaX: 0,
      deltaY: 1,
      pointerType: 'keyboard',
      shiftKey: false,
    }),
  ).toBe(16)
})

test('latent explicit intent regrows after a temporary useful-content cap', () => {
  const intent: ResizeIntent = { _tag: 'explicit', px: 500 }
  const contracted = projectUsefulExtentBounds({
    bounds: { min: 256, max: 607 },
    contentSemantics: 'finite-scroll',
    readiness: { _tag: 'settled', epoch: 4 },
    sample: { epoch: 4, px: 224 },
  })
  expect(contracted).toEqual({ min: 224, max: 224 })
  expect(projectResizeIntent(intent, 607, contracted)).toBe(224)

  const regrown = projectUsefulExtentBounds({
    bounds: { min: 256, max: 607 },
    contentSemantics: 'finite-scroll',
    readiness: { _tag: 'settled', epoch: 5 },
    sample: { epoch: 5, px: 607 },
  })
  expect(projectResizeIntent(intent, 607, regrown)).toBe(500)
})

test('stale and unsupported useful extents fail open without capping bounds', () => {
  const bounds = { min: 256, max: 607 }
  expect(
    projectUsefulExtentBounds({
      bounds,
      contentSemantics: 'finite-scroll',
      readiness: { _tag: 'settled', epoch: 8 },
      sample: { epoch: 7, px: 224 },
    }),
  ).toBe(bounds)
  expect(
    projectUsefulExtentBounds({
      bounds,
      contentSemantics: 'finite-scroll',
      readiness: { _tag: 'unsupported' },
      sample: undefined,
    }),
  ).toBe(bounds)
})

test('symbolic minimum and maximum-useful intents follow changing bounds', () => {
  expect(projectResizeIntent({ _tag: 'minimum' }, 400, { min: 120, max: 500 })).toBe(120)
  expect(projectResizeIntent({ _tag: 'minimum' }, 400, { min: 80, max: 240 })).toBe(80)
  expect(projectResizeIntent({ _tag: 'maximum-useful' }, 400, { min: 120, max: 500 })).toBe(500)
  expect(projectResizeIntent({ _tag: 'maximum-useful' }, 400, { min: 80, max: 240 })).toBe(240)
})

test('resize preference keys isolate exact publications and explicit split ids', () => {
  const identity: AppVersionPreferenceIdentity = {
    owner: 'vista.tests',
    slug: 'review/app',
    version: 'v3',
  }
  expect(resizeIntentStorageKey(identity, 'diff/height')).toBe(
    'vista.blocks.v1/resize-intent/vista.tests/review%2Fapp/v3/diff%2Fheight',
  )
  expect(resizeIntentStorageKey({ ...identity, version: 'v4' }, 'diff/height')).not.toBe(
    resizeIntentStorageKey(identity, 'diff/height'),
  )
})
