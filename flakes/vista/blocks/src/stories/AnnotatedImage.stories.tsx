import type { Meta, StoryObj } from '@storybook/react'

import illustrationUrl from '../assets/vista-icon-color.svg?url&no-inline'
import {
  AnnotatedImage,
  type AnnotatedImageProps,
  imageAsset,
} from '../blocks/decision-review/AnnotatedImage.tsx'

const meta = {
  title: 'Vista/Blocks/DecisionReview/AnnotatedImage',
  component: AnnotatedImage,
  parameters: { layout: 'padded' },
  args: {
    src: imageAsset(illustrationUrl),
    alt: 'Vista mountain and sun illustration',
    width: 80,
    height: 80,
    annotations: [
      { id: 'sun', label: 'Orange sun above the mountain ridge.', anchor: { x: 0.725, y: 0.275 } },
    ],
    caption: 'Illustration, not measured evidence.',
  },
} satisfies Meta<AnnotatedImageProps>

export default meta
type Story = StoryObj<typeof meta>

/** Click anywhere on the image or focus its expand control and press Enter. */
export const Expand: Story = {}
/** Local image evidence without annotation markers. */
export const WithoutAnnotations: Story = { args: { annotations: [] } }
/** Missing local asset rendered through the fail-closed image state. */
export const MissingAsset: Story = { args: { src: imageAsset('/missing-annotated-image.svg') } }
/** Compare annotated, unannotated and missing-asset states together. */
export const AllStates: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 24, maxWidth: 640 }}>
      <AnnotatedImage {...meta.args} {...args} />
      <AnnotatedImage {...meta.args} {...args} annotations={[]} />
      <AnnotatedImage {...meta.args} {...args} src={imageAsset('/missing-annotated-image.svg')} />
    </div>
  ),
}
