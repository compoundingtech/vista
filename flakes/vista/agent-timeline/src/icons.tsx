import type { ReactNode } from 'react'

const iconProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 14 14',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/** Fullscreen-corner glyph for expanding every session-tree branch. */
export const ExpandAllIcon = (): ReactNode => (
  <svg {...iconProps}>
    <path d="M5 2H2v3M9 2h3v3M5 12H2V9M9 12h3V9" />
    <path d="M2 5l3-3M12 5L9 2M2 9l3 3M12 9l-3 3" />
  </svg>
)

/** Inward-corner glyph for collapsing every session-tree branch. */
export const CollapseAllIcon = (): ReactNode => (
  <svg {...iconProps}>
    <path d="M2 5h3V2M12 5H9V2M2 9h3v3M12 9H9v3" />
    <path d="M5 5L2 2M9 5l3-3M5 9l-3 3M9 9l3 3" />
  </svg>
)

/** Downward chevron indicating an expanded tree row or disclosure. */
export const ChevronDownIcon = (): ReactNode => (
  <svg {...iconProps}>
    <path d="M3 5.25 7 9l4-3.75" />
  </svg>
)

/** Magnifier glyph for fitting the timeline viewport to one span. */
export const ZoomToSpanIcon = (): ReactNode => (
  <svg {...iconProps}>
    <circle cx="6" cy="6" r="3.75" />
    <path d="m9 9 3 3M6 4.25v3.5M4.25 6h3.5" />
  </svg>
)
