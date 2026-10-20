import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { colorScheme, lightTheme } from '@vista/ui/foundations'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import { Button, Dialog, DialogTrigger, Modal, ModalOverlay } from 'react-aria-components'

import { useTheme } from '../../theme.ts'

const imageAssetBrand: unique symbol = Symbol('Vista.ImageAsset')

/** Validated local image URL accepted by annotated evidence visuals. */
export type ImageAsset = {
  readonly [imageAssetBrand]: true
  readonly url: string
}

const validateAssetUrl = (url: string): void => {
  if (
    url.length === 0 ||
    /[\s\\]/.test(url) ||
    url.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(url) ||
    url.startsWith('#')
  ) {
    throw new TypeError(
      'AnnotatedImage requires a local imported image asset URL, not a data:, blob:, or remote URL.',
    )
  }
}

/** Wrap an imported local image URL, retaining a path even with Vite's relative build base. */
export const imageAsset = (url: string): ImageAsset => {
  // Relative-base bundles emit imports as new URL(asset, import.meta.url).href.
  // Strip only this browser's origin; the stored asset contract remains path-only.
  if (typeof location !== 'undefined' && /^https?:\/\//i.test(url) && !/[\s\\]/.test(url)) {
    const asset = new URL(url)
    if (asset.origin === location.origin && asset.username === '' && asset.password === '') {
      url = `${asset.pathname}${asset.search}${asset.hash}`
    }
  }
  validateAssetUrl(url)
  return { [imageAssetBrand]: true, url }
}

/** Named image-relative point highlighted in the annotation overlay. */
export interface ImageAnnotation {
  readonly id: string
  readonly label: string
  /** Image-relative coordinates, each between 0 and 1. */
  readonly anchor: { readonly x: number; readonly y: number }
}

/** Intrinsic image dimensions, accessible text and labeled annotation anchors. */
export interface AnnotatedImageProps {
  readonly src: ImageAsset
  readonly alt: string
  readonly width: number
  readonly height: number
  readonly annotations: readonly ImageAnnotation[]
  readonly caption?: string | undefined
  readonly style?: StyleXStylesWithout<{ maxWidth: '100%'; minWidth: 0 }>
}

/** Annotated-image element accepted by the decision visual factory. */
export type AnnotatedImageElement = React.ReactElement<AnnotatedImageProps, typeof AnnotatedImage>

type ImageState = {
  readonly source: string
  readonly status: 'loading' | 'ready' | 'failed'
}

const validateProps = ({ src, width, height, annotations }: AnnotatedImageProps): void => {
  validateAssetUrl(src.url)
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new TypeError(
      'AnnotatedImage width and height must be positive intrinsic pixel dimensions.',
    )
  }
  const ids = new Set<string>()
  for (const { id, label, anchor } of annotations) {
    if (id.trim().length === 0 || ids.has(id) || label.trim().length === 0) {
      throw new TypeError(
        'AnnotatedImage annotations need unique non-empty ids and non-empty labels.',
      )
    }
    if (
      ![anchor.x, anchor.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
    ) {
      throw new TypeError(
        `AnnotatedImage annotation ${id} needs anchor coordinates between 0 and 1.`,
      )
    }
    ids.add(id)
  }
}

/** Render local image evidence with accessible annotations and an expanded view. */
export class AnnotatedImage extends React.Component<AnnotatedImageProps, ImageState> {
  override state: ImageState = { source: this.props.src.url, status: 'loading' }

  static getDerivedStateFromProps(
    props: AnnotatedImageProps,
    state: ImageState,
  ): ImageState | null {
    return props.src.url === state.source ? null : { source: props.src.url, status: 'loading' }
  }

  private fail = (source: string): void => {
    this.setState((state) => (state.source === source ? { ...state, status: 'failed' } : null))
  }

