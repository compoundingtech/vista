import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { AppShellHeader } from '../src/AppShell.tsx'

test.each(['hover', 'keyboard focus', 'press'])(
  'the owner tooltip shows the exact identity on %s',
  async (interaction) => {
    const owner = 'agent/dotfiles/ui-design'
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      flushSync(() => {
        root.render(
          <AppShellHeader
            title="Owner byline"
            owner={owner}
            theme="light"
            onThemeChange={() => undefined}
          />,
        )
      })
      const byline = page.getByRole('button', { name: `Owner: ${owner}` })
      await expect.element(page.getByRole('tooltip')).not.toBeInTheDocument()

      if (interaction === 'keyboard focus') {
        await userEvent.tab() // Vista home
        await userEvent.tab() // Owner byline
        await expect.element(byline).toHaveFocus()
      } else if (interaction === 'hover') {
        const pointerEvents: { type: string; trusted: boolean; target: string | null }[] = []
        const recordPointer = (event: PointerEvent) => {
          pointerEvents.push({
            type: event.type,
            trusted: event.isTrusted,
            target:
              event.target instanceof Element ? event.target.getAttribute('aria-label') : null,
          })
        }
        document.addEventListener('pointerover', recordPointer, true)
        document.addEventListener('pointermove', recordPointer, true)
        try {
          // React Aria establishes pointer modality on pointermove, after the first pointerover.
          // Move from another real target rather than entering the trigger as the first interaction.
          await userEvent.hover(page.getByRole('link', { name: 'Vista home' }))
          await userEvent.hover(byline)
          expect(pointerEvents).toContainEqual({
            type: 'pointerover',
            trusted: true,
            target: `Owner: ${owner}`,
          })
          console.info('Owner tooltip real-pointer evidence:', JSON.stringify(pointerEvents))
        } finally {
          document.removeEventListener('pointerover', recordPointer, true)
          document.removeEventListener('pointermove', recordPointer, true)
        }
      } else {
        await userEvent.click(byline)
      }
      await expect.element(page.getByRole('tooltip')).toHaveTextContent(owner)
      await expect.element(page.getByRole('tooltip')).toBeVisible()
    } finally {
      flushSync(() => root.unmount())
      host.remove()
    }
  },
)
