import { composeStories } from '@storybook/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import * as stories from './LivePty.stories.tsx'

const { AttachEnabled, ReadOnly } = composeStories(stories)

describe('LivePty stories', () => {
  it('renders the read-only provenance without an attach control', () => {
    const html = renderToStaticMarkup(<ReadOnly />)

    expect(html).toContain('Read-only · no trusted actor source')
    expect(html).not.toContain('>Attach<')
  })

  it('renders attach only when a trusted actor source is configured', () => {
    const html = renderToStaticMarkup(<AttachEnabled />)

    expect(html).toContain('>Attach<')
    expect(html).toContain('attach available via loopback-dev')
  })
})
