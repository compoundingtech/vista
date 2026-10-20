import { expect, test, type Page } from '@playwright/test'

/**
 * Storybook globals travel in ONE `globals=` query param as `key:value` pairs
 * separated by `;`, so the helper takes the whole map rather than a theme
 * argument: the reduced-motion review global is selected the same way the theme
 * is, and a second bespoke parameter would have gone stale the moment a third
 * global landed.
 */
const storyUrl = (id: string, globals: Record<string, string> = { theme: 'dark' }) => {
  const encoded = Object.entries(globals)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
  return `/iframe.html?viewMode=story&globals=${encoded}&id=${id}`
}

const expectThemeBackground = async (page: Page, theme: 'dark' | 'light') => {
  const colors = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    html: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
    canvas: getComputedStyle(
      document.querySelector('[aria-label="Vista story canvas"]') ?? document.body,
    ).backgroundColor,
  }))
  expect(colors.theme).toBe(theme)
  expect(colors.html).toBe(colors.body)
  expect(colors.body).toBe(colors.canvas)
  expect(colors.html).not.toBe('rgba(0, 0, 0, 0)')
}

const chart = (page: Page, name: string) => page.getByRole('figure', { name })

const frozenBadge = (page: Page) => page.getByTitle('point-in-time copy captured at publish')

