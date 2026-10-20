import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import type { ReactNode } from 'react'

import {
  hueLegend,
  spanMarkApplies,
  spanMarks,
  type SpanMarkId,
  type SpanMarkSwatch,
} from '@overeng/agent-timeline/encodings'
import type { AgentTimelineScene } from '@overeng/agent-timeline/projection'

import { useTheme } from '../../theme.ts'

const MarkSwatch = ({ swatch }: { readonly swatch: SpanMarkSwatch }): ReactNode => {
  const common = { width: 18, height: 12, viewBox: '0 0 18 12', 'aria-hidden': true } as const
  switch (swatch._tag) {
    case 'context-histogram':
      return (
        <svg {...common}>
          <path d="M1 10V8H5V6H9V3H13V1H17V10Z" fill={tokens['--ds-blue-700']} />
        </svg>
      )
    case 'context-estimate':
      return (
        <svg {...common}>
          <rect x="2" y="4" width="14" height="6" fill={tokens['--ds-blue-700']} />
          <line
            x1="2"
            x2="16"
            y1="4"
            y2="4"
            stroke={tokens['--ds-foreground']}
            strokeWidth="1.2"
            strokeDasharray="1 2"
          />
        </svg>
      )
    case 'binned':
      return (
        <svg {...common}>
          <rect x="1" y="2" width="16" height="8" fill={tokens['--ds-gray-alpha-100']} />
          <path
            d="M2 10L6 6M6 10L10 6M10 10L14 6M14 10L17 7"
            stroke={tokens['--ds-gray-700']}
            strokeWidth="0.8"
            opacity="0.55"
          />
        </svg>
      )
    case 'activity':
      return (
        <svg {...common}>
          <rect x="1" y="2" width="7" height="8" fill={tokens['--ds-blue-700']} opacity="0.65" />
          <path
            d="M8 10L16 2M11 11L17 5"
            stroke={tokens['--ds-blue-900']}
            strokeWidth="1"
            opacity="0.5"
          />
        </svg>
      )
    case 'turn-tick':
      return (
        <svg {...common}>
          <rect
            x="1"
            y="2"
            width="16"
            height="8"
            rx="1"
            fill={tokens['--ds-blue-700']}
            opacity="0.5"
          />
          <line x1="9" x2="9" y1="3" y2="9" stroke={tokens['--ds-foreground']} strokeWidth="1.3" />
        </svg>
      )
    case 'model-change':
      return (
        <svg {...common}>
          <rect
            x="1"
            y="2"
            width="16"
            height="8"
            rx="1"
            fill={tokens['--ds-blue-700']}
            opacity="0.34"
          />
          <line x1="9" x2="9" y1="1" y2="7" stroke={tokens['--ds-purple-900']} strokeWidth="1.5" />
        </svg>
      )
    case 'prompt-marker':
      return (
        <svg {...common}>
          <path
            d="M5 8L9 3L13 8Z"
            fill={swatch.steering ? tokens['--ds-background-100'] : tokens['--ds-amber-900']}
            stroke={tokens['--ds-amber-900']}
          />
        </svg>
      )
    case 'compaction-marker':
      return (
        <svg {...common}>
          <rect x="1" y="5" width="6" height="5" fill={tokens['--ds-blue-700']} opacity="0.72" />
          <rect x="10" y="8" width="7" height="2" fill={tokens['--ds-blue-700']} opacity="0.72" />
          <path
            d="M6 2L9 5L12 2M9 5V10"
            fill="none"
            stroke={tokens['--ds-foreground']}
            strokeWidth="1.2"
          />
        </svg>
      )
    case 'span-end-active':
      return (
        <svg {...common}>
          <line
            x1="1"
            x2="12"
            y1="6"
            y2="6"
            stroke={tokens['--ds-blue-700']}
            strokeWidth="6"
            opacity="0.5"
          />
          <circle
            cx="14"
            cy="6"
            r="3"
            fill={tokens['--ds-background-100']}
            stroke={tokens['--ds-green-900']}
          />
          <circle cx="14" cy="6" r="1" fill={tokens['--ds-green-900']} />
        </svg>
      )
    case 'span-end-inactive':
      return (
        <svg {...common}>
          <line
            x1="1"
            x2="12"
            y1="6"
            y2="6"
            stroke={tokens['--ds-blue-700']}
            strokeWidth="6"
            opacity="0.22"
          />
          <circle
            cx="14"
            cy="6"
            r="3"
            fill={tokens['--ds-background-100']}
            stroke={tokens['--ds-gray-700']}
            strokeDasharray="1 1"
            opacity="0.65"
          />
        </svg>
      )
    case 'span-end':
      return (
        <svg {...common}>
          <line
            x1="1"
            x2="14"
            y1="6"
            y2="6"
            stroke={tokens['--ds-blue-700']}
            strokeWidth="6"
            opacity="0.5"
          />
          <line
            x1="14"
            x2="14"
            y1="1"
            y2="11"
            stroke={swatch.failed ? tokens['--ds-red-900'] : tokens['--ds-foreground']}
            strokeWidth="1.5"
          />
          {swatch.failed ? (
            <path d="M12 4L16 8M16 4L12 8" stroke={tokens['--ds-red-900']} strokeWidth="1.2" />
          ) : null}
        </svg>
      )
    case 'span-highlight':
      return (
        <svg {...common}>
          <rect
            x="1"
            y="2"
            width="16"
            height="8"
            rx="1"
            fill="none"
            stroke={tokens['--ds-amber-900']}
            strokeWidth="2"
          />
        </svg>
      )
    case 'ancestor-dimming':
      return (
        <svg {...common}>
          <rect
            x="1"
            y="2"
            width="16"
            height="8"
            rx="1"
            fill={tokens['--ds-blue-700']}
            opacity="0.26"
          />
        </svg>
      )
    case 'cursor-line':
      return (
        <svg {...common}>
          <rect
            x="1"
            y="2"
            width="16"
            height="8"
            rx="1"
            fill={tokens['--ds-blue-700']}
            opacity="0.35"
          />
          <line x1="9" x2="9" y1="0" y2="12" stroke={tokens['--ds-red-900']} />
        </svg>
      )
    case 'span-label':
      return (
        <svg {...common}>
          <rect
            x="1"
            y="2"
            width="16"
            height="8"
            rx="1"
            fill={tokens['--ds-blue-700']}
            opacity="0.5"
          />
          <text x="3" y="8" fill={tokens['--ds-foreground']} fontSize="5">
            Aa
          </text>
        </svg>
      )
  }
}

