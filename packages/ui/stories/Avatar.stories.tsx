import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Avatar } from '../src/components/Avatar/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'
// Local SVG fixtures keep image stories independent of remote avatars and network timing.
const avatarImage = (initials: string, background: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${background}"/><text x="48" y="50" text-anchor="middle" dominant-baseline="central" fill="white" font-family="sans-serif" font-size="36" font-weight="600">${initials}</text></svg>`,
  )}`

const avatarImages = {
  rauchg: avatarImage('GR', '#2563eb'),
  leerob: avatarImage('LR', '#7c3aed'),
  shuding: avatarImage('SD', '#059669'),
}

const waitForAvatarImages = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await Promise.all(Array.from(canvasElement.querySelectorAll('img'), (image) => image.decode()))
}

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', '2xl'],
    },
  },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  sizes: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '1rem',
  },
  group: {
    display: 'flex',
  },
  groupAvatar: {
    boxShadow: `0 0 0 2px ${tokens['--ds-background-100']}`,
  },
  overlappingGroupAvatar: {
    marginInlineStart: '-0.5rem',
  },
})

export const Default: Story = {
  args: {},
}

export const WithImage: Story = {
  args: {
    src: avatarImages.rauchg,
    alt: 'rauchg',
  },
  play: waitForAvatarImages,
}

export const WithFallback: Story = {
  args: {
    fallback: 'JD',
  },
}

export const Placeholder: Story = {
  args: {},
}

export const AllSizes: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.sizes)}>
      <Avatar size="sm" src={avatarImages.leerob} alt="leerob" />
      <Avatar size="md" src={avatarImages.leerob} alt="leerob" />
      <Avatar size="lg" src={avatarImages.leerob} alt="leerob" />
      <Avatar size="xl" src={avatarImages.leerob} alt="leerob" />
      <Avatar size="2xl" src={avatarImages.leerob} alt="leerob" />
    </div>
  ),
  play: waitForAvatarImages,
}

export const AllSizesWithFallback: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.sizes)}>
      <Avatar size="sm" fallback="SM" />
      <Avatar size="md" fallback="MD" />
      <Avatar size="lg" fallback="LG" />
      <Avatar size="xl" fallback="XL" />
      <Avatar size="2xl" fallback="2X" />
    </div>
  ),
}

export const AllSizesPlaceholder: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.sizes)}>
      <Avatar size="sm" />
      <Avatar size="md" />
      <Avatar size="lg" />
      <Avatar size="xl" />
      <Avatar size="2xl" />
    </div>
  ),
}

export const Group: Story = {
  render: () => (
    <div {...stylex.props(storyStyles.group)}>
      <Avatar src={avatarImages.rauchg} alt="rauchg" {...stylex.props(storyStyles.groupAvatar)} />
      <Avatar
        src={avatarImages.leerob}
        alt="leerob"
        {...stylex.props(storyStyles.groupAvatar, storyStyles.overlappingGroupAvatar)}
      />
      <Avatar
        src={avatarImages.shuding}
        alt="shuding"
        {...stylex.props(storyStyles.groupAvatar, storyStyles.overlappingGroupAvatar)}
      />
      <Avatar
        fallback="+3"
        {...stylex.props(storyStyles.groupAvatar, storyStyles.overlappingGroupAvatar)}
      />
    </div>
  ),
  play: waitForAvatarImages,
}
