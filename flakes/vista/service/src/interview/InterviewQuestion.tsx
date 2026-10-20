import * as stylex from '@stylexjs/stylex'
import { useTheme } from '@vista/blocks'
import { decodeRouteOwner, encodeOwner } from '@vista/blocks/internal/owner-identity'
import { tokens } from '@vista/ui/tokens.stylex'
import { Result, Schema } from 'effect'
import { useEffect, useState } from 'react'

import { DecisionAnswer, StoredQuestion } from './contract.ts'

/**
 * Renders one pending structured question and submits the human's bounded
 * choice to the service. The public `@vista/blocks` wrapper loads this
 * service-owned runtime inside a RuntimeIsland.
 */

/** The block's props: just the app id — the question is fetched at runtime. */
export const InterviewQuestionProps = Schema.Struct({ appId: Schema.String })
export type InterviewQuestionProps = typeof InterviewQuestionProps.Type

const PendingResponse = Schema.Struct({ questions: Schema.Array(StoredQuestion) })

const scopedAppIdFromRoute = (appId: string): string | undefined => {
  const segment = /^\/r\/([^/]+)\//.exec(window.location.pathname)?.[1]
  const owner = segment === undefined ? undefined : decodeRouteOwner(segment)
  return owner === undefined ? undefined : `${encodeOwner(owner)}/${appId}`
}
const decodePending = Schema.decodeUnknownResult(PendingResponse)

type Phase =
  | { readonly _tag: 'loading' }
  | { readonly _tag: 'none' }
  | { readonly _tag: 'asking'; readonly question: StoredQuestion }
  | { readonly _tag: 'submitting'; readonly question: StoredQuestion }
  | { readonly _tag: 'answered'; readonly chosen: ReadonlyArray<string> }
  | { readonly _tag: 'error'; readonly message: string }

