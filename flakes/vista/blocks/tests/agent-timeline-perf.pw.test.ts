import { availableParallelism, loadavg } from 'node:os'

import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Perf gates for the Agent Timeline block at both actor-filter session caps (128 and 512; the 512
 * fixture holds the 459 sessions the dogfood selection yields at that cap).
 *
 * Every interaction is pure frontend, so three signals come from one bracket:
 * - `renders`: function renders of the trace's own components (`countTraceRender`). They are
 *   deterministic and asserted exactly.
 * - `commits`: `React.Profiler` commits per region (`TraceProfiler`). A region that must not
 *   react is asserted at exactly 0. A region that must react also counts React Aria's own
 *   collection commits (a Tree or GridList commits again after rebuilding its collection), so it
 *   gets a budget of about 1.3× the measured count instead of an exact value.
 * - `frameDrops`: dropped rAF frames beyond the drops of an equally long idle window right after
 *   the bracket, gated per interaction class (0 hover, 2 moderate re-render, 5 large list or pane).
 *   Frame timing only measures the trace when the browser gets its CPU time: on a host whose
 *   one-minute load average exceeds its core count, render work stretches across frames for
 *   reasons outside the trace. There the frame gates are skipped with a `frame-gates-skipped`
 *   annotation and the measured drops are still logged; the render and commit gates always apply.
 */

type Region = 'header' | 'tree' | 'rows' | 'details'
const regions: ReadonlyArray<Region> = ['header', 'tree', 'rows', 'details']

interface Measurement {
  readonly renders: Readonly<Record<string, number>>
  readonly commits: Readonly<Record<Region, number>>
  readonly renderMs: Readonly<Record<Region, number>>
  readonly frameDrops: number
  readonly ambientDrops: number
  readonly durationMs: number
}

declare global {
  // oxlint-disable-next-line no-var -- page-global harness state.
  var agentTimelineFrames: number[] | undefined
}

const storyUrl = (sessions: 128 | 512) =>
  `/iframe.html?viewMode=story&globals=theme:dark&id=vista-blocks-agents-agent-timeline-performance--sessions-${sessions}`

