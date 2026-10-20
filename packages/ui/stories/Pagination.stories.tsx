import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Pagination, PaginationLink } from '../src/components/Pagination/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Pagination>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  width500: {
    width: '500px',
  },
  width600: {
    width: '600px',
  },
  allStates: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3rem',
    width: '500px',
  },
  sectionLabel: {
    margin: 0,
    marginBottom: '1rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
})

export const Default: Story = {
  args: {
    previous: {
      href: '#',
      title: 'Home',
    },
    next: {
      href: '#',
      title: 'Introduction',
    },
  },
  decorators: [
    (Story) => (
      <div {...stylex.props(storyStyles.width500)}>
        <Story />
      </div>
    ),
  ],
}

export const PreviousOnly: Story = {
  args: {
    previous: {
      href: '#',
      title: 'Getting Started',
    },
  },
  decorators: [
    (Story) => (
      <div {...stylex.props(storyStyles.width500)}>
        <Story />
      </div>
    ),
  ],
}

export const NextOnly: Story = {
  args: {
    next: {
      href: '#',
      title: 'Configuration',
    },
  },
  decorators: [
    (Story) => (
      <div {...stylex.props(storyStyles.width500)}>
        <Story />
      </div>
    ),
  ],
}

export const LongTitles: Story = {
  args: {
    previous: {
      href: '#',
      title: 'API Reference Documentation',
    },
    next: {
      href: '#',
      title: 'Advanced Configuration Guide',
    },
  },
  decorators: [
    (Story) => (
      <div {...stylex.props(storyStyles.width600)}>
        <Story />
      </div>
    ),
  ],
}

export const CustomChildren: Story = {
  args: {},
  render: () => (
    <div {...stylex.props(storyStyles.width500)}>
      <Pagination>
        <PaginationLink href="#" title="Previous Page" direction="previous" />
        <PaginationLink href="#" title="Next Page" direction="next" />
      </Pagination>
    </div>
  ),
}

export const AllStates: Story = {
  args: {
    previous: {
      href: '#',
      title: 'Home',
    },
    next: {
      href: '#',
      title: 'Introduction',
    },
  },
  render: () => (
    <div {...stylex.props(storyStyles.allStates)}>
      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Default (Both Links)</p>
        <Pagination
          previous={{ href: '#', title: 'Home' }}
          next={{ href: '#', title: 'Introduction' }}
        />
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Previous Only</p>
        <Pagination previous={{ href: '#', title: 'Getting Started' }} />
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Next Only</p>
        <Pagination next={{ href: '#', title: 'Configuration' }} />
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Long Titles</p>
        <Pagination
          previous={{ href: '#', title: 'API Reference Documentation' }}
          next={{ href: '#', title: 'Advanced Configuration Guide' }}
        />
      </div>
    </div>
  ),
}
