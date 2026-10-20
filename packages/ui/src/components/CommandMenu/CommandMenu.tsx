/**
 * CommandMenu component built on React Aria
 *
 * @see https://vercel.com/geist/command-menu
 */

import * as stylex from '@stylexjs/stylex'
import { useMemo, useState, type Key, type ReactNode } from 'react'
import {
  Dialog as AriaDialog,
  Header as AriaHeader,
  Input as AriaInput,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  Section as AriaSection,
  type ModalOverlayProps as AriaModalOverlayProps,
} from 'react-aria-components'

import { styled } from '../../foundations/props.ts'
import { scale, tokens } from '../../foundations/tokens.stylex.ts'

const styles = stylex.create({
  // The Tailwind baseline listed entering/exiting animation utilities, but the
  // package has no animation plugin and its emitted production CSS contains no
  // animate-in, fade or zoom rules. Preserve that inert behavior rather than
  // introducing motion as part of a styling migration.
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
    backgroundColor: 'rgb(0 0 0 / 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  modal: {
    width: '100%',
    maxWidth: '640px',
    backgroundColor: tokens['--ds-background-100'],
    borderRadius: '0.75rem',
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`,
    outlineStyle: 'none',
    overflow: 'hidden',
  },
  dialog: {
    outlineStyle: 'none',
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space3,
    height: scale.space12,
    paddingInline: scale.space4,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  searchIcon: {
    flexShrink: 0,
    width: scale.space5,
    height: scale.space5,
    color: tokens['--ds-gray-700'],
  },
  searchInput: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-1000'],
    fontSize: '1rem',
    lineHeight: '1.5rem',
    outlineStyle: 'none',
    '::placeholder': {
      color: tokens['--ds-gray-700'],
    },
  },
  listBox: {
    maxHeight: '400px',
    padding: scale.space2,
    overflow: 'auto',
    outlineStyle: 'none',
  },
  section: {
    marginBottom: scale.space2,
    ':last-child': {
      marginBottom: 0,
    },
  },
  sectionHeader: {
    paddingInline: scale.space2,
    paddingBlock: '0.375rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
    lineHeight: '1rem',
    fontWeight: 500,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space3,
    height: scale.space10,
    paddingInline: scale.space3,
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    borderRadius: scale.radiusLg,
    outlineStyle: 'none',
    backgroundColor: {
      default: null,
      ':is([data-focused])': tokens['--ds-gray-alpha-100'],
      ':is([data-hovered])': tokens['--ds-gray-alpha-100'],
    },
    cursor: {
      default: 'pointer',
      ':is([data-disabled])': 'not-allowed',
    },
    opacity: {
      default: 1,
      ':is([data-disabled])': 0.5,
    },
  },
  itemIcon: {
    flexShrink: 0,
    width: scale.space5,
    height: scale.space5,
    color: tokens['--ds-gray-900'],
  },
  itemContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    minWidth: 0,
  },
  itemLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemDescription: {
    overflow: 'hidden',
    color: tokens['--ds-gray-800'],
    fontSize: '0.75rem',
    lineHeight: '1rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemShortcut: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space1,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale.space5,
    minWidth: scale.space5,
    paddingInline: scale.space1,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-1000'],
    fontFamily: scale.fontSans,
    fontSize: '0.75rem',
    lineHeight: '1rem',
    borderRadius: scale.radiusSm,
    boxShadow: `0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBlock: scale.space12,
    textAlign: 'center',
  },
  emptyIcon: {
    width: '2.5rem',
    height: '2.5rem',
    marginBottom: scale.space3,
    color: tokens['--ds-gray-600'],
  },
  emptyTitle: {
    color: tokens['--ds-gray-1000'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
  },
  emptyDescription: {
    marginTop: scale.space1,
    color: tokens['--ds-gray-800'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '2.25rem',
    paddingInline: scale.space4,
    color: tokens['--ds-gray-800'],
    fontSize: '0.75rem',
    lineHeight: '1rem',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
  },
  footerHints: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space4,
  },
  footerHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
})

type OwnedStyle<TProperty extends string> = Record<TProperty, string>

type CommandMenuOwnedStyle = OwnedStyle<
  | 'position'
  | 'inset'
  | 'insetBlock'
  | 'insetBlockStart'
  | 'insetBlockEnd'
  | 'insetInline'
  | 'insetInlineStart'
  | 'insetInlineEnd'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'zIndex'
  | 'display'
  | 'alignItems'
  | 'justifyContent'
  | 'padding'
  | 'paddingBlock'
  | 'paddingBlockStart'
  | 'paddingInline'
  | 'paddingInlineStart'
  | 'paddingInlineEnd'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'background'
  | 'backgroundColor'
  | 'backdropFilter'
  | 'WebkitBackdropFilter'
>

export interface CommandItem {
  /** Unique identifier for the command */
  id: string
  /** Display label */
  label: string
  /** Optional description */
  description?: string
  /** Icon element */
  icon?: ReactNode
  /** Keyboard shortcut keys (e.g., ['Cmd', 'K']) */
  shortcut?: string[]
  /** Action to perform when selected */
  onSelect?: () => void
  /** Whether the item is disabled */
  disabled?: boolean
  /** Keywords for fuzzy search */
  keywords?: string[]
}

export interface CommandGroup {
  /** Unique identifier for the group */
  id: string
  /** Group header label */
  label: string
  /** Commands in this group */
  items: CommandItem[]
}

