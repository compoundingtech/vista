/**
 * Geist theme reconciliation for the wrapped `@pierre/diffs` +
 * `@pierre/trees` blocks.
 *
 * Both libraries render into custom elements. `@pierre/diffs` derives its
 * chrome from a registered Shiki theme, while `@pierre/trees` accepts CSS
 * custom properties on its host. Keeping both mappings here prevents either
 * library's blue-tinted default surfaces from leaking into Vista.
 */
import { registerCustomTheme, type ThemeRegistration } from '@pierre/diffs'
import { themeToTreeStyles, type TreeThemeStyles } from '@pierre/trees'
import { tokens } from '@vista/ui/tokens.stylex'

import type { Theme } from '../model.ts'

/** Geist roles consumed by Pierre's theme adapters. */
interface VistaPalette {
  readonly background: string
  readonly foreground: string
  readonly secondaryForeground: string
  readonly mutedForeground: string
  readonly border: string
  readonly hover: string
  readonly selected: string
  readonly focus: string
  readonly added: string
  readonly deleted: string
  readonly modified: string
  readonly syntaxAccent: string
  readonly syntaxString: string
}

const PALETTE: Record<Theme, VistaPalette> = {
  light: {
    background: tokens['--ds-background-100'],
    foreground: tokens['--ds-gray-1000'],
    secondaryForeground: tokens['--ds-gray-900'],
    mutedForeground: tokens['--ds-gray-700'],
    border: tokens['--ds-gray-alpha-400'],
    hover: tokens['--ds-gray-alpha-100'],
    selected: tokens['--ds-gray-alpha-200'],
    focus: tokens['--ds-blue-700'],
    added: tokens['--ds-green-700'],
    deleted: tokens['--ds-red-700'],
    modified: tokens['--ds-gray-900'],
    syntaxAccent: tokens['--ds-blue-800'],
    syntaxString: tokens['--ds-green-500'],
  },
  dark: {
    background: tokens['--ds-background-100'],
    foreground: tokens['--ds-gray-1000'],
    secondaryForeground: tokens['--ds-gray-900'],
    mutedForeground: tokens['--ds-gray-700'],
    border: tokens['--ds-gray-alpha-400'],
    hover: tokens['--ds-gray-alpha-100'],
    selected: tokens['--ds-gray-alpha-200'],
    focus: tokens['--ds-blue-700'],
    added: tokens['--ds-green-700'],
    deleted: tokens['--ds-red-700'],
    modified: tokens['--ds-gray-900'],
    syntaxAccent: tokens['--ds-blue-900'],
    syntaxString: tokens['--ds-green-900'],
  },
}

/** The Shiki theme names the kit registers; passed to the diff `theme` prop. */
export const VISTA_DIFF_THEMES = { light: 'vista-light', dark: 'vista-dark' } as const

/**
 * Chrome overrides that Pierre's Shiki adapter cannot express. Callers append
 * their layout-specific unsafe CSS to this shared color layer.
 */
export const VISTA_DIFF_UNSAFE_CSS = `
  :host {
    --diffs-addition-color-override: var(--ds-green-700);
    --diffs-deletion-color-override: var(--ds-red-700);
    --diffs-modified-color-override: var(--ds-blue-700);
    --diffs-fg-number-override: var(--ds-gray-700);
    --diffs-bg-context-override: var(--ds-background-100);
    --diffs-bg-context-gutter-override: var(--ds-background-100);
    --diffs-bg-buffer-override: var(--ds-background-200);
    --diffs-bg-separator-override: var(--ds-background-200);
    --diffs-bg-addition-emphasis-override: color-mix(
      in srgb,
      var(--ds-green-700) 28%,
      transparent
    );
    --diffs-bg-deletion-emphasis-override: color-mix(
      in srgb,
      var(--ds-red-700) 28%,
      transparent
    );
    --diffs-bg-selection-override: var(--ds-blue-700);
    --diffs-bg-selection-number-override: var(--ds-blue-700);
  }

  [data-line-type='change-addition'] {
    --diffs-computed-diff-line-bg: color-mix(
      in srgb,
      var(--ds-green-700) 12%,
      var(--ds-background-100)
    );
  }

  [data-line-type='change-deletion'] {
    --diffs-computed-diff-line-bg: color-mix(
      in srgb,
      var(--ds-red-700) 12%,
      var(--ds-background-100)
    );
  }

  :where([data-editor-overlay], [data-selected-line]) {
    --diffs-computed-selected-line-bg: color-mix(
      in srgb,
      var(--ds-blue-700) 16%,
      var(--ds-background-100)
    );
  }

  [data-diffs-header][data-sticky] {
    background-color: var(--ds-background-200);
    border-block-end: 1px solid var(--ds-gray-alpha-400);
  }
`

