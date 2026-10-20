/**
 * Modal component built on React Aria
 *
 * @see https://vercel.com/geist/modal
 */

import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  Heading as AriaHeading,
  type DialogProps as AriaDialogProps,
  type DialogTriggerProps as AriaDialogTriggerProps,
  type ModalOverlayProps as AriaModalOverlayProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  // The former animate/fade/zoom utilities emitted no CSS because this package
  // has no animation plugin. Their unprefixed duration utilities did emit, so
  // the final 150ms value remains without introducing motion during migration.
  overlay: {
    boxSizing: 'border-box',
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(0 0 0 / 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    transitionDuration: '150ms',
  },
  modal: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '540px',
    backgroundColor: tokens['--ds-background-100'],
    borderRadius: '0.75rem',
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`,
    outlineStyle: 'none',
    transitionDuration: '150ms',
  },
  dialog: {
    boxSizing: 'border-box',
    outlineStyle: 'none',
  },
  header: {
    boxSizing: 'border-box',
    padding: scale.space6,
  },
  title: {
    boxSizing: 'border-box',
    margin: 0,
    color: tokens['--ds-gray-1000'],
    fontSize: '1.5rem',
    lineHeight: '2rem',
    fontWeight: 600,
  },
  description: {
    boxSizing: 'border-box',
    margin: 0,
    marginTop: scale.space2,
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  content: {
    boxSizing: 'border-box',
    paddingInline: scale.space6,
    paddingBottom: scale.space6,
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  footer: {
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: scale.space3,
    padding: scale.space4,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
  },
})

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type ModalOverlayOwnedStyle = OwnedStyle<
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
  | 'display'
  | 'alignItems'
  | 'placeItems'
  | 'justifyContent'
  | 'placeContent'
  | 'background'
  | 'backgroundColor'
  | 'backdropFilter'
  | 'WebkitBackdropFilter'
  | 'transition'
  | 'transitionDuration'
>

type ModalDialogOwnedStyle = OwnedStyle<
  'boxSizing' | 'outline' | 'outlineWidth' | 'outlineStyle' | 'outlineColor' | 'outlineOffset'
>

type ModalHeaderOwnedStyle = OwnedStyle<
  | 'boxSizing'
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
>

type ModalTitleOwnedStyle = OwnedStyle<
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
  | 'fontWeight'
>

type ModalDescriptionOwnedStyle = OwnedStyle<
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

type ModalContentOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'padding'
  | 'paddingBlock'
  | 'paddingBlockEnd'
  | 'paddingInline'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingBlockStart'
  | 'paddingStart'
  | 'paddingEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'color'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
>

type ModalFooterOwnedStyle = OwnedStyle<
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
  | 'borderBlock'
  | 'borderBlockWidth'
  | 'borderBlockStyle'
  | 'borderBlockColor'
  | 'borderBlockStart'
  | 'borderBlockStartWidth'
  | 'borderBlockStartStyle'
  | 'borderBlockStartColor'
  | 'border'
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderTop'
  | 'borderTopWidth'
  | 'borderTopStyle'
  | 'borderTopColor'
>

export interface ModalProps extends Omit<AriaModalOverlayProps, 'children'> {
  /** Modal content */
  children: ReactNode
  /** Caller-last overlay adaptation. Component-owned overlay geometry is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ModalOverlayOwnedStyle>
}

export interface ModalDialogProps extends Omit<AriaDialogProps, 'children'> {
  /** Dialog content */
  children: ReactNode
  /** Caller-last dialog adaptation. Component-owned focus presentation is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ModalDialogOwnedStyle>
}

export interface ModalTriggerProps extends AriaDialogTriggerProps {
  /** Trigger element and modal */
  children: ReactNode
}

export interface ModalHeaderProps {
  /** Header content */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last header adaptation. Component-owned spacing is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ModalHeaderOwnedStyle>
}

export interface ModalTitleProps {
  /** Title text */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last title adaptation. Component-owned typography is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ModalTitleOwnedStyle>
}

export interface ModalDescriptionProps {
  /** Description text */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last description adaptation. Component-owned typography is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ModalDescriptionOwnedStyle>
}

export interface ModalContentProps {
  /** Content */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last content adaptation. Component-owned spacing and typography are constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ModalContentOwnedStyle>
}

export interface ModalFooterProps {
  /** Footer content (typically buttons) */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last footer adaptation. Component-owned layout is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<ModalFooterOwnedStyle>
}

/** Trigger container for opening the modal */
export const ModalTrigger = ({ children, ...props }: ModalTriggerProps) => {
  return <AriaDialogTrigger {...props}>{children}</AriaDialogTrigger>
}

/** Modal overlay and container */
export const Modal = ({ children, className, style, stylexStyle, ...props }: ModalProps) => {
  return (
    <AriaModalOverlay {...styled({ className, style }, styles.overlay, stylexStyle)} {...props}>
      <AriaModal {...styled(undefined, styles.modal)}>{children}</AriaModal>
    </AriaModalOverlay>
  )
}

/** Dialog content wrapper */
export const ModalDialog = ({
  children,
  className,
  style,
  stylexStyle,
  ...props
}: ModalDialogProps) => {
  return (
    <AriaDialog {...styled({ className, style }, styles.dialog, stylexStyle)} {...props}>
      {children}
    </AriaDialog>
  )
}

/** Modal header section */
export const ModalHeader = ({ children, className, stylexStyle }: ModalHeaderProps) => {
  return <div {...styled(className, styles.header, stylexStyle)}>{children}</div>
}

/** Modal title */
export const ModalTitle = ({ children, className, stylexStyle }: ModalTitleProps) => {
  return (
    <AriaHeading slot="title" {...styled(className, styles.title, stylexStyle)}>
      {children}
    </AriaHeading>
  )
}

/** Modal description */
export const ModalDescription = ({ children, className, stylexStyle }: ModalDescriptionProps) => {
  return <p {...styled(className, styles.description, stylexStyle)}>{children}</p>
}

/** Modal content section */
export const ModalContent = ({ children, className, stylexStyle }: ModalContentProps) => {
  return <div {...styled(className, styles.content, stylexStyle)}>{children}</div>
}

/** Modal footer section */
export const ModalFooter = ({ children, className, stylexStyle }: ModalFooterProps) => {
  return <div {...styled(className, styles.footer, stylexStyle)}>{children}</div>
}
