/**
 * Light chrome parts of the composable pull-request review: identity header,
 * markdown body, stack navigation, the scope/layout toolbar, and the list of
 * files that could not be rendered. Each reads `usePullRequestReview()` and
 * renders nothing that is not in the captured payload.
 */
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { useState, type CSSProperties } from 'react'

import type { GitStatus } from '../../model.ts'
import { Markdown } from '../markdown.tsx'
import { summarizePullRequestStack } from '../pull-request-stack.ts'
import type { PullRequestData } from '../pull-request.ts'
import { usePullRequestReview } from './review.tsx'

/**
 * Provides the human-readable display label for every Git change status so UI surfaces need not
 * switch on the raw status union.
 */
export const STATUS_LABEL: Record<GitStatus, string> = {
  added: 'added',
  deleted: 'deleted',
  ignored: 'ignored',
  modified: 'modified',
  renamed: 'renamed',
  untracked: 'untracked',
}

/** Compact churn: exact below a thousand, `10.9k` above. */
export const formatChurn = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

const BODY_HEADING_SCALE = {
  '--vista-heading-2-size': '1.05rem',
  '--vista-heading-3-size': '0.95rem',
  '--vista-heading-4-size': '0.88rem',
  '--vista-heading-5-size': '0.84rem',
  '--vista-heading-6-size': '0.8rem',
} as CSSProperties

const Churn = ({ additions, deletions }: { additions: number; deletions: number }) => (
  <span {...stylex.props(styles.churn)}>
    <span {...stylex.props(styles.additions)}>+{formatChurn(additions)}</span>{' '}
    <span {...stylex.props(styles.deletions)}>−{formatChurn(deletions)}</span>
  </span>
)

const requestChurn = (pr: PullRequestData, parsed: { additions: number; deletions: number }) => ({
  additions: pr.additions ?? parsed.additions,
  deletions: pr.deletions ?? parsed.deletions,
})

/**
 * Request identity — state, linked title, author, file count, churn, stack
 * position — plus the review controls that belong on the same line: the active
 * directory scope (clearable) and the unified⇄split toggle.
 */