const installHarness = (page: Page) =>
  page.addInitScript(() => {
    globalThis.agentTimelineRenders = {}
    const frames: number[] = []
    globalThis.agentTimelineFrames = frames
    const tick = (now: number) => {
      frames.push(now)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

/** Wait until no counter changed for `quietFrames` consecutive frames. */
const settle = (page: Page, quietFrames = 10) =>
  page.evaluate(
    (quiet) =>
      new Promise<void>((resolve) => {
        const total = () =>
          Object.entries(globalThis.agentTimelineRenders ?? {})
            .filter(([key]) => !key.endsWith('.ms'))
            .reduce((sum, [, value]) => sum + value, 0)
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

const snapshot = (page: Page) =>
  page.evaluate(() => ({
    counts: { ...globalThis.agentTimelineRenders },
    frameIndex: globalThis.agentTimelineFrames!.length,
    now: performance.now(),
  }))

/** Frames lost between two frame indices, against the median interval of the preceding frames. */
const droppedFrames = (page: Page, from: number, to: number) =>
  page.evaluate(
    ({ start, end }) => {
      const frames = globalThis.agentTimelineFrames!
      const first = Math.max(1, start - 60)
      const deltas = frames.slice(first, start).map((ts, index) => ts - frames[first + index - 1]!)
      const interval = deltas.toSorted((a, b) => a - b)[Math.floor(deltas.length / 2)] ?? 1000 / 60
      let dropped = 0
      for (let index = Math.max(1, start); index < end; index++) {
        dropped += Math.max(0, Math.round((frames[index]! - frames[index - 1]!) / interval) - 1)
      }
      return dropped
    },
    { start: from, end: to },
  )

/** Bracket one interaction: renders, commits, render time, excess dropped frames, wall clock. */
const measure = async (page: Page, action: () => Promise<unknown>): Promise<Measurement> => {
  await settle(page)
  const before = await snapshot(page)
  await action()
  await settle(page)
  const after = await snapshot(page)
  const durationMs = after.now - before.now
  // Idle control of the same length, right after the interaction settled.
  await page.waitForTimeout(durationMs)
  const idle = await snapshot(page)
  const frameDrops = await droppedFrames(page, before.frameIndex, after.frameIndex)
  const ambientDrops = await droppedFrames(page, after.frameIndex, idle.frameIndex)
  const delta = (key: string) => (after.counts[key] ?? 0) - (before.counts[key] ?? 0)
  return {
    renders: Object.fromEntries(
      Object.keys(after.counts)
        .filter((key) => key.startsWith('fn.') && delta(key) !== 0)
        .map((key) => [key.slice(3), delta(key)]),
    ),
    commits: Object.fromEntries(regions.map((region) => [region, delta(region)])) as Record<
      Region,
      number
    >,
    renderMs: Object.fromEntries(
      regions.map((region) => [region, Math.round(delta(`${region}.ms`))]),
    ) as Record<Region, number>,
    frameDrops,
    ambientDrops,
    // Includes the Playwright round-trip and the settle window (10 quiet frames).
    durationMs: Math.round(durationMs),
  }
}

/** A budget of about 1.3× a measured count, rounded up, for regions React Aria also commits. */
const budget = (measured: number) => Math.ceil(measured * 1.3)

interface Expectation {
  /** Exact function renders of the trace's own components; absent components render 0 times. */
  readonly renders: Readonly<Record<string, number>>
  /** Regions that must not commit at all. */
  readonly still: ReadonlyArray<Region>
  /** Measured commit counts of the reacting regions, gated at `budget(count)`. */
  readonly commits: Partial<Readonly<Record<Region, number>>>
  /** Maximum excess dropped frames: 0 hover, 2 moderate re-render, 5 large list or pane. */
  readonly frameDrops: 0 | 2 | 5
}

const check = (
  sessions: number,
  interaction: string,
  measured: Measurement,
  expected: Expectation,
  frameGates: boolean,
) => {
  console.log(`[perf-gate] ${JSON.stringify({ sessions, interaction, ...measured })}`)
  expect.soft(measured.renders, `${interaction} renders`).toEqual(expected.renders)
  for (const region of expected.still) {
    expect.soft(measured.commits[region], `${interaction} ${region} commits`).toBe(0)
  }
  for (const [region, count] of Object.entries(expected.commits)) {
    expect
      .soft(measured.commits[region as Region], `${interaction} ${region} commits`)
      .toBeLessThanOrEqual(budget(count))
  }
  if (!frameGates) return
  expect
    .soft(measured.frameDrops - measured.ambientDrops, `${interaction} excess frame drops`)
    .toBeLessThanOrEqual(expected.frameDrops)
}

for (const sessions of [128, 512] as const) {
  test(`Agent Timeline interactions stay within render and frame budgets at ${sessions} sessions`, async ({
    page,
  }) => {
    await installHarness(page)
    await page.goto(storyUrl(sessions))
    // A cold Vite optimizer on a loaded host can take far longer than the default 5 s.
    await expect(page.locator('[role="row"][data-session-id]').first()).toBeVisible({
      timeout: 30_000,
    })
    await settle(page)
    const initial = await page.evaluate(() => ({ ...globalThis.agentTimelineRenders }))
    console.log(
      `[perf-gate] ${JSON.stringify({ sessions, interaction: 'initial', counts: initial })}`,
    )
    const [load] = loadavg()
    const cores = availableParallelism()
    const frameGates = load! <= cores
    console.log(`[perf-gate] ${JSON.stringify({ sessions, load, cores, frameGates })}`)
    if (!frameGates) {
      test.info().annotations.push({
        type: 'frame-gates-skipped',
        description: `load average ${load!.toFixed(0)} exceeds ${cores} cores`,
      })
    }
    const gate = (interaction: string, measured: Measurement, expected: Expectation) =>
      check(sessions, interaction, measured, expected, frameGates)

    // Clicks start with the pointer already on their target, so a bracket holds only the click.
    const click = async (target: Locator) => {
      await target.hover()
      return measure(page, () => target.click())
    }

    // Expand and collapse rebuild the row list: the tree, the rows (all windowed rows get new
    // items), and the layout that owns them re-render once.
    gate('expand-all', await click(page.getByRole('button', { name: 'Expand all' })), {
      renders: { layout: 1, tree: 1, row: 31 },
      still: ['header', 'details'],
      commits: { tree: 6, rows: 4 },
      frameDrops: 5,
    })
    gate('collapse-all', await click(page.getByRole('button', { name: 'Collapse all' })), {
      renders: { layout: 1, tree: 1, row: 9 },
      still: ['header', 'details'],
      commits: { tree: 7, rows: 3 },
      frameDrops: 5,
    })
    await page.getByRole('button', { name: 'Expand all' }).click()

    // A filter keystroke changes the matching set: the header counts, the tree, and the rows.
    const filter = page.getByPlaceholder('Filter sessions…')
    await filter.focus()
    gate('filter-keystroke', await measure(page, () => page.keyboard.type('t')), {
      renders: { layout: 1, toolbar: 1, tree: 1, row: 31 },
      still: ['details'],
      commits: { header: 1, tree: 3, rows: 3 },
      frameDrops: 5,
    })
    await filter.fill('')

    // Zoom and pan move every windowed bar and nothing else.
    const timeline = page.getByRole('group', { name: 'Trace timeline navigation' })
    const box = (await timeline.boundingBox())!
    await page.mouse.move(box.x + box.width * 0.5, box.y + Math.min(box.height * 0.3, 200))
    await settle(page)
    const zoom = await measure(page, async () => {
      await page.keyboard.down('Control')
      await page.mouse.wheel(0, -240)
      await page.keyboard.up('Control')
    })
    gate('wheel-zoom', zoom, {
      renders: { layout: 1, row: 31 },
      still: ['header', 'tree', 'details'],
      commits: { rows: 2 },
      frameDrops: 2,
    })
    gate('wheel-pan', await measure(page, () => page.mouse.wheel(240, 0)), {
      renders: { layout: 1, row: 31 },
      still: ['header', 'tree', 'details'],
      commits: { rows: 2 },
      frameDrops: 2,
    })

    // Four pointer moves along one span: only the hovered row renders, once per move.
    const rows = page.locator('[aria-label="Agent session spans"] [role="row"][data-session-id]')
    const rowBox = (await rows.nth(2).boundingBox())!
    await page.mouse.move(rowBox.x + 4, rowBox.y + rowBox.height / 2)
    await settle(page)
    const hover = await measure(page, () =>
      page.mouse.move(rowBox.x + rowBox.width * 0.5, rowBox.y + rowBox.height / 2, { steps: 4 }),
    )
    gate('hover-span', hover, {
      renders: { row: 4 },
      still: ['header', 'tree', 'details'],
      commits: { rows: 8 },
      frameDrops: 0,
    })

    // Selecting opens the details pane, which resizes the workspace: the selection and the resize
    // observer's follow-up updates (pane maxima, shorter row window) render the layout 3 times and
    // the tree twice (the selection, then the shorter row window).
    const select = await click(rows.nth(3))
    gate('select-span', select, {
      renders: { layout: 3, tree: 2, row: 1, details: 1, 'selected-details': 1 },
      still: ['header'],
      commits: { tree: 4, rows: 8, details: 4 },
      frameDrops: 5,
    })

    // A live refresh is a new scene: every region re-renders exactly once.
    const refresh = await click(page.getByRole('button', { name: /Simulate live refresh/ }))
    gate('live-refresh', refresh, {
      renders: { layout: 1, toolbar: 1, tree: 1, row: 24, details: 1, 'selected-details': 1 },
      still: [],
      commits: { header: 1, tree: 3, rows: 2, details: 2 },
      frameDrops: 5,
    })
    await expect(page.getByRole('button', { name: 'Simulate live refresh (1)' })).toBeVisible()
  })
}