test.describe('Vista Storybook smoke', () => {
  for (const { story, path } of [
    { story: 'binary-first', path: 'src/supervisor.ts' },
    { story: 'preselected-file', path: 'src/projection/tmux.ts' },
  ]) {
    test(`opens ${story} with matching file-tree selection and diff pane`, async ({ page }) => {
      await page.goto(storyUrl(`vista-blocks-code-pull-request-viewer--${story}`))
      const rail = page.getByRole('navigation', { name: 'Changed files' })
      await expect(
        rail.getByRole('treeitem', { name: path.split('/').at(-1)!, selected: true, exact: true }),
      ).toBeVisible()
      const header = page.locator('[data-diffs-header]').filter({ hasText: path }).first()
      await expect(header).toBeInViewport()
    })
  }

  // The hand-rolled `OtelTrace` waterfall story is retired (decision 0040: the
  // Grafana island is the single trace renderer, exercised in the real pipeline by
  // the service `telemetry-trace-island.browser.test.ts`, not in Storybook — the
  // island chunk can't render here, same as `MetricBlock`). The theme-link smoke
  // therefore rides a surviving deterministic story (the Recharts area chart).
  test('links Storybook theme globals to Vista and Geist dark page background', async ({
    page,
  }) => {
    await page.goto(storyUrl('vista-blocks-data-chart--default', { theme: 'dark' }))
    await expect(chart(page, 'Attach latency')).toBeVisible()
    await expectThemeBackground(page, 'dark')

    await page.goto(storyUrl('vista-blocks-data-chart--default', { theme: 'light' }))
    await expect(chart(page, 'Attach latency')).toBeVisible()
    await expectThemeBackground(page, 'light')
  })

  // The reduced-motion toolbar global is a REVIEW control: `prefers-reduced-motion`
  // cannot be set from the page, so the preview models it as a document attribute
  // plus a duration-collapsing stylesheet. Both halves are asserted, because an
  // attribute with no stylesheet behind it is a switch that does nothing.
  test('applies the reduced-motion review global to the story document', async ({ page }) => {
    await page.goto(
      storyUrl('vista-blocks-data-chart--default', { theme: 'dark', motion: 'system' }),
    )
    await expect(chart(page, 'Attach latency')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'no-preference')

    await page.goto(
      storyUrl('vista-blocks-data-chart--default', { theme: 'dark', motion: 'reduced' }),
    )
    const reducedChart = chart(page, 'Attach latency')
    await expect(reducedChart).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'reduce')
    // Every declared transition collapses, so a shorthand with a list of
    // durations reads as a list of collapsed ones — assert the set, not a
    // single string.
    const durations = await reducedChart.evaluate((el) =>
      getComputedStyle(el)
        .transitionDuration.split(',')
        .map((d) => d.trim()),
    )
    expect(durations.filter((duration) => duration !== '0.001s')).toEqual([])
  })

  test('renders the document-anchored shell and preserves version routing', async ({ page }) => {
    await page.goto(storyUrl('vista-shell-appshell-navigation--pinned-current'))

    const header = page.locator('[data-vista-shell-header]')
    await expect(page.getByRole('heading', { name: 'Agent-run viewer architecture' })).toBeVisible()
    await expect(header).toHaveAttribute('data-vista-header-variant', 'H1')
    await expect(header.getByRole('link', { name: 'Vista home' })).toHaveAttribute('href', '/')
    await expect(header.locator('[data-vista-document-identity]')).toHaveText(
      'Where this came from',
    )
    await expect(page).toHaveTitle('Agent-run viewer architecture')
    await expect(header.getByRole('button', { name: /^Theme: (Dark|Light)$/u })).toBeVisible()
    const contentFrame = page.locator('[data-vista-content-frame]')
    const frameBox = await contentFrame.boundingBox()
    expect(frameBox?.x).toBe(0)
    expect(frameBox?.width).toBe(await page.evaluate(() => document.documentElement.clientWidth))

    const versionControl = header.locator('[data-vista-version-control]').getByRole('button')
    await expect(versionControl).toContainText('Readable shell metadata')
    await versionControl.click()
    const previous = page.getByRole('option', { name: /v2 Lineage guarantee/u })
    await expect(previous).toContainText('agent vista-publisher-07')
    await expect(previous).toContainText(
      'Made publication lineage visible without moving document identity.',
    )
    await previous.click()
    await expect(page).toHaveURL(/\/r\/vista\.tests\/agent-run-viewer\/v2$/u)
  })

  test('opens the version selector from the keyboard without losing its selection', async ({
    page,
  }) => {
    await page.goto(storyUrl('vista-shell-appshell-navigation--pinned-current'))

    const version = page.getByRole('button', { name: 'Vista version' })
    await expect(version).toContainText('Readable shell metadata')
    await expect(version).toContainText('v3')

    await version.focus()
    await page.keyboard.press('Enter')
    const versionList = page.getByRole('listbox')
    await expect(versionList).toBeVisible()
    await expect(
      versionList.getByRole('option', {
        name: /v3 Readable shell metadata/u,
        selected: true,
      }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(versionList).toBeHidden()
    await expect(version).toBeFocused()
  })

  test('keeps both selectors inside the narrow header in light and dark themes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 844 })

    for (const id of [
      'vista-shell-appshell-responsive--narrow-layout',
      'vista-shell-appshell-responsive--narrow-layout-light',
    ]) {
      await page.goto(storyUrl(id))

      const header = page.locator('[data-vista-shell-header]')
      const headerBounds = await header.boundingBox()
      expect(headerBounds).not.toBeNull()

      const trigger = page.getByRole('button', { name: 'Vista version' })
      await expect(trigger).toBeVisible()
      const rootBounds = await trigger.locator('..').boundingBox()
      expect(rootBounds).not.toBeNull()
      expect(rootBounds!.width).toBeGreaterThan(0)
      expect(rootBounds!.x).toBeGreaterThanOrEqual(headerBounds!.x)
      expect(rootBounds!.x + rootBounds!.width).toBeLessThanOrEqual(
        headerBounds!.x + headerBounds!.width,
      )
      expect(rootBounds!.y).toBeGreaterThanOrEqual(headerBounds!.y)
      expect(rootBounds!.y + rootBounds!.height).toBeLessThanOrEqual(
        headerBounds!.y + headerBounds!.height,
      )
    }
  })

  // The shell's document outline is a contract, not a detail: the app title is the
  // ONE semantic `h1`, while H1 repeats document identity as non-heading chrome.
  // A second exposed `h1` is exactly the regression a header rework produces, and
  // nothing else would catch it.
  test('exposes exactly one semantic h1 across shell variants', async ({ page }) => {
    for (const id of [
      'vista-shell-appshell-navigation--pinned-current',
      'vista-shell-appshell-navigation--pinned-stale',
      'vista-shell-appshell-navigation--follow-latest',
    ]) {
      await page.goto(storyUrl(id))
      const headings = page.getByRole('heading', { level: 1 })
      await expect(headings).toHaveCount(1)
      await expect(headings).toHaveText('Agent-run viewer architecture')
    }
  })

  test('tracks the active outline label without changing document identity', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 844 })
    await page.goto(storyUrl('vista-shell-appshell-metadata--document-anchored-title'))

    const identity = page.locator('[data-vista-document-identity]')
    await expect(identity).toHaveText('Where this came from')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Agent-run viewer architecture',
    )
    await expect(page).toHaveTitle('Agent-run viewer architecture')

    await page.locator('#lineage').evaluate((element) => {
      window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 64 })
    })
    await expect(identity).toHaveText('Lineage guarantee')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Agent-run viewer architecture',
    )
    await expect(page).toHaveTitle('Agent-run viewer architecture')
  })

  test('truncates a long active heading in the narrow shell bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(storyUrl('vista-shell-appshell-sizing--long-title'))

    const identity = page.locator('[data-vista-document-identity]')
    await expect(identity).toHaveText(
      'Agent-run viewer architecture, lineage guarantees and the publish-time projection boundary across every owner-scoped route',
    )
    await expect(identity).toHaveCSS('white-space', 'nowrap')
    await expect(identity).toHaveCSS('text-overflow', 'ellipsis')
    expect(await identity.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    )
    await expect(page).toHaveTitle(
      'Agent-run viewer architecture, lineage guarantees and the publish-time projection boundary across every owner-scoped route',
    )
  })

  test('renders lazy changelog ready, loading, failed, and exact-build empty states', async ({
    page,
  }) => {
    await page.goto(storyUrl('vista-shell-appshell-metadata--changelog-ready'))
    const ready = page.getByRole('region', { name: 'Vista changelog' })
    await expect(ready).toContainText('Readable shell metadata')
    await expect(ready).toContainText('Full history · 5 entries')
    await expect(ready).not.toContainText('2026-09-20-readable-shell-metadata')

    await page.goto(storyUrl('vista-shell-appshell-metadata--changelog-loading'))
    await expect(page.getByRole('status')).toHaveText('Loading release notes…')

    await page.goto(storyUrl('vista-shell-appshell-metadata--changelog-failed'))
    await expect(page.getByRole('alert')).toHaveText(
      'Release notes could not be loaded for this build.',
    )
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()

    await page.goto(storyUrl('vista-shell-appshell-metadata--changelog-empty'))
    await expect(page.getByRole('region', { name: 'Vista changelog' })).toContainText(
      'No release notes are available for this build.',
    )
  })

  test('uses a Diff bottom border as the keyboard-resizable height edge', async ({ page }) => {
    await page.goto(storyUrl('vista-blocks-code-diff--bottom-edge-height-resize'))

    const diff = page.locator('#diff-bottom-edge')
    const split = page.locator('#diff-bottom-edge-height-resize')
    const separator = page.getByRole('separator', { name: 'Resize first pane' })
    await expect(diff).toHaveAttribute('data-vista-diff-height-resizable', '')
    await expect(separator).toHaveAttribute('aria-orientation', 'horizontal')
    await expect(diff).toHaveCSS('border-bottom-width', '0px')
    await expect(split).toHaveCSS('border-bottom-width', '0px')

    await separator.focus()
    await expect(separator).toBeFocused()
    const minValue = await separator.getAttribute('aria-valuemin')
    const maxValue = await separator.getAttribute('aria-valuemax')
    expect(minValue).not.toBeNull()
    expect(maxValue).not.toBeNull()
    if (minValue === null || maxValue === null) throw new Error('splitter bounds must be exposed')
    await separator.press('Home')
    await expect(separator).toHaveAttribute('aria-valuenow', minValue)
    await separator.press('End')
    await expect(separator).toHaveAttribute('aria-valuenow', maxValue)
    const edgeGap = await page.evaluate(() => {
      const figure = document.querySelector('#diff-bottom-edge')
      const edge = document.querySelector('#diff-bottom-edge-height-resize-separator')
      if (figure === null || edge === null) throw new Error('resize edge must be rendered')
      const figureRect = figure.getBoundingClientRect()
      const edgeRect = edge.getBoundingClientRect()
      return Math.abs(figureRect.bottom - edgeRect.top)
    })
    expect(edgeGap).toBeLessThanOrEqual(1)
  })

  test('persists content width per canonical App across reloads without leaking', async ({
    page,
  }) => {
    await page.goto(storyUrl('vista-shell-appshell-navigation--pinned-current'))
    await page.getByRole('button', { name: 'Switch to centered maximum width' }).click()
    await expect(page.locator('[data-vista-content-frame]')).toHaveAttribute(
      'data-vista-content-width',
      'contained',
    )

    await page.reload()
    await expect(page.locator('[data-vista-content-frame]')).toHaveAttribute(
      'data-vista-content-width',
      'contained',
    )

    await page.goto(storyUrl('vista-shell-appshell-sizing--resize-preference-other-app'))
    await expect(page.locator('[data-vista-content-frame]')).toHaveAttribute(
      'data-vista-content-width',
      'full',
    )
  })

  test('scopes latent resize intent to resolved publication and reset deletes it', async ({
    page,
  }) => {
    const pinned = 'vista-shell-appshell-sizing--resize-preference-pinned'
    const alias = 'vista-shell-appshell-sizing--resize-preference-latest-alias'
    const separator = () => page.getByRole('separator', { name: 'Resize first pane' })
    const reset = () => page.getByRole('button', { name: 'Reset size' })
    const storageKey =
      'vista.blocks.v1/resize-intent/vista.tests/agent-run-viewer/v3/publication-resize-probe'

    await page.goto(storyUrl(pinned))
    await separator().focus()
    await separator().press('ArrowRight')
    expect(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), storageKey),
    ).toMatchObject({ version: 1, intent: { _tag: 'explicit' } })
    await separator().press('End')
    const maximum = await separator().getAttribute('aria-valuemax')
    if (maximum === null) throw new Error('splitter maximum must be exposed')
    await expect(separator()).toHaveAttribute('aria-valuenow', maximum)
    expect(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), storageKey),
    ).toEqual({ version: 1, intent: { _tag: 'maximum-useful' } })

    await page.reload()
    await expect(separator()).toHaveAttribute('aria-valuenow', maximum)

    await page.goto(storyUrl(alias))
    await expect(separator()).toHaveAttribute('aria-valuenow', maximum)

    await page.goto(storyUrl('vista-shell-appshell-sizing--resize-preference-previous-version'))
    await expect(separator()).toHaveAttribute('aria-valuenow', '260')
    await page.goto(storyUrl('vista-shell-appshell-sizing--resize-preference-other-app'))
    await expect(separator()).toHaveAttribute('aria-valuenow', '260')

    await page.goto(storyUrl(pinned))
    await reset().focus()
    await reset().press('Enter')
    await expect(separator()).toHaveAttribute('aria-valuenow', '260')
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull()

    await separator().press('End')
    await reset().focus()
    await reset().press('Space')
    await expect(separator()).toHaveAttribute('aria-valuenow', '260')

    await separator().press('End')
    await reset().click()
    await expect(separator()).toHaveAttribute('aria-valuenow', '260')

    await separator().press('End')
    await separator().dblclick()
    await expect(separator()).toHaveAttribute('aria-valuenow', '260')
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull()
  })

  test('caps only settled Diff content and removes a collapsed range separator', async ({
    page,
  }) => {
    await page.goto(storyUrl('vista-blocks-code-diff--collapsed-useful-extent'))
    const shortDiff = page.locator('#diff-collapsed-useful-extent')
    await expect(shortDiff).toHaveAttribute('data-vista-useful-extent')
    await expect(page.getByRole('separator', { name: 'Resize first pane' })).toHaveCount(0)

    const exactExtent = await shortDiff.evaluate((figure) => {
      const logical = Number(figure.getAttribute('data-vista-diff-logical-extent'))
      const useful = Number(figure.getAttribute('data-vista-useful-extent'))
      const toolbar = figure.querySelector<HTMLElement>('[role="group"]')?.parentElement
      const caption = figure.querySelector('figcaption')
      const style = getComputedStyle(figure)
      return {
        useful,
        expected:
          logical +
          (toolbar?.offsetHeight ?? 0) +
          (caption instanceof HTMLElement ? caption.offsetHeight : 0) +
          Number.parseFloat(style.borderBlockStartWidth) +
          Number.parseFloat(style.borderBlockEndWidth),
      }
    })
    expect(exactExtent.useful).toBe(exactExtent.expected)

    await page.goto(storyUrl('vista-blocks-code-diff--virtualized-useful-extent'))
    const longDiff = page.locator('#diff-virtualized-useful-extent')
    await expect(longDiff).toHaveAttribute('data-vista-diff-logical-extent')
    const extents = await longDiff.evaluate((figure) => ({
      logical: Number(figure.getAttribute('data-vista-diff-logical-extent')),
      rendered: figure.getBoundingClientRect().height,
    }))
    expect(extents.logical).toBeGreaterThan(extents.rendered)
  })

  test('shows only the persistent outline at supported widths', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 844 })
    await page.goto(storyUrl('vista-shell-appshell-navigation--pinned-current'))

    const outline = page.getByRole('navigation', { name: 'Sections' })
    const first = outline.getByRole('link', { name: 'Where this came from' })
    await expect(outline).toBeVisible()
    await expect(first.locator('span').first()).toHaveCSS('opacity', '0')
    await expect(page.getByRole('button', { name: 'Outline' })).toHaveCount(0)

    await outline.hover()
    await expect(first.locator('span').first()).toHaveCSS('opacity', '1')

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(outline).toBeHidden()
    await expect(page.getByRole('button', { name: 'Outline' })).toHaveCount(0)

    await page.mouse.move(0, 0)
    await page.setViewportSize({ width: 1280, height: 844 })
    await expect(outline).toBeVisible()
    await expect(first.locator('span').first()).toHaveCSS('opacity', '0')
  })

  test('renders Recharts area and stacked bar stories', async ({ page }) => {
    await page.goto(storyUrl('vista-blocks-data-chart--default'))
    const latency = chart(page, 'Attach latency')
    await expect(latency).toBeVisible()
    await expect(latency.getByRole('application')).toBeVisible()
    await expect(latency).toContainText('p50')
    await expect(latency).toContainText('p95')
    await expect(page.getByRole('alert')).toHaveCount(0)

    await page.goto(storyUrl('vista-blocks-data-chart--outcome-stacked-bar'))
    const outcomes = chart(page, 'Run outcomes')
    await expect(outcomes).toBeVisible()
    await expect(outcomes.getByRole('application')).toBeVisible()
    await expect(outcomes).toContainText('ok')
    await expect(outcomes).toContainText('queued')
    await expect(outcomes).toContainText('error')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('shows every row in both 183×101 viewport modes and copies a two-row selection', async ({
    page,
    context,
  }) => {
    test.slow()
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(storyUrl('vista-blocks-livepty--fit-width-full-height'))

      const viewport = page.getByTestId('livepty-viewport')
      const surface = page.getByTestId('livepty-surface')
      const screen = surface.locator('.xterm-screen')
      await expect(viewport).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText('183×101')).toBeVisible()
      await expect(surface.locator('.xterm-accessibility-tree')).toContainText(
        '101  Vista LivePty large-geometry proof',
      )
      await expect(surface).toHaveAttribute('data-font-size', /.+/)
      await expect(surface.locator('.xterm-helper-textarea')).toHaveAttribute('tabindex', '-1')
      await expect(viewport).toHaveAttribute('data-viewport-mode', 'fit')

      const fitGeometry = await viewport.evaluate((element) => {
        const terminalScreen = element.querySelector<HTMLElement>('.xterm-screen')
        if (terminalScreen === null) throw new Error('xterm screen did not mount')
        const viewportRect = element.getBoundingClientRect()
        const screenRect = terminalScreen.getBoundingClientRect()
        return {
          horizontalOverflow: element.scrollWidth - element.clientWidth,
          verticalOverflow: element.scrollHeight - element.clientHeight,
          lastRowWithinViewport: screenRect.bottom <= viewportRect.bottom,
        }
      })
      expect(fitGeometry.horizontalOverflow).toBeLessThanOrEqual(1)
      expect(fitGeometry.verticalOverflow).toBeLessThanOrEqual(1)
      expect(fitGeometry.lastRowWithinViewport).toBe(true)

      if (width === 1280) {
        const box = await screen.boundingBox()
        if (box === null) throw new Error('xterm screen has no selection geometry')
        const cellWidth = box.width / 183
        const cellHeight = box.height / 101
        await page.mouse.move(box.x + cellWidth / 2, box.y + cellHeight / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + cellWidth * 70, box.y + cellHeight * 1.5, {
          steps: 8,
        })
        await page.mouse.up()
        await page.keyboard.press('Control+C')
        await expect
          .poll(async () => await page.evaluate(() => navigator.clipboard.readText()))
          .toContain('001  Vista LivePty large-geometry proof')
        await expect
          .poll(async () => await page.evaluate(() => navigator.clipboard.readText()))
          .toContain('002  Vista LivePty large-geometry proof')
      }

      await page.getByRole('button', { name: 'Use fixed-height terminal viewport' }).click()
      await expect(viewport).toHaveAttribute('data-viewport-mode', 'scroll')
      await expect
        .poll(
          async () =>
            await viewport.evaluate((element) => element.scrollHeight - element.clientHeight),
        )
        .toBeGreaterThan(0)
      await viewport.focus()
      await page.keyboard.press('End')
      await expect
        .poll(async () => await viewport.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0)

      const scrollGeometry = await viewport.evaluate((element) => {
        const terminalScreen = element.querySelector<HTMLElement>('.xterm-screen')
        if (terminalScreen === null) throw new Error('xterm screen did not mount')
        const viewportRect = element.getBoundingClientRect()
        const screenRect = terminalScreen.getBoundingClientRect()
        return {
          horizontalOverflow: element.scrollWidth - element.clientWidth,
          lastRowWithinViewport: screenRect.bottom <= viewportRect.bottom,
          reachedBottom:
            Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 1,
        }
      })
      expect(scrollGeometry.horizontalOverflow).toBeLessThanOrEqual(1)
      expect(scrollGeometry.lastRowWithinViewport).toBe(true)
      expect(scrollGeometry.reachedBottom).toBe(true)

      await page.reload()
      await expect(page.getByTestId('livepty-viewport')).toHaveAttribute(
        'data-viewport-mode',
        'scroll',
      )
      await page.evaluate(() => localStorage.clear())
    }
  })

  test('keeps read-only focus escapable and returns attached input to controls', async ({
    page,
  }) => {
    await page.goto(storyUrl('vista-blocks-livepty--attached'))
    const viewport = page.getByTestId('livepty-viewport')
    const input = page.locator('.xterm-helper-textarea')
    const controls = page.getByRole('button', { name: /terminal viewport/ })
    await expect(viewport).toBeVisible({ timeout: 30_000 })
    await expect(input).toHaveAttribute('tabindex', '0')
    await expect(page.getByText('Ctrl+Shift+Escape returns to controls')).toBeVisible()

    await input.focus()
    await expect
      .poll(async () => await input.evaluate((element) => document.activeElement === element))
      .toBe(true)
    await page.keyboard.press('Control+Shift+Escape')
    await expect
      .poll(async () => await controls.evaluate((element) => document.activeElement === element))
      .toBe(true)
  })

  test('renders React Flow scenario canvas', async ({ page }) => {
    await page.goto(storyUrl('vista-blocks-diagrams-system-explorer--incident-blast-radius'))

    await expect(page.getByRole('group', { name: 'Visible relationship aspects' })).toBeVisible()
    await expect(page.getByText('API gateway')).toBeVisible()
    await expect(page.getByText('Grafana')).toBeVisible()
    await expect(page.getByText('Clear focus')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  // Markdown is prose the reader trusts: the assertions are the semantics GFM
  // must produce from the story's source (a link, a real list, inline code),
  // never the renderer's markup, so swapping the renderer keeps them honest.
  test('renders markdown prose as semantic HTML', async ({ page }) => {
    await page.goto(storyUrl('vista-blocks-content-rich-text--default'))

    await expect(page.getByRole('link', { name: 'process-group decision' })).toHaveAttribute(
      'href',
      '#set-process-group',
    )
    // Item TEXTS, not a count: the sample is free to grow (GFM tables, task
    // lists) without turning this into a story-content ratchet.
    const items = page.getByRole('listitem')
    await expect(items.filter({ hasText: 'viewer attaches and detaches freely' })).toHaveCount(1)
    await expect(
      items.filter({ hasText: 'supervisor reaps the provider process group' }),
    ).toHaveCount(1)
    await expect(page.getByText('disposable')).toBeVisible()
    await expect(page.locator('code', { hasText: 'SIGKILL' })).toBeVisible()

    await page.goto(storyUrl('vista-blocks-content-rich-text--empty'))
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('renders the decision log as a real table with its empty state', async ({ page }) => {
    await page.goto(storyUrl('vista-blocks-doctrine-decision-log--default'))

    const log = page.getByRole('figure', { name: 'Decision log' })
    await expect(log).toBeVisible()
    await expect(log.getByRole('columnheader', { name: 'Decision' })).toBeVisible()
    await expect(log.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    // One row per fixture decision, addressed by title rather than by count so
    // the story's fixture can gain a decision without failing the smoke.
    for (const decision of [
      'Terminate provider on visual-TUI failure',
      'Bounded graceful shutdown',
      'Pluggable projection adapter',
    ]) {
      await expect(log.getByRole('row').filter({ hasText: decision })).toHaveCount(1)
    }
    await expect(page.getByRole('alert')).toHaveCount(0)

    await page.goto(storyUrl('vista-blocks-doctrine-decision-log--empty'))
    await expect(page.getByRole('status')).toContainText('No decisions recorded.')
    await expect(page.getByRole('table')).toHaveCount(0)
  })

  // Read-only PR review surface. Kept to the two things a reader depends on —
  // the named summary region and the diff content — so the viewer's internal
  // layout can move without a false failure.
  test('renders the read-only pull request viewer', async ({ page }) => {
    await page.goto(storyUrl('vista-blocks-code-pull-request-viewer--default'))

    await expect(page.getByRole('region', { name: 'Pull request #482' })).toBeVisible()
    await expect(page.getByText('Reap the provider process group on shutdown')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('keeps the source viewport mounted while keyboard navigating detail tabs', async ({
    page,
  }) => {
    await page.goto(storyUrl('vista-blocks-code-source-inspector--default'))

    const sourceFile = page.getByRole('treeitem', { name: 'app.tsx' })
    await expect(sourceFile).toBeVisible()

    const fileTab = page.getByRole('tab', { name: 'File' })
    await fileTab.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')

    const receiptTab = page.getByRole('tab', { name: 'Receipt' })
    await expect(receiptTab).toBeFocused()
    await expect(receiptTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('complementary', { name: 'Capture details' })).toContainText(
      '/r/vista.tests/demo/v3/',
    )
    await expect(sourceFile).toBeVisible()
  })

  test('updates the pull request region name when stack navigation changes the request', async ({
    page,
  }) => {
    await page.goto(storyUrl('vista-compositions-pull-request-review--canary-base'))

    await expect(page.getByRole('region', { name: 'Pull request #1260' })).toBeVisible()
    await page.getByRole('button', { name: /^#1262/ }).click()
    await expect(page.getByRole('region', { name: 'Pull request #1262' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Pull request #1260' })).toHaveCount(0)
  })

  test('renders bounded empty and error states for first-class block families', async ({
    page,
  }) => {
    await page.goto(storyUrl('vista-blocks-telemetry-metric--structural-empty'))
    await expect(page.getByRole('status')).toContainText('no telemetry series.')
    await expect(frozenBadge(page)).toContainText('FROZEN')
    await expect(page.getByRole('alert')).toHaveCount(0)

    await page.goto(storyUrl('vista-blocks-telemetry-metric--failed'))
    await expect(page.getByRole('alert')).toContainText('error: tempo 503')

    await page.goto(storyUrl('vista-blocks-telemetry-trace--empty'))
    await expect(page.getByRole('status')).toContainText('no spans recorded for this trace.')
    await expect(frozenBadge(page)).toContainText('FROZEN')

    await page.goto(storyUrl('vista-blocks-telemetry-flamegraph--empty'))
    await expect(page.getByRole('status')).toContainText('no profile samples in range.')
    await expect(frozenBadge(page)).toContainText('FROZEN')

    await page.goto(storyUrl('vista-blocks-telemetry-lazy-block--error-fallback'))
    await expect(page.getByRole('alert')).toContainText("couldn't load visualization")
    await expect(page.getByTestId('lazyblock-status')).toContainText('error')

    await page.goto(storyUrl('vista-blocks-code-github-previews--loading'))
    await expect(page.getByRole('status')).toContainText('Loading preview...')

    await page.goto(storyUrl('vista-blocks-code-github-previews--failed'))
    await expect(page.getByRole('alert')).toContainText('GitHub 503')
  })
})
