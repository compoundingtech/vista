import { availableParallelism, loadavg } from 'node:os'

import { expect, test, type Locator, type Page } from '@playwright/test'
import { Schema } from 'effect'

import { MeasureResult } from '@overeng/meters/headless'

import type { BridgeHost } from '../src/stories/diff/scale/perf-bridge.dev.tsx'

/**
 * Perf gates for the semantic diff family's Scale stories (`Vista/Blocks/Diff/Scale`,
 * MED.BLK.DIFF-R93). Each interaction uses a scoped public meters measurement through the
 * stories' development-only DOM bridge. Five settlement frames follow the page's quiet window.
 * One eligible Complete result yields three gates:
 * - commits: `Renders.<id>` deltas from the stories' `<RenderProfiler>` boundaries, one per lens
 *   plus `page` for the whole `DiffPage`. Pure-frontend interactions confined to one component
 *   are asserted exactly; interactions that fan out, defer (`startTransition`,
 *   `useDeferredValue`, IntersectionObserver visibility) or wait on the image worker get a
 *   budget of about 1.3× the measured count. Every budget comment names its measured baseline.
 * - `frameDrops`: rAF frames the engine saw skipped, gated per interaction class (0 hover,
 *   2 moderate re-render, 5 large list or page-wide switch).
 * - long tasks: main-thread tasks over 50 ms that overlap the bracket, from a `longtask`
 *   `PerformanceObserver` installed before the page loads. R93 caps the longest one at 100 ms
 *   per interaction and 300 ms for the 40-frame mounts. A mount bracket runs from the Scale
 *   stories' `vista-diff-scale-mount` mark until the page settles.
 * Frame drops and long tasks are timing gates: the `frames` lane waits for a quiet host before
 * every bracket and enforces them; the deterministic lane logs them and defers their gate.
 * Commit and settle gates apply in both lanes.
 *
 * The tree hover gate additionally installs a minimal React DevTools hook that counts, per
 * `data-node-key`, the commits in which a tree row's element was re-rendered: hovering must
 * re-render the hovered rows only.
 */

interface DevtoolsFiber {
  readonly tag: number
  readonly memoizedProps: Record<string, unknown> | null
  readonly alternate: DevtoolsFiber | null
  readonly child: DevtoolsFiber | null
  readonly sibling: DevtoolsFiber | null
}

declare global {
  // oxlint-disable-next-line no-var -- page-global harness state.
  var diffRowCommits: Record<string, number> | undefined
  // oxlint-disable-next-line no-var -- set by the Scale stories once mounted.
  var diffScaleReady: boolean | undefined
  // oxlint-disable-next-line no-var -- page-global harness state.
  var diffLongTasks: LongTaskRecorder | undefined
}

interface LongTaskRecorder {
  /** Durations (ms) of long tasks overlapping `[from, now]`, in page `performance.now()` time. */
  readonly since: (from: number) => readonly number[]
}

/** Set by the Scale stories when the story first renders, before any fixture is generated. */
const mountMark = 'vista-diff-scale-mount'

const storyUrl = (story: string) =>
  `/iframe.html?viewMode=story&globals=theme:dark&id=vista-blocks-diff-scale--${story}`

/** Keys of the declared commit counters bound to the stories' session. */
const renderPrefix = 'Renders.'

interface Commits {
  /** Commits of the whole page (`Renders.page`). */
  readonly page: number
  /** Sum of all lens commits. */
  readonly lenses: number
  /** Commits per declared lens id, including observed zero deltas. */
  readonly byLens: Readonly<Record<string, number>>
}

interface Timing {
  /** Absent for mount brackets, which start before the meters session exists. */
  readonly frameDrops?: number
  /** Durations (ms) of the long tasks that overlapped the bracket. */
  readonly longTasksMs: readonly number[]
}

interface Measurement extends Timing {
  readonly commits: Commits
  readonly frameDrops: number
  readonly framesCaptured: number
  readonly averageFps: number
  readonly durationMs: number
}