/** Trace-derived hues and optional mark selection explained by the legend. */
export interface LegendProps {
  readonly scene: AgentTimelineScene
  readonly marks?: ReadonlySet<SpanMarkId>
}

/** Explain agent-type hue and every span mark currently drawn. */
export const Legend = ({ scene, marks }: LegendProps): ReactNode => {
  const theme = useTheme()
  const appliedMarks = spanMarks.filter((mark) =>
    spanMarkApplies(mark, marks === undefined ? {} : { marks }),
  )
  return (
    <div {...stylex.props(styles.legend)} aria-label="Agent timeline legend">
      <div {...stylex.props(styles.legendGroup)}>
        <span {...stylex.props(styles.legendHeading)}>AGENT TYPE</span>
        {hueLegend(scene, theme).map((item) => (
          <span key={item.id} {...stylex.props(styles.legendItem)}>
            <i {...stylex.props(styles.swatch(item.color))} />
            {item.label.length <= 18 ? item.label : `${item.label.slice(0, 17)}…`}
          </span>
        ))}
      </div>
      <div {...stylex.props(styles.legendGroup)}>
        <span {...stylex.props(styles.legendHeading)}>ACTIVITY</span>
        <span {...stylex.props(styles.legendNote)}>
          bars = working · hatch = waiting · gap = idle ·{' '}
          {Math.round(scene.model.parameters.activeWithinMs / 60_000)}-minute request-gap rule
        </span>
      </div>
      <div {...stylex.props(styles.legendGroup)}>
        <span {...stylex.props(styles.legendHeading)}>STATUS</span>
        <span {...stylex.props(styles.legendNote)}>
          active if last request ≤ {Math.round(scene.model.parameters.idleThresholdMs / 60_000)} min
          · inactive otherwise · exited only on a recorded exit
        </span>
      </div>
      <div {...stylex.props(styles.legendGroup)}>
        <span {...stylex.props(styles.legendHeading)}>SPAN MARKS</span>
        {appliedMarks.map((mark) => (
          <span
            key={mark.id}
            title={mark.description}
            aria-label={`${mark.label}: ${mark.description}`}
            {...stylex.props(styles.legendItem)}
          >
            <MarkSwatch swatch={mark.swatch} />
            {mark.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const styles = stylex.create({
  legend: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scale.space3,
    minHeight: 34,
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-100'],
    color: tokens['--ds-gray-800'],
    fontSize: '0.6rem',
  },
  legendGroup: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: scale.space2 },
  legendHeading: { color: tokens['--ds-gray-700'], fontWeight: 600, letterSpacing: '0.04em' },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space1,
    whiteSpace: 'nowrap',
  },
  legendNote: { color: tokens['--ds-gray-600'] },
  swatch: (color: string) => ({
    display: 'inline-block',
    width: 12,
    height: 7,
    backgroundColor: color,
  }),
})
