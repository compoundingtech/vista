/**
 * Pull Request Review — locked decisions (2026-09-18)
 *
 * - L2: treemap banner above; resizable file rail left of the resizable diff.
 * - B1: closed description disclosure under the header.
 * - S2: one-row stack pills with truncated inline titles.
 * - M1: churn by directory; the layout toggle remains available at runtime.
 * - F1: filter button in the treemap controls row.
 */
import type { Meta, StoryObj } from '@storybook/react'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import { PullRequestViewer } from '../blocks/PullRequestViewer.tsx'
import { canaryBase, canaryStack, canaryTop } from './_canary-fixtures.ts'
import {
  provenancePullRequest,
  pullRequest as syntheticPullRequest,
} from './_pull-request-fixtures.ts'

/** Production pull-request review composition over the real canary stack. */
const meta = {
  title: 'Vista/Compositions/Pull Request Review',
  component: PullRequestViewer,
  args: {
    id: 'pr-review',
    pullRequest: canaryBase,
    stack: canaryStack,
    treemap: 'above',
    viewportHeight: 'max(36rem, 70vh)',
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PullRequestViewer>

export default meta
type Story = StoryObj<typeof meta>

/** The locked composition on the base of the canary stack. */
export const Default: Story = {}

/** The default composition (`PullRequestViewer`) on the base of the canary stack. */
export const CanaryBase: Story = {}

/** The top of the stack: the smallest request, reviewed with the stack visible. */
export const CanaryTop: Story = { args: { pullRequest: canaryTop } }
/** Focus one canary commit, then extend to a true per-commit stacked diff. */
export const CommitFocus: Story = {
  args: {
    id: 'pr-review-commit-focus',
    pullRequest: canaryTop,
    stack: undefined,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const commits = args.pullRequest.commits!
    const newest = commits.at(-1)!
    const previous = commits.at(-2)!
    const newestSubject = newest.message.split('\n', 1)[0]!
    const newestPath = newest.files[0]!.path
    const previousPath = previous.files[0]!.path

    await userEvent.click(canvas.getByRole('button', { name: /^Commit focus:/ }))
    const page = within(canvasElement.ownerDocument.body)
    const dialog = await page.findByRole('dialog', { name: 'Commit focus' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'None' }))
    await userEvent.click(
      within(dialog).getByRole('row', {
        name: new RegExp(`${newest.sha.slice(0, 7)}.*${newest.author}`),
      }),
    )
    await expect(
      canvas.getByRole('button', {
        name: `Commit focus: 1 of ${commits.length} commits`,
      }),
    ).toBeVisible()

    const railSearch = canvas.getByRole('searchbox', { name: 'Search changed files' })
    fireEvent.change(railSearch, { target: { value: newestPath } })
    fireEvent.keyDown(railSearch, { key: 'Enter' })
    const railItem = (path: string) =>
      canvasElement
        .querySelector('nav[aria-label="Changed files"] file-tree-container')
        ?.shadowRoot?.querySelector(`[data-item-path="${path}"]`) ?? null
    await waitFor(() => expect(railItem(newestPath)).not.toBeNull(), { timeout: 5_000 })
    await expect(
      await canvas.findByText(new RegExp(newestPath.split('/').at(-1)!.replaceAll('.', '\\.'))),
    ).toBeVisible()
    fireEvent.change(railSearch, { target: { value: previousPath } })
    await waitFor(() => expect(railItem(previousPath)).toBeNull(), { timeout: 5_000 })

    await userEvent.click(
      within(dialog).getByRole('row', {
        name: new RegExp(`${previous.sha.slice(0, 7)}.*${previous.author}`),
      }),
    )
    await expect(
      await canvas.findByRole('heading', {
        level: 3,
        name: `Commit ${newest.sha.slice(0, 7)}: ${newestSubject}`,
      }),
    ).toBeVisible()
  },
}

/** Empty commit focus keeps the review recoverable and uses grid selection semantics. */
export const CommitFocusRecovery: Story = {
  args: {
    id: 'pr-review-commit-focus-recovery',
    pullRequest: canaryTop,
    stack: undefined,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const commits = args.pullRequest.commits!

    await userEvent.click(canvas.getByRole('button', { name: /^Commit focus:/ }))
    const page = within(canvasElement.ownerDocument.body)
    const dialog = await page.findByRole('dialog', { name: 'Commit focus' })
    const commitGrid = within(dialog).getByRole('grid', { name: 'Commits' })
    const rows = within(commitGrid).getAllByRole('row')
    const links = within(commitGrid).getAllByRole('link', { name: /^Open commit / })

    await expect(within(commitGrid).queryByRole('option')).toBeNull()
    await expect(within(commitGrid).queryByRole('checkbox')).toBeNull()
    await expect(rows).toHaveLength(commits.length)
    await expect(links).toHaveLength(commits.length)
    for (const row of rows) {
      await expect(row).toHaveAttribute('aria-selected', 'true')
    }
    for (const link of links) {
      await expect(link).toHaveAttribute('href')
    }

    await userEvent.click(within(dialog).getByRole('button', { name: 'None' }))
    await expect(
      canvas.getByRole('button', {
        name: `Commit focus: 0 of ${commits.length} commits`,
      }),
    ).toBeVisible()
    await expect(await canvas.findByText('No commits selected.')).toBeVisible()
    await expect(canvas.queryByText('This pull request changes no files.')).toBeNull()
    await expect(canvas.getByRole('navigation', { name: 'Changed files' })).toBeVisible()
    await expect(dialog).toBeVisible()
    for (const row of rows) {
      await expect(row).toHaveAttribute('aria-selected', 'false')
    }

    await userEvent.click(within(dialog).getByRole('button', { name: 'All' }))
    for (const row of rows) {
      await expect(row).toHaveAttribute('aria-selected', 'true')
    }
    await waitFor(() => expect(canvas.queryByText('No commits selected.')).toBeNull())
    await waitFor(() => expect(canvasElement.querySelector('diffs-container')).not.toBeNull(), {
      timeout: 5_000,
    })
  },
}

/** A single request outside any stack: no stack chrome at all. */
export const Standalone: Story = {
  args: { pullRequest: syntheticPullRequest, stack: undefined, treemap: 'above' },
}

/** Zooming a directory scopes and re-roots the map, rail, and pane; the root crumb restores all. */
export const TreemapScopesDiff: Story = {
  args: { id: 'pr-review-scope', pullRequest: canaryTop },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const map = within(canvas.getByRole('tree', { name: 'Value-proportioned hierarchy' }))
    const breadcrumb = within(canvas.getByRole('navigation', { name: 'Breadcrumb' }))
    await userEvent.click(map.getByRole('treeitem', { name: /^packages,/ }))
    await expect(breadcrumb.getByRole('button', { name: 'packages' })).toBeVisible()
    await userEvent.click(breadcrumb.getByRole('button', { name: 'All files' }))
    await expect(breadcrumb.queryByRole('button', { name: 'packages' })).toBeNull()
    const restoredMap = within(canvas.getByRole('tree', { name: 'Value-proportioned hierarchy' }))
    await expect(restoredMap.getByRole('treeitem', { name: /^packages,/ })).toBeVisible()
  },
}

