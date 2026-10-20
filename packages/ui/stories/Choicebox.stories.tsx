import type { Meta, StoryObj } from '@storybook/react'

import {
  ChoiceboxGroup,
  Choicebox,
  ChoiceboxMultiGroup,
  ChoiceboxMulti,
} from '../src/components/Choicebox/Choicebox.tsx'

const meta: Meta<typeof ChoiceboxGroup> = {
  title: 'Components/Choicebox',
  component: ChoiceboxGroup,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    columns: {
      control: 'select',
      options: [1, 2, 3, 4],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <ChoiceboxGroup {...args}>
      <Choicebox value="option1" title="Option 1" description="Description for option 1" />
      <Choicebox value="option2" title="Option 2" description="Description for option 2" />
      <Choicebox value="option3" title="Option 3" description="Description for option 3" />
      <Choicebox value="option4" title="Option 4" description="Description for option 4" />
    </ChoiceboxGroup>
  ),
  args: {
    label: 'Select an option',
  },
}

export const SingleColumn: Story = {
  render: (args) => (
    <ChoiceboxGroup {...args}>
      <Choicebox value="option1" title="Option 1" description="Description for option 1" />
      <Choicebox value="option2" title="Option 2" description="Description for option 2" />
      <Choicebox value="option3" title="Option 3" description="Description for option 3" />
    </ChoiceboxGroup>
  ),
  args: {
    label: 'Select an option',
    columns: 1,
  },
}

export const ThreeColumns: Story = {
  render: (args) => (
    <ChoiceboxGroup {...args}>
      <Choicebox value="option1" title="Option 1" />
      <Choicebox value="option2" title="Option 2" />
      <Choicebox value="option3" title="Option 3" />
    </ChoiceboxGroup>
  ),
  args: {
    label: 'Select an option',
    columns: 3,
  },
}

export const SmallSize: Story = {
  render: (args) => (
    <ChoiceboxGroup {...args}>
      <Choicebox value="option1" title="Small Option 1" size="sm" />
      <Choicebox value="option2" title="Small Option 2" size="sm" />
    </ChoiceboxGroup>
  ),
  args: {
    label: 'Small choiceboxes',
  },
}

export const LargeSize: Story = {
  render: (args) => (
    <ChoiceboxGroup {...args}>
      <Choicebox
        value="option1"
        title="Large Option 1"
        description="More space for content"
        size="lg"
      />
      <Choicebox
        value="option2"
        title="Large Option 2"
        description="More space for content"
        size="lg"
      />
    </ChoiceboxGroup>
  ),
  args: {
    label: 'Large choiceboxes',
  },
}

export const MultiSelect: StoryObj<typeof ChoiceboxMultiGroup> = {
  render: (args) => (
    <ChoiceboxMultiGroup {...args}>
      <ChoiceboxMulti value="feature1" title="Feature 1" description="Enable this feature" />
      <ChoiceboxMulti value="feature2" title="Feature 2" description="Enable this feature" />
      <ChoiceboxMulti value="feature3" title="Feature 3" description="Enable this feature" />
      <ChoiceboxMulti value="feature4" title="Feature 4" description="Enable this feature" />
    </ChoiceboxMultiGroup>
  ),
  args: {
    label: 'Select features',
  },
}

export const Disabled: Story = {
  render: (args) => (
    <ChoiceboxGroup {...args}>
      <Choicebox value="option1" title="Option 1" isDisabled />
      <Choicebox value="option2" title="Option 2" />
    </ChoiceboxGroup>
  ),
  args: {
    label: 'Some options disabled',
  },
}
