import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  GridList,
  GridListItem,
  Link,
  Popover,
} from 'react-aria-components'

import { useTheme } from '../../theme.ts'
import { CheckRowActions } from '../treemap/CheckRow.tsx'
import { usePullRequestReview } from './review.tsx'
import { formatCompactAge } from './time.ts'
/** Compact commit-focus control for the active pull request. */
export const PullRequestCommits = () => {
  const theme = useTheme()
  const { commits, pullRequest, selectedCommitShas, setSelectedCommits } = usePullRequestReview()
  const [openedAt, setOpenedAt] = React.useState(() => Date.now())
  const newestFirst = React.useMemo(() => commits.toReversed(), [commits])
  const commitHrefBase = React.useMemo(() => {
    if (pullRequest.repository !== undefined) {
      return `https://github.com/${pullRequest.repository}/commit/`
    }
    try {
      const pullRequestUrl = new URL(pullRequest.url)
      const [owner, repository] = pullRequestUrl.pathname.split('/').filter(Boolean)
      return owner === undefined || repository === undefined
        ? undefined
        : `${pullRequestUrl.origin}/${owner}/${repository}/commit/`
    } catch {
      return undefined
    }
  }, [pullRequest.repository, pullRequest.url])

  if (commits.length === 0) return null

  const selectedCount = selectedCommitShas?.size ?? commits.length
  const label =
    selectedCommitShas === undefined || selectedCount === commits.length
      ? 'All commits'
      : `${selectedCount} of ${commits.length} commits`

  return (
    <DialogTrigger
      onOpenChange={(isOpen) => {
        if (isOpen) setOpenedAt(Date.now())
      }}
    >
      <Button
        className={({ isHovered, isPressed, isFocusVisible }) =>
          stylex.props(
            styles.trigger,
            isHovered && styles.triggerHovered,
            isPressed && styles.triggerPressed,
            selectedCommitShas !== undefined && styles.triggerActive,
            isFocusVisible && styles.focused,
          ).className ?? ''
        }
        aria-label={`Commit focus: ${label}`}
      >
        <span aria-hidden="true" {...stylex.props(styles.caret)}>
          ▾
        </span>
        <span>{label}</span>
      </Button>
      <Popover {...stylex.props(styles.popover)} placement="bottom start" data-theme={theme}>
        <Dialog {...stylex.props(styles.dialog)} aria-label="Commit focus">
          <div {...stylex.props(styles.header)}>
            <span {...stylex.props(styles.summary)}>{label}</span>
            <CheckRowActions
              onAll={() => setSelectedCommits(undefined)}
              onNone={() => setSelectedCommits(new Set())}
            />
          </div>
          <GridList
            {...stylex.props(styles.list)}
            aria-label="Commits"
            items={newestFirst}
            selectionMode="multiple"
            selectionBehavior="toggle"
            selectedKeys={selectedCommitShas ?? 'all'}
            onSelectionChange={(keys) => {
              if (keys === 'all') {
                setSelectedCommits(undefined)
                return
              }
              const shas = new Set([...keys].map(String))
              setSelectedCommits(shas.size === commits.length ? undefined : shas)
            }}
          >
            {(commit) => {
              const subject = commit.message.split('\n', 1)[0] ?? commit.message
              const additions = commit.files.reduce(
                (total, file) => total + (file.additions ?? 0),
                0,
              )
              const deletions = commit.files.reduce(
                (total, file) => total + (file.deletions ?? 0),
                0,
              )
              const commitDate = new Date(commit.date)
              const dateTitle = Number.isNaN(commitDate.getTime())
                ? commit.date
                : `${commitDate.toISOString()} · ${commitDate.toLocaleString()}`
              const shortSha = commit.sha.slice(0, 7)
              const commitHref =
                commitHrefBase === undefined ? undefined : `${commitHrefBase}${commit.sha}`
              return (
                <GridListItem
                  id={commit.sha}
                  textValue={`${subject} ${shortSha} ${commit.author}`}
                  aria-label={`${subject} ${shortSha} ${commit.author}`}
                  className={({ isHovered, isSelected, isFocusVisible }) =>
                    stylex.props(
                      styles.item,
                      isHovered && styles.itemHovered,
                      isSelected && styles.itemSelected,
                      isFocusVisible && styles.focused,
                    ).className ?? ''
                  }
                >
                  {({ isSelected }) => (
                    <>
                      <span {...stylex.props(styles.check)} aria-hidden="true">
                        <span {...stylex.props(styles.box, isSelected && styles.boxChecked)}>
                          {isSelected ? '✓' : ''}
                        </span>
                      </span>
                      <span {...stylex.props(styles.commitLabel)}>
                        <span {...stylex.props(styles.subject)}>{subject}</span>
                        {commitHref === undefined ? (
                          <span {...stylex.props(styles.sha)}>{shortSha}</span>
                        ) : (
                          <Link
                            className={({ isHovered, isFocusVisible }) =>
                              stylex.props(
                                styles.sha,
                                isHovered && styles.shaHovered,
                                isFocusVisible && styles.focused,
                              ).className ?? ''
                            }
                            aria-label={`Open commit ${shortSha}`}
                            href={commitHref}
                            target="_blank"
                            rel="noreferrer"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {shortSha}
                          </Link>
                        )}
                        <time
                          {...stylex.props(styles.age)}
                          dateTime={commit.date}
                          title={dateTitle}
                        >
                          {formatCompactAge(commit.date, openedAt)}
                        </time>
                      </span>
                      <span {...stylex.props(styles.churn)}>
                        <span {...stylex.props(styles.additions)}>+{additions}</span>
                        <span {...stylex.props(styles.deletions)}>−{deletions}</span>
                      </span>
                    </>
                  )}
                </GridListItem>
              )
            }}
          </GridList>
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}

const styles = stylex.create({
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    gap: '0.3rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-gray-900'],
    font: 'inherit',
    fontSize: '0.74rem',
    paddingBlock: '0.3rem',
    paddingInline: '0.55rem',
    cursor: 'pointer',
    outline: 'none',
    whiteSpace: 'nowrap',
  },
  triggerHovered: { color: tokens['--ds-foreground'] },
  triggerPressed: { backgroundColor: tokens['--ds-gray-alpha-200'] },
  triggerActive: {
    borderColor: tokens['--ds-blue-700'],
    color: tokens['--ds-blue-700'],
    backgroundColor: 'color-mix(in srgb, var(--ds-blue-700) 12%, var(--ds-background-100))',
  },
  focused: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: 1,
  },
  caret: { fontSize: '0.7rem', lineHeight: 1 },
  popover: { zIndex: 60, outline: 'none' },
  dialog: {
    width: '22rem',
    maxWidth: '90vw',
    maxHeight: '26rem',
    display: 'flex',
    flexDirection: 'column',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    boxShadow: tokens['--ds-shadow-medium'],
    outline: 'none',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    paddingBlock: '0.5rem',
    paddingInline: '0.7rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: tokens['--ds-gray-800'],
  },
  summary: { fontVariantNumeric: 'tabular-nums' },
  list: { overflowY: 'auto', padding: '0.3rem', outline: 'none' },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: scale.radiusSm,
    paddingBlock: '0.3rem',
    paddingInline: '0.4rem',
    color: tokens['--ds-foreground'],
    fontSize: '0.76rem',
    cursor: 'pointer',
    outline: 'none',
  },
  itemHovered: { backgroundColor: tokens['--ds-gray-alpha-100'] },
  itemSelected: {
    backgroundColor: 'color-mix(in srgb, var(--ds-blue-700) 8%, transparent)',
  },
  check: {
    flex: '0 0 auto',
    display: 'inline-flex',
    cursor: 'pointer',
    outline: 'none',
  },
  box: {
    width: '0.95rem',
    height: '0.95rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: 3,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-background-100'],
    fontSize: '0.7rem',
    lineHeight: 1,
    outline: 'none',
  },
  boxChecked: {
    backgroundColor: tokens['--ds-blue-700'],
    borderColor: tokens['--ds-blue-700'],
    color: tokens['--ds-background-100'],
  },
  commitLabel: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  subject: {
    minWidth: 0,
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 550,
  },
  sha: {
    flex: '0 0 auto',
    color: tokens['--ds-gray-800'],
    fontFamily: scale.fontMono,
    textDecoration: 'none',
    outline: 'none',
  },
  shaHovered: { textDecoration: 'underline' },
  age: {
    flex: '0 0 auto',
    color: tokens['--ds-gray-800'],
    fontVariantNumeric: 'tabular-nums',
  },
  churn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.68rem',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  additions: { color: tokens['--ds-green-700'] },
  deletions: { color: tokens['--ds-red-700'] },
})
