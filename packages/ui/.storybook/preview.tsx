import type { Decorator, Preview } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { setTheme, type Theme } from '../src/foundations/theme.ts'
import { scale, tokens } from '../src/foundations/tokens.stylex.ts'
import '../src/foundations/styles.css'
import { resetStoryCapturePointer } from '../stories/story-interactions.ts'

const styles = stylex.create({
  frame: {
    padding: '1rem',
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontSans,
  },
})

const isTheme = (value: unknown): value is Exclude<Theme, 'system'> =>
  value === 'light' || value === 'dark'

/**
 * Applies the scheme through the design system's own `setTheme`, rather than
 * reproducing whatever mechanism it currently uses. That keeps the story gate
 * honest across the token migration: the same decorator exercises the attribute
 * switch before the move and the theme class after it, so a broken switch shows
 * up as a visual regression instead of being papered over by the harness.
 */
const withTheme: Decorator = (Story, context) => {
  setTheme(isTheme(context.globals.theme) ? context.globals.theme : 'dark')

  return (
    <div {...stylex.props(styles.frame)}>
      <Story />
    </div>
  )
}

const preview: Preview = {
  afterEach: resetStoryCapturePointer,
  decorators: [withTheme],
  initialGlobals: { theme: 'dark' },
  globalTypes: {
    theme: {
      description: 'Colour scheme',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