const frameGates = process.env.VISTA_DIFF_PERF_LANE === 'frames'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const tasks: { readonly start: number; readonly end: number }[] = []
    const record = (entries: readonly PerformanceEntry[]) => {
      for (const entry of entries) {
        tasks.push({ start: entry.startTime, end: entry.startTime + entry.duration })
      }
    }
    const observer = new PerformanceObserver((list) => record(list.getEntries()))
    observer.observe({ type: 'longtask', buffered: true })
    globalThis.diffLongTasks = {
      since: (from) => {
        // Entries are delivered asynchronously; take the ones not yet handed to the callback.
        record(observer.takeRecords())
        const now = performance.now()
        return tasks
          .filter(({ start, end }) => end > from && start < now)
          .map(({ start, end }) => Math.round(end - start))
      },
    }
  })
})

/** Long tasks since `from` (page time), or since the Scale stories' mount mark. */
const longTasksSince = (page: Page, from: number | 'mount') =>
  page.evaluate(
    ({ from, mountMark }) => {
      const start = from === 'mount' ? performance.getEntriesByName(mountMark)[0]?.startTime : from
      if (start === undefined) throw new Error(`The Scale story never set the ${mountMark} mark`)
      return globalThis.diffLongTasks!.since(start)
    },
    { from, mountMark },
  )

/** A frame measurement is only meaningful once the host's one-minute load fits its cores. */
const waitForQuietHost = async () => {
  if (!frameGates) return
  const cores = availableParallelism()
  const deadline = performance.now() + 10 * 60_000
  let reportedWait = false
  while (true) {
    const [load] = loadavg()
    if (load !== undefined && Number.isFinite(load) && load <= cores) {
      console.log(`[perf-gate] ${JSON.stringify({ load, cores, frameGates: true })}`)
      return
    }
    if (performance.now() >= deadline) {
      throw new Error(
        `Vista diff frame gates require a quiet host: one-minute load average ${load} is not ≤ ${cores} cores after waiting 10 minutes`,
      )
    }
    if (!reportedWait) {
      console.log(`[perf-gate] waiting for quiet host: load ${load}, cores ${cores}`)
      reportedWait = true
    }
    // Host load is real external state: a bounded real-time poll cannot use fake timers.
    await new Promise<void>((resolve) => setTimeout(resolve, 5_000))
  }
}