export interface CommandMenuProps extends Omit<
  AriaModalOverlayProps,
  'children' | 'className' | 'style'
> {
  /** Grouped commands to display */
  groups: CommandGroup[]
  /** Placeholder text for search input */
  placeholder?: string
  /** Empty state title when no results found */
  emptyTitle?: string
  /** Empty state description when no results found */
  emptyDescription?: string
  /** Show keyboard navigation hints in footer */
  showFooter?: boolean
  /** Callback when a command is selected */
  onSelect?: (item: CommandItem) => void
  /** Optional class name */
  className?: string
  /** Caller-last root adaptation. Component-owned overlay geometry and visuals are constrained. */
  style?: stylex.StyleXStylesWithout<CommandMenuOwnedStyle>
}

/** Simple fuzzy search - checks if query characters appear in order */
const fuzzyMatch = (text: string, query: string): boolean => {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  let queryIndex = 0
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++
    }
  }

  return queryIndex === lowerQuery.length
}

/** Filter groups and items based on search query */
const filterGroups = (groups: CommandGroup[], query: string): CommandGroup[] => {
  if (!query.trim()) return groups

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const searchableText = [item.label, item.description ?? '', ...(item.keywords ?? [])].join(
          ' ',
        )
        return fuzzyMatch(searchableText, query)
      }),
    }))
    .filter((group) => group.items.length > 0)
}

/** CommandMenu provides a searchable command palette interface */
export const CommandMenu = ({
  groups,
  placeholder = 'Search commands...',
  emptyTitle = 'No results found',
  emptyDescription = 'Try a different search term',
  showFooter = true,
  onSelect,
  className,
  style,
  ...props
}: CommandMenuProps) => {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredGroups = useMemo(() => filterGroups(groups, searchQuery), [groups, searchQuery])

  const hasResults = filteredGroups.some((group) => group.items.length > 0)

  const handleAction = (key: Key) => {
    for (const group of groups) {
      const item = group.items.find((i) => i.id === key)
      if (item) {
        item.onSelect?.()
        onSelect?.(item)
        break
      }
    }
  }

  return (
    <AriaModalOverlay {...styled(className, styles.overlay, style)} {...props}>
      <AriaModal {...styled(undefined, styles.modal)}>
        <AriaDialog {...styled(undefined, styles.dialog)} aria-label="Command menu">
          {({ close }) => (
            <>
              <div {...styled(undefined, styles.searchWrapper)}>
                <svg
                  {...styled(undefined, styles.searchIcon)}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  />
                </svg>
                <AriaInput
                  {...styled(undefined, styles.searchInput)}
                  placeholder={placeholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {hasResults ? (
                <AriaListBox
                  {...styled(undefined, styles.listBox)}
                  selectionMode="single"
                  onAction={(key) => {
                    handleAction(key)
                    close()
                  }}
                  aria-label="Commands"
                >
                  {filteredGroups.map((group) => (
                    <AriaSection key={group.id} {...styled(undefined, styles.section)}>
                      <AriaHeader {...styled(undefined, styles.sectionHeader)}>
                        {group.label}
                      </AriaHeader>
                      {group.items.map((item) => (
                        <AriaListBoxItem
                          {...styled(undefined, styles.item)}
                          key={item.id}
                          id={item.id}
                          isDisabled={item.disabled === true}
                          textValue={item.label}
                        >
                          {item.icon && (
                            <span {...styled(undefined, styles.itemIcon)}>{item.icon}</span>
                          )}
                          <div {...styled(undefined, styles.itemContent)}>
                            <div {...styled(undefined, styles.itemLabel)}>{item.label}</div>
                            {item.description && (
                              <div {...styled(undefined, styles.itemDescription)}>
                                {item.description}
                              </div>
                            )}
                          </div>
                          {item.shortcut && item.shortcut.length > 0 && (
                            <div {...styled(undefined, styles.itemShortcut)}>
                              {item.shortcut.map((key, index) => (
                                <kbd key={index} {...styled(undefined, styles.kbd)}>
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          )}
                        </AriaListBoxItem>
                      ))}
                    </AriaSection>
                  ))}
                </AriaListBox>
              ) : (
                <div {...styled(undefined, styles.emptyState)}>
                  <svg
                    {...styled(undefined, styles.emptyIcon)}
                    viewBox="0 0 40 40"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <circle cx="20" cy="20" r="16" strokeWidth="1.5" />
                    <path d="M14 16l12 8M26 16l-12 8" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <div {...styled(undefined, styles.emptyTitle)}>{emptyTitle}</div>
                  <div {...styled(undefined, styles.emptyDescription)}>{emptyDescription}</div>
                </div>
              )}

              {showFooter && (
                <div {...styled(undefined, styles.footer)}>
                  <div {...styled(undefined, styles.footerHints)}>
                    <span {...styled(undefined, styles.footerHint)}>
                      <kbd {...styled(undefined, styles.kbd)}>↑</kbd>
                      <kbd {...styled(undefined, styles.kbd)}>↓</kbd>
                      <span>Navigate</span>
                    </span>
                    <span {...styled(undefined, styles.footerHint)}>
                      <kbd {...styled(undefined, styles.kbd)}>↵</kbd>
                      <span>Select</span>
                    </span>
                    <span {...styled(undefined, styles.footerHint)}>
                      <kbd {...styled(undefined, styles.kbd)}>Esc</kbd>
                      <span>Close</span>
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </AriaDialog>
      </AriaModal>
    </AriaModalOverlay>
  )
}
