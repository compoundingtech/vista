import type { StyleXStylesWithout } from '@stylexjs/stylex'
import * as stylex from '@stylexjs/stylex'
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Radio,
  RadioGroup,
  Select,
} from 'react-aria-components'

import { colorScheme, lightTheme } from '@vista/ui/foundations'
import { tokens } from '@vista/ui/tokens.stylex'

/**
 * Props for the theme switcher: the current light/dark value, an optional compact mode, caller
 * styling, and the change callback.
 */
export interface ShellThemeSwitcherProps {
  readonly style?: StyleXStylesWithout<{ position: 'absolute' }>
  readonly value: 'light' | 'dark'
  readonly compact?: boolean
  readonly onChange: (theme: 'light' | 'dark') => void
}

const sunIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="2.75" stroke="currentColor" strokeWidth="1.25" />
    <path
      d="M8 1.25v1.5M8 13.25v1.5M1.25 8h1.5M13.25 8h1.5M3.23 3.23l1.06 1.06M11.71 11.71l1.06 1.06M12.77 3.23l-1.06 1.06M4.29 11.71l-1.06 1.06"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
  </svg>
)

const moonIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <path
      d="M13.5 10.2A5.75 5.75 0 0 1 5.8 2.5a5.75 5.75 0 1 0 7.7 7.7Z"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
  </svg>
)

const ShellThemeSwitcher = ({
  style,
  value,
  onChange,
  compact = false,
}: ShellThemeSwitcherProps) => {
  if (compact) {
    return (
      <Select
        {...stylex.props(styles.compactRoot, style)}
        selectedKey={value}
        onSelectionChange={(key) => {
          if (key !== null) onChange(key === 'dark' ? 'dark' : 'light')
        }}
        aria-label="Theme"
      >
        <Button
          aria-label={`Theme: ${value === 'dark' ? 'Dark' : 'Light'}`}
          className={({ isHovered, isFocusVisible, isPressed }) =>
            stylex.props(
              styles.iconButton,
              isHovered && styles.iconButtonHovered,
              isPressed && styles.iconButtonPressed,
              isFocusVisible && styles.optionFocused,
            ).className ?? ''
          }
        >
          {value === 'dark' ? moonIcon : sunIcon}
        </Button>
        <Popover
          {...stylex.props(styles.popover, value === 'light' && lightTheme, colorScheme[value])}
          placement="bottom end"
        >
          <ListBox {...stylex.props(styles.listBox)} aria-label="Theme">
            <ListBoxItem
              id="light"
              textValue="Light"
              className={({ isHovered, isSelected, isFocusVisible }) =>
                stylex.props(
                  styles.item,
                  isHovered && styles.itemHovered,
                  isSelected && styles.itemSelected,
                  isFocusVisible && styles.itemFocused,
                ).className ?? ''
              }
            >
              {sunIcon}
              <span>Light</span>
            </ListBoxItem>
            <ListBoxItem
              id="dark"
              textValue="Dark"
              className={({ isHovered, isSelected, isFocusVisible }) =>
                stylex.props(
                  styles.item,
                  isHovered && styles.itemHovered,
                  isSelected && styles.itemSelected,
                  isFocusVisible && styles.itemFocused,
                ).className ?? ''
              }
            >
              {moonIcon}
              <span>Dark</span>
            </ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
    )
  }

  return (
    <RadioGroup
      {...stylex.props(styles.root, style)}
      value={value}
      onChange={(next) => onChange(next === 'dark' ? 'dark' : 'light')}
      orientation="horizontal"
      aria-label="Theme"
    >
      {(['light', 'dark'] as const).map((theme) => (
        <Radio
          key={theme}
          value={theme}
          className={({ isSelected, isHovered, isFocusVisible, isPressed }) =>
            stylex.props(
              styles.option,
              isHovered && styles.optionHovered,
              isPressed && styles.optionPressed,
              isSelected && styles.optionSelected,
              isFocusVisible && styles.optionFocused,
            ).className ?? ''
          }
          aria-label={`${theme === 'light' ? 'Light' : 'Dark'} theme`}
        >
          <span {...stylex.props(styles.optionText)}>{theme === 'light' ? 'Light' : 'Dark'}</span>
        </Radio>
      ))}
    </RadioGroup>
  )
}

export default ShellThemeSwitcher

const styles = stylex.create({
  root: {
    display: 'inline-flex',
    flex: 'none',
    gap: '0.125rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '0.375rem',
    backgroundColor: tokens['--ds-background-200'],
    padding: '0.125rem',
  },
  option: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '1.625rem',
    borderRadius: '0.25rem',
    color: tokens['--ds-gray-800'],
    cursor: 'pointer',
    fontSize: '0.72rem',
    lineHeight: 1,
    paddingBlock: '0.3rem',
    paddingInline: '0.5rem',
    outline: 'none',
    userSelect: 'none',
  },
  optionHovered: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
    color: tokens['--ds-foreground'],
  },
  optionPressed: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  optionSelected: {
    backgroundColor: tokens['--ds-foreground'],
    color: tokens['--ds-background-100'],
  },
  optionFocused: {
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
  optionText: {
    fontWeight: 550,
  },
  compactRoot: {
    display: 'inline-flex',
    flex: 'none',
  },
  iconButton: {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2rem',
    height: '2rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '0.375rem',
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    padding: 0,
    outline: 'none',
  },
  iconButtonHovered: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
    color: tokens['--ds-foreground'],
  },
  iconButtonPressed: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
  },
  popover: {
    minWidth: '8rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '0.5rem',
    backgroundColor: tokens['--ds-background-200'],
    boxShadow: tokens['--ds-shadow-medium'],
    overflow: 'hidden',
  },
  listBox: {
    padding: '0.25rem',
    outline: 'none',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderRadius: '0.3rem',
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    fontSize: '0.75rem',
    paddingBlock: '0.45rem',
    paddingInline: '0.55rem',
    outline: 'none',
  },
  itemHovered: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
    color: tokens['--ds-foreground'],
  },
  itemSelected: {
    backgroundColor: tokens['--ds-gray-alpha-200'],
    color: tokens['--ds-foreground'],
    fontWeight: 600,
  },
  itemFocused: {
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: -2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  },
})