/** Wait until no `Renders.*` counter changed for `quietFrames` consecutive frames. */
const settle = (page: Page, quietFrames = 30) =>
  page.evaluate(
    (quiet) =>
      new Promise<void>((resolve) => {
        const total = () => {
          const bridge = document.querySelector<BridgeHost>(
            '[data-testid="meters-test-host"]',
          )?.metersTestBridge
          if (bridge === undefined) throw new Error('Scale meters bridge is not mounted')
          const counters = bridge.counters()
          if (!Object.hasOwn(counters, 'Renders.page'))
            throw new Error('Missing page commit evidence')
          return Object.entries(counters)
            .filter(([key]) => key.startsWith('Renders.'))
            .reduce((sum, [, value]) => {
              if (!Number.isFinite(value)) throw new Error('Invalid cumulative commit evidence')
              return sum + value
            }, 0)
        }
        let last = total()
        let still = 0
        const step = () => {
          const current = total()
          still = current === last ? still + 1 : 0
          last = current
          if (still >= quiet) resolve()
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
    quietFrames,
  )

/** Pixel comparisons still running anywhere on the page. */
const pendingComparisons = (page: Page) => page.getByText(/Comparing pixels…|Computing difference…/)

/** Bracket one interaction with scoped public evidence; always release a failed action's token. */
const measure = async (
  page: Page,
  action: () => Promise<unknown>,
  idle: () => Promise<unknown> = async () => {},
): Promise<Measurement> => {
  await waitForQuietHost()
  await settle(page)
  await page.waitForFunction(() =>
    document
      .querySelector<BridgeHost>('[data-testid="meters-test-host"]')
      ?.metersTestBridge?.ready(),
  )
  const { token, start } = await page.evaluate(async () => {
    const bridge = document.querySelector<BridgeHost>(
      '[data-testid="meters-test-host"]',
    )?.metersTestBridge
    if (bridge === undefined) throw new Error('Scale meters bridge is not mounted')
    return { token: await bridge.acquire(), start: performance.now() }
  })
  let result: typeof MeasureResult.Type
  try {
    await action()
    await idle()
    await settle(page)
    const wire = await page.evaluate(async (token) => {
      const bridge = document.querySelector<BridgeHost>(
        '[data-testid="meters-test-host"]',
      )?.metersTestBridge
      if (bridge === undefined) throw new Error('Scale meters bridge unmounted')
      return bridge.finish({ token, settleFrames: 5 })
    }, token)
    result = Schema.decodeUnknownSync(MeasureResult)(wire)
  } finally {
    await page.evaluate(async (token) => {
      await document
        .querySelector<BridgeHost>('[data-testid="meters-test-host"]')
        ?.metersTestBridge?.cancel({ token })
    }, token)
  }
  if (result._tag !== 'Complete' || !result.eligible) {
    throw new Error(`Ineligible Scale measurement: ${JSON.stringify(result)}`)
  }
  const data = result.data
  if (data.framesCaptured <= 0) throw new Error('Scale measurement captured no frames')
  const longTasksMs = await longTasksSince(page, start)
  const byLens = Object.fromEntries(
    Object.entries(data.counterDelta)
      .filter(([key]) => key.startsWith(renderPrefix) && key !== 'Renders.page')
      .map(([key, value]) => [key.slice(renderPrefix.length), value]),
  )
  const pageCommits = data.counterDelta['Renders.page']
  if (pageCommits === undefined) throw new Error('Missing page commit delta')
  return {
    commits: {
      page: pageCommits,
      lenses: Object.values(byLens).reduce((sum, value) => sum + value, 0),
      byLens,
    },
    frameDrops: data.frameDrops,
    framesCaptured: data.framesCaptured,
    averageFps: Math.round(data.averageFps),
    // Includes the Playwright round-trips and the settle window (30 quiet frames).
    durationMs: Math.round(data.durationMs),
    longTasksMs,
  }
}

/** A budget of about 1.3× a measured count, rounded up. */
const budget = (measured: number) => Math.ceil(measured * 1.3)

interface TimingBudget {
  /** Maximum dropped frames: 0 hover, 2 moderate re-render, 5 large list or page-wide switch. */
  readonly frameDrops?: 0 | 2 | 5
  /** R93: no long task longer than this many ms. */
  readonly longTaskMs?: 100 | 300
}

interface Expectation extends TimingBudget {
  /** Exact commit counts; `0` means the boundary must not commit at all. */
  readonly exact?: Readonly<Record<string, number>>
  /** Measured commit counts gated at `budget(count)`. */
  readonly budgeted?: Readonly<Record<string, number>>
}

/** `page`, `lenses` (sum over lenses) or a lens id. */
const commitsOf = (commits: Commits, key: string) => {
  if (key === 'page') return commits.page
  if (key === 'lenses') return commits.lenses
  const value = commits.byLens[key]
  if (value === undefined) throw new Error(`Missing declared lens commit delta: ${key}`)
  return value
}

/** Frame drops and long tasks: enforced in the `frames` lane, logged and deferred otherwise. */
const checkTiming = (
  interaction: string,
  measured: Timing,
  expected: TimingBudget,
  frameGatesEnabled: boolean,
) => {
  if (!frameGatesEnabled) {
    if (!test.info().annotations.some(({ type }) => type === 'frame-gates-deferred-to-perf-lane')) {
      test.info().annotations.push({
        type: 'frame-gates-deferred-to-perf-lane',
        description:
          'Set VISTA_DIFF_PERF_LANE=frames to enforce frame-drop and long-task budgets on a quiet host',
      })
    }
    return
  }
  if (expected.frameDrops !== undefined) {
    expect
      .soft(measured.frameDrops, `${interaction} frame drops`)
      .toBeLessThanOrEqual(expected.frameDrops)
  }
  if (expected.longTaskMs !== undefined) {
    expect
      .soft(Math.max(0, ...measured.longTasksMs), `${interaction} longest task (ms)`)
      .toBeLessThanOrEqual(expected.longTaskMs)
  }
}

const check = (
  story: string,
  interaction: string,
  measured: Measurement,
  expected: Expectation,
  frameGatesEnabled: boolean,
) => {
  console.log(
    `[perf-gate] ${JSON.stringify({ story, interaction, ...measured, frameGates: frameGatesEnabled })}`,
  )
  for (const [key, count] of Object.entries(expected.exact ?? {})) {
    expect.soft(commitsOf(measured.commits, key), `${interaction} ${key} commits`).toBe(count)
  }
  for (const [key, count] of Object.entries(expected.budgeted ?? {})) {
    expect
      .soft(commitsOf(measured.commits, key), `${interaction} ${key} commits`)
      .toBeLessThanOrEqual(budget(count))
  }
  checkTiming(interaction, measured, expected, frameGatesEnabled)
}

/** The mount bracket: R93 gates its long tasks only. */
const checkMount = (
  story: string,
  mount: Timing,
  expected: TimingBudget,
  frameGatesEnabled: boolean,
) => {
  console.log(
    `[perf-gate] ${JSON.stringify({ story, interaction: 'mount', ...mount, frameGates: frameGatesEnabled })}`,
  )
  checkTiming('mount', mount, expected, frameGatesEnabled)
}

/**
 * Load a story and wait until it is mounted, `idle` holds and render commits settle. Returns the
 * mount bracket: the long tasks since the story's mount mark.
 */
const open = async (
  page: Page,
  story: string,
  idle: () => Promise<unknown> = async () => {},
): Promise<Timing> => {
  await waitForQuietHost()
  await page.goto(storyUrl(story))
  // A cold Vite optimizer on a loaded host can take far longer than the default 5 s.
  await page.waitForFunction(
    () =>
      globalThis.diffScaleReady === true &&
      document
        .querySelector<BridgeHost>('[data-testid="meters-test-host"]')
        ?.metersTestBridge?.ready(),
    undefined,
    { timeout: 120_000 },
  )
  await idle()
  await settle(page)
  const mount = { longTasksMs: await longTasksSince(page, 'mount') }
  return mount
}

/** The page-level arrangement switch; frames below a `DiffPage` drop their own. */
const arrangement = (page: Page, name: 'Side by side' | 'Combined') =>
  page
    .getByRole('radiogroup', { name: 'Diff arrangement' })
    .first()
    .getByRole('radio', { name, exact: true })

/** Clicks start with the pointer already on their target, so a bracket holds only the click. */
const click = async (page: Page, target: Locator, idle?: () => Promise<unknown>) => {
  await target.hover()
  return measure(page, () => target.click(), idle)
}

/** Toggle the page arrangement to side by side and back; returns both brackets. */
const togglePage = async (page: Page, idle?: () => Promise<unknown>) => {
  const split = await click(page, arrangement(page, 'Side by side'), idle)
  await expect(arrangement(page, 'Side by side')).toBeChecked()
  const unified = await click(page, arrangement(page, 'Combined'), idle)
  await expect(arrangement(page, 'Combined')).toBeChecked()
  return { split, unified }
}

test.describe.configure({ timeout: frameGates ? 35 * 60_000 : 240_000 })

test('40 mixed frames: mount and page arrangement toggle', async ({ page }) => {
  const mount = await open(page, 'mixed-forty-frames', () =>
    expect(pendingComparisons(page)).toHaveCount(0, { timeout: 120_000 }),
  )
  checkMount('mixed-forty-frames', mount, { longTaskMs: 300 }, frameGates)
  const { split, unified } = await togglePage(page)
  // Every frame reads the page arrangement, so every lens and the page commit. `page` also
  // counts the switch's own press, focus and selection commits.
  // Measured: → side by side page 7, lenses 78 (38 frames twice, the first two once);
  // → combined page 7, lenses 40.
  check(
    'mixed-forty-frames',
    'page toggle → side by side',
    split,
    {
      budgeted: { page: 7, lenses: 78 },
      frameDrops: 5,
      longTaskMs: 100,
    },
    frameGates,
  )
  check(
    'mixed-forty-frames',
    'page toggle → combined',
    unified,
    {
      budgeted: { page: 7, lenses: 40 },
      frameDrops: 5,
      longTaskMs: 100,
    },
    frameGates,
  )
})

test('1000-node tree: row hover and page toggle', async ({ page }) => {
  await page.addInitScript(() => {
    // Minimal React DevTools hook: after each commit, count per `data-node-key` the row
    // elements that were re-rendered. A subtree whose child list is the previous tree's is
    // untouched by the commit and is skipped.
    const rowCommits: Record<string, number> = {}
    globalThis.diffRowCommits = rowCommits
    const visit = (root: DevtoolsFiber) => {
      const stack = [root]
      while (stack.length > 0) {
        const fiber = stack.pop()!
        const previous = fiber.alternate
        const key = fiber.tag === 5 ? fiber.memoizedProps?.['data-node-key'] : undefined
        if (
          typeof key === 'string' &&
          previous !== null &&
          fiber.memoizedProps !== previous.memoizedProps
        ) {
          rowCommits[key] = (rowCommits[key] ?? 0) + 1
        }
        if (previous !== null && fiber.child === previous.child) continue
        for (let child = fiber.child; child !== null; child = child.sibling) stack.push(child)
      }
    }
    Object.assign(globalThis, {
      __REACT_DEVTOOLS_GLOBAL_HOOK__: {
        supportsFiber: true,
        isDisabled: false,
        renderers: new Map(),
        inject: () => 1,
        checkDCE: () => {},
        onScheduleFiberRoot: () => {},
        onCommitFiberUnmount: () => {},
        onPostCommitFiberRoot: () => {},
        onCommitFiberRoot: (_id: number, root: { readonly current: DevtoolsFiber }) =>
          visit(root.current),
      },
    })
  })
  await open(page, 'tree-one-thousand')

  const rows = page.locator('[role="row"][data-node-key]')
  await expect(rows.nth(12)).toBeVisible()
  const hovered = await rows.evaluateAll((elements) =>
    elements.slice(0, 13).map((row) => row.dataset['nodeKey']!),
  )
  await rows.nth(0).hover()
  await settle(page)
  const before = await page.evaluate(() => ({ ...globalThis.diffRowCommits }))
  const hover = await measure(page, async () => {
    for (let index = 1; index <= 12; index++) await rows.nth(index).hover()
  })
  const after = await page.evaluate(() => ({ ...globalThis.diffRowCommits }))
  const rowDelta = Object.fromEntries(
    Object.keys(after)
      .map((key) => [key, after[key]! - (before[key] ?? 0)] as const)
      .filter(([, count]) => count > 0),
  )
  const others = Object.fromEntries(
    Object.entries(rowDelta).filter(([key]) => !hovered.includes(key)),
  )
  console.log(`[perf-gate] ${JSON.stringify({ interaction: 'hover 12 rows', rowDelta })}`)
  // Highlighting runs outside React; only React Aria's hover state of the rows the pointer
  // enters and leaves re-renders them. Every other row: exactly 0 commits.
  expect.soft(others, 'hover commits of non-hovered rows').toEqual({})
  // Pure frontend and confined to the tree: one commit per pointer move (leave + enter).
  // Measured: tree-1000 12, page 12.
  check(
    'tree-one-thousand',
    'hover 12 rows',
    hover,
    {
      exact: { 'tree-1000': 12, page: 12 },
      frameDrops: 0,
    },
    frameGates,
  )

  const { split, unified } = await togglePage(page)
  // The virtualized tree re-lays out after the transition. Measured: → side by side page 19,
  // tree-1000 15; → combined page 14, tree-1000 8.
  check(
    'tree-one-thousand',
    'page toggle → side by side',
    split,
    {
      budgeted: { page: 19, 'tree-1000': 15 },
      frameDrops: 5,
    },
    frameGates,
  )
  check(
    'tree-one-thousand',
    'page toggle → combined',
    unified,
    {
      budgeted: { page: 14, 'tree-1000': 8 },
      frameDrops: 5,
    },
    frameGates,
  )
})

test('500-span trace: filter typing and page toggle', async ({ page }) => {
  await open(page, 'trace-five-hundred')
  const filter = page.getByRole('searchbox', { name: 'Filter spans' })
  await filter.focus()
  const typing = await measure(page, () => filter.pressSequentially('op.1', { delay: 60 }))
  // `useDeferredValue` coalesces keystrokes under load, so the count is budgeted.
  // Measured: page 14, trace-500 14.
  check(
    'trace-five-hundred',
    'type 4 filter keys',
    typing,
    {
      budgeted: { page: 14, 'trace-500': 14 },
      frameDrops: 2,
      longTaskMs: 100,
    },
    frameGates,
  )
  await filter.fill('')

  const { split, unified } = await togglePage(page)
  // The lens defers the arrangement (`useDeferredValue`). Measured: → side by side page 8,
  // trace-500 4; → combined page 7, trace-500 1.
  check(
    'trace-five-hundred',
    'page toggle → side by side',
    split,
    {
      budgeted: { page: 8, 'trace-500': 4 },
      frameDrops: 5,
      longTaskMs: 100,
    },
    frameGates,
  )
  check(
    'trace-five-hundred',
    'page toggle → combined',
    unified,
    {
      budgeted: { page: 7, 'trace-500': 1 },
      frameDrops: 5,
      longTaskMs: 100,
    },
    frameGates,
  )
})

test('40 OCR frames: mount and page toggle', async ({ page }) => {
  const mount = await open(page, 'forty-ocr-frames')
  checkMount('forty-ocr-frames', mount, { longTaskMs: 300 }, frameGates)
  const { split, unified } = await togglePage(page)
  // Measured: → side by side page 6, lenses 77 (37 frames twice, the first three once);
  // → combined page 7, lenses 40.
  check(
    'forty-ocr-frames',
    'page toggle → side by side',
    split,
    {
      budgeted: { page: 6, lenses: 77 },
      frameDrops: 5,
      longTaskMs: 100,
    },
    frameGates,
  )
  check(
    'forty-ocr-frames',
    'page toggle → combined',
    unified,
    {
      budgeted: { page: 7, lenses: 40 },
      frameDrops: 5,
      longTaskMs: 100,
    },
    frameGates,
  )
})

test('40 code files: mount and page toggle', async ({ page }) => {
  const mount = await open(page, 'forty-code-files')
  checkMount('forty-code-files', mount, { longTaskMs: 300 }, frameGates)
  // R93 gates this story's timing only; commits are logged, not budgeted.
  const { split, unified } = await togglePage(page)
  check(
    'forty-code-files',
    'page toggle → side by side',
    split,
    { frameDrops: 5, longTaskMs: 100 },
    frameGates,
  )
  check(
    'forty-code-files',
    'page toggle → combined',
    unified,
    { frameDrops: 5, longTaskMs: 100 },
    frameGates,
  )
})

test('150-node diagram: select a change', async ({ page }) => {
  await open(page, 'diagram-one-hundred-fifty')
  const change = page.getByRole('listbox', { name: 'Diagram changes' }).getByRole('option').first()
  await expect(change).toBeVisible()
  const select = await click(page, change)
  await expect(change).toHaveAttribute('aria-selected', 'true')
  // R93 gates this story's timing only; commits are logged, not budgeted.
  check(
    'diagram-one-hundred-fifty',
    'select a change',
    select,
    { frameDrops: 2, longTaskMs: 100 },
    frameGates,
  )
})

test('10 A4 image diffs: mount, mode switch and page toggle', async ({ page }) => {
  const comparisonsDone = (timeout: number) =>
    expect(pendingComparisons(page)).toHaveCount(0, { timeout })
  await waitForQuietHost()
  await page.goto(storyUrl('ten-a-4-image-diffs'))
  await page.waitForFunction(
    () =>
      document
        .querySelector<BridgeHost>('[data-testid="meters-test-host"]')
        ?.metersTestBridge?.ready(),
    undefined,
    { timeout: 120_000 },
  )
  // Mount is gated by completion without a failure plus frame drops and long tasks; there is
  // no commit budget because the lenses' first commit precedes the session lease. The meters
  // bracket acquires only after calibrated frame evidence; the long-task window still runs
  // from the story's mount mark to the end of near-viewport comparisons.
  const mount = await measure(
    page,
    () => page.waitForFunction(() => globalThis.diffScaleReady === true),
    () => comparisonsDone(120_000),
  )
  await expect(page.getByRole('alert')).toHaveCount(0)
  check(
    'ten-a-4-image-diffs',
    'mount in difference mode',
    { ...mount, longTasksMs: await longTasksSince(page, 'mount') },
    { frameDrops: 5, longTaskMs: 100 },
    frameGates,
  )

  // A frame's mode is local: that frame commits, every other lens exactly 0, and the page
  // commits only for that frame.
  const modes = page.getByRole('radiogroup', { name: 'Diff mode' }).first()
  const others = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`a4-${index + 1}`, 0]))
  const local = (interaction: string, measured: Measurement) => {
    check(
      'ten-a-4-image-diffs',
      interaction,
      measured,
      { exact: others, frameDrops: 2 },
      frameGates,
    )
    const own = commitsOf(measured.commits, 'a4-0')
    expect.soft(own, `${interaction} a4-0 commits`).toBeGreaterThan(0)
    expect.soft(measured.commits.page, `${interaction} page commits`).toBe(own)
  }
  local('mode → swipe', await click(page, modes.getByRole('radio', { name: 'Swipe', exact: true })))
  local(
    'mode → difference',
    await click(page, modes.getByRole('radio', { name: 'Difference', exact: true }), () =>
      comparisonsDone(60_000),
    ),
  )

  // R93 gates the page toggle's timing only; commits are logged, not budgeted.
  const { split, unified } = await togglePage(page, () => comparisonsDone(60_000))
  await expect(page.getByRole('alert')).toHaveCount(0)
  check(
    'ten-a-4-image-diffs',
    'page toggle → side by side',
    split,
    { frameDrops: 5, longTaskMs: 100 },
    frameGates,
  )
  check(
    'ten-a-4-image-diffs',
    'page toggle → combined',
    unified,
    { frameDrops: 5, longTaskMs: 100 },
    frameGates,
  )
})

