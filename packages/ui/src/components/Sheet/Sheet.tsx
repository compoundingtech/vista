/**
 * Sheet component built on React Aria
 *
 * @see https://vercel.com/geist/sheet
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  Heading as AriaHeading,
  Button as AriaButton,
  type DialogProps as AriaDialogProps,
  type DialogTriggerProps as AriaDialogTriggerProps,
  type ModalOverlayProps as AriaModalOverlayProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  // The former animate/fade/slide utilities emitted no CSS because this package
  // has no animation plugin. The live duration/easing declarations remain, but
  // no motion is introduced by this migration.
  overlay: {
    boxSizing: 'border-box',
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    backgroundColor: 'rgb(0 0 0 / 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    transitionDuration: '200ms',
  },
  modal: {
    boxSizing: 'border-box',
    position: 'fixed',
    top: 0,
    bottom: 0,
    height: '100%',
    backgroundColor: tokens['--ds-background-100'],
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 8px 30px rgb(0 0 0 / 0.12), 0 4px 12px rgb(0 0 0 / 0.08)`,
    outlineStyle: 'none',
  },
  modalLeft: {
    left: 0,
    borderTopRightRadius: scale.radiusLg,
    borderBottomRightRadius: scale.radiusLg,
    transitionDuration: '200ms',
    transitionTimingFunction: 'ease-in',
  },
  modalRight: {
    right: 0,
    borderTopLeftRadius: scale.radiusLg,
    borderBottomLeftRadius: scale.radiusLg,
    transitionDuration: '200ms',
    transitionTimingFunction: 'ease-in',
  },
  modalSm: { width: '20rem' },
  modalMd: { width: '480px' },
  modalLg: { width: '640px' },
  modalFull: { width: '100%' },
  dialog: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    outlineStyle: 'none',
  },
  header: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInline: scale.space6,
    paddingBlock: scale.space4,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  headerContent: {
    boxSizing: 'border-box',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    minWidth: 0,
  },
  title: {
    boxSizing: 'border-box',
    margin: 0,
    overflow: 'hidden',
    color: tokens['--ds-gray-1000'],
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: 600,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  description: {
    boxSizing: 'border-box',
    margin: 0,
    marginTop: scale.space1,
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  content: {
    boxSizing: 'border-box',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    paddingInline: scale.space6,
    paddingBlock: scale.space4,
    overflowY: 'auto',
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  footer: {
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: scale.space3,
    paddingInline: scale.space6,
    paddingBlock: scale.space4,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
  },
  closeButton: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: scale.space8,
    height: scale.space8,
    margin: 0,
    marginLeft: scale.space4,
    padding: 0,
    appearance: 'button',
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: scale.radiusDefault,
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: 'transparent',
        '@media (hover: hover)': tokens['--ds-gray-200'],
      },
      ':active': tokens['--ds-gray-300'],
    },
    color: tokens['--ds-gray-900'],
    font: 'inherit',
    textTransform: 'none',
    outlineStyle: 'none',
    boxShadow: {
      default: null,
      ':focus-visible': `0 0 0 2px ${tokens['--ds-focus-color']}`,
    },
    cursor: 'pointer',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  closeIcon: {
    display: 'block',
    flexShrink: 0,
  },
})

type SheetPosition = 'left' | 'right'
type SheetSize = 'sm' | 'md' | 'lg' | 'full'

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type SheetOverlayOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'position'
  | 'inset'
  | 'insetBlock'
  | 'insetBlockStart'
  | 'insetBlockEnd'
  | 'insetInline'
  | 'insetInlineStart'
  | 'insetInlineEnd'
  | 'start'
  | 'end'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'zIndex'
  | 'background'
  | 'backgroundColor'
  | 'backdropFilter'
  | 'WebkitBackdropFilter'
  | 'transition'
  | 'transitionDuration'
>

type SheetDialogOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'display'
  | 'flexDirection'
  | 'flexFlow'
  | 'height'
  | 'minHeight'
  | 'maxHeight'
  | 'blockSize'
  | 'minBlockSize'
  | 'maxBlockSize'
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
>

type SheetHeaderOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'display'
  | 'alignItems'
  | 'placeItems'
  | 'justifyContent'
  | 'placeContent'
  | 'padding'
  | 'paddingBlock'
  | 'paddingInline'
  | 'paddingBlockStart'
  | 'paddingBlockEnd'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingStart'
  | 'paddingEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderBottom'
  | 'borderBottomWidth'
  | 'borderBottomStyle'
  | 'borderBottomColor'
  | 'borderBlock'
  | 'borderBlockWidth'
  | 'borderBlockStyle'
  | 'borderBlockColor'
  | 'borderBlockEnd'
  | 'borderBlockEndWidth'
  | 'borderBlockEndStyle'
  | 'borderBlockEndColor'
>

type SheetTitleOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'margin'
  | 'marginBlock'
  | 'marginInline'
  | 'marginBlockStart'
  | 'marginBlockEnd'
  | 'marginInlineStart'
  | 'marginInlineEnd'
  | 'marginStart'
  | 'marginEnd'
  | 'marginTop'
  | 'marginRight'
  | 'marginBottom'
  | 'marginLeft'
  | 'overflow'
  | 'overflowX'
  | 'overflowY'
  | 'overflowBlock'
  | 'overflowInline'
  | 'color'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
  | 'fontWeight'
  | 'textOverflow'
  | 'whiteSpace'
>

type SheetDescriptionOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'margin'
  | 'marginBlock'
  | 'marginInline'
  | 'marginBlockStart'
  | 'marginBlockEnd'
  | 'marginInlineStart'
  | 'marginInlineEnd'
  | 'marginStart'
  | 'marginEnd'
  | 'marginTop'
  | 'marginRight'
  | 'marginBottom'
  | 'marginLeft'
  | 'color'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
>

type SheetContentOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'flex'
  | 'flexGrow'
  | 'flexShrink'
  | 'flexBasis'
  | 'padding'
  | 'paddingBlock'
  | 'paddingInline'
  | 'paddingBlockStart'
  | 'paddingBlockEnd'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingStart'
  | 'paddingEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'overflow'
  | 'overflowX'
  | 'overflowY'
  | 'overflowBlock'
  | 'color'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
>

type SheetFooterOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'display'
  | 'justifyContent'
  | 'placeContent'
  | 'gap'
  | 'columnGap'
  | 'rowGap'
  | 'gridGap'
  | 'gridRowGap'
  | 'gridColumnGap'
  | 'padding'
  | 'paddingBlock'
  | 'paddingInline'
  | 'paddingBlockStart'
  | 'paddingBlockEnd'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingStart'
  | 'paddingEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderTop'
  | 'borderTopWidth'
  | 'borderTopStyle'
  | 'borderTopColor'
  | 'borderBlock'
  | 'borderBlockWidth'
  | 'borderBlockStyle'
  | 'borderBlockColor'
  | 'borderBlockEnd'
  | 'borderBlockEndWidth'
  | 'borderBlockEndStyle'
  | 'borderBlockEndColor'
>

type SheetCloseButtonOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'display'
  | 'alignItems'
  | 'placeItems'
  | 'justifyContent'
  | 'placeContent'
  | 'flexShrink'
  | 'flex'
  | 'width'
  | 'inlineSize'
  | 'height'
  | 'blockSize'
  | 'margin'
  | 'marginBlock'
  | 'marginBlockStart'
  | 'marginBlockEnd'
  | 'marginInline'
  | 'marginInlineStart'
  | 'marginInlineEnd'
  | 'marginStart'
  | 'marginEnd'
  | 'marginTop'
  | 'marginRight'
  | 'marginBottom'
  | 'marginLeft'
  | 'padding'
  | 'paddingBlock'
  | 'paddingBlockStart'
  | 'paddingBlockEnd'
  | 'paddingInline'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingStart'
  | 'paddingEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'appearance'
  | 'WebkitAppearance'
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderRadius'
  | 'borderBlock'
  | 'borderBlockWidth'
  | 'borderBlockStyle'
  | 'borderBlockColor'
  | 'borderBlockStart'
  | 'borderBlockStartWidth'
  | 'borderBlockStartStyle'
  | 'borderBlockStartColor'
  | 'borderBlockEnd'
  | 'borderBlockEndWidth'
  | 'borderBlockEndStyle'
  | 'borderBlockEndColor'
  | 'borderInline'
  | 'borderInlineWidth'
  | 'borderInlineStyle'
  | 'borderInlineColor'
  | 'borderInlineStart'
  | 'borderInlineStartWidth'
  | 'borderInlineStartStyle'
  | 'borderInlineStartColor'
  | 'borderInlineEnd'
  | 'borderInlineEndWidth'
  | 'borderInlineEndStyle'
  | 'borderInlineEndColor'
  | 'borderTop'
  | 'borderTopWidth'
  | 'borderTopStyle'
  | 'borderTopColor'
  | 'borderRight'
  | 'borderRightWidth'
  | 'borderRightStyle'
  | 'borderRightColor'
  | 'borderBottom'
  | 'borderBottomWidth'
  | 'borderBottomStyle'
  | 'borderBottomColor'
  | 'borderLeft'
  | 'borderLeftWidth'
  | 'borderLeftStyle'
  | 'borderLeftColor'
  | 'borderStartStartRadius'
  | 'borderStartEndRadius'
  | 'borderEndStartRadius'
  | 'borderEndEndRadius'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderBottomLeftRadius'
  | 'borderBottomRightRadius'
  | 'background'
  | 'backgroundColor'
  | 'color'
  | 'font'
  | 'textTransform'
  | 'outline'
  | 'outlineStyle'
  | 'outlineWidth'
  | 'outlineColor'
  | 'outlineOffset'
  | 'boxShadow'
  | 'cursor'
  | 'transition'
  | 'transitionProperty'
  | 'transitionTimingFunction'
  | 'transitionDuration'
>

export interface SheetProps extends Omit<AriaModalOverlayProps, 'children'> {
  /** Sheet content */
  children: ReactNode
  /** Side from which the sheet is anchored. */
  position?: SheetPosition | undefined
  /** Width of the sheet. */
  size?: SheetSize | undefined
  /** Caller-last overlay adaptation. Component-owned overlay geometry is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SheetOverlayOwnedStyle>
}

export interface SheetDialogProps extends Omit<AriaDialogProps, 'children'> {
  /** Dialog content */
  children: ReactNode
  /** Caller-last dialog adaptation. Component-owned layout is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SheetDialogOwnedStyle>
}

export interface SheetTriggerProps extends AriaDialogTriggerProps {
  /** Trigger element and sheet */
  children: ReactNode
}

