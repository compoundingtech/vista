/** Core content blocks: callout, decision-log, options-grid, tables. */
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'

import type {
  CalloutKind,
  DecisionStatus,
  InterfaceRow,
  OptionCard,
  ResponsibilityRow,
} from '../model.ts'

type CalloutStyle = StyleXStylesWithout<{
  padding: 0
  paddingBlock: 0
  paddingInline: 0
  borderWidth: 0
  borderStyle: 'solid'
}>

type GridStyle = StyleXStylesWithout<{
  display: 'grid'
  gridTemplateColumns: 'none'
  gap: 0
}>

type TableStyle = StyleXStylesWithout<{
  display: 'block'
  width: '100%'
  maxWidth: '100%'
  overflowX: 'auto'
  overflowY: 'hidden'
  containerType: 'inline-size'
}>

/**
 * Props for a callout block that renders a titled advisory message styled by its kind, with a
 * required accessibility id and optional styles.
 */
export interface CalloutProps {
  readonly kind: CalloutKind
  readonly title: string
  readonly body: string
  readonly id: string
  readonly style?: CalloutStyle
}

/**
 * Props for a decision-log table whose entries each carry a title, status, and summary, keyed by a
 * container id and styled as a table.
 */
export interface DecisionLogProps {
  readonly entries: readonly {
    readonly id: string
    readonly title: string
    readonly status: DecisionStatus
    readonly summary: string
  }[]
  readonly id: string
  readonly style?: TableStyle
}

/** Props for a grid of option cards, requiring the card list, a container id, and optional grid styles. */
export interface OptionsGridProps {
  readonly options: readonly OptionCard[]
  readonly id: string
  readonly style?: GridStyle
}

/**
 * Props for a table of responsibility rows, requiring the rows, a container id, and optional table
 * styles.
 */
export interface ResponsibilitiesTableProps {
  readonly rows: readonly ResponsibilityRow[]
  readonly id: string
  readonly style?: TableStyle
}

/** Props for a table of interface rows, requiring the rows, a container id, and optional table styles. */
export interface InterfacesTableProps {
  readonly rows: readonly InterfaceRow[]
  readonly id: string
  readonly style?: TableStyle
}

const EmptyState = ({ children }: { children: string }) => (
  <p {...stylex.props(styles.emptyState)} role="status">
    {children}
  </p>
)

/** A `callout` block: an accented finding/tradeoff/constraint/open-question aside. */
export const Callout = ({ kind, title, body, id, style }: CalloutProps) => (
  <aside
    {...stylex.props(styles.callout, calloutKindStyles[kind], style)}
    id={id}
    role="note"
    aria-labelledby={`${id}-title`}
  >
    <div {...stylex.props(styles.calloutKind, calloutKindLabelStyles[kind])}>{kind}</div>
    <h3 {...stylex.props(styles.calloutTitle)} id={`${id}-title`}>
      {title}
    </h3>
    <div {...stylex.props(styles.calloutBody)}>{body}</div>
  </aside>
)

