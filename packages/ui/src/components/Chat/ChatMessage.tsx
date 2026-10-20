/**
 * @see https://v0.app/chat - Design reference for AI chat components
 *
 * ChatMessage displays a single message in a chat conversation.
 * User messages are right-aligned with a dark bubble background.
 * Assistant/system messages are left-aligned without bubble.
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { styled } from '../../foundations/props.ts'

/*
 * The colours below are literal `oklch()` values carried over verbatim from the
 * v0 chat reference, not design tokens. Every `--ds-*` token in this package is
 * `hsl()`, and none of them matches these values; the nearest neighbours differ
 * in both space and lightness. Substituting a token would also make these
 * surfaces follow the light theme, which the literals deliberately do not do.
 * So they stay literal until the Chat family gets tokens of its own.
 */
const chatForeground = 'oklch(0.946 0 0)'
const chatForegroundMuted = 'oklch(0.706 0 0)'
const chatUserBubble = 'oklch(0.23 0 0)'

const styles = stylex.create({
  root: {
    display: 'flex',
    gap: '0.75rem',
  },
  rootUser: { flexDirection: 'row-reverse' },
  rootSystem: { opacity: 0.7 },

  avatarContainer: { flexShrink: 0 },

  content: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    minWidth: 0,
  },
  contentUser: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },

  body: {
    fontSize: '0.875rem',
    lineHeight: 1.625,
    color: chatForeground,
    minWidth: 0,
    // `break-words` and `[overflow-wrap:anywhere]` both set `overflow-wrap`;
    // the arbitrary property was emitted last and won, so `anywhere` is the
    // value that was in effect.
    overflowWrap: 'anywhere',
  },
  bodyUser: {
    display: 'inline-block',
    backgroundColor: chatUserBubble,
    borderRadius: '1rem',
    paddingInline: '1rem',
    paddingBlock: '0.625rem',
    maxWidth: '85%',
  },
  bodySystem: {
    color: chatForegroundMuted,
    fontStyle: 'italic',
  },

  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    marginTop: '0.5rem',
  },
  actionsUser: { justifyContent: 'flex-end' },
})

/** Role of the message author. */
export type ChatMessageRole = 'user' | 'assistant' | 'system'

/*
 * Per-slot role overrides. `assistant` is the default variant and adds nothing
 * to any slot, so it maps to `null` — `stylex.props` skips nullish entries.
 */
const rootByRole = {
  user: styles.rootUser,
  assistant: null,
  system: styles.rootSystem,
} as const

const contentByRole = {
  user: styles.contentUser,
  assistant: null,
  system: null,
} as const

const bodyByRole = {
  user: styles.bodyUser,
  assistant: null,
  system: styles.bodySystem,
} as const

const actionsByRole = {
  user: styles.actionsUser,
  assistant: null,
  system: null,
} as const

export interface ChatMessageProps {
  /** Role of the message author */
  role: ChatMessageRole
  /** Avatar slot - render your own avatar component */
  avatar?: ReactNode
  /** Header slot - for author name, timestamp, etc. */
  header?: ReactNode
  /** Actions slot - for copy, feedback buttons, etc. */
  actions?: ReactNode
  /** Message content - consumer handles markdown rendering */
  children: ReactNode
  /** Optional class name override */
  className?: string
}

/** ChatMessage displays a single message in a chat conversation */
export const ChatMessage = ({
  role,
  avatar,
  header,
  actions,
  children,
  className,
}: ChatMessageProps) => (
  <div {...styled(className, styles.root, rootByRole[role])}>
    {avatar && <div {...styled(undefined, styles.avatarContainer)}>{avatar}</div>}
    <div {...styled(undefined, styles.content, contentByRole[role])}>
      {header && <div {...styled(undefined, styles.header)}>{header}</div>}
      <div {...styled(undefined, styles.body, bodyByRole[role])}>{children}</div>
      {actions && <div {...styled(undefined, styles.actions, actionsByRole[role])}>{actions}</div>}
    </div>
  </div>
)
