import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
/**
 * The four doctrine blocks (decision 0020): ask / fork / status-line / settled.
 *
 * `fork` subordinates rejected branches and roots the shared driver set
 * (decisions 0020/0021): the chosen branch is primary, rejected/deferred
 * branches are visually subordinated and each names the driver(s) it failed.
 */
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { useState } from 'react'

import type { ForkBranch, OpenQuestion, Recommendation, SettledDecision } from '../model.ts'

type StatusLineProps = {
  locked: number
  open: number
  awaiting: number
  style?: StyleXStylesWithout<{
    display: 'inline-flex'
    alignItems: 'center'
    flexWrap: 'wrap'
    maxWidth: '100%'
    width: '100%'
  }>
}

type AskProps = {
  recommendations: readonly Recommendation[]
  openQuestions: readonly OpenQuestion[]
  informational?: boolean | undefined
  style?: StyleXStylesWithout<{ maxWidth: '100%'; containerType: 'inline-size' }>
}

type ForkProps = {
  axis: string
  drivers: readonly string[]
  branches: readonly ForkBranch[]
  id: string
  style?: StyleXStylesWithout<{ maxWidth: '100%'; containerType: 'inline-size' }>
}

type SettledProps = {
  decisions: readonly SettledDecision[]
  id: string
  style?: StyleXStylesWithout<{ position: 'absolute' }>
}

/**
 * Status line is a projection of the per-decision status buckets (0019).
 * @deprecated The shell derives the ask counter from registered asks; drop hand-typed counts.
 * Kept exported so existing AppSources that import it keep building.
 */
export const StatusLine = ({ locked, open, awaiting, style }: StatusLineProps) => (
  <div {...stylex.props(styles.statusLine, style)} role="status" aria-label="Decision status">
    <span {...stylex.props(styles.statusSegment, styles.locked)}>{locked} locked</span>
    <span {...stylex.props(styles.statusSeparator)}>·</span>
    <span {...stylex.props(styles.statusSegment, styles.open)}>{open} open</span>
    <span {...stylex.props(styles.statusSeparator)}>·</span>
    <span {...stylex.props(styles.statusSegment, styles.awaiting)}>
      {awaiting} awaiting sign-off
    </span>
  </div>
)

/**
 * The `ask` block (BLUF): recommendations to sign off + open questions, or informational.
 * @deprecated Use `ContextHeader` (omit `you` for informational) and `ChoiceCards` for each ask.
 * Kept exported so existing AppSources that import it keep building.
 */
