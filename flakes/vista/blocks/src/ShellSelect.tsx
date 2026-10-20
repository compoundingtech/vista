import type { StyleXStylesWithout } from '@stylexjs/stylex'
import * as stylex from '@stylexjs/stylex'
import { Button, ListBox, ListBoxItem, Popover, Select } from 'react-aria-components'

import { colorScheme, lightTheme } from '@vista/ui/foundations'
import { tokens } from '@vista/ui/tokens.stylex'

const chevronIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false">
    <path
      d="m4 6 4 4 4-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * One selectable row in the version control, carrying display fields like number, title, relative
 * time, publisher, alias, and a newness flag.
 */
export interface ShellVersionItem {
  readonly id: string
  readonly number: string
  readonly title?: string
  readonly relativeTime?: string
  readonly publisher?: string
  readonly reason?: string
  readonly alias?: 'latest' | 'draft'
  readonly isNew?: boolean
}

/** Determines how the version control groups its items: by document, by version, or by provenance. */
export type ShellVersionHierarchy = 'document' | 'version' | 'provenance'

/**
 * Props for the version control component: the selected key, change callback, items, theme,
 * grouping hierarchy, new-version hint, and caller-provided outer styles.
 */
export interface ShellVersionControlProps {
  readonly selectedKey: string
  readonly onSelectionChange: (key: string) => void
  readonly items: readonly ShellVersionItem[]
  readonly theme: 'light' | 'dark'
  readonly hierarchy: ShellVersionHierarchy
  readonly newVersionAvailable?: boolean
  readonly style?: StyleXStylesWithout<{
    maxWidth: '100%'
    minWidth: 0
  }>
}