export const PullRequestHeader = ({
  style,
}: {
  readonly style?: StyleXStylesWithout<{ display: string }> | undefined
}) => {
  const { pullRequest, projection, stack } = usePullRequestReview()
  const churn = requestChurn(pullRequest, projection)
  const files = projection.entries.length
  const position = stack.findIndex((pr) => pr.number === pullRequest.number)
  const refs =
    pullRequest.baseRef !== undefined && pullRequest.headRef !== undefined
      ? `${pullRequest.headRef} → ${pullRequest.baseRef}`
      : undefined
  return (
    <header {...stylex.props(styles.header, style)}>
      <span {...stylex.props(styles.state)}>{pullRequest.state}</span>
      {/* Number and churn already sit in the stack pill; branches are one hover away. */}
      <a
        {...stylex.props(styles.title)}
        href={pullRequest.url}
        title={refs === undefined ? `#${pullRequest.number}` : `#${pullRequest.number} · ${refs}`}
        aria-label={`#${pullRequest.number} ${pullRequest.title}`}
      >
        {stack.length > 1 ? null : <>#{pullRequest.number} </>}
        {pullRequest.title}
      </a>
      <span {...stylex.props(styles.meta)}>
        {pullRequest.author} · {files} {files === 1 ? 'file' : 'files'}
        {stack.length > 1 ? (
          ` · ${position + 1}/${stack.length}`
        ) : (
          <>
            {' '}
            · <Churn {...churn} />
          </>
        )}
      </span>
    </header>
  )
}

/**
 * The request description as GFM prose. `collapsible` folds it behind a
 * disclosure (the first line stays visible as the summary) so a long body never
 * pushes the diff out of view; `maxBlockSize` bounds the open height instead.
 */
export const PullRequestBody = ({
  collapsible = true,
  defaultOpen = false,
  maxBlockSize = '18rem',
  style,
}: {
  readonly collapsible?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  /** CSS length; the body scrolls inside it. `'none'` lets it grow. */
  readonly maxBlockSize?: string | undefined
  readonly style?: StyleXStylesWithout<{ display: string }> | undefined
}) => {
  const { pullRequest } = usePullRequestReview()
  const [open, setOpen] = useState(defaultOpen)
  const body = pullRequest.body ?? ''
  if (body.trim() === '') {
    return <p {...stylex.props(styles.noBody, style)}>No description.</p>
  }
  // StyleX carries the dynamic `maxBlockSize` in `style`, so merge rather than replace.
  const scroll = stylex.props(styles.bodyScroll, styles.bodyMax(maxBlockSize))
  const prose = (
    <div
      className={scroll.className}
      // Document-scale heading sizes read as section titles; a request body is a
      // note inside the review, so its headings step down to block scale.
      style={{ ...scroll.style, ...BODY_HEADING_SCALE }}
    >
      <Markdown source={body} style={styles.prose} />
    </div>
  )
  if (!collapsible) return <div {...stylex.props(styles.body, style)}>{prose}</div>
  // The first prose line (not a heading or rule) previews the body in the closed state.
  const preview =
    body
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '' && !/^(#{1,6}\s|-{3,}$|\*{3,}$)/u.test(line)) ?? ''
  return (
    <details
      {...stylex.props(styles.body, style)}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary {...stylex.props(styles.summary)} aria-label="Pull request description">
        {open ? <span {...stylex.props(styles.summaryLabel)}>Description</span> : null}
        {open ? null : (
          <span {...stylex.props(styles.summaryPreview)}>
            {preview.replace(/^[-*>]\s+/u, '').slice(0, 140)}
          </span>
        )}
      </summary>
      {prose}
    </details>
  )
}

/**
 * Stack navigation: every request base→top, the active one pressed. Horizontal
 * pills read as a pipeline; the vertical list gives room for titles and churn.
 */
export const PullRequestStackNav = ({
  orientation = 'horizontal',
  titles = orientation === 'vertical' ? 'full' : 'inline',
  style,
}: {
  readonly orientation?: 'horizontal' | 'vertical' | undefined
  /**
   * How much of each request's title a pill shows: none (number + churn), a
   * truncated title inline, or the full title on its own line.
   */
  readonly titles?: 'none' | 'inline' | 'full' | undefined
  readonly style?: StyleXStylesWithout<{ display: string }> | undefined
}) => {
  const { stack, activeNumber, setActiveNumber } = usePullRequestReview()
  if (stack.length < 2) return null
  const summary = summarizePullRequestStack(stack)
  const vertical = orientation === 'vertical'
  return (
    <nav
      {...stylex.props(styles.stack, vertical && styles.stackVertical, style)}
      aria-label="Pull request stack"
    >
      <span
        {...stylex.props(styles.stackSummary)}
        title={`${summary.count} pull requests · ${summary.files} files · ${summary.sharedPaths} paths changed by more than one`}
      >
        {summary.count} PRs · {summary.files} files
        {summary.sharedPaths > 0 ? ` · ${summary.sharedPaths} shared` : ''}
      </span>
      <ol
        {...stylex.props(styles.stackList, vertical && styles.stackListVertical)}
        // Every pill gets an equal share of the row, so titles truncate instead of wrapping.
        style={
          vertical ? undefined : { gridTemplateColumns: `repeat(${stack.length}, minmax(0, 1fr))` }
        }
      >
        {stack.map((pr) => {
          const active = pr.number === activeNumber
          const churn = requestChurn(pr, {
            additions: pr.files.reduce((n, f) => n + (f.additions ?? 0), 0),
            deletions: pr.files.reduce((n, f) => n + (f.deletions ?? 0), 0),
          })
          const meta = (
            <span {...stylex.props(styles.stackMeta)}>
              {titles === 'inline' ? null : `${pr.files.length} files · `}
              <Churn {...churn} />
            </span>
          )
          return (
            <li key={pr.number} {...stylex.props(styles.stackItem)}>
              <button
                type="button"
                {...stylex.props(
                  styles.stackButton,
                  (vertical || titles === 'full') && styles.stackButtonVertical,
                  active && styles.stackButtonActive,
                )}
                aria-pressed={active}
                onClick={() => setActiveNumber(pr.number)}
                title={`#${pr.number} ${pr.title} · ${pr.files.length} files`}
              >
                {titles === 'full' ? (
                  <>
                    <span {...stylex.props(styles.stackRow)}>
                      <span {...stylex.props(styles.stackNumber)}>#{pr.number}</span>
                      {meta}
                    </span>
                    <span {...stylex.props(styles.stackTitle)}>{pr.title}</span>
                  </>
                ) : (
                  <>
                    <span {...stylex.props(styles.stackNumber)}>#{pr.number}</span>
                    {titles === 'inline' ? (
                      <span {...stylex.props(styles.stackTitle)}>{pr.title}</span>
                    ) : null}
                    {meta}
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Every file the projection could not render, with the bounded reason. */
export const PullRequestProblems = () => {
  const { projection } = usePullRequestReview()
  const problems = projection.entries.filter((entry) => entry.problem !== undefined)
  if (problems.length === 0) return null
  return (
    <ul {...stylex.props(styles.problems)} aria-label="Files that could not be rendered">
      {problems.map((entry) => (
        <li key={entry.id} {...stylex.props(styles.problem)}>
          <span {...stylex.props(styles.problemPath)}>{entry.path}</span>
          <span {...stylex.props(styles.problemStatus)}>{STATUS_LABEL[entry.status]}</span>
          <span>{entry.problem}</span>
        </li>
      ))}
    </ul>
  )
}

const styles = stylex.create({
  header: {
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'baseline',
    gap: '0.6rem',
    minWidth: 0,
  },
  state: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    paddingBlock: '0.1rem',
    paddingInline: '0.4rem',
    borderRadius: scale.radiusSm,
    color: tokens['--ds-blue-700'],
    backgroundColor: tokens['--ds-blue-200'],
  },
  title: {
    flex: '0 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: {
      default: tokens['--ds-foreground'],
      ':hover': tokens['--ds-blue-700'],
    },
    textDecoration: {
      default: 'none',
      ':hover': 'underline',
    },
  },
  meta: {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.78rem',
    color: tokens['--ds-gray-800'],
  },
  refs: {
    textDecoration: 'underline dotted',
    textUnderlineOffset: '0.15em',
    cursor: 'help',
  },
  churn: { whiteSpace: 'nowrap' },
  additions: { color: tokens['--ds-green-700'] },
  deletions: { color: tokens['--ds-red-700'] },
  body: {
    paddingInlineStart: '0.6rem',
    borderInlineStartWidth: 2,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: tokens['--ds-gray-alpha-400'],
  },
  noBody: {
    margin: 0,
    fontSize: '0.8rem',
    fontStyle: 'italic',
    color: tokens['--ds-gray-800'],
  },
  summary: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
    minWidth: 0,
    cursor: 'pointer',
    fontSize: '0.8rem',
    color: tokens['--ds-gray-900'],
    listStyle: 'none',
    '::-webkit-details-marker': { display: 'none' },
    '::before': {
      content: '"▸"',
      fontSize: '0.7rem',
      color: tokens['--ds-gray-800'],
    },
  },
  summaryLabel: { fontWeight: 600, flexShrink: 0 },
  summaryPreview: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens['--ds-gray-800'],
  },
  bodyScroll: {
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  bodyMax: (maxBlockSize: string) => ({ maxBlockSize }),
  prose: { fontSize: '0.84rem' },
  stack: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'max-content minmax(0, 1fr)',
      '@container (max-width: 52rem)': 'minmax(0, 1fr)',
    },
    alignItems: 'center',
    columnGap: '0.6rem',
    rowGap: '0.3rem',
    minWidth: 0,
  },
  stackVertical: {
    gridTemplateColumns: 'minmax(0, 1fr)',
    padding: '0.5rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
  },
  stackSummary: {
    fontSize: '0.72rem',
    color: tokens['--ds-gray-800'],
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  stackList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '0.3rem',
    minWidth: 0,
  },
  stackListVertical: { gridTemplateColumns: 'minmax(0, 1fr)' },
  stackItem: { display: 'flex', minWidth: 0 },
  stackButton: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.45rem',
    minWidth: 0,
    inlineSize: '100%',
    overflow: 'hidden',
    paddingBlock: '0.25rem',
    paddingInline: '0.55rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: tokens['--ds-background-200'],
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    fontSize: '0.76rem',
    textAlign: 'start',
    outlineWidth: { default: 0, ':focus-visible': 2 },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineColor: { default: 'transparent', ':focus-visible': tokens['--ds-focus-color'] },
  },
  stackButtonVertical: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '0.15rem',
    inlineSize: '100%',
    overflow: 'hidden',
  },
  stackButtonActive: {
    borderColor: tokens['--ds-blue-700'],
    backgroundColor: {
      default: `color-mix(in srgb, ${tokens['--ds-blue-900']} 6%, ${tokens['--ds-background-100']})`,
      ':hover': `color-mix(in srgb, ${tokens['--ds-blue-900']} 6%, ${tokens['--ds-background-100']})`,
    },
    color: tokens['--ds-foreground'],
  },
  stackRow: { display: 'flex', alignItems: 'baseline', gap: '0.45rem', minWidth: 0 },
  stackNumber: { fontWeight: 600, fontFamily: scale.fontMono, flexShrink: 0 },
  stackTitle: {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stackMeta: { fontSize: '0.7rem', color: tokens['--ds-gray-800'], whiteSpace: 'nowrap' },
  problems: {
    listStyle: 'none',
    margin: 0,
    padding: '0.4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    maxBlockSize: '7rem',
    overflowY: 'auto',
    borderWidth: 1,
    borderStyle: 'solid',
    // `--ds-red-100`/`--ds-red-400` are dark-ramp surfaces and paint a near-black
    // slab on the light theme. Mixing the vivid `--ds-red-900` accent into the
    // page background keeps the band a legible error surface in both schemes.
    borderColor: `color-mix(in srgb, ${tokens['--ds-red-900']} 28%, ${tokens['--ds-gray-alpha-400']})`,
    borderRadius: scale.radiusSm,
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-red-900']} 6%, ${tokens['--ds-background-100']})`,
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  problem: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0.4rem',
    fontSize: '0.76rem',
    color: tokens['--ds-red-900'],
  },
  problemPath: {
    fontFamily: scale.fontMono,
    color: tokens['--ds-gray-1000'],
  },
  problemStatus: {
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens['--ds-gray-800'],
  },
})
