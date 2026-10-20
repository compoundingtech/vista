/** Decorative SVG icons used by the treemap controls and tile affordances. */
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import type { MouseEvent as ReactMouseEvent, SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'className' | 'style'> & {
  readonly rootStyle?: StyleXStylesWithout<{ position: string }>
}

const iconStyles = stylex.create({
  icon: {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  maximize: {
    color: 'currentColor',
  },
  hitTarget: {
    fill: 'transparent',
  },
  maximizePath: {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    vectorEffect: 'non-scaling-stroke',
  },
})

/** Right-pointing chevron: breadcrumb separator and collapsed disclosure. */
export const ChevronRight = ({ rootStyle, ...props }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
    {...props}
    {...stylex.props(iconStyles.icon, rootStyle)}
  >
    <path d="M6 3l5 5-5 5" />
  </svg>
)

/** Down-pointing chevron: expanded disclosure and filter/sibling carets. */
export const ChevronDown = ({ rootStyle, ...props }: IconProps) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
    {...props}
    {...stylex.props(iconStyles.icon, rootStyle)}
  >
    <path d="M3 6l5 5 5-5" />
  </svg>
)

const MAXIMIZE_PATH = 'M10 3h3v3 M13 3l-4 4 M6 13h-3v-3 M3 13l4-4'

/** SVG-native maximize affordance positioned inside a treemap tile. */
export const TileMaximize = ({
  x,
  y,
  size,
  style,
  onClick,
}: {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly style?: StyleXStylesWithout<{ transform: string }>
  readonly onClick?: (event: ReactMouseEvent<SVGGElement>) => void
}) => (
  <g
    {...stylex.props(iconStyles.maximize, style)}
    transform={`translate(${x}, ${y}) scale(${size / 16})`}
    aria-hidden="true"
    onClick={onClick}
  >
    <rect {...stylex.props(iconStyles.hitTarget)} x={0} y={0} width={16} height={16} />
    <path {...stylex.props(iconStyles.maximizePath)} d={MAXIMIZE_PATH} />
  </g>
)