/** Unified version identity and history control used by the production shell header. */
export const ShellVersionControl = ({
  selectedKey,
  onSelectionChange,
  items,
  theme,
  hierarchy,
  newVersionAvailable = false,
  style,
}: ShellVersionControlProps) => {
  const selected = items.find((item) => item.id === selectedKey) ?? items[0]
  if (selected === undefined) return null
  const primary = selected.title ?? selected.number
  const secondary = [selected.number, selected.relativeTime]
    .filter((value) => value !== undefined)
    .join(' · ')
  const selectedIsLatest = selected.id === 'latest'

  return (
    <Select
      {...stylex.props(styles.versionRoot, style)}
      selectedKey={selected.id}
      onSelectionChange={(key) => {
        if (key !== null) onSelectionChange(String(key))
      }}
      aria-label="Vista version"
      data-vista-version-control=""
      data-vista-version-hierarchy={hierarchy}
    >
      <Button
        className={({ isHovered, isFocusVisible, isPressed }) =>
          stylex.props(
            styles.versionTrigger,
            hierarchy === 'document' && styles.versionTriggerDocument,
            hierarchy === 'version' && styles.versionTriggerVersion,
            hierarchy === 'provenance' && styles.versionTriggerProvenance,
            isHovered && styles.triggerHovered,
            isPressed && styles.triggerPressed,
            isFocusVisible && styles.focused,
          ).className ?? ''
        }
      >
        <span {...stylex.props(styles.versionIdentity)}>
          <span {...stylex.props(styles.versionPrimary)}>{primary}</span>
          {secondary === undefined || secondary === '' ? null : (
            <span {...stylex.props(styles.versionSecondary)} data-vista-version-secondary="">
              {secondary}
            </span>
          )}
        </span>
        {selectedIsLatest ? (
          <span {...stylex.props(styles.newBadge)} aria-label="Currently viewing latest version">
            Latest
          </span>
        ) : null}
        {newVersionAvailable ? (
          <span {...stylex.props(styles.newBadge)} aria-label="New version available">
            New
          </span>
        ) : null}
        <span {...stylex.props(styles.chevron)}>{chevronIcon}</span>
      </Button>
      <Popover
        {...stylex.props(
          styles.versionPopover,
          theme === 'light' && lightTheme,
          colorScheme[theme],
        )}
        placement="bottom start"
      >
        <ListBox {...stylex.props(styles.listBox)} items={items}>
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={[item.number, item.title].filter((value) => value !== undefined).join(' ')}
              className={({ isHovered, isSelected, isFocusVisible }) =>
                stylex.props(
                  styles.versionItem,
                  isHovered && styles.itemHovered,
                  isSelected && styles.itemSelected,
                  isFocusVisible && styles.itemFocused,
                ).className ?? ''
              }
            >
              <span {...stylex.props(styles.versionItemHeading)}>
                <span {...stylex.props(styles.versionNumber)}>{item.number}</span>
                {item.title === undefined ? null : (
                  <span {...stylex.props(styles.versionItemTitle)}>{item.title}</span>
                )}
                {item.alias === 'latest' ? (
                  <span {...stylex.props(styles.newBadge)}>Latest</span>
                ) : null}
                {item.alias === 'draft' ? (
                  <span {...stylex.props(styles.newBadge)}>Draft</span>
                ) : null}
                {item.isNew ? <span {...stylex.props(styles.newBadge)}>New</span> : null}
              </span>
              {item.publisher === undefined && item.relativeTime === undefined ? null : (
                <span {...stylex.props(styles.versionItemMeta)}>
                  {[item.publisher, item.relativeTime]
                    .filter((value) => value !== undefined)
                    .join(' · ')}
                </span>
              )}
              {item.reason === undefined ? null : (
                <span {...stylex.props(styles.versionItemReason)}>{item.reason}</span>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  )
}

const styles = stylex.create({
  triggerHovered: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
    borderColor: tokens['--ds-gray-alpha-500'],
  },
  triggerPressed: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  focused: {
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  chevron: {
    display: 'block',
    flex: 'none',
    width: '1rem',
    height: '1rem',
    color: tokens['--ds-gray-800'],
  },
  listBox: {
    maxHeight: '18rem',
    overflowY: 'auto',
    padding: '0.25rem',
    outline: 'none',
  },
  itemHovered: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  itemSelected: {
    backgroundColor: 'color-mix(in srgb, var(--ds-blue-700) 12%, var(--ds-background-200))',
  },
  itemFocused: {
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: -2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  versionRoot: {
    display: 'inline-flex',
    flex: '0 1 auto',
    minWidth: 0,
    maxWidth: '100%',
  },
  versionTrigger: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
    height: '2rem',
    gap: '0.5rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '0.375rem',
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    cursor: 'pointer',
    font: 'inherit',
    paddingBlock: '0.25rem',
    paddingInline: '0.625rem',
    outline: 'none',
  },
  versionTriggerDocument: {
    maxWidth: '17rem',
  },
  versionTriggerVersion: {
    maxWidth: '20rem',
  },
  versionTriggerProvenance: {
    maxWidth: '24rem',
  },
  versionIdentity: {
    display: 'flex',
    flex: '1 1 auto',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '0.1rem',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  versionPrimary: {
    flex: '1 1 auto',
    minWidth: 0,
    color: tokens['--ds-foreground'],
    fontSize: '0.78rem',
    fontWeight: 600,
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  versionSecondary: {
    minWidth: 0,
    color: tokens['--ds-gray-900'],
    fontSize: '0.7rem',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: {
      default: 'block',
      '@media (max-width: 42rem)': 'none',
    },
  },
  newBadge: {
    flex: 'none',
    borderRadius: '999px',
    backgroundColor: tokens['--ds-amber-300'],
    color: tokens['--ds-amber-900'],
    fontSize: '0.625rem',
    fontWeight: 600,
    lineHeight: 1,
    paddingBlock: '0.2rem',
    paddingInline: '0.35rem',
  },
  versionPopover: {
    width: 'min(26rem, calc(100vw - 2rem))',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '0.5rem',
    backgroundColor: tokens['--ds-background-200'],
    boxShadow: tokens['--ds-shadow-medium'],
    overflow: 'hidden',
  },
  versionItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    borderRadius: '0.3rem',
    cursor: 'pointer',
    paddingBlock: '0.55rem',
    paddingInline: '0.625rem',
    outline: 'none',
  },
  versionItemHeading: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    minWidth: 0,
  },
  versionNumber: {
    flex: 'none',
    color: tokens['--ds-foreground'],
    fontSize: '0.75rem',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  versionItemTitle: {
    minWidth: 0,
    color: tokens['--ds-foreground'],
    fontSize: '0.78rem',
    fontWeight: 550,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  versionItemMeta: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.68rem',
  },
  versionItemReason: {
    color: tokens['--ds-gray-1000'],
    fontSize: '0.7rem',
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
  },
})
