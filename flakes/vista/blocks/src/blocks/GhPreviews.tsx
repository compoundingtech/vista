import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { Result, Schema } from 'effect'
/** Pull-request preview composed from a directly supplied typed data source. */
import { useEffect, useState } from 'react'

import type { DataFeed, DataLoadState } from '../data-feed.ts'
import type { GhPreview } from '../model.ts'
import { Diff } from './Diff.tsx'
import { FileTree } from './FileTree.tsx'

const GitStatusSchema = Schema.Literals([
  'added',
  'deleted',
  'ignored',
  'modified',
  'renamed',
  'untracked',
])

// A URL-identity string: a branded `string` (NOT `Schema.URL`, whose decoded type
// is a `URL` instance — that would break `<a href>` and the `GhPreview.url: string`
// contract). Branding is a type-level phantom: it keeps the wire/decoded value a
// plain `string` (so it stays assignable to `GhPreview.url`) and adds ZERO runtime
// validation, so it can never reject an existing frozen payload.
const GhPreviewUrl = Schema.String.pipe(Schema.brand('Vista.GhPreviewUrl'))

// The decode boundary for a `gh-previews` payload (KR08, MED.DATA-R28–MED.DATA-R30), symmetric
// with the system-explorer model decode: a `DataFeed` yields `unknown`, so the
// block narrows it through a real Schema before rendering rather than trusting a
// shallow shape guard. Optional keys remain JSON-honest (MED.AUTH-R25).
const GhPreviewSchema = Schema.Struct({
  kind: Schema.Literals(['pull-request', 'issue']),
  // A PR / issue number is a positive integer — GitHub numbers start at 1 (richer
  // than a bare `number`); the decoded/encoded type stays `number`, so the wire
  // shape is unchanged.
  number: Schema.Int.check(Schema.isGreaterThan(0)),
  title: Schema.String,
  url: GhPreviewUrl,
  author: Schema.String,
  state: Schema.String,
  body: Schema.optionalKey(Schema.String),
  files: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      status: GitStatusSchema,
      patch: Schema.optionalKey(Schema.String),
    }).annotate({ identifier: 'Vista.GhPreviewFile' }),
  ),
}).annotate({ identifier: 'Vista.GhPreview' })

const decodeGhPreview = Schema.decodeUnknownResult(GhPreviewSchema)