/** A `decision-log` block: per-entry status-pilled rows of decisions and summaries. */
export const DecisionLog = ({ entries, id, style }: DecisionLogProps) => (
  <figure {...stylex.props(styles.tableFrame, style)} id={id}>
    <figcaption {...stylex.props(styles.visuallyHidden)}>Decision log</figcaption>
    {entries.length === 0 ? (
      <EmptyState>No decisions recorded.</EmptyState>
    ) : (
      <table {...stylex.props(styles.tableElement, styles.responsiveTable)}>
        <thead {...stylex.props(styles.responsiveTableHead)}>
          <tr {...stylex.props(styles.responsiveHeaderRow)}>
            <th
              {...stylex.props(styles.headerCell, styles.decisionCell, styles.responsiveCell)}
              scope="col"
            >
              Decision
            </th>
            <th
              {...stylex.props(styles.headerCell, styles.decisionCell, styles.responsiveCell)}
              scope="col"
            >
              Status
            </th>
            <th
              {...stylex.props(styles.headerCell, styles.decisionCell, styles.responsiveCell)}
              scope="col"
            >
              Summary
            </th>
          </tr>
        </thead>
        <tbody {...stylex.props(styles.responsiveTableBody)}>
          {entries.map((entry) => (
            <tr
              {...stylex.props(styles.hoverRow, styles.responsiveTableRow)}
              key={entry.id}
              id={entry.id}
            >
              <th
                {...stylex.props(
                  styles.bodyCell,
                  styles.rowHeader,
                  styles.decisionCell,
                  styles.responsiveCell,
                )}
                scope="row"
                data-label="Decision"
              >
                <span {...stylex.props(styles.responsiveCellLabel)} aria-hidden="true">
                  Decision
                </span>
                {entry.title}
              </th>
              <td
                {...stylex.props(styles.bodyCell, styles.decisionCell, styles.responsiveCell)}
                data-label="Status"
              >
                <span {...stylex.props(styles.responsiveCellLabel)} aria-hidden="true">
                  Status
                </span>
                <span {...stylex.props(styles.statusPill, statusStyles[entry.status])}>
                  {entry.status}
                </span>
              </td>
              <td
                {...stylex.props(
                  styles.bodyCell,
                  styles.decisionCell,
                  styles.responsiveCell,
                  styles.responsiveLastCell,
                )}
                data-label="Summary"
              >
                <span {...stylex.props(styles.responsiveCellLabel)} aria-hidden="true">
                  Summary
                </span>
                {entry.summary}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </figure>
)

/**
 * An `options-grid` block: pros/cons cards with an optional recommended marker.
 * @deprecated Use `ChoiceCards` for an ask or `Comparison` for aligned peers. Kept exported so
 * existing AppSources that import it keep building.
 */
export const OptionsGrid = ({ options, id, style }: OptionsGridProps) => (
  <div {...stylex.props(styles.optionsGrid, style)} id={id}>
    {options.length === 0 ? (
      <EmptyState>No options recorded.</EmptyState>
    ) : (
      options.map((option) => (
        <div
          {...stylex.props(styles.optionCard, option.recommended && styles.optionRecommended)}
          key={option.id}
          id={option.id}
        >
          <h3 {...stylex.props(styles.optionName)}>
            {option.name}
            {option.recommended && (
              <span {...stylex.props(styles.optionRecommendation)}>recommended</span>
            )}
          </h3>
          <ul {...stylex.props(styles.optionList)} aria-label="Pros">
            {option.pros.length === 0 ? (
              <li {...stylex.props(styles.optionListItem)}>No pros recorded.</li>
            ) : (
              option.pros.map((pro, index) => (
                // oxlint-disable-next-line react/no-array-index-key -- static, never-reordered list
                <li {...stylex.props(styles.optionListItem)} key={index}>
                  {pro}
                </li>
              ))
            )}
          </ul>
          <ul {...stylex.props(styles.optionList)} aria-label="Cons">
            {option.cons.length === 0 ? (
              <li {...stylex.props(styles.optionListItem)}>No cons recorded.</li>
            ) : (
              option.cons.map((con, index) => (
                // oxlint-disable-next-line react/no-array-index-key -- static, never-reordered list
                <li {...stylex.props(styles.optionListItem)} key={index}>
                  {con}
                </li>
              ))
            )}
          </ul>
          {option.verdict && <div {...stylex.props(styles.optionVerdict)}>{option.verdict}</div>}
        </div>
      ))
    )}
  </div>
)

/** A `responsibilities-table` block: owner → responsibility rows with optional notes. */
export const ResponsibilitiesTable = ({ rows, id, style }: ResponsibilitiesTableProps) => (
  <figure {...stylex.props(styles.tableFrame, style)} id={id}>
    <figcaption {...stylex.props(styles.visuallyHidden)}>Responsibilities</figcaption>
    {rows.length === 0 ? (
      <EmptyState>No responsibilities recorded.</EmptyState>
    ) : (
      <table {...stylex.props(styles.tableElement, styles.responsiveTable)}>
        <thead {...stylex.props(styles.responsiveTableHead)}>
          <tr {...stylex.props(styles.responsiveHeaderRow)}>
            <th {...stylex.props(styles.headerCell, styles.responsiveCell)} scope="col">
              Owner
            </th>
            <th {...stylex.props(styles.headerCell, styles.responsiveCell)} scope="col">
              Responsibility
            </th>
            <th {...stylex.props(styles.headerCell, styles.responsiveCell)} scope="col">
              Notes
            </th>
          </tr>
        </thead>
        <tbody {...stylex.props(styles.responsiveTableBody)}>
          {rows.map((row) => (
            <tr
              {...stylex.props(styles.hoverRow, styles.responsiveTableRow)}
              key={row.id}
              id={row.id}
            >
              <th
                {...stylex.props(styles.bodyCell, styles.rowHeader, styles.responsiveCell)}
                scope="row"
                data-label="Owner"
              >
                <span {...stylex.props(styles.responsiveCellLabel)} aria-hidden="true">
                  Owner
                </span>
                {row.owner}
              </th>
              <td
                {...stylex.props(styles.bodyCell, styles.responsiveCell)}
                data-label="Responsibility"
              >
                <span {...stylex.props(styles.responsiveCellLabel)} aria-hidden="true">
                  Responsibility
                </span>
                {row.responsibility}
              </td>
              <td
                {...stylex.props(
                  styles.bodyCell,
                  styles.tableNotes,
                  styles.responsiveCell,
                  styles.responsiveLastCell,
                )}
                data-label="Notes"
              >
                <span {...stylex.props(styles.responsiveCellLabel)} aria-hidden="true">
                  Notes
                </span>
                {row.notes ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </figure>
)

/** An `interfaces-table` block: named signature rows with descriptions. */
export const InterfacesTable = ({ rows, id, style }: InterfacesTableProps) => (
  <figure {...stylex.props(styles.tableFrame, style)} id={id}>
    <figcaption {...stylex.props(styles.visuallyHidden)}>Interfaces</figcaption>
    {rows.length === 0 ? (
      <EmptyState>No interfaces recorded.</EmptyState>
    ) : (
      <table {...stylex.props(styles.tableElement, styles.responsiveTable)}>
        <thead {...stylex.props(styles.responsiveTableHead)}>
          <tr {...stylex.props(styles.responsiveHeaderRow)}>
            <th {...stylex.props(styles.headerCell, styles.responsiveCell)} scope="col">
              Name
            </th>
            <th {...stylex.props(styles.headerCell, styles.responsiveCell)} scope="col">
              Signature
            </th>
            <th {...stylex.props(styles.headerCell, styles.responsiveCell)} scope="col">
              Description
            </th>
          </tr>
        </thead>
        <tbody {...stylex.props(styles.responsiveTableBody)}>
          {rows.map((row) => (
            <tr
              {...stylex.props(styles.hoverRow, styles.responsiveTableRow)}
              key={row.id}
              id={row.id}
            >
              <th
                {...stylex.props(styles.bodyCell, styles.rowHeader, styles.responsiveCell)}
                scope="row"
                data-label="Name"
              >
                <span {...stylex.props(styles.responsiveCellLabel)} aria-hidden="true">
                  Name
                </span>
                {row.name}
              </th>
              <td {...stylex.props(styles.bodyCell, styles.responsiveCell)} data-label="Signature">
                <span {...stylex.props(styles.responsiveCellLabel)} aria-hidden="true">
                  Signature
                </span>
                <code>{row.signature}</code>
              </td>
              <td
                {...stylex.props(styles.bodyCell, styles.responsiveCell, styles.responsiveLastCell)}
                data-label="Description"
              >
                <span {...stylex.props(styles.responsiveCellLabel)} aria-hidden="true">
                  Description
                </span>
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </figure>
)

/**
 * Each kind carries its own accent: a tinted fill, a matching hairline and a
 * thicker leading edge, so a stack of callouts encodes what it is made of
 * rather than relying on a 0.7rem word. Mixing the vivid `-900` accents into
 * the page background keeps every surface legible in both themes.
 */
const calloutKindStyles = stylex.create({
  finding: {
    borderColor: `color-mix(in srgb, ${tokens['--ds-blue-900']} 22%, ${tokens['--ds-gray-alpha-400']})`,
    borderInlineStartColor: tokens['--ds-blue-900'],
    borderInlineStartWidth: 3,
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-blue-900']} 4%, ${tokens['--ds-background-100']})`,
  },
  tradeoff: {
    borderColor: `color-mix(in srgb, ${tokens['--ds-purple-900']} 22%, ${tokens['--ds-gray-alpha-400']})`,
    borderInlineStartColor: tokens['--ds-purple-900'],
    borderInlineStartWidth: 3,
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-purple-900']} 4%, ${tokens['--ds-background-100']})`,
  },
  constraint: {
    borderColor: `color-mix(in srgb, ${tokens['--ds-red-900']} 22%, ${tokens['--ds-gray-alpha-400']})`,
    borderInlineStartColor: tokens['--ds-red-900'],
    borderInlineStartWidth: 3,
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-red-900']} 4%, ${tokens['--ds-background-100']})`,
  },
  'open-question': {
    borderColor: `color-mix(in srgb, ${tokens['--ds-amber-900']} 22%, ${tokens['--ds-gray-alpha-400']})`,
    borderInlineStartColor: tokens['--ds-amber-900'],
    borderInlineStartWidth: 3,
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-amber-900']} 4%, ${tokens['--ds-background-100']})`,
  },
})

/**
 * The kind word repeats the accent, mixed toward the foreground so it stays
 * readable as 0.7rem type in both themes — the raw `-900` accents are tuned
 * for fills and borders, not for small text.
 */
const calloutKindLabelStyles = stylex.create({
  finding: {
    color: `color-mix(in srgb, ${tokens['--ds-blue-900']} 62%, ${tokens['--ds-gray-1000']})`,
  },
  tradeoff: {
    color: `color-mix(in srgb, ${tokens['--ds-purple-900']} 62%, ${tokens['--ds-gray-1000']})`,
  },
  constraint: {
    color: `color-mix(in srgb, ${tokens['--ds-red-900']} 62%, ${tokens['--ds-gray-1000']})`,
  },
  'open-question': {
    color: `color-mix(in srgb, ${tokens['--ds-amber-900']} 62%, ${tokens['--ds-gray-1000']})`,
  },
})

const statusStyles = stylex.create({
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
  'awaiting-sign-off': {
    color: tokens['--ds-red-900'],
    backgroundColor: 'color-mix(in srgb, var(--ds-red-900) 4%, var(--ds-background-100))',
    borderColor: 'color-mix(in srgb, var(--ds-red-900) 14%, var(--ds-gray-alpha-400))',
  },
})

const styles = stylex.create({
  callout: {
    borderRadius: scale.radiusDefault,
    paddingBlock: scale.space3,
    paddingInline: '1rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-200'],
  },
  calloutKind: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: tokens['--ds-gray-800'],
  },
  calloutTitle: {
    fontWeight: 650,
    marginBlock: scale.space1,
    marginInline: 0,
  },
  calloutBody: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.92rem',
  },
  tableFrame: {
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    borderCollapse: 'separate',
    borderSpacing: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    fontSize: '0.9rem',
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--ds-gray-alpha-400) transparent',
    containerType: 'inline-size',
  },
  tableElement: {
    width: '100%',
    minWidth: 'min(36rem, 100%)',
    borderCollapse: 'separate',
    borderSpacing: 0,
    tableLayout: 'auto',
    fontSize: {
      default: null,
      '@container (max-width: 42rem)': '0.8rem',
    },
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
  emptyState: {
    margin: 0,
    paddingBlock: scale.space3,
    paddingInline: '0.875rem',
    color: tokens['--ds-gray-800'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
    fontSize: '0.85rem',
    lineHeight: 1.4,
  },
  headerCell: {
    textAlign: 'left',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: tokens['--ds-gray-800'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    paddingBlock: scale.space2,
    paddingInline: '0.6rem',
  },
  bodyCell: {
    paddingBlock: scale.space2,
    paddingInline: '0.6rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    verticalAlign: 'top',
  },
  decisionCell: {
    paddingBlock: {
      default: null,
      '@container (max-width: 42rem)': '0.35rem',
    },
    paddingInline: {
      default: null,
      '@container (max-width: 42rem)': '0.45rem',
    },
    overflowWrap: {
      default: 'normal',
      '@container (max-width: 42rem)': 'anywhere',
    },
  },
  rowHeader: {
    // A `th scope="row"` is a body cell visually: the uppercase micro-type
    // belongs to column headers only, or every row reads like another header.
    // `th` defaults to centred text; body rows must read as a left-aligned column.
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 'inherit',
    textTransform: 'none',
    color: tokens['--ds-foreground'],
    backgroundColor: 'transparent',
  },
  hoverRow: {
    backgroundColor: {
      default: 'transparent',
      ':hover': tokens['--ds-gray-alpha-100'],
    },
  },
  tableNotes: {
    color: tokens['--ds-gray-800'],
  },
  statusPill: {
    // Hyphenated states (`awaiting-sign-off`) must stay one token: the narrow
    // container turns on `overflow-wrap: anywhere`, which would otherwise split
    // the pill across lines mid-word.
    display: 'inline-block',
    width: 'fit-content',
    whiteSpace: 'nowrap',
    overflowWrap: 'normal',
    wordBreak: 'keep-all',
    hyphens: 'none',
    justifySelf: 'start',
    fontSize: '0.72rem',
    fontWeight: 600,
    paddingBlock: 0,
    paddingInline: '0.4rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    textTransform: 'uppercase',
  },
  responsiveTable: {
    display: {
      default: 'table',
      '@container (max-width: 42rem)': 'block',
    },
  },
  responsiveHeaderRow: {
    display: {
      default: 'table-row',
      '@container (max-width: 42rem)': 'block',
    },
  },
  responsiveTableHead: {
    display: {
      default: 'table-header-group',
      '@container (max-width: 42rem)': 'block',
    },
    position: {
      default: 'static',
      '@container (max-width: 42rem)': 'absolute',
    },
    width: {
      default: 'auto',
      '@container (max-width: 42rem)': 1,
    },
    height: {
      default: 'auto',
      '@container (max-width: 42rem)': 1,
    },
    padding: {
      default: 0,
      '@container (max-width: 42rem)': 0,
    },
    margin: {
      default: 0,
      '@container (max-width: 42rem)': -1,
    },
    overflow: {
      default: 'visible',
      '@container (max-width: 42rem)': 'hidden',
    },
    clip: {
      default: 'auto',
      '@container (max-width: 42rem)': 'rect(0, 0, 0, 0)',
    },
    whiteSpace: {
      default: 'normal',
      '@container (max-width: 42rem)': 'nowrap',
    },
    borderWidth: {
      default: 0,
      '@container (max-width: 42rem)': 0,
    },
  },
  responsiveTableBody: {
    display: {
      default: 'table-row-group',
      '@container (max-width: 42rem)': 'grid',
    },
    gap: {
      default: 0,
      '@container (max-width: 42rem)': '0.5rem',
    },
    padding: {
      default: 0,
      '@container (max-width: 42rem)': '0.5rem',
    },
  },
  responsiveTableRow: {
    display: {
      default: 'table-row',
      '@container (max-width: 42rem)': 'block',
    },
    borderWidth: {
      default: 0,
      '@container (max-width: 42rem)': 1,
    },
    borderStyle: {
      default: 'none',
      '@container (max-width: 42rem)': 'solid',
    },
    borderColor: {
      default: 'transparent',
      '@container (max-width: 42rem)': tokens['--ds-gray-alpha-400'],
    },
    borderRadius: {
      default: 0,
      '@container (max-width: 42rem)': scale.radiusSm,
    },
    backgroundColor: {
      default: 'transparent',
      '@container (max-width: 42rem)': tokens['--ds-background-100'],
    },
    overflow: {
      default: 'visible',
      '@container (max-width: 42rem)': 'hidden',
    },
  },
  responsiveCell: {
    display: {
      default: 'table-cell',
      '@container (max-width: 42rem)': 'grid',
    },
    gridTemplateColumns: {
      default: 'none',
      '@container (max-width: 42rem)': 'minmax(5.75rem, 34%) minmax(0, 1fr)',
    },
    gap: {
      default: 0,
      '@container (max-width: 42rem)': '0.625rem',
    },
    paddingBlock: {
      default: null,
      '@container (max-width: 42rem)': '0.35rem',
    },
    paddingInline: {
      default: null,
      '@container (max-width: 42rem)': '0.45rem',
    },
    overflowWrap: {
      default: 'normal',
      '@container (max-width: 42rem)': 'anywhere',
    },
    backgroundColor: {
      default: null,
      '@container (max-width: 42rem)': 'transparent',
    },
    textTransform: {
      default: null,
      '@container (max-width: 42rem)': 'none',
    },
    color: {
      default: null,
      '@container (max-width: 42rem)': tokens['--ds-foreground'],
    },
  },
  responsiveCellLabel: {
    display: {
      default: 'none',
      '@container (max-width: 42rem)': 'block',
    },
    color: tokens['--ds-gray-800'],
    fontSize: '0.68rem',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  responsiveLastCell: {
    borderBottomWidth: {
      default: 1,
      '@container (max-width: 42rem)': 0,
    },
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
    gap: scale.space3,
  },
  optionCard: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    padding: '0.75rem',
    backgroundColor: tokens['--ds-background-200'],
  },
  optionRecommended: {
    borderColor: 'color-mix(in srgb, var(--ds-green-900) 14%, var(--ds-gray-alpha-400))',
    boxShadow: 'none',
  },
  optionName: {
    fontWeight: 650,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionRecommendation: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    backgroundColor: 'color-mix(in srgb, var(--ds-green-900) 4%, var(--ds-background-100))',
    color: tokens['--ds-green-900'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'color-mix(in srgb, var(--ds-green-900) 14%, var(--ds-gray-alpha-400))',
    paddingBlock: 0,
    paddingInline: '0.35rem',
    borderRadius: scale.radiusSm,
  },
  optionList: {
    listStyle: 'none',
    marginBlockStart: scale.space2,
    marginBlockEnd: 0,
    marginInline: 0,
    padding: 0,
    fontSize: '0.85rem',
  },
  optionListItem: {
    color: tokens['--ds-gray-900'],
  },
  optionVerdict: {
    marginTop: '0.4rem',
    fontSize: '0.82rem',
    fontStyle: 'italic',
    color: tokens['--ds-gray-800'],
  },
})