test('200-row record: page toggle', async ({ page }) => {
  await open(page, 'record-two-hundred')
  const { split, unified } = await togglePage(page)
  // Measured: → side by side page 9, record-200 5; → combined page 10, record-200 4.
  check(
    'record-two-hundred',
    'page toggle → side by side',
    split,
    {
      budgeted: { page: 9, 'record-200': 5 },
      frameDrops: 5,
    },
    frameGates,
  )
  check(
    'record-two-hundred',
    'page toggle → combined',
    unified,
    {
      budgeted: { page: 10, 'record-200': 4 },
      frameDrops: 5,
    },
    frameGates,
  )
})

test('200-page page set: page toggle', async ({ page }) => {
  await open(page, 'page-set-two-hundred')
  const idle = () => expect(pendingComparisons(page)).toHaveCount(0, { timeout: 120_000 })
  await idle()
  const { split, unified } = await togglePage(page, idle)
  // Measured: → side by side page 10, pages-0 6; → combined page 12, pages-0 6.
  check(
    'page-set-two-hundred',
    'page toggle → side by side',
    split,
    {
      budgeted: { page: 10, 'pages-0': 6 },
      frameDrops: 5,
    },
    frameGates,
  )
  check(
    'page-set-two-hundred',
    'page toggle → combined',
    unified,
    {
      budgeted: { page: 12, 'pages-0': 6 },
      frameDrops: 5,
    },
    frameGates,
  )
})
