/**
 * Drawer component built on React Aria
 *
 * @see https://vercel.com/geist/drawer
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
  // The former animate/fade/slide utilities emitted no CSS because this package
  // has no animation plugin. The live duration/easing declarations remain, but
  // no motion is introduced by this migration.
  overlay: {
    boxSizing: 'border-box',
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    backgroundColor: 'rgb(0 0 0 / 0.35)',
    transitionDuration: '200ms',
  },
  modal: {
    boxSizing: 'border-box',
    position: 'fixed',
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    backgroundColor: tokens['--ds-background-100'],
    borderTopLeftRadius: '0.75rem',
    borderTopRightRadius: '0.75rem',
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 -8px 30px rgb(0 0 0 / 0.12), 0 -4px 12px rgb(0 0 0 / 0.08)`,
    outlineStyle: 'none',
    transitionDuration: '300ms',
    transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
  },
  dialog: {
    boxSizing: 'border-box',
    maxHeight: '85vh',
    overflowY: 'auto',
    outlineStyle: 'none',
  },
  header: {
    boxSizing: 'border-box',
    paddingTop: scale.space8,
    paddingRight: scale.space12,
    paddingBottom: scale.space4,
    paddingLeft: scale.space12,
  },
  title: {
    boxSizing: 'border-box',
    margin: 0,
    color: tokens['--ds-gray-1000'],
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: 600,
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
    paddingRight: scale.space12,
    paddingBottom: scale.space12,
    paddingLeft: scale.space12,
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  handle: {
    boxSizing: 'border-box',
    width: scale.space12,
    height: '0.375rem',
    marginTop: scale.space3,
    marginRight: 'auto',
    marginBottom: scale.space2,
    marginLeft: 'auto',
    backgroundColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusFull,
  },
})

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type DrawerOverlayOwnedStyle = OwnedStyle<
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
  | 'transition'
  | 'transitionDuration'
>

type DrawerDialogOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'maxHeight'
  | 'overflow'
  | 'overflowX'
  | 'overflowY'
  | 'overflowBlock'
  | 'maxBlockSize'
  | 'outline'
  | 'outlineWidth'
  | 'outlineStyle'
  | 'outlineColor'
  | 'outlineOffset'
>

type DrawerHeaderOwnedStyle = OwnedStyle<
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

type DrawerTitleOwnedStyle = OwnedStyle<
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

type DrawerDescriptionOwnedStyle = OwnedStyle<
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

type DrawerContentOwnedStyle = OwnedStyle<
  | 'boxSizing'
  | 'padding'
  | 'paddingBlock'
  | 'paddingBlockEnd'
  | 'paddingInline'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingRight'
  | 'paddingBlockStart'
  | 'paddingTop'
  | 'paddingStart'
  | 'paddingEnd'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'color'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
>

export interface DrawerProps extends Omit<AriaModalOverlayProps, 'children'> {
  /** Drawer content */
  children: ReactNode
  /** Caller-last overlay adaptation. Component-owned overlay geometry is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<DrawerOverlayOwnedStyle>
}

export interface DrawerDialogProps extends Omit<AriaDialogProps, 'children'> {
  /** Dialog content */
  children: ReactNode
  /** Caller-last dialog adaptation. Component-owned overflow is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<DrawerDialogOwnedStyle>
}

export interface DrawerTriggerProps extends AriaDialogTriggerProps {
  /** Trigger element and drawer */
  children: ReactNode
}

export interface DrawerHeaderProps {
  /** Header content */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last header adaptation. Component-owned spacing is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<DrawerHeaderOwnedStyle>
}

export interface DrawerTitleProps {
  /** Title text */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last title adaptation. Component-owned typography is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<DrawerTitleOwnedStyle>
}

export interface DrawerDescriptionProps {
  /** Description text */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last description adaptation. Component-owned typography is constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<DrawerDescriptionOwnedStyle>
}

export interface DrawerContentProps {
  /** Content */
  children: ReactNode
  /** Optional class name */
  className?: string
  /** Caller-last content adaptation. Component-owned spacing and typography are constrained. */
  stylexStyle?: stylex.StyleXStylesWithout<DrawerContentOwnedStyle>
}

/** Trigger container for opening the drawer */
export const DrawerTrigger = ({ children, ...props }: DrawerTriggerProps) => {
  return <AriaDialogTrigger {...props}>{children}</AriaDialogTrigger>
}

/** Drawer overlay and container */
export const Drawer = ({ children, className, style, stylexStyle, ...props }: DrawerProps) => {
  return (
    <AriaModalOverlay {...styled({ className, style }, styles.overlay, stylexStyle)} {...props}>
      <AriaModal {...styled(undefined, styles.modal)}>
        <div {...styled(undefined, styles.handle)} />
        {children}
      </AriaModal>
    </AriaModalOverlay>
  )
}

/** Dialog content wrapper */
export const DrawerDialog = ({
  children,
  className,
  style,
  stylexStyle,
  ...props
}: DrawerDialogProps) => {
  return (
    <AriaDialog {...styled({ className, style }, styles.dialog, stylexStyle)} {...props}>
      {children}
    </AriaDialog>
  )
}

/** Drawer header section */
export const DrawerHeader = ({ children, className, stylexStyle }: DrawerHeaderProps) => {
  return <div {...styled(className, styles.header, stylexStyle)}>{children}</div>
}

/** Drawer title */
export const DrawerTitle = ({ children, className, stylexStyle }: DrawerTitleProps) => {
  return (
    <AriaHeading slot="title" {...styled(className, styles.title, stylexStyle)}>
      {children}
    </AriaHeading>
  )
}

/** Drawer description */
export const DrawerDescription = ({ children, className, stylexStyle }: DrawerDescriptionProps) => {
  return <p {...styled(className, styles.description, stylexStyle)}>{children}</p>
}

/** Drawer content section */
export const DrawerContent = ({ children, className, stylexStyle }: DrawerContentProps) => {
  return <div {...styled(className, styles.content, stylexStyle)}>{children}</div>
}
