import type { Meta, StoryObj } from '@storybook/react'

import { Button } from '../src/components/Button/Button.tsx'
import { Entity } from '../src/components/Entity/Entity.tsx'

// Local SVG fixtures keep image stories independent of remote image hosts and
// network timing: a remote thumbnail that arrives late (or never) leaves the
// capture waiting on an unfinished image.
const imageFixture = (width: number, height: number, background: string, accent: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${background}"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="${accent}"/></svg>`,
  )}`

const images = {
  avatar: imageFixture(100, 100, '#7c3aed', '#c4b5fd'),
  alpha: imageFixture(80, 80, '#2563eb', '#93c5fd'),
  video: imageFixture(160, 90, '#059669', '#6ee7b7'),
  album: imageFixture(100, 100, '#dc2626', '#fca5a5'),
}

const waitForImages = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await Promise.all(Array.from(canvasElement.querySelectorAll('img'), (image) => image.decode()))
}

const meta = {
  title: 'Components/Entity',
  component: Entity,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  play: waitForImages,
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
    thumbnailShape: {
      control: 'select',
      options: ['square', 'rounded', 'video'],
    },
  },
} satisfies Meta<typeof Entity>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    name: 'John Doe',
  },
}

export const WithDescription: Story = {
  args: {
    name: 'John Doe',
    description: 'Software Engineer',
  },
}

export const WithMeta: Story = {
  args: {
    name: 'John Doe',
    description: 'Software Engineer',
    meta: '2 hours ago',
  },
}

export const WithAvatarImage: Story = {
  args: {
    name: 'Jane Smith',
    description: 'Product Designer',
    avatarSrc: images.avatar,
  },
}

export const WithAvatarFallback: Story = {
  args: {
    name: 'Alice Johnson',
    description: 'Frontend Developer',
    avatarFallback: 'AJ',
  },
}

export const WithThumbnail: Story = {
  args: {
    name: 'Project Alpha',
    description: 'Web Application',
    thumbnailSrc: images.alpha,
    thumbnailShape: 'rounded',
  },
}

export const WithVideoThumbnail: Story = {
  args: {
    name: 'Tutorial Video',
    description: 'Getting Started Guide',
    thumbnailSrc: images.video,
    thumbnailShape: 'video',
  },
}

export const WithActions: Story = {
  args: {
    name: 'John Doe',
    description: 'Software Engineer',
    avatarFallback: 'JD',
    actions: (
      <>
        <Button size="sm" variant="secondary">
          Edit
        </Button>
        <Button size="sm" variant="tertiary">
          Delete
        </Button>
      </>
    ),
  },
}

export const Small: Story = {
  args: {
    name: 'Small Entity',
    description: 'Compact size',
    avatarFallback: 'SE',
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    name: 'Large Entity',
    description: 'Expanded size',
    avatarFallback: 'LE',
    size: 'lg',
  },
}

export const ExtraLarge: Story = {
  args: {
    name: 'Extra Large Entity',
    description: 'Maximum size',
    avatarFallback: 'XL',
    size: 'xl',
  },
}

export const SquareThumbnail: Story = {
  args: {
    name: 'Album Cover',
    description: 'Music Album',
    thumbnailSrc: images.album,
    thumbnailShape: 'square',
  },
}
