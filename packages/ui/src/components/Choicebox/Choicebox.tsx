/**
 * Choicebox component built on React Aria
 *
 * @see https://vercel.com/geist/choicebox
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  RadioGroup as AriaRadioGroup,
  Radio as AriaRadio,
  CheckboxGroup as AriaCheckboxGroup,
  Checkbox as AriaCheckbox,
  Label as AriaLabel,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
  type RadioRenderProps,
  type CheckboxGroupProps as AriaCheckboxGroupProps,
  type CheckboxProps as AriaCheckboxProps,
} from 'react-aria-components'

import { styled, type StyledProps } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  groupRoot: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space3,
  },
  groupLabel: {
    marginBottom: scale.space1,
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gap: scale.space3,
  },
  gridColumns1: {
    gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
  },
  gridColumns2: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  gridColumns3: {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  gridColumns4: {
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  },
  root: {
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    cursor: 'pointer',
    borderRadius: '0.375rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-100'],
    outlineWidth: 0,
    outlineStyle: 'none',
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  rootHovered: {
    borderColor: tokens['--ds-gray-600'],
  },
  rootSelected: {
    borderColor: tokens['--ds-gray-1000'],
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-1000']}`,
  },
  rootDisabledHoverReset: {
    borderColor: {
      default: null,
      ':hover': {
        default: null,
        '@media (hover: hover)': tokens['--ds-gray-alpha-400'],
      },
    },
  },
  rootDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  rootFocused: {
    // `ring-offset-2` omitted an offset colour, so Tailwind painted white.
    boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${tokens['--ds-focus-color']}`,
  },
  rootSelectedFocused: {
    // Tailwind composed the focus ring and selected one-pixel shadow.
    boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${tokens['--ds-focus-color']}, 0 0 0 1px ${tokens['--ds-gray-1000']}`,
  },
  content: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    width: '100%',
  },
  contentSm: {
    padding: scale.space3,
  },
  contentMd: {
    padding: scale.space4,
  },
  contentLg: {
    padding: scale.space5,
  },
  indicator: {
    position: 'absolute',
    top: scale.space3,
    right: scale.space3,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: scale.space4,
    height: scale.space4,
    borderRadius: scale.radiusFull,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-600'],
    backgroundColor: tokens['--ds-background-100'],
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  checkIndicator: {
    borderRadius: scale.radiusSm,
  },
  indicatorSelected: {
    borderColor: tokens['--ds-gray-1000'],
    backgroundColor: tokens['--ds-gray-1000'],
  },
  indicatorDot: {
    width: scale.space2,
    height: scale.space2,
    borderRadius: scale.radiusFull,
    backgroundColor: tokens['--ds-background-100'],
    transform: 'scale(0)',
    transitionProperty: 'transform, translate, scale, rotate',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  indicatorDotSelected: {
    transform: 'scale(1)',
  },
  indicatorCheck: {
    width: scale.space3,
    height: scale.space3,
    color: tokens['--ds-background-100'],
    opacity: 0,
  },
  indicatorCheckSelected: {
    opacity: 1,
  },
  checkIcon: {
    display: 'block',
    verticalAlign: 'middle',
    width: scale.space3,
    height: scale.space3,
  },
  title: {
    color: tokens['--ds-gray-1000'],
    fontWeight: 500,
  },
  titleSm: {
    // The arbitrary Tailwind size replaced `text-sm`, including its paired
    // line-height, rather than merely overriding the font size.
    fontSize: '13px',
  },
  titleMd: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  titleLg: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
  },
  description: {
    color: tokens['--ds-gray-900'],
    fontSize: '13px',
    lineHeight: 1.4,
  },
  descriptionSm: {
    fontSize: '0.75rem',
  },
  descriptionLg: {
    fontSize: '0.875rem',
  },
})

type ChoiceboxColumns = 1 | 2 | 3 | 4
type ChoiceboxSize = 'sm' | 'md' | 'lg'

const gridColumnStyles: Record<ChoiceboxColumns, stylex.StyleXStyles> = {
  1: styles.gridColumns1,
  2: styles.gridColumns2,
  3: styles.gridColumns3,
  4: styles.gridColumns4,
}

const contentSizeStyles: Record<ChoiceboxSize, stylex.StyleXStyles> = {
  sm: styles.contentSm,
  md: styles.contentMd,
  lg: styles.contentLg,
}

const titleSizeStyles: Record<ChoiceboxSize, stylex.StyleXStyles> = {
  sm: styles.titleSm,
  md: styles.titleMd,
  lg: styles.titleLg,
}

const descriptionSizeStyles: Record<ChoiceboxSize, stylex.StyleXStyles> = {
  sm: styles.descriptionSm,
  md: undefined,
  lg: styles.descriptionLg,
}

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type ChoiceboxGroupOwnedStyle = OwnedStyle<
  'display' | 'flexDirection' | 'flexFlow' | 'gap' | 'columnGap' | 'rowGap'
>

type ChoiceboxOwnedStyle = OwnedStyle<
  | 'position'
  | 'boxSizing'
  | 'display'
  | 'cursor'
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderRadius'
  | 'background'
  | 'backgroundColor'
  | 'boxShadow'
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
  | 'opacity'
  | 'transition'
  | 'transitionProperty'
  | 'transitionTimingFunction'
  | 'transitionDuration'
  | 'transitionDelay'
>

type ChoiceboxRenderProps = Pick<
  RadioRenderProps,
  'isHovered' | 'isSelected' | 'isDisabled' | 'isFocusVisible'
>

const makeChoiceboxStyleProps = ({
  className,
  style,
}: {
  className: string | undefined
  style: stylex.StyleXStylesWithout<ChoiceboxOwnedStyle> | undefined
}) => {
  let cached:
    | {
        key: number
        props: StyledProps
      }
    | undefined

  const resolve = ({
    isHovered,
    isSelected,
    isDisabled,
    isFocusVisible,
  }: ChoiceboxRenderProps): StyledProps => {
    const key =
      (isHovered ? 1 : 0) | (isSelected ? 2 : 0) | (isDisabled ? 4 : 0) | (isFocusVisible ? 8 : 0)
    if (cached?.key === key) return cached.props

    const props = styled(
      className,
      styles.root,
      isDisabled && styles.rootDisabledHoverReset,
      isHovered && styles.rootHovered,
      isSelected && styles.rootSelected,
      isDisabled && styles.rootDisabled,
      isFocusVisible && styles.rootFocused,
      isSelected && isFocusVisible && styles.rootSelectedFocused,
      style,
    )
    cached = { key, props }
    return props
  }

  return {
    className: (values: ChoiceboxRenderProps) => resolve(values).className ?? '',
    style: (values: ChoiceboxRenderProps) => resolve(values).style ?? {},
  }
}

/** Check icon for multi-select */
const CheckIcon = () => (
  <svg
    {...styled(undefined, styles.checkIcon)}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export interface ChoiceboxGroupProps extends Omit<AriaRadioGroupProps, 'children' | 'style'> {
  /** Label for the group */
  label?: string
  /** Choicebox items */
  children: ReactNode
  /** Number of grid columns */
  columns?: ChoiceboxColumns | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned group layout is constrained. */
  style?: stylex.StyleXStylesWithout<ChoiceboxGroupOwnedStyle>
}

/** Single-select choicebox group using radio behavior */
export const ChoiceboxGroup = ({
  label,
  children,
  columns = 2,
  className,
  style,
  ...props
}: ChoiceboxGroupProps) => (
  <AriaRadioGroup {...styled(className, styles.groupRoot, style)} {...props}>
    {label && <AriaLabel {...styled(undefined, styles.groupLabel)}>{label}</AriaLabel>}
    <div {...styled(undefined, styles.grid, gridColumnStyles[columns])}>{children}</div>
  </AriaRadioGroup>
)

export interface ChoiceboxMultiGroupProps extends Omit<
  AriaCheckboxGroupProps,
  'children' | 'style'
> {
  /** Label for the group */
  label?: string
  /** Choicebox items */
  children: ReactNode
  /** Number of grid columns */
  columns?: ChoiceboxColumns | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned group layout is constrained. */
  style?: stylex.StyleXStylesWithout<ChoiceboxGroupOwnedStyle>
}

/** Multi-select choicebox group using checkbox behavior */
export const ChoiceboxMultiGroup = ({
  label,
  children,
  columns = 2,
  className,
  style,
  ...props
}: ChoiceboxMultiGroupProps) => (
  <AriaCheckboxGroup {...styled(className, styles.groupRoot, style)} {...props}>
    {label && <AriaLabel {...styled(undefined, styles.groupLabel)}>{label}</AriaLabel>}
    <div {...styled(undefined, styles.grid, gridColumnStyles[columns])}>{children}</div>
  </AriaCheckboxGroup>
)

export interface ChoiceboxProps extends Omit<AriaRadioProps, 'children' | 'style'> {
  /** Title text */
  title: string
  /** Description text */
  description?: string
  /** Visual size */
  size?: ChoiceboxSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned visual and state styling is constrained. */
  style?: stylex.StyleXStylesWithout<ChoiceboxOwnedStyle>
}

/** Single-select choicebox card with radio behavior */
export const Choicebox = ({
  title,
  description,
  size = 'md',
  className,
  style,
  ...props
}: ChoiceboxProps) => (
  <AriaRadio {...makeChoiceboxStyleProps({ className, style })} {...props}>
    {({ isSelected }) => (
      <>
        <span {...styled(undefined, styles.indicator, isSelected && styles.indicatorSelected)}>
          <span
            {...styled(undefined, styles.indicatorDot, isSelected && styles.indicatorDotSelected)}
          />
        </span>
        <span {...styled(undefined, styles.content, contentSizeStyles[size])}>
          <span {...styled(undefined, styles.title, titleSizeStyles[size])}>{title}</span>
          {description && (
            <span {...styled(undefined, styles.description, descriptionSizeStyles[size])}>
              {description}
            </span>
          )}
        </span>
      </>
    )}
  </AriaRadio>
)

export interface ChoiceboxMultiProps extends Omit<AriaCheckboxProps, 'children' | 'style'> {
  /** Title text */
  title: string
  /** Description text */
  description?: string
  /** Visual size */
  size?: ChoiceboxSize | undefined
  /** Optional class name override */
  className?: string
  /** Caller-last root adaptation. Component-owned visual and state styling is constrained. */
  style?: stylex.StyleXStylesWithout<ChoiceboxOwnedStyle>
}

/** Multi-select choicebox card with checkbox behavior */
export const ChoiceboxMulti = ({
  title,
  description,
  size = 'md',
  className,
  style,
  ...props
}: ChoiceboxMultiProps) => (
  <AriaCheckbox {...makeChoiceboxStyleProps({ className, style })} {...props}>
    {({ isSelected }) => (
      <>
        <span
          {...styled(
            undefined,
            styles.indicator,
            styles.checkIndicator,
            isSelected && styles.indicatorSelected,
          )}
        >
          <span
            {...styled(
              undefined,
              styles.indicatorCheck,
              isSelected && styles.indicatorCheckSelected,
            )}
          >
            <CheckIcon />
          </span>
        </span>
        <span {...styled(undefined, styles.content, contentSizeStyles[size])}>
          <span {...styled(undefined, styles.title, titleSizeStyles[size])}>{title}</span>
          {description && (
            <span {...styled(undefined, styles.description, descriptionSizeStyles[size])}>
              {description}
            </span>
          )}
        </span>
      </>
    )}
  </AriaCheckbox>
)
