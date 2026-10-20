import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Description } from '../src/components/Description/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Description',
  component: Description,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'default', 'large'],
    },
  },
} satisfies Meta<typeof Description>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  suffixIcon: {
    display: 'block',
    width: '0.875rem',
    height: '0.875rem',
    color: tokens['--ds-gray-700'],
    verticalAlign: 'middle',
  },
  sizes: {
    display: 'flex',
    flexDirection: 'column',
    width: '300px',
    gap: '1.5rem',
  },
  descriptions: {
    display: 'flex',
    flexDirection: 'column',
    width: '300px',
    gap: '1rem',
  },
  states: {
    display: 'flex',
    flexDirection: 'column',
    width: '350px',
    gap: '2rem',
  },
  label: {
    margin: 0,
    marginBottom: '1rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  projectInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
})

export const Default: Story = {
  args: {
    title: 'Section Title',
    children: 'Data about this section.',
  },
}

export const WithSuffix: Story = {
  args: {
    title: 'Section Title',
    children: 'Data about this section.',
    suffix: (
      <svg {...stylex.props(storyStyles.suffixIcon)} viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
        <path d="M8.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
      </svg>
    ),
  },
}

export const Sizes: Story = {
  args: {
    title: 'Section Title',
    children: 'Data about this section.',
  },
  render: () => (
    <div {...stylex.props(storyStyles.sizes)}>
      <Description title="Small" size="small">
        Small size description content.
      </Description>
      <Description title="Default" size="default">
        Default size description content.
      </Description>
      <Description title="Large" size="large">
        Large size description content.
      </Description>
    </div>
  ),
}

export const MultipleDescriptions: Story = {
  args: {
    title: 'Section Title',
    children: 'Data about this section.',
  },
  render: () => (
    <div {...stylex.props(storyStyles.descriptions)}>
      <Description title="Project Name">my-awesome-project</Description>
      <Description title="Framework">Next.js 14</Description>
      <Description title="Status">Production</Description>
      <Description title="Last Deployed">2 hours ago</Description>
    </div>
  ),
}

export const AllStates: Story = {
  args: {
    title: 'Section Title',
    children: 'Data about this section.',
  },
  render: () => (
    <div {...stylex.props(storyStyles.states)}>
      <div>
        <p {...stylex.props(storyStyles.label)}>Default</p>
        <Description title="Section Title">Data about this section.</Description>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>With Suffix Icon</p>
        <Description
          title="Section Title"
          suffix={
            <svg {...stylex.props(storyStyles.suffixIcon)} viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
              <path d="M8.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
            </svg>
          }
        >
          Data about this section.
        </Description>
      </div>

      <div>
        <p {...stylex.props(storyStyles.label)}>Project Info Example</p>
        <div {...stylex.props(storyStyles.projectInfo)}>
          <Description title="Project">vercel/next.js</Description>
          <Description title="Environment">Production</Description>
          <Description title="Domain">next.js.org</Description>
        </div>
      </div>
    </div>
  ),
}
