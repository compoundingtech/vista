import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import {
  Collapse,
  CollapseGroup,
  CollapseTrigger,
  CollapsePanel,
} from '../src/components/Collapse/mod.ts'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/Collapse',
  component: Collapse,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Collapse>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  width500: {
    width: '500px',
  },
  allStates: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    width: '500px',
  },
  sectionLabel: {
    marginBottom: '0.5rem',
    color: tokens['--ds-gray-900'],
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
})

export const Default: Story = {
  args: {
    id: 'default',
    children: null,
  },
  render: () => (
    <div {...stylex.props(storyStyles.width500)}>
      <CollapseGroup>
        <Collapse id="question-a">
          <CollapseTrigger>Question A</CollapseTrigger>
          <CollapsePanel>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
            exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </CollapsePanel>
        </Collapse>
        <Collapse id="question-b">
          <CollapseTrigger>Question B</CollapseTrigger>
          <CollapsePanel>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
            nulla pariatur.
          </CollapsePanel>
        </Collapse>
      </CollapseGroup>
    </div>
  ),
}

export const Expanded: Story = {
  args: {
    id: 'expanded',
    children: null,
  },
  render: () => (
    <div {...stylex.props(storyStyles.width500)}>
      <CollapseGroup defaultExpandedKeys={new Set(['question-b'])}>
        <Collapse id="question-a">
          <CollapseTrigger>Question A</CollapseTrigger>
          <CollapsePanel>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </CollapsePanel>
        </Collapse>
        <Collapse id="question-b">
          <CollapseTrigger>Question B</CollapseTrigger>
          <CollapsePanel>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
            nulla pariatur.
          </CollapsePanel>
        </Collapse>
      </CollapseGroup>
    </div>
  ),
}

export const Multiple: Story = {
  args: {
    id: 'multiple',
    children: null,
  },
  render: () => (
    <div {...stylex.props(storyStyles.width500)}>
      <CollapseGroup allowsMultipleExpanded>
        <Collapse id="question-a">
          <CollapseTrigger>Question A</CollapseTrigger>
          <CollapsePanel>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </CollapsePanel>
        </Collapse>
        <Collapse id="question-b">
          <CollapseTrigger>Question B</CollapseTrigger>
          <CollapsePanel>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
            nulla pariatur.
          </CollapsePanel>
        </Collapse>
      </CollapseGroup>
    </div>
  ),
}

export const Small: Story = {
  args: {
    id: 'small',
    children: null,
  },
  render: () => (
    <div {...stylex.props(storyStyles.width500)}>
      <CollapseGroup>
        <Collapse id="question-a" size="small">
          <CollapseTrigger>Question A</CollapseTrigger>
          <CollapsePanel>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </CollapsePanel>
        </Collapse>
      </CollapseGroup>
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    id: 'disabled',
    children: null,
  },
  render: () => (
    <div {...stylex.props(storyStyles.width500)}>
      <CollapseGroup>
        <Collapse id="question-a">
          <CollapseTrigger>Question A (enabled)</CollapseTrigger>
          <CollapsePanel>This item can be expanded and collapsed.</CollapsePanel>
        </Collapse>
        <Collapse id="question-b" isDisabled>
          <CollapseTrigger>Question B (disabled)</CollapseTrigger>
          <CollapsePanel>
            This content cannot be accessed because the item is disabled.
          </CollapsePanel>
        </Collapse>
      </CollapseGroup>
    </div>
  ),
}

export const AllStates: Story = {
  args: {
    id: 'all-states',
    children: null,
  },
  render: () => (
    <div {...stylex.props(storyStyles.allStates)}>
      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Default (single expansion)</p>
        <CollapseGroup>
          <Collapse id="default-a">
            <CollapseTrigger>Question A</CollapseTrigger>
            <CollapsePanel>Content for Question A</CollapsePanel>
          </Collapse>
          <Collapse id="default-b">
            <CollapseTrigger>Question B</CollapseTrigger>
            <CollapsePanel>Content for Question B</CollapsePanel>
          </Collapse>
        </CollapseGroup>
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Multiple expansion allowed</p>
        <CollapseGroup allowsMultipleExpanded defaultExpandedKeys={new Set(['multi-a', 'multi-b'])}>
          <Collapse id="multi-a">
            <CollapseTrigger>Question A</CollapseTrigger>
            <CollapsePanel>Content for Question A</CollapsePanel>
          </Collapse>
          <Collapse id="multi-b">
            <CollapseTrigger>Question B</CollapseTrigger>
            <CollapsePanel>Content for Question B</CollapsePanel>
          </Collapse>
        </CollapseGroup>
      </div>

      <div>
        <p {...stylex.props(storyStyles.sectionLabel)}>Small size</p>
        <CollapseGroup>
          <Collapse id="small-a" size="small">
            <CollapseTrigger>Question A</CollapseTrigger>
            <CollapsePanel>Content for Question A</CollapsePanel>
          </Collapse>
        </CollapseGroup>
      </div>
    </div>
  ),
}