/** Selected rows need a shape cue in addition to their neutral background. */
export const VISTA_TREE_UNSAFE_CSS = `
  [data-type='item'][data-item-selected='true']::after {
    content: '';
    position: absolute;
    inset-block: 4px;
    inset-inline-start: 0;
    inline-size: 2px;
    border-radius: 2px;
    background-color: var(--ds-blue-700);
    pointer-events: none;
  }
`

/**
 * Build a neutral-canvas Shiki theme. Pierre reads the base editor colors and
 * git-decoration colors directly; syntax colors stay semantic and retain AA
 * contrast in the corresponding light or dark theme.
 */
const buildDiffTheme = (theme: Theme): ThemeRegistration => {
  const p = PALETTE[theme]
  return {
    name: VISTA_DIFF_THEMES[theme],
    type: theme,
    bg: p.background,
    fg: p.foreground,
    colors: {
      'editor.background': p.background,
      'editor.foreground': p.foreground,
      'editor.selectionBackground': `color-mix(in srgb, ${p.focus} 16%, ${p.background})`,
      'editor.lineHighlightBackground': p.hover,
      'editor.lineHighlightBorder': p.border,
      'editorLineNumber.foreground': p.mutedForeground,
      'editorGutter.background': p.background,
      'gitDecoration.addedResourceForeground': p.added,
      'gitDecoration.deletedResourceForeground': p.deleted,
      'gitDecoration.modifiedResourceForeground': p.focus,
      'terminal.ansiGreen': p.added,
      'terminal.ansiRed': p.deleted,
      'terminal.ansiBlue': p.focus,
    },
    tokenColors: [
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: p.secondaryForeground },
      },
      {
        scope: ['keyword', 'storage', 'storage.type'],
        settings: { foreground: p.syntaxAccent },
      },
      { scope: ['string'], settings: { foreground: p.syntaxString } },
    ],
  } satisfies ThemeRegistration
}

let registered = false

/**
 * Register the vista diff themes with @pierre's shared highlighter (idempotent).
 * Safe to call on every block render; the registry is global and keyed by name.
 */
export const ensureVistaDiffThemes = (): void => {
  if (registered) return
  registerCustomTheme(VISTA_DIFF_THEMES.light, () => Promise.resolve(buildDiffTheme('light')))
  registerCustomTheme(VISTA_DIFF_THEMES.dark, () => Promise.resolve(buildDiffTheme('dark')))
  registered = true
}

/**
 * Tree host styles, including every Pierre color override that otherwise falls
 * back to its blue-accented defaults.
 */
export const vistaTreeStyles = (theme: Theme): TreeThemeStyles => {
  const p = PALETTE[theme]
  const styles = themeToTreeStyles({
    type: theme,
    bg: p.background,
    fg: p.foreground,
    colors: {
      'editor.background': p.background,
      'editor.foreground': p.foreground,
      'editor.selectionBackground': p.selected,
      'sideBar.background': p.background,
      'sideBar.foreground': p.foreground,
      'sideBarSectionHeader.foreground': p.mutedForeground,
      'sideBar.border': p.border,
      'list.hoverBackground': p.hover,
      'list.activeSelectionBackground': p.selected,
      'list.activeSelectionForeground': p.foreground,
      'list.focusOutline': p.focus,
      'input.background': p.background,
      'input.border': p.border,
      'scrollbarSlider.background': p.border,
      'gitDecoration.addedResourceForeground': p.added,
      'gitDecoration.deletedResourceForeground': p.deleted,
      'gitDecoration.modifiedResourceForeground': p.modified,
      'gitDecoration.untrackedResourceForeground': p.added,
      'terminal.ansiGreen': p.added,
      'terminal.ansiRed': p.deleted,
      'terminal.ansiBlue': p.modified,
    },
  })

  return {
    ...styles,
    backgroundColor: p.background,
    color: p.foreground,
    borderColor: p.border,
    '--trees-accent-override': p.focus,
    '--trees-bg-override': p.background,
    '--trees-bg-muted-override': p.hover,
    '--trees-fg-override': p.foreground,
    '--trees-fg-muted-override': p.mutedForeground,
    '--trees-input-bg-override': p.background,
    '--trees-search-bg-override': p.background,
    '--trees-search-fg-override': p.foreground,
    '--trees-border-color-override': p.border,
    '--trees-indent-guide-bg-override': p.border,
    '--trees-scrollbar-thumb-override': p.border,
    '--trees-selected-bg-override': p.selected,
    '--trees-selected-fg-override': p.foreground,
    '--trees-focus-ring-color-override': p.focus,
    '--trees-selected-focused-border-color-override': p.focus,
    '--trees-status-added-override': p.added,
    '--trees-status-untracked-override': p.added,
    '--trees-status-deleted-override': p.deleted,
    '--trees-status-modified-override': p.modified,
    '--trees-status-renamed-override': p.secondaryForeground,
    '--trees-status-ignored-override': p.mutedForeground,
    '--trees-file-icon-color': p.mutedForeground,
    '--trees-file-icon-vermilion': p.mutedForeground,
    '--trees-file-icon-cyan': p.mutedForeground,
  }
}
