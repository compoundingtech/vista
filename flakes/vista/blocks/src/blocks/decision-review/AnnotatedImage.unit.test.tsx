import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import {
  AnnotatedImage,
  imageAsset,
  type AnnotatedImageProps,
  type ImageAsset,
} from './AnnotatedImage.tsx'

const props: AnnotatedImageProps = {
  src: imageAsset('/assets/review.png'),
  alt: 'Measured response times',
  width: 1200,
  height: 800,
  annotations: [
    { id: 'first', label: 'Baseline result', anchor: { x: 0, y: 0 } },
    { id: 'second', label: 'Candidate result', anchor: { x: 1, y: 1 } },
  ],
  caption: 'Recorded comparison',
}

interface ElementProps {
  readonly children?: React.ReactNode
  readonly 'data-vista-image-box'?: string
  readonly 'data-vista-image-gutter'?: string
  readonly 'data-vista-image-asset'?: string
  readonly onError?: () => void
  readonly onLoad?: (event: {
    readonly currentTarget: Pick<HTMLImageElement, 'decode' | 'naturalWidth' | 'naturalHeight'>
  }) => Promise<void>
}

const findElement = (
  root: React.ReactNode,
  predicate: (element: React.ReactElement<ElementProps>) => boolean,
): React.ReactElement<ElementProps> => {
  for (const child of React.Children.toArray(root)) {
    if (!React.isValidElement<ElementProps>(child)) continue
    if (predicate(child)) return child
    if (child.props.children !== undefined) {
      try {
        return findElement(child.props.children, predicate)
      } catch {
        // This branch contains no matching element; inspect its siblings.
      }
    }
  }
  throw new Error('Expected element was not rendered')
}

const imageElement = (component: AnnotatedImage) =>
  findElement(
    component.render(),
    (element) => element.props['data-vista-image-asset'] !== undefined,
  )

const mountedComponent = () => {
  const component = new AnnotatedImage(props)
  // A unit test exercises native image callbacks without a DOM renderer; only
  // React's mount-owned updater and the browser decoder need substitution.
  vi.spyOn(component, 'setState').mockImplementation((update) => {
    const next = typeof update === 'function' ? update(component.state, component.props) : update
    if (next !== null) component.state = { ...component.state, ...next }
  })
  return component
}

const markup = (component: AnnotatedImage) => renderToStaticMarkup(component.render())