  private decode = async (
    image: Pick<HTMLImageElement, 'decode' | 'naturalWidth' | 'naturalHeight'>,
    source: string,
  ): Promise<void> => {
    try {
      await image.decode()
      if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        this.fail(source)
        return
      }
      this.setState((state) => (state.source === source ? { ...state, status: 'ready' } : null))
    } catch {
      this.fail(source)
    }
  }

  override render(): React.ReactNode {
    validateProps(this.props)
    const { src, alt, width, height, annotations, caption, style } = this.props
    const failed = this.state.status === 'failed'
    return (
      <figure {...stylex.props(styles.figure, style)} data-vista-annotated-image="">
        <div {...stylex.props(styles.layout, annotations.length === 0 && styles.singleColumn)}>
          <div {...stylex.props(styles.imageBox)} data-vista-image-box="">
            <img
              key={src.url}
              src={src.url}
              alt={alt}
              width={width}
              height={height}
              data-vista-image-asset=""
              onLoad={(event) => this.decode(event.currentTarget, src.url)}
              onError={() => this.fail(src.url)}
              {...stylex.props(styles.image, failed && styles.failedImage)}
            />
            {failed ? (
              <p role="alert" {...stylex.props(styles.error)}>
                Image could not be loaded or decoded. Check the imported asset and publish again.
              </p>
            ) : (
              annotations.map(({ id, anchor }, index) => (
                <span
                  key={id}
                  aria-hidden="true"
                  {...stylex.props(styles.pin, styles.anchor(anchor.x * 100, anchor.y * 100))}
                >
                  {index + 1}
                </span>
              ))
            )}
            <NaturalSizeView src={src} alt={alt} width={width} height={height} failed={failed} />
          </div>
          {annotations.length === 0 ? null : (
            <ol
              {...stylex.props(styles.gutter)}
              aria-label="Image annotations"
              data-vista-image-gutter=""
            >
              {annotations.map(({ id, label }, index) => (
                <li key={id} {...stylex.props(styles.annotation)}>
                  <span aria-hidden="true" {...stylex.props(styles.number)}>
                    {index + 1}
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {caption === undefined ? null : (
          <figcaption {...stylex.props(styles.caption)}>{caption}</figcaption>
        )}
      </figure>
    )
  }
}

const NaturalSizeView = ({
  src,
  alt,
  width,
  height,
  failed,
}: Pick<AnnotatedImageProps, 'src' | 'alt' | 'width' | 'height'> & {
  readonly failed: boolean
}): React.ReactNode => {
  const theme = useTheme()
  return (
    <DialogTrigger>
      <Button
        isDisabled={failed}
        aria-label="View at natural size"
        aria-haspopup="dialog"
        {...stylex.props(styles.expandSurface)}
      >
        <span {...stylex.props(styles.expandIcon)} aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6" />
          </svg>
        </span>
      </Button>
      <ModalOverlay
        isDismissable
        {...stylex.props(styles.overlay, theme === 'light' && lightTheme, colorScheme[theme])}
        data-theme={theme}
      >
        <Modal {...stylex.props(styles.modal)}>
          <Dialog aria-label="Image at natural size" {...stylex.props(styles.dialog)}>
            {({ close }) => (
              <>
                <div {...stylex.props(styles.modalHeader)}>
                  <span>
                    {width} × {height} px
                  </span>
                  <Button onPress={close} {...stylex.props(styles.button)}>
                    Close
                  </Button>
                </div>
                <div {...stylex.props(styles.naturalViewport)}>
                  <img
                    src={src.url}
                    alt={alt}
                    width={width}
                    height={height}
                    {...stylex.props(styles.naturalImage)}
                  />
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}

const styles = stylex.create({
  figure: { margin: 0, maxWidth: '100%', minWidth: 0, color: tokens['--ds-gray-1000'] },
  layout: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) minmax(10rem, 16rem)',
      '@media (max-width: 900px)': 'minmax(0, 1fr)',
    },
    gap: scale.space4,
    alignItems: 'start',
  },
  singleColumn: { gridTemplateColumns: 'minmax(0, 1fr)' },
  imageBox: {
    position: 'relative',
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
  },
  image: { display: 'block', width: '100%', height: 'auto' },
  failedImage: { visibility: 'hidden' },
  pin: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '1.4rem',
    height: '1.4rem',
    paddingInline: '0.15rem',
    boxSizing: 'border-box',
    borderRadius: '999px',
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-1000'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-700'],
    fontSize: '0.7rem',
    fontWeight: 600,
    lineHeight: 1,
    pointerEvents: 'none',
  },
  anchor: (x: number, y: number) => ({
    left: `clamp(0.7rem, ${x}%, calc(100% - 0.7rem))`,
    top: `clamp(0.7rem, ${y}%, calc(100% - 0.7rem))`,
  }),
  gutter: {
    margin: 0,
    padding: 0,
    listStyleType: 'none',
    display: 'grid',
    gap: scale.space3,
    position: 'static',
    minWidth: 0,
  },
  annotation: {
    display: 'flex',
    gap: scale.space2,
    alignItems: 'baseline',
    fontSize: '0.8rem',
    lineHeight: 1.5,
    overflowWrap: 'anywhere',
  },
  number: {
    flexShrink: 0,
    fontWeight: 600,
    color: tokens['--ds-gray-900'],
    minWidth: '1.4rem',
    textAlign: 'center',
  },
  expandSurface: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    padding: scale.space2,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-1000'],
    cursor: { default: 'zoom-in', ':disabled': 'default' },
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
    outlineOffset: -2,
    opacity: { default: 1, ':disabled': 0.5 },
  },
  expandIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: scale.space8,
    height: scale.space8,
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    pointerEvents: 'none',
  },
  caption: {
    marginTop: scale.space3,
    fontSize: '0.8rem',
    color: tokens['--ds-gray-900'],
    lineHeight: 1.5,
  },
  button: {
    font: 'inherit',
    fontSize: '0.8rem',
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-1000'],
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
    outlineOffset: 2,
    opacity: { default: 1, ':disabled': 0.5 },
  },
  error: {
    position: 'absolute',
    inset: 0,
    margin: 0,
    padding: scale.space4,
    color: tokens['--ds-red-800'],
    backgroundColor: tokens['--ds-background-100'],
    fontSize: '0.85rem',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale.space4,
    backgroundColor: tokens['--ds-gray-alpha-500'],
  },
  modal: {
    width: '100%',
    maxWidth: '90rem',
    maxHeight: '100%',
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-1000'],
    borderRadius: scale.radiusDefault,
    overflow: 'hidden',
  },
  dialog: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100dvh - 2rem)',
    outline: 'none',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale.space3,
    padding: scale.space3,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    fontSize: '0.8rem',
  },
  naturalViewport: { overflow: 'auto', minHeight: 0 },
  naturalImage: { display: 'block', maxWidth: 'none', flexShrink: 0 },
})