/** Poll the open questions for this app; show the first, collect the choice. */
export const InterviewQuestion = ({ appId }: InterviewQuestionProps) => {
  const theme = useTheme()
  const [phase, setPhase] = useState<Phase>({ _tag: 'loading' })
  const [selected, setSelected] = useState<ReadonlyArray<string>>([])

  // Poll for the next pending question. The browser is one of the three faces on
  // the shared store; a freshly `vista_ask`ed question appears here within a tick.
  useEffect(() => {
    let alive = true
    const tick = async (): Promise<void> => {
      try {
        const scopedAppId = scopedAppIdFromRoute(appId)
        if (scopedAppId === undefined) {
          if (alive) setPhase({ _tag: 'error', message: 'review route has no owner' })
          return
        }
        const res = await fetch(`/_interview/pending?appId=${encodeURIComponent(scopedAppId)}`)
        const body = decodePending(await res.json())
        if (!alive) return
        if (Result.isFailure(body))
          return setPhase({ _tag: 'error', message: String(body.failure) })
        const next = body.success.questions[0]
        setPhase((prev) => {
          // Don't clobber a submit-in-flight or a just-answered terminal state.
          if (prev._tag === 'submitting' || prev._tag === 'answered') return prev
          if (!next) return prev._tag === 'asking' ? prev : { _tag: 'none' }
          if (prev._tag === 'asking' && prev.question.questionId === next.questionId) return prev
          setSelected([])
          return { _tag: 'asking', question: next }
        })
      } catch (e) {
        if (alive) setPhase({ _tag: 'error', message: (e as Error).message })
      }
    }
    void tick()
    const id = setInterval(tick, 1000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [appId])

  if (phase._tag === 'loading')
    return (
      <div
        {...stylex.props(
          theme === 'light' ? interviewLightTheme : interviewDarkTheme,
          styles.root,
          styles.idle,
          theme === 'dark' && styles.darkRoot,
        )}
      >
        Loading…
      </div>
    )
  if (phase._tag === 'none')
    return (
      <div
        {...stylex.props(
          theme === 'light' ? interviewLightTheme : interviewDarkTheme,
          styles.root,
          styles.idle,
          theme === 'dark' && styles.darkRoot,
        )}
      >
        No pending question.
      </div>
    )
  if (phase._tag === 'error')
    return (
      <div
        {...stylex.props(
          theme === 'light' ? interviewLightTheme : interviewDarkTheme,
          styles.root,
          styles.error,
          theme === 'dark' && styles.darkRoot,
        )}
        role="alert"
      >
        Interview error: {phase.message}
      </div>
    )
  if (phase._tag === 'answered')
    return (
      <div
        {...stylex.props(
          theme === 'light' ? interviewLightTheme : interviewDarkTheme,
          styles.root,
          styles.idle,
          theme === 'dark' && styles.darkRoot,
        )}
        data-testid="interview-answered"
        data-vista-answered=""
      >
        Answer submitted: <strong>{phase.chosen.join(', ')}</strong>
      </div>
    )

  const stored = phase.question
  const q = stored.question
  const submitting = phase._tag === 'submitting'

  const toggle = (id: string): void =>
    setSelected((prev) =>
      q.multiSelect ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id],
    )

  const submit = async (): Promise<void> => {
    if (selected.length === 0) return
    setPhase({ _tag: 'submitting', question: stored })
    try {
      const scopedAppId = scopedAppIdFromRoute(appId)
      if (scopedAppId === undefined)
        return setPhase({ _tag: 'error', message: 'review route has no owner' })
      const answer = Schema.encodeSync(DecisionAnswer)({ chosenOptionIds: selected })
      const res = await fetch('/_answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appId: scopedAppId, questionId: stored.questionId, answer }),
      })
      if (!res.ok) {
        const text = await res.text()
        return setPhase({ _tag: 'error', message: `submit failed (${res.status}): ${text}` })
      }
      setPhase({ _tag: 'answered', chosen: selected })
    } catch (e) {
      setPhase({ _tag: 'error', message: (e as Error).message })
    }
  }

  return (
    <div
      {...stylex.props(
        theme === 'light' ? interviewLightTheme : interviewDarkTheme,
        styles.root,
        theme === 'dark' && styles.darkRoot,
      )}
      data-testid="interview-question"
    >
      <p {...stylex.props(styles.prompt)}>{q.question}</p>
      {q.evidenceGaps && q.evidenceGaps.length > 0 && (
        <div {...stylex.props(styles.gaps)}>
          <span {...stylex.props(styles.gapsLabel)}>Evidence gaps</span>
          <ul>
            {q.evidenceGaps.map((g, i) => (
              // oxlint-disable-next-line react/no-array-index-key -- static, never-reordered list
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      <fieldset {...stylex.props(styles.options)} disabled={submitting}>
        {q.options.map((opt) => {
          const checked = selected.includes(opt.id)
          const recommended = q.recommendedDefault === opt.id
          return (
            <label
              key={opt.id}
              {...stylex.props(styles.option, checked && styles.optionSelected)}
              data-testid={`interview-option-${opt.id}`}
            >
              <input
                {...stylex.props(styles.input)}
                type={q.multiSelect ? 'checkbox' : 'radio'}
                name="interview-option"
                checked={checked}
                onChange={() => toggle(opt.id)}
              />
              <span {...stylex.props(styles.optionLabel)}>
                {opt.label}
                {recommended && <span {...stylex.props(styles.recommended)}> (recommended)</span>}
              </span>
              <span {...stylex.props(styles.tradeoff)}>{opt.tradeoff}</span>
            </label>
          )
        })}
      </fieldset>
      <button
        type="button"
        {...stylex.props(styles.submit)}
        disabled={submitting || selected.length === 0}
        onClick={() => void submit()}
        data-testid="interview-submit"
      >
        {submitting ? 'Submitting…' : 'Submit answer'}
      </button>
    </div>
  )
}

const interviewDarkTheme = stylex.createTheme(tokens, {
  '--ds-background': '#161b22',
  '--ds-border': '#30363d',
  '--ds-foreground': '#e6edf3',
  '--ds-foreground-muted': '#57606a',
  '--ds-focus-color': '#0969da',
  '--ds-red-800': '#d1242f',
})

const interviewLightTheme = stylex.createTheme(tokens, {
  '--ds-background': '#fff',
  '--ds-border': '#d0d7de',
  '--ds-foreground': '#1d1d1f',
  '--ds-foreground-muted': '#57606a',
  '--ds-focus-color': '#0969da',
  '--ds-red-800': '#d1242f',
})

/**
 * Service-local until the interview question becomes a first-class Vista block;
 * that promotion should move both the component and these styles into blocks.
 */
const styles = stylex.create({
  root: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-border'],
    borderRadius: 8,
    padding: '1rem 1.25rem',
    backgroundColor: tokens['--ds-background'],
  },
  darkRoot: {
    color: tokens['--ds-foreground'],
    borderColor: tokens['--ds-border'],
  },
  idle: {
    color: tokens['--ds-foreground-muted'],
    fontSize: '0.9rem',
  },
  error: {
    borderColor: tokens['--ds-red-800'],
    color: tokens['--ds-red-800'],
  },
  prompt: {
    fontWeight: 600,
    margin: '0 0 0.75rem',
  },
  gaps: {
    margin: '0 0 0.75rem',
    fontSize: '0.85rem',
    color: tokens['--ds-foreground-muted'],
  },
  gapsLabel: {
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
  },
  options: {
    borderWidth: 0,
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  option: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '0.25rem 0.6rem',
    alignItems: 'start',
    padding: '0.6rem 0.75rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-border'],
    borderRadius: 6,
    cursor: 'pointer',
  },
  optionSelected: {
    borderColor: tokens['--ds-focus-color'],
    boxShadow: `0 0 0 1px ${tokens['--ds-focus-color']}`,
  },
  input: {
    marginTop: '0.2rem',
  },
  optionLabel: {
    fontWeight: 600,
  },
  recommended: {
    fontWeight: 400,
    color: tokens['--ds-focus-color'],
    fontSize: '0.85rem',
  },
  tradeoff: {
    gridColumn: 2,
    fontSize: '0.85rem',
    color: tokens['--ds-foreground-muted'],
  },
  submit: {
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    borderWidth: 0,
    borderRadius: 6,
    backgroundColor: tokens['--ds-focus-color'],
    color: '#fff',
    fontWeight: 600,
    cursor: {
      default: 'pointer',
      ':disabled': 'not-allowed',
    },
    opacity: {
      default: 1,
      ':disabled': 0.5,
    },
  },
})