describe('AnnotatedImage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('normalizes Vite relative-base imports to a same-origin asset path', () => {
    vi.stubGlobal('location', new URL('https://vista.example/reviews/storybook/iframe.html'))
    const importedUrl = new URL(
      './review.svg?version=1#detail',
      'https://vista.example/reviews/storybook/assets/story.js',
    ).href
    const asset = imageAsset(importedUrl)
    expect(asset.url).toBe('/reviews/storybook/assets/review.svg?version=1#detail')
    expect(renderToStaticMarkup(<AnnotatedImage {...props} src={asset} />)).toContain(
      'src="/reviews/storybook/assets/review.svg?version=1#detail"',
    )
  })

  it.each([
    'https://elsewhere.example/review.svg',
    'https://vista.example.evil/review.svg',
    'http://vista.example/review.svg',
    'https://vista.example:8443/review.svg',
    'https://user:password@vista.example/review.svg',
    'https://vista.example//elsewhere.example/review.svg',
    'https://vista.example/review with spaces.svg',
    'data:image/png;base64,broken',
    'blob:https://vista.example/image',
    '//vista.example/review.svg',
  ])('preserves local-only image validation in a browser: %s', (url) => {
    vi.stubGlobal('location', new URL('https://vista.example/reviews/storybook/iframe.html'))
    expect(() => imageAsset(url)).toThrow('local imported image asset URL')
  })

  it('rejects absolute URLs without a browser origin to establish locality', () => {
    vi.stubGlobal('location', undefined)
    expect(() => imageAsset('https://vista.example/review.svg')).toThrow(
      'local imported image asset URL',
    )
  })

  it('keeps every label in a sibling gutter, never inside the image box', () => {
    const component = new AnnotatedImage(props)
    const tree = component.render()
    const box = findElement(tree, (element) => element.props['data-vista-image-box'] !== undefined)
    const gutter = findElement(
      tree,
      (element) => element.props['data-vista-image-gutter'] !== undefined,
    )
    const imageHtml = renderToStaticMarkup(box)
    const gutterHtml = renderToStaticMarkup(gutter)

    for (const { label } of props.annotations) {
      expect(imageHtml).not.toContain(label)
      expect(gutterHtml).toContain(label)
    }
    expect(imageHtml).toContain('aria-hidden="true"')
    expect(gutterHtml).toContain('aria-label="Image annotations"')
    expect(markup(component)).toContain('<figcaption')
  })

  it('offers an accessible icon over the clickable image, not a text label beneath it', () => {
    const component = new AnnotatedImage(props)
    const html = markup(component)
    const box = findElement(
      component.render(),
      (element) => element.props['data-vista-image-box'] !== undefined,
    )
    const imageHtml = renderToStaticMarkup(box)
    expect(imageHtml).toContain('aria-label="View at natural size"')
    expect(imageHtml).toMatch(/<button[^>]*><span[^>]*aria-hidden="true"[^>]*><svg/)
    expect(html).not.toContain('>View at natural size<')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).not.toContain('<a ')
    expect(html).not.toMatch(/(?:href|src)="(?:data|blob):/i)
    expect(html).toContain('width="1200" height="800"')
  })

  it.each([
    'data:image/png;base64,broken',
    'blob:https://example.com/image',
    'https://example.com/image.png',
    '//example.com/image.png',
    '/\\example.com/image.png',
    ' data:image/png,broken',
  ])('rejects unsafe image URLs: %s', (url) => {
    expect(() => imageAsset(url)).toThrow('local imported image asset URL')
  })

  it('requires a typed asset reference rather than a raw string', () => {
    expectTypeOf<string>().not.toExtend<ImageAsset>()
    expectTypeOf<AnnotatedImageProps['src']>().toEqualTypeOf<ImageAsset>()
  })

  it('surfaces a missing image as a visible error and disables natural-size viewing', () => {
    const component = mountedComponent()
    imageElement(component).props.onError?.()
    const html = markup(component)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Image could not be loaded or decoded.')
    expect(html).toContain('disabled=""')
    expect(html).toContain('data-vista-image-asset=""')
  })

  it('surfaces a corrupt image when browser decode rejects', async () => {
    const component = mountedComponent()
    const decode = vi.fn(async () => {
      throw new Error('Corrupt image')
    })
    await imageElement(component).props.onLoad?.({
      currentTarget: { decode, naturalWidth: 1200, naturalHeight: 800 },
    })
    expect(decode).toHaveBeenCalledOnce()
    expect(markup(component)).toContain('role="alert"')
  })

  it('rejects a decoded image with no intrinsic dimensions', async () => {
    const component = mountedComponent()
    await imageElement(component).props.onLoad?.({
      currentTarget: { decode: async () => {}, naturalWidth: 0, naturalHeight: 0 },
    })
    expect(markup(component)).toContain('role="alert"')
  })

  it('accepts a decoded image and retains its external annotations', async () => {
    const component = mountedComponent()
    await imageElement(component).props.onLoad?.({
      currentTarget: { decode: async () => {}, naturalWidth: 1200, naturalHeight: 800 },
    })
    expect(component.state.status).toBe('ready')
    expect(markup(component)).not.toContain('role="alert"')
    expect(markup(component)).toContain('Baseline result')
  })

  it('does not apply a stale image error to a replacement asset', () => {
    const component = mountedComponent()
    const previousImage = imageElement(component)
    component.state = { source: '/assets/replacement.png', status: 'loading' }
    previousImage.props.onError?.()
    expect(component.state.status).toBe('loading')
    expect(AnnotatedImage.getDerivedStateFromProps(props, component.state)).toEqual({
      source: props.src.url,
      status: 'loading',
    })
  })

  it.each([Number.NaN, -0.1, 1.1])('rejects anchors outside the image-relative range: %s', (x) => {
    expect(() =>
      renderToStaticMarkup(
        <AnnotatedImage
          {...props}
          annotations={[{ id: 'outside', label: 'Outside', anchor: { x, y: 0.5 } }]}
        />,
      ),
    ).toThrow('between 0 and 1')
  })

  it('requires valid intrinsic image dimensions', () => {
    expect(() => renderToStaticMarkup(<AnnotatedImage {...props} width={0} />)).toThrow(
      'positive intrinsic pixel dimensions',
    )
  })
})
