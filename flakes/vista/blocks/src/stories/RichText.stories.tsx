import type { Meta, StoryObj } from '@storybook/react'

import { Markdown } from '../blocks/markdown.tsx'

const sample = `The viewer is a **disposable** surface over a supervised provider.
A viewer crash must not orphan the provider — see the [process-group decision](#set-process-group).
- viewer attaches and detaches freely
- supervisor reaps the \`provider\` process group
- bounded grace, then \`SIGKILL\``

/** A realistic long review document exercising every shipped GFM family. */
const longDocument = `# Supervised provider lifecycle

The viewer is a **disposable** surface over a supervised provider. A viewer
crash must not orphan the provider, and a provider restart must not invalidate
a published snapshot. This document is hard-wrapped at 80 columns on purpose:
folding is the renderer's job, not the author's.

## Constraints

1. Publication artifacts are static — no runtime service may be required.
2. The provider owns its process group; the viewer never signals children.
3. Snapshots are content-addressed, so a rebuild is a no-op when inputs match.

## Failure handling

> A viewer that cannot reach its provider degrades to the last snapshot rather
> than showing an error page. Silence is worse than staleness.

- [x] bounded grace before \`SIGKILL\`
- [x] snapshot fallback on transport loss
- [ ] provider-side backpressure signal
- [ ] operator-visible reap counter

### Reap sequence

\`\`\`ts
const reap = (group: ProcessGroup, grace: Duration) =>
  Effect.gen(function* () {
    yield* group.signal('SIGTERM')
    yield* Effect.sleep(grace)
    yield* group.signal('SIGKILL')
  })
\`\`\`

### Observed budgets

| Stage | Budget | Observed | Verdict |
| :--- | ---: | ---: | :---: |
| attach | 50ms | 31ms | ok |
| first paint | 250ms | 240ms | ok |
| reap (grace) | 2s | 2.1s | over |

## Notes

Autolinked upstream thread: https://github.com/schickling/dotfiles/pull/1
Nested rationale:

- transport
  - loss is expected, not exceptional
  - reconnect is idempotent
- storage
  - snapshots are immutable
  - ~~mutable overlays~~ removed in this revision

Terms of art are footnoted[^grace] rather than expanded inline.

---

Inline markup coverage: **bold**, _italic_, \`code\`, ~~struck~~, a
[relative link](./doctrine.md), and an [anchor](#constraints).

[^grace]: The window between \`SIGTERM\` and \`SIGKILL\` in which a provider may
  flush its snapshot.
`

/**
 * Inputs a renderer must survive: repeated headings (anchor collisions), unsafe
 * URLs, raw HTML, and an unterminated fence.
 */
const hostileDocument = `## Risks

Duplicate headings must still produce stable, unique anchors.

## Risks

### Risks

Unsafe targets are inert: [click me](javascript:alert(1)) and
![payload](data:text/html;base64,PHNjcmlwdD4=).

Raw HTML is shown, never interpreted: <script>alert(1)</script> and
an inline <b>bold</b> attempt.

An unterminated fence must not eat the document:

\`\`\`sh
provider --supervise
`

const meta = {
  title: 'Vista/Blocks/Content/Rich Text',
  component: Markdown,
  args: { source: sample },
} satisfies Meta<typeof Markdown>

export default meta

type Story = StoryObj<typeof meta>

/** Story rendering the rich text block from its default document source. */
export const Default: Story = {}

/**
 * Feeds a large markdown document with headings, tables, task lists, code, and footnotes to
 * exercise the renderer's scrolling and deep-layout behaviour.
 */
export const LongDocument: Story = {
  args: { source: longDocument },
}

/**
 * Supplies a deliberately hostile markdown document to verify the renderer degrades gracefully
 * instead of crashing.
 */
export const HostileInput: Story = {
  args: { source: hostileDocument },
}

/** Renders a zero-length markdown source to confirm the component handles empty input cleanly. */
export const Empty: Story = {
  args: { source: '' },
}

/**
 * Renders a source containing only blank lines, spaces, and tabs to check that whitespace-only
 * input yields no visible output.
 */
export const WhitespaceOnly: Story = {
  args: { source: '\n   \n\t\n' },
}

/**
 * Stacks the rich, long, hostile, empty, and whitespace-only variants in one column so every
 * rendering state can be reviewed at a glance.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Rich prose (bold, code, link, bullets)</strong>
        <Markdown source={sample} />
      </div>
      <div>
        <strong>Long document (headings, tables, task lists, code, footnotes)</strong>
        <Markdown source={longDocument} />
      </div>
      <div>
        <strong>Hostile input (duplicate anchors, unsafe URLs, raw HTML, open fence)</strong>
        <Markdown source={hostileDocument} />
      </div>
      <div>
        <strong>Empty source</strong>
        <Markdown source="" />
      </div>
      <div>
        <strong>Whitespace-only source</strong>
        <Markdown source={'\n   \n\t\n'} />
      </div>
    </div>
  ),
}