const useDataFeed = (source: DataFeed<unknown> | undefined): DataLoadState<unknown> => {
  const [state, setState] = useState<DataLoadState<unknown>>(
    source ? { _tag: 'loading' } : { _tag: 'empty' },
  )
  useEffect(() => {
    if (!source) {
      // oxlint-disable-next-line react/set-state-in-effect -- reset to empty when the source detaches; render-phase setState would loop on source changes.
      setState({ _tag: 'empty' })
      return
    }
    let cancelled = false
    setState({ _tag: 'loading' })
    source
      .fetch()
      .then((l) => {
        if (!cancelled) setState(l)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({ _tag: 'error', message: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [source])
  return state
}

const GhPreviewStatus = ({
  id,
  kind,
  message,
  style,
}: {
  id: string
  kind: 'loading' | 'error' | 'empty'
  message: string
  style: StyleXStylesWithout<{ containerType: 'inline-size'; overflow: 'hidden' }> | undefined
}) => (
  <section
    {...stylex.props(styles.root, styles.status, statusStyles[kind], style)}
    id={id}
    role={kind === 'error' ? 'alert' : 'status'}
    aria-live={kind === 'loading' ? 'polite' : undefined}
  >
    <p {...stylex.props(styles.statusMessage)}>{message}</p>
  </section>
)

/**
 * Props for the gh-previews block: a required id and data feed, an optional caption, and style
 * overrides that may not set containerType or overflow.
 */
export interface GhPreviewsProps {
  readonly id: string
  readonly dataFeed: DataFeed<unknown>
  readonly caption?: string
  readonly style?:
    | StyleXStylesWithout<{ containerType: 'inline-size'; overflow: 'hidden' }>
    | undefined
}

/**
 * Renders GitHub preview cards from a data feed, showing dedicated loading and error status
 * placeholders until the feed resolves successfully.
 */
export const GhPreviews = ({ id, dataFeed, caption, style }: GhPreviewsProps) => {
  const state = useDataFeed(dataFeed)

  if (state._tag === 'loading') {
    return <GhPreviewStatus id={id} kind="loading" message="Loading preview..." style={style} />
  }
  if (state._tag === 'error') {
    return (
      <GhPreviewStatus
        id={id}
        kind="error"
        message={`gh-previews: ${state.message}`}
        style={style}
      />
    )
  }
  if (state._tag === 'empty') {
    return (
      <GhPreviewStatus id={id} kind="empty" message="gh-previews: empty payload" style={style} />
    )
  }
  const decoded = decodeGhPreview(state.value)
  if (Result.isFailure(decoded)) {
    return (
      <GhPreviewStatus
        id={id}
        kind="error"
        message="gh-previews: malformed payload"
        style={style}
      />
    )
  }

  const pr: GhPreview = decoded.success
  const treeEntries = pr.files.map((f) => ({ path: f.path, status: f.status }))
  const patchFiles = pr.files.filter((f) => f.patch)

  return (
    <section {...stylex.props(styles.root, style)} id={id} aria-label={`${pr.kind} preview`}>
      <header {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.kind, ghKindStyles[pr.kind])}>{pr.kind}</span>
        <a {...stylex.props(styles.title)} href={pr.url}>
          #{pr.number} {pr.title}
        </a>
        <span {...stylex.props(styles.meta)}>
          {pr.author} · {pr.state}
        </span>
      </header>
      {pr.body ? <p {...stylex.props(styles.body)}>{pr.body}</p> : null}
      <div {...stylex.props(styles.split)}>
        <div {...stylex.props(styles.tree)}>
          <div {...stylex.props(styles.paneTitle)}>Changed files ({pr.files.length})</div>
          <FileTree id={`${id}-tree`} entries={treeEntries} />
        </div>
        <div {...stylex.props(styles.diffs)}>
          {patchFiles.length === 0 ? (
            <p {...stylex.props(styles.empty)}>No file patches in this preview.</p>
          ) : (
            patchFiles.map((f) => (
              <Diff
                key={f.path}
                id={`${id}-diff-${f.path}`}
                source={{ _tag: 'patch', patch: f.patch! }}
                view="unified"
                caption={f.path}
              />
            ))
          )}
        </div>
      </div>
      {caption ? <footer {...stylex.props(styles.caption)}>{caption}</footer> : null}
    </section>
  )
}

const styles = stylex.create({
  root: {
    containerType: 'inline-size',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    paddingBlockStart: '0.75rem',
    paddingInline: '1rem',
    paddingBlockEnd: '1rem',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.6rem',
    flexWrap: 'wrap',
  },
  kind: {
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    fontWeight: 600,
    paddingBlock: '0.12rem',
    paddingInline: '0.4rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: scale.radiusSm,
  },
  kindPullRequest: {
    borderColor: `color-mix(in srgb, ${tokens['--ds-blue-700']} 14%, ${tokens['--ds-gray-alpha-400']})`,
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-blue-900']} 4%, ${tokens['--ds-background-100']})`,
    color: tokens['--ds-blue-700'],
  },
  kindIssue: {
    borderColor: `color-mix(in srgb, ${tokens['--ds-amber-900']} 14%, ${tokens['--ds-gray-alpha-400']})`,
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-amber-900']} 4%, ${tokens['--ds-background-100']})`,
    color: tokens['--ds-amber-900'],
  },
  title: {
    minWidth: 0,
    fontWeight: 650,
    color: {
      default: tokens['--ds-foreground'],
      ':hover': tokens['--ds-blue-700'],
    },
    textDecoration: 'none',
    outlineWidth: {
      default: 0,
      ':focus-visible': 2,
    },
    outlineStyle: {
      default: 'none',
      ':focus-visible': 'solid',
    },
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: {
      default: 0,
      ':focus-visible': 2,
    },
    borderRadius: scale.radiusSm,
  },
  meta: {
    marginLeft: 'auto',
    fontSize: '0.8rem',
    color: tokens['--ds-gray-800'],
  },
  body: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.9rem',
    marginBlockStart: '0.5rem',
    marginInline: 0,
    marginBlockEnd: '0.75rem',
  },
  split: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(12rem, 16rem) 1fr',
      '@container (max-width: 48rem)': '1fr',
    },
    gap: '0.75rem',
    alignItems: 'start',
    minWidth: 0,
  },
  tree: {
    minWidth: 0,
  },
  diffs: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  paneTitle: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: tokens['--ds-gray-800'],
    marginBottom: '0.4rem',
  },
  status: {
    paddingBlockStart: '0.65rem',
    paddingInline: '0.75rem',
    paddingBlockEnd: '0.65rem',
  },
  statusError: {
    borderColor: `color-mix(in srgb, ${tokens['--ds-red-900']} 14%, ${tokens['--ds-gray-alpha-400']})`,
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-red-900']} 4%, ${tokens['--ds-background-100']})`,
  },
  statusMessage: {
    margin: 0,
    color: tokens['--ds-gray-900'],
    fontSize: '0.88rem',
  },
  empty: {
    margin: 0,
    color: tokens['--ds-gray-900'],
    fontSize: '0.88rem',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    padding: '0.75rem',
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  caption: {
    display: 'block',
    marginTop: '0.6rem',
    fontSize: '0.8rem',
    color: tokens['--ds-gray-800'],
  },
})

const ghKindStyles = {
  issue: styles.kindIssue,
  'pull-request': styles.kindPullRequest,
} as const

const statusStyles = {
  loading: undefined,
  error: styles.statusError,
  empty: undefined,
} as const
