import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium, expect, test, type Browser, type Page } from '@playwright/test'

import { selectDominantPair } from '../src/visual/screenshot-clusters.ts'

const referenceRoot = process.env['REFERENCE_STORYBOOK_DIR']
const candidateRoot = process.env['CANDIDATE_STORYBOOK_DIR']
const port = process.env['VISTA_BLOCKS_VISUAL_PORT']
if (referenceRoot === undefined || candidateRoot === undefined || port === undefined) {
  throw new Error(
    'REFERENCE_STORYBOOK_DIR, CANDIDATE_STORYBOOK_DIR, and VISTA_BLOCKS_VISUAL_PORT are required',
  )
}

const serverOrigin = `http://127.0.0.1:${port}`
const affectedStories: ReadonlySet<string> = new Set([
  './src/stories/PullRequestReview.stories.tsx',
  './src/stories/PullRequestViewer.stories.tsx',
  './src/stories/RichText.stories.tsx',
  './src/stories/SystemExplorer.stories.tsx',
  './src/stories/Treemap.stories.tsx',
])

type StoryIndex = {
  readonly entries: Record<
    string,
    { readonly id: string; readonly importPath: string; readonly type: 'docs' | 'story' }
  >
}

const storyIdsFrom = (directory: string): readonly string[] => {
  const index = JSON.parse(readFileSync(join(directory, 'index.json'), 'utf8')) as StoryIndex
  return Object.values(index.entries)
    .filter(({ importPath, type }) => type === 'story' && affectedStories.has(importPath))
    .map(({ id }) => id)
    .sort()
}

const referenceStoryIds = storyIdsFrom(referenceRoot)
const candidateStoryIds = storyIdsFrom(candidateRoot)
if (referenceStoryIds.length === 0) throw new Error('No affected stories found')
if (JSON.stringify(referenceStoryIds) !== JSON.stringify(candidateStoryIds)) {
  throw new Error('Affected story inventory changed')
}

const settleStory = async (page: Page): Promise<void> => {
  await page.locator('#storybook-root > :not(style)').first().waitFor({ state: 'visible' })
  await page.evaluate(async () => document.fonts.ready)
  await page.waitForTimeout(1_000)
}

const resetAndAssertScrollOrigin = async (page: Page): Promise<void> => {
  const scrolledElementCount = await page.evaluate(async () => {
    const scrollContainers = [
      document.scrollingElement,
      ...Array.from(document.querySelectorAll<HTMLElement>('*')).filter(
        (element) =>
          element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth,
      ),
    ].filter((element): element is Element => element !== null)

    for (const element of scrollContainers) {
      element.scrollTop = 0
      element.scrollLeft = 0
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )

    return scrollContainers.filter(
      (element) => element.scrollTop !== 0 || element.scrollLeft !== 0,
    ).length
  })
  expect(scrolledElementCount).toBe(0)
}

const screenshotOptions = {
  animations: 'disabled',
  caret: 'hide',
  fullPage: true,
} as const
const comparisonOptions = {
  maxDiffPixels: 0,
  threshold: 0.02,
} as const

type ImageComparator = (
  actual: Buffer,
  expected: Buffer,
  options: typeof comparisonOptions,
) => null | { readonly errorMessage: string }

const { utils: playwrightUtils } = createRequire(import.meta.url)(
  'playwright-core/lib/coreBundle',
) as {
  readonly utils: {
    readonly getComparator: (mimeType: string) => ImageComparator
  }
}
const comparePng = playwrightUtils.getComparator('image/png')
const screenshotsMatch = (actual: Buffer, expected: Buffer): boolean =>
  comparePng(actual, expected, comparisonOptions) === null

// Chromium can choose a different antialiasing or graph-paint mode per renderer.
// Require a comparator-equivalent 3-of-4 dominant cluster independently for
// each build, then compare only those representatives.
const captureScreenshot = async (page: Page): Promise<Buffer> => {
  await resetAndAssertScrollOrigin(page)
  return await page.screenshot(screenshotOptions)
}

const captureViewer = async (page: Page, selector: string): Promise<Buffer> => {
  const viewer = page.locator(selector)
  await expect(viewer).toBeVisible()
  await resetAndAssertScrollOrigin(page)
  return await viewer.screenshot({ animations: 'disabled', caret: 'hide' })
}


const pageDiagnostics = async (page: Page): Promise<string> => {
  try {
    return await page.locator('#storybook-root').evaluate((root) =>
      JSON.stringify({
        childElementCount: root.childElementCount,
        html: root.innerHTML.slice(0, 2_000),
        text: root.textContent?.slice(0, 1_000),
      }),
    )
  } catch (error) {
    return `root diagnostics unavailable: ${String(error)}`
  }
}

