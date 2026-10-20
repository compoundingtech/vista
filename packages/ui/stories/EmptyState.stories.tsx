import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Button } from '../src/components/Button/mod.ts'
import { EmptyState, EmptyStateLink } from '../src/components/EmptyState/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  icon: {
    display: 'block',
    width: '4rem',
    height: '4rem',
    color: tokens['--ds-gray-600'],
    verticalAlign: 'middle',
  },
  states: {
    display: 'flex',
    flexDirection: 'column',
    width: '400px',
    gap: '4rem',
  },
  label: {
    margin: 0,
    marginBottom: '1.5rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
})

const PlaceholderIcon = () => (
  <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 64 64" fill="none">
    <rect
      x="8"
      y="8"
      width="48"
      height="48"
      rx="8"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="4 4"
    />
    <circle cx="24" cy="26" r="4" fill="currentColor" />
    <path
      d="M16 44L28 32L36 40L48 28"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const FolderIcon = () => (
  <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 64 64" fill="none">
    <path
      d="M8 16C8 13.7909 9.79086 12 12 12H24L28 16H52C54.2091 16 56 17.7909 56 20V48C56 50.2091 54.2091 52 52 52H12C9.79086 52 8 50.2091 8 48V16Z"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

export const BlankSlate: Story = {
  args: {
    icon: <PlaceholderIcon />,
    title: 'Title',
    description: 'A message conveying the state of the product.',
  },
}

export const Informational: Story = {
  args: {
    icon: <PlaceholderIcon />,
    title: 'Title',
    description:
      "This should detail the actions you can take on this screen, as well as why it's valuable.",
    action: <Button>Primary Action</Button>,
    secondaryAction: <EmptyStateLink href="#">Learn more</EmptyStateLink>,
  },
}

export const NoProjects: Story = {
  args: {
    icon: <FolderIcon />,
    title: 'No projects yet',
    description: 'Create your first project to get started building with our platform.',
    action: <Button>Create Project</Button>,
    secondaryAction: <EmptyStateLink href="#">View documentation</EmptyStateLink>,
  },
}

export const NoResults: Story = {
  args: {
    icon: (
      <svg {...stylex.props(storyStyles.icon)} viewBox="0 0 64 64" fill="none">
        <circle cx="28" cy="28" r="16" stroke="currentColor" strokeWidth="2" />
        <path d="M40 40L52 52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 28H34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'No results found',
    description: "Try adjusting your search or filter to find what you're looking for.",
  },
}

export const WithoutIcon: Story = {
  args: {
    title: 'No data available',
    description: 'There is no data to display at this time.',
  },
}

export const WithActionOnly: Story = {
  args: {
    icon: <FolderIcon />,
    title: 'Get started',
    description: 'Add your first item to begin.',
    action: <Button>Add Item</Button>,
  },
}

export const AllStates: Story = {
  args: {
    title: 'Title',
    description: 'Description',
  },
  render: () => (
    <div {...stylex.props(storyStyles.states)}>
      <div>
        <p {...stylex.props(storyStyles.label)}>Blank Slate</p>
        <EmptyState
          icon={<PlaceholderIcon />}
          title="Title"
          description="A message conveying the state of the product."
        />
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>Informational</p>
        <EmptyState
          icon={<PlaceholderIcon />}
          title="Title"
          description="This should detail the actions you can take on this screen, as well as why it's valuable."
          action={<Button>Primary Action</Button>}
          secondaryAction={<EmptyStateLink href="#">Learn more</EmptyStateLink>}
        />
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>Without Icon</p>
        <EmptyState
          title="No data available"
          description="There is no data to display at this time."
          action={<Button variant="secondary">Refresh</Button>}
        />
      </div>
    </div>
  ),
}