export const Ask = ({ recommendations, openQuestions, informational, style }: AskProps) => {
  if (informational && recommendations.length === 0 && openQuestions.length === 0) {
    return (
      <section {...stylex.props(styles.panel, styles.queryContainer, style)} aria-label="The ask">
        <h2 {...stylex.props(styles.askHeading)}>The ask</h2>
        <p {...stylex.props(styles.askInformational)}>
          Informational app — no decisions awaiting sign-off.
        </p>
      </section>
    )
  }
  return (
    <section {...stylex.props(styles.panel, styles.queryContainer, style)} aria-label="The ask">
      <h2 {...stylex.props(styles.askHeading)}>The ask</h2>
      {recommendations.length > 0 && (
        <div>
          <h3 {...stylex.props(styles.askSubheading)}>Recommendations</h3>
          <ul {...stylex.props(styles.askList)}>
            {recommendations.map((recommendation) => (
              <li key={recommendation.id} {...stylex.props(styles.askItem)} id={recommendation.id}>
                {/* The badge tracks `awaitingSignoff` so the rendered body and the
                    status-line count are the same projection (decision 0019): a
                    recommendation not awaiting sign-off is shown as FYI and is not
                    counted in the awaiting total. */}
                {recommendation.awaitingSignoff ? (
                  <span {...stylex.props(styles.askBadge, styles.awaiting)}>awaiting</span>
                ) : (
                  <span {...stylex.props(styles.askBadge, styles.fyi)}>fyi</span>
                )}
                <span {...stylex.props(styles.askTitle)}>{recommendation.title}</span>
                <span {...stylex.props(styles.askLean)}>{recommendation.lean}</span>
                {recommendation.evidenceRef && (
                  <a {...stylex.props(styles.askEvidence)} href={`#${recommendation.evidenceRef}`}>
                    evidence ↓
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {openQuestions.length > 0 && (
        <div>
          <h3 {...stylex.props(styles.askSubheading)}>Open questions</h3>
          <ul {...stylex.props(styles.askList)}>
            {openQuestions.map((question) => (
              <li key={question.id} {...stylex.props(styles.askItem)} id={question.id}>
                <span {...stylex.props(styles.askBadge, styles.open)}>{question.code}</span>
                <span {...stylex.props(styles.askTitle)}>{question.question}</span>
                <span {...stylex.props(styles.askLean)}>lean: {question.lean}</span>
                {question.evidenceRef && (
                  <a {...stylex.props(styles.askEvidence)} href={`#${question.evidenceRef}`}>
                    evidence ↓
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** The `fork` block: shared drivers + branches, chosen first, rejected subordinated. */
export const Fork = ({ axis, drivers, branches, id, style }: ForkProps) => {
  // Subordinate rejected/deferred branches: chosen first, then the rest.
  const chosen = branches.filter((branch) => branch.verdict === 'chosen')
  const rest = branches.filter((branch) => branch.verdict !== 'chosen')
  return (
    <section
      {...stylex.props(styles.panel, styles.queryContainer, style)}
      id={id}
      aria-labelledby={`${id}-axis`}
    >
      <header>
        <h3 {...stylex.props(styles.forkAxis)} id={`${id}-axis`}>
          {axis}
        </h3>
        {/* The shared driver set is rooted at the fork (decision 0021). */}
        <div {...stylex.props(styles.driverRow)}>
          <span {...stylex.props(styles.driverLabel)}>drivers:</span>
          <ul {...stylex.props(styles.driverList)} aria-label="Drivers">
            {drivers.map((driver) => (
              <li key={driver} {...stylex.props(styles.driver)}>
                {driver}
              </li>
            ))}
          </ul>
        </div>
      </header>
      <div>
        {chosen.map((branch) => (
          <Branch key={branch.id} branch={branch} />
        ))}
      </div>
      {rest.length > 0 && (
        <div>
          <span {...stylex.props(styles.rejectedLabel)}>considered &amp; not chosen</span>
          {rest.map((branch) => (
            <Branch key={branch.id} branch={branch} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * The `settled` block: locked decisions, collapsed by default (audit context).
 * @deprecated Use `InspectRow` for any closed-by-default detail. Kept exported so existing
 * AppSources that import it keep building.
 */
export const Settled = ({ decisions, id, style }: SettledProps) => {
  const [open, setOpen] = useState(false)
  return (
    <section {...stylex.props(style)} id={id} aria-labelledby={`${id}-toggle`}>
      <button
        id={`${id}-toggle`}
        {...stylex.props(styles.settledToggle)}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => setOpen((value) => !value)}
      >
        <span {...stylex.props(styles.settledIcon)} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <span>Settled ({decisions.length} locked)</span>
      </button>
      {open && (
        <ul {...stylex.props(styles.settledList)} id={`${id}-list`}>
          {decisions.map((decision) => (
            <li key={decision.id} {...stylex.props(styles.settledItem)} id={decision.id}>
              <span {...stylex.props(styles.settledTitle)}>{decision.title}</span>
              <span {...stylex.props(styles.settledSummary)}>{decision.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** One fork branch card; rejected/deferred branches name the driver(s) they failed (0021). */
const Branch = ({ branch }: { branch: ForkBranch }) => (
  <article
    {...stylex.props(styles.branch, branchStyles[branch.verdict])}
    id={branch.id}
    aria-labelledby={`${branch.id}-name`}
  >
    <div {...stylex.props(styles.branchHead)}>
      <span {...stylex.props(styles.branchLabel)}>{branch.label}</span>
      <span {...stylex.props(styles.branchName)} id={`${branch.id}-name`}>
        {branch.name}
      </span>
      <span {...stylex.props(styles.verdict, verdictStyles[branch.verdict])}>{branch.verdict}</span>
    </div>
    <p {...stylex.props(styles.branchThesis)}>{branch.thesis}</p>
    <p {...stylex.props(styles.branchWhy)}>{branch.why}</p>
    {branch.verdict === 'rejected' && branch.failedDrivers.length > 0 && (
      <p {...stylex.props(styles.failed)}>
        failed driver{branch.failedDrivers.length > 1 ? 's' : ''}:{' '}
        {branch.failedDrivers.map((driver) => (
          <span key={driver} {...stylex.props(styles.failedDriver)}>
            {driver}
          </span>
        ))}
        {!branch.proofRef && <span {...stylex.props(styles.uncited)}>uncited</span>}
      </p>
    )}
    {(branch.pros || branch.cons) && (
      <div {...stylex.props(styles.prosCons)}>
        {branch.pros && (
          <ul {...stylex.props(styles.prosConsList, styles.pros)}>
            {branch.pros.map((pro, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- static, never-reordered list
              <li key={index}>+ {pro}</li>
            ))}
          </ul>
        )}
        {branch.cons && (
          <ul {...stylex.props(styles.prosConsList, styles.cons)}>
            {branch.cons.map((con, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- static, never-reordered list
              <li key={index}>− {con}</li>
            ))}
          </ul>
        )}
      </div>
    )}
  </article>
)

const styles = stylex.create({
  panel: {
    backgroundColor: tokens['--ds-background-200'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    padding: '0.875rem 1rem',
    maxWidth: '100%',
  },
  queryContainer: {
    containerType: 'inline-size',
  },
  statusLine: {
    display: 'inline-flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.35rem',
    width: {
      default: 'fit-content',
      '@container (max-width: 34rem)': '100%',
    },
    maxWidth: '100%',
    fontSize: '0.82rem',
    fontWeight: 500,
    backgroundColor: tokens['--ds-background-200'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    padding: '0.35rem',
  },
  statusSegment: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
    padding: '0.12rem 0.45rem',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  locked: {
    color: tokens['--ds-green-900'],
    backgroundColor: 'color-mix(in srgb, var(--ds-green-900) 4%, var(--ds-background-100))',
    borderColor: 'color-mix(in srgb, var(--ds-green-900) 14%, var(--ds-gray-alpha-400))',
  },
  open: {
    color: tokens['--ds-amber-900'],
    backgroundColor: 'color-mix(in srgb, var(--ds-amber-900) 4%, var(--ds-background-100))',
    borderColor: 'color-mix(in srgb, var(--ds-amber-900) 14%, var(--ds-gray-alpha-400))',
  },
  awaiting: {
    color: tokens['--ds-red-900'],
    backgroundColor: 'color-mix(in srgb, var(--ds-red-900) 4%, var(--ds-background-100))',
    borderColor: 'color-mix(in srgb, var(--ds-red-900) 14%, var(--ds-gray-alpha-400))',
  },
  statusSeparator: {
    display: 'none',
  },
  askHeading: {
    margin: '0 0 0.625rem',
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  askSubheading: {
    margin: '0.75rem 0 0.4rem',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: tokens['--ds-gray-800'],
  },
  askList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    minWidth: 0,
  },
  askItem: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'auto 1fr auto',
      '@container (max-width: 34rem)': 'auto minmax(0, 1fr)',
    },
    alignItems: 'baseline',
    gap: '0.5rem 0.75rem',
    padding: '0.55rem 0',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    minWidth: 0,
  },
  askTitle: {
    fontWeight: 500,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  askLean: {
    gridColumn: '2 / 3',
    color: tokens['--ds-gray-900'],
    fontSize: '0.9rem',
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  askBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    padding: '0.15rem 0.4rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    whiteSpace: 'nowrap',
  },
  fyi: {
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-900'],
  },
  askEvidence: {
    gridColumn: {
      default: 'auto',
      '@container (max-width: 34rem)': '2 / 3',
    },
    fontSize: '0.8rem',
    color: tokens['--ds-blue-700'],
    textDecoration: {
      default: 'none',
      ':hover': 'underline',
    },
    textUnderlineOffset: '0.16rem',
    whiteSpace: 'nowrap',
    borderRadius: scale.radiusSm,
    outlineWidth: {
      default: 0,
      ':focus-visible': '2px',
    },
    outlineStyle: {
      default: 'none',
      ':focus-visible': 'solid',
    },
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: '2px',
  },
  askInformational: {
    color: tokens['--ds-gray-900'],
    fontStyle: 'italic',
    margin: 0,
  },
  forkAxis: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },
  driverRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    alignItems: 'center',
    margin: '0.4rem 0 0.75rem',
    minWidth: 0,
  },
  driverList: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    alignItems: 'center',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    minWidth: 0,
  },
  driverLabel: {
    fontSize: '0.75rem',
    color: tokens['--ds-gray-800'],
  },
  driver: {
    fontSize: '0.72rem',
    backgroundColor: tokens['--ds-background-100'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    color: tokens['--ds-gray-900'],
    padding: '0.1rem 0.4rem',
    borderRadius: scale.radiusSm,
    maxWidth: '100%',
    overflowWrap: 'anywhere',
  },
  branch: {
    borderRadius: scale.radiusDefault,
    padding: '0.625rem 0.75rem',
    margin: '0.5rem 0',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-100'],
    minWidth: 0,
  },
  branchChosen: {
    backgroundColor: tokens['--ds-background-100'],
    borderColor: 'color-mix(in srgb, var(--ds-green-900) 14%, var(--ds-gray-alpha-400))',
  },
  branchSubordinated: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
    marginLeft: {
      default: '1.25rem',
      '@container (max-width: 34rem)': 0,
    },
  },
  branchHead: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
    minWidth: 0,
  },
  branchLabel: {
    fontWeight: 700,
    backgroundColor: tokens['--ds-gray-alpha-100'],
    color: tokens['--ds-foreground'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    width: '1.4rem',
    height: '1.4rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scale.radiusSm,
    fontSize: '0.8rem',
    flex: '0 0 auto',
  },
  branchName: {
    fontWeight: 650,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  verdict: {
    marginLeft: 'auto',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    fontWeight: 600,
    padding: '0.12rem 0.45rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    whiteSpace: 'nowrap',
  },
  verdictChosen: {
    backgroundColor: 'color-mix(in srgb, var(--ds-green-900) 4%, var(--ds-background-100))',
    borderColor: 'color-mix(in srgb, var(--ds-green-900) 14%, var(--ds-gray-alpha-400))',
    color: tokens['--ds-green-900'],
  },
  verdictRejected: {
    backgroundColor: 'color-mix(in srgb, var(--ds-red-900) 4%, var(--ds-background-100))',
    borderColor: 'color-mix(in srgb, var(--ds-red-900) 14%, var(--ds-gray-alpha-400))',
    color: tokens['--ds-red-900'],
  },
  verdictDeferred: {
    backgroundColor: 'color-mix(in srgb, var(--ds-amber-900) 4%, var(--ds-background-100))',
    borderColor: 'color-mix(in srgb, var(--ds-amber-900) 14%, var(--ds-gray-alpha-400))',
    color: tokens['--ds-amber-900'],
  },
  branchThesis: {
    margin: '0.3rem 0',
    fontSize: '0.92rem',
    overflowWrap: 'anywhere',
  },
  branchWhy: {
    margin: '0.3rem 0',
    color: tokens['--ds-gray-900'],
    fontSize: '0.88rem',
    overflowWrap: 'anywhere',
  },
  failed: {
    fontSize: '0.82rem',
    margin: '0.3rem 0 0',
    overflowWrap: 'anywhere',
  },
  failedDriver: {
    backgroundColor: 'color-mix(in srgb, var(--ds-red-900) 4%, var(--ds-background-100))',
    color: tokens['--ds-red-900'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'color-mix(in srgb, var(--ds-red-900) 14%, var(--ds-gray-alpha-400))',
    padding: '0.05rem 0.35rem',
    borderRadius: scale.radiusSm,
    margin: '0 0.2rem',
    fontSize: '0.75rem',
    display: 'inline-block',
  },
  uncited: {
    fontSize: '0.7rem',
    color: tokens['--ds-gray-800'],
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-800'],
    padding: '0.02rem 0.3rem',
    borderRadius: scale.radiusSm,
    marginLeft: '0.3rem',
  },
  prosCons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1.5rem',
    fontSize: '0.85rem',
  },
  prosConsList: {
    margin: '0.3rem 0 0',
    paddingLeft: '0.5rem',
    listStyle: 'none',
    minWidth: 'min(14rem, 100%)',
  },
  pros: {
    color: tokens['--ds-green-900'],
  },
  cons: {
    color: tokens['--ds-gray-900'],
  },
  rejectedLabel: {
    display: 'block',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: tokens['--ds-gray-800'],
    margin: '0.75rem 0 0.25rem',
  },
  settledToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    maxWidth: '100%',
    backgroundColor: {
      default: tokens['--ds-background-200'],
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    color: {
      default: tokens['--ds-gray-900'],
      ':hover': tokens['--ds-foreground'],
    },
    borderRadius: scale.radiusDefault,
    padding: '0.5rem 0.9rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    textAlign: 'left',
    outlineWidth: {
      default: 0,
      ':focus-visible': '2px',
    },
    outlineStyle: {
      default: 'none',
      ':focus-visible': 'solid',
    },
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: '2px',
  },
  settledIcon: {
    width: '0.8rem',
    flex: '0 0 auto',
    textAlign: 'center',
  },
  settledList: {
    listStyle: 'none',
    margin: '0.5rem 0 0',
    padding: '0.5rem 0.75rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    minWidth: 0,
  },
  settledItem: {
    padding: '0.4rem 0',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    overflowWrap: 'anywhere',
  },
  settledTitle: {
    fontWeight: 600,
    marginRight: '0.5rem',
  },
  settledSummary: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.88rem',
  },
})

const branchStyles = {
  chosen: styles.branchChosen,
  rejected: styles.branchSubordinated,
  deferred: styles.branchSubordinated,
} as const

const verdictStyles = {
  chosen: styles.verdictChosen,
  rejected: styles.verdictRejected,
  deferred: styles.verdictDeferred,
} as const