const captureBuild = async (
  page: Page,
  build: 'reference' | 'candidate',
  storyUrl: string,
  consoleMessages: string[],
  viewerSelector?: string,
): Promise<Buffer> => {
  const selection = await fetch(`${serverOrigin}/__select/${build}`)
  if (!selection.ok) throw new Error(`Could not select ${build} Storybook`)

  consoleMessages.length = 0
  try {
    await page.goto(storyUrl)
    await settleStory(page)
    return viewerSelector === undefined
      ? await captureScreenshot(page)
      : await captureViewer(page, viewerSelector)
  } catch (error) {
    throw new Error(
      `${build} capture failed: ${String(error)}\nconsole:\n${consoleMessages.join('\n') || '(none)'}\nroot:\n${await pageDiagnostics(page)}`,
      { cause: error },
    )
  }
}
const captureFreshBuild = async (
  browser: Browser,
  build: 'reference' | 'candidate',
  storyUrl: string,
  viewerSelector?: string,
): Promise<readonly Buffer[]> => {
  const screenshots: Buffer[] = []
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const consoleMessages: string[] = []
    try {
      const page = await context.newPage()
      page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`))
      page.on('pageerror', (error) => consoleMessages.push(`pageerror: ${error.message}`))
      screenshots.push(await captureBuild(page, build, storyUrl, consoleMessages, viewerSelector))
    } finally {
      await context.close()
    }
  }
  return screenshots
}


const evidenceRoot = join(process.cwd(), 'tmp', 'visual-parity')
const referenceEvidence = join(evidenceRoot, 'reference')
const candidateEvidence = join(evidenceRoot, 'candidate')
mkdirSync(referenceEvidence, { recursive: true })
mkdirSync(candidateEvidence, { recursive: true })

const unstableCompositeId = 'vista-compositions-pull-request-review--all-states'

const compareStory = async (
  browser: Browser,
  storyId: string,
  theme: 'dark' | 'light',
  screenshotName: string,
  viewerSelector?: string,
): Promise<void> => {
  const storyUrl = `${serverOrigin}/iframe.html?viewMode=story&globals=theme:${theme};motion:reduced&id=${storyId}`
  const referenceScreenshots = await test.step('capture reference', async () =>
    captureFreshBuild(browser, 'reference', storyUrl, viewerSelector),
  )
  const candidateScreenshots = await test.step('capture candidate', async () =>
    captureFreshBuild(browser, 'candidate', storyUrl, viewerSelector),
  )
  const [referenceScreenshot, candidateScreenshot] = selectDominantPair(
    referenceScreenshots,
    candidateScreenshots,
    screenshotsMatch,
    3,
  )
  writeFileSync(join(referenceEvidence, screenshotName), referenceScreenshot)
  writeFileSync(join(candidateEvidence, screenshotName), candidateScreenshot)
  expect(candidateScreenshot).toMatchSnapshot(screenshotName, comparisonOptions)
}

for (const storyId of referenceStoryIds) {
  test.describe(storyId, () => {
    let browser: Browser

    test.beforeAll(async () => {
      browser = await chromium.launch()
    })
    test.afterAll(async () => {
      await browser.close()
    })

    for (const theme of ['dark', 'light'] as const) {
      // Current main cannot produce a majority-stable full-page light capture for
      // this four-viewer composition. Its exact child containers are compared
      // independently below; the dark composite remains covered here.
      if (storyId === unstableCompositeId && theme === 'light') continue
      test(`${storyId} (${theme})`, async () => {
        await compareStory(browser, storyId, theme, `${storyId}-${theme}.png`)
      })
    }
  })
}

test.describe(`${unstableCompositeId} isolated light viewers`, () => {
  let browser: Browser

  test.beforeAll(async () => {
    browser = await chromium.launch()
  })
  test.afterAll(async () => {
    await browser.close()
  })

  for (const [label, viewerSelector] of [
    ['stack-top', '#all-stack-top'],
    ['stack-base', '#all-stack-base'],
    ['standalone-22rem', '#all-single'],
    ['narrow-canary-26rem', '#all-narrow'],
  ] as const) {
    test(`${unstableCompositeId} (light, ${label})`, async () => {
      await compareStory(
        browser,
        unstableCompositeId,
        'light',
        `${unstableCompositeId}-light-${label}.png`,
        viewerSelector,
      )
    })
  }
})