export interface SheetHeaderProps {
  /** Header content */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Show close button. Defaults to true */
  showCloseButton?: boolean
  /** Close button aria label */
  closeButtonLabel?: string
  /** Caller-last header adaptation. Component-owned layout is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SheetHeaderOwnedStyle>
}

export interface SheetTitleProps {
  /** Title text */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last title adaptation. Component-owned typography is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SheetTitleOwnedStyle>
}

export interface SheetDescriptionProps {
  /** Description text */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last description adaptation. Component-owned typography is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SheetDescriptionOwnedStyle>
}

export interface SheetContentProps {
  /** Content */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last content adaptation. Component-owned scrolling and layout are constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SheetContentOwnedStyle>
}

export interface SheetFooterProps {
  /** Footer content (typically buttons) */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last footer adaptation. Component-owned layout is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SheetFooterOwnedStyle>
}

export interface SheetCloseButtonProps {
  /** Aria label for the close button */
  label?: string
  /** Optional class name */
  className?: string
  /** Caller-last close-button adaptation. Component-owned interaction styling is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<SheetCloseButtonOwnedStyle>
}

const modalPositionStyles = {
  left: styles.modalLeft,
  right: styles.modalRight,
} as const

const modalSizeStyles = {
  sm: styles.modalSm,
  md: styles.modalMd,
  lg: styles.modalLg,
  full: styles.modalFull,
} as const

/** Trigger container for opening the sheet */
export const SheetTrigger = ({ children, ...props }: SheetTriggerProps) => {
  return <AriaDialogTrigger {...props}>{children}</AriaDialogTrigger>
}

/** Sheet overlay and container */
export const Sheet = ({
  children,
  position = 'right',
  size = 'md',
  className,
  style,
  stylexStyle,
  ...props
}: SheetProps) => {
  return (
    <AriaModalOverlay {...styled({ className, style }, styles.overlay, stylexStyle)} {...props}>
      <AriaModal
        {...styled(undefined, styles.modal, modalPositionStyles[position], modalSizeStyles[size])}
      >
        {children}
      </AriaModal>
    </AriaModalOverlay>
  )
}

/** Dialog content wrapper */
export const SheetDialog = ({
  children,
  className,
  style,
  stylexStyle,
  ...props
}: SheetDialogProps) => {
  return (
    <AriaDialog {...styled({ className, style }, styles.dialog, stylexStyle)} {...props}>
      {children}
    </AriaDialog>
  )
}

/** Close icon SVG component */
const CloseIcon = () => (
  <svg
    {...styled(undefined, styles.closeIcon)}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M12.5 3.5L3.5 12.5M3.5 3.5L12.5 12.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/** Sheet close button */
export const SheetCloseButton = ({
  label = 'Close',
  className,
  stylexStyle,
}: SheetCloseButtonProps) => {
  return (
    <AriaButton
      slot="close"
      {...styled(className, styles.closeButton, stylexStyle)}
      aria-label={label}
    >
      <CloseIcon />
    </AriaButton>
  )
}

/** Sheet header section */
export const SheetHeader = ({
  children,
  className,
  showCloseButton = true,
  closeButtonLabel,
  stylexStyle,
}: SheetHeaderProps) => {
  return (
    <div {...styled(className, styles.header, stylexStyle)}>
      <div {...styled(undefined, styles.headerContent)}>{children}</div>
      {showCloseButton &&
        (closeButtonLabel !== undefined ? (
          <SheetCloseButton label={closeButtonLabel} />
        ) : (
          <SheetCloseButton />
        ))}
    </div>
  )
}

/** Sheet title */
export const SheetTitle = ({ children, className, stylexStyle }: SheetTitleProps) => {
  return (
    <AriaHeading slot="title" {...styled(className, styles.title, stylexStyle)}>
      {children}
    </AriaHeading>
  )
}

/** Sheet description */
export const SheetDescription = ({ children, className, stylexStyle }: SheetDescriptionProps) => {
  return <p {...styled(className, styles.description, stylexStyle)}>{children}</p>
}

/** Sheet content section */
export const SheetContent = ({ children, className, stylexStyle }: SheetContentProps) => {
  return <div {...styled(className, styles.content, stylexStyle)}>{children}</div>
}

/** Sheet footer section */
export const SheetFooter = ({ children, className, stylexStyle }: SheetFooterProps) => {
  return <div {...styled(className, styles.footer, stylexStyle)}>{children}</div>
}