/** Depth starts at four, remains interactive, and follows the reviewer across stack navigation. */
export const TreemapDepthControl: Story = {
  args: { id: 'pr-review-depth' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    let depth = within(canvas.getByRole('group', { name: 'Render depth' }))
    await expect(depth.getByText('depth 4')).toBeVisible()

    await userEvent.click(depth.getByRole('button', { name: 'Increase depth' }))
    await expect(depth.getByText('depth 5')).toBeVisible()

    const stack = within(canvas.getByRole('navigation', { name: 'Pull request stack' }))
    await userEvent.click(stack.getByRole('button', { name: /^#1262/ }))
    await expect(canvas.getByRole('link', { name: /^#1262 / })).toBeVisible()
    depth = within(canvas.getByRole('group', { name: 'Render depth' }))
    await expect(depth.getByText('depth 5')).toBeVisible()

    await userEvent.click(depth.getByRole('button', { name: 'Decrease depth' }))
    await expect(depth.getByText('depth 4')).toBeVisible()
  },
}

/** Hiding a top-level directory prunes the shared treemap, file rail, and diff projection. */
export const FilterHidesEverywhere: Story = {
  args: { id: 'pr-review-filter', pullRequest: canaryTop },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const map = within(canvas.getByRole('tree', { name: 'Value-proportioned hierarchy' }))
    const packagePath =
      'packages/@overeng/buck2-tools/src/package-command-runner.integration.test.ts'
    const packageRailItem = () =>
      canvasElement
        .querySelector('nav[aria-label="Changed files"] file-tree-container')
        ?.shadowRoot?.querySelector(`[data-item-path="${packagePath}"]`) ?? null
    const packagesTile = map.queryByRole('treeitem', { name: /^packages,/ })
    if (packagesTile !== null) {
      await expect(packagesTile).toBeVisible()
      const railSearch = canvas.getByRole('searchbox', { name: 'Search changed files' })
      fireEvent.change(railSearch, {
        target: { value: 'package-command-runner.integration.test.ts' },
      })
      fireEvent.keyDown(canvas.getByRole('searchbox', { name: 'Search changed files' }), {
        key: 'Enter',
      })
      await waitFor(() => expect(packageRailItem()).not.toBeNull(), { timeout: 5_000 })
      await expect(packageRailItem()).toBeVisible()
      await userEvent.click(canvas.getByRole('button', { name: 'Filter tree' }))
      const page = within(canvasElement.ownerDocument.body)
      const dialog = await page.findByRole('dialog', { name: 'Filter tree' })
      const packagesCheckbox = within(dialog).getByRole('checkbox', { name: 'Include packages' })
      packagesCheckbox.focus()
      await userEvent.keyboard(' ')
      await userEvent.keyboard('{Escape}')
    }
    await waitFor(
      () => {
        const filteredMap = within(
          canvas.getByRole('tree', { name: 'Value-proportioned hierarchy' }),
        )
        expect(filteredMap.queryByRole('treeitem', { name: /^packages,/ })).toBeNull()
        expect(packageRailItem()).toBeNull()
        expect(canvas.getByRole('button', { name: 'Filter tree' })).toHaveTextContent('hidden')
      },
      { timeout: 5_000 },
    )
  },
}

/**
 * `.gitattributes` provenance is a visible, reversible filter: generated files
 * start unchecked while authored and vendored files retain their included default.
 */
export const GeneratedFilesCanBeReenabled: Story = {
  args: {
    id: 'pr-review-generated-filter',
    pullRequest: provenancePullRequest,
    stack: undefined,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const generatedPath = args.pullRequest.files.find(
      (file) => file.provenance === 'generated',
    )!.path
    const authoredPath = args.pullRequest.files.find(
      (file) => file.provenance === undefined || file.provenance === 'authored',
    )!.path
    const vendoredPath = args.pullRequest.files.find((file) => file.provenance === 'vendored')!.path
    const railItem = (path: string) => {
      const tree = canvasElement.querySelector(
        'nav[aria-label="Changed files"] file-tree-container',
      )
      return tree?.shadowRoot?.querySelector(`[data-item-path="${path}"]`) ?? null
    }

    await waitFor(() => {
      expect(railItem(authoredPath)).not.toBeNull()
      expect(railItem(vendoredPath)).not.toBeNull()
      expect(railItem(generatedPath)).toBeNull()
    })

    await userEvent.click(canvas.getByRole('button', { name: 'Filter tree' }))
    const page = within(canvasElement.ownerDocument.body)
    const dialog = await page.findByRole('dialog', { name: 'Filter tree' })
    const provenance = within(within(dialog).getByRole('group', { name: 'Filter by Provenance' }))
    const generated = provenance.getByRole('checkbox', { name: 'Include Generated' })
    const vendored = provenance.getByRole('checkbox', { name: 'Include Vendored' })

    await expect(generated).not.toBeChecked()
    await expect(vendored).toBeChecked()
    await userEvent.click(generated)
    await expect(generated).toBeChecked()
    await waitFor(() => expect(railItem(generatedPath)).not.toBeNull())
  },
}

/** Switching the active request in the stack swaps header, body, and files. */
export const StackSwitch: Story = {
  args: { id: 'pr-review-stack' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The treemap's root breadcrumb is also a `#<number>` button; ask the stack nav.
    const stack = within(canvas.getByRole('navigation', { name: 'Pull request stack' }))
    await expect(canvas.getByRole('link', { name: /^#1260 / })).toBeVisible()
    await userEvent.click(stack.getByRole('button', { name: /^#1262/ }))
    await expect(canvas.getByRole('link', { name: /^#1262 / })).toBeVisible()
    await expect(stack.getByRole('button', { name: /^#1262/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

/** The description is GFM: the canary body's headings and lists render as prose. */
export const BodyIsMarkdown: Story = {
  args: { id: 'pr-review-body', bodyCollapsible: false, treemap: 'none' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const headings = await canvas.findAllByRole('heading')
    await expect(headings.length).toBeGreaterThan(0)
  },
}

/** Locked composition across stack, standalone, and narrow-container states. */
export const AllStates: Story = {
  render: (args) => (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        inlineSize: '100%',
        padding: 12,
      }}
    >
      <PullRequestViewer {...args} id="all-stack-top" pullRequest={canaryTop} />
      <PullRequestViewer {...args} id="all-stack-base" pullRequest={canaryBase} />
      <PullRequestViewer
        {...args}
        id="all-single"
        pullRequest={syntheticPullRequest}
        stack={undefined}
        viewportHeight="22rem"
      />
      <div style={{ inlineSize: 'min(40rem, 100%)' }}>
        <PullRequestViewer
          {...args}
          id="all-narrow"
          pullRequest={canaryTop}
          viewportHeight="26rem"
        />
      </div>
    </div>
  ),
}
