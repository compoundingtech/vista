import type { Meta, StoryObj } from '@storybook/react'

import { Combobox, ComboboxItem } from '../src/components/Combobox/Combobox.tsx'

const meta: Meta<typeof Combobox> = {
  title: 'Components/Combobox',
  component: Combobox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

const fruits = [
  { id: '1', name: 'Apple' },
  { id: '2', name: 'Banana' },
  { id: '3', name: 'Cherry' },
  { id: '4', name: 'Date' },
  { id: '5', name: 'Elderberry' },
  { id: '6', name: 'Fig' },
  { id: '7', name: 'Grape' },
]

export const Default: Story = {
  render: (args) => (
    <Combobox {...args}>
      {fruits.map((fruit) => (
        <ComboboxItem key={fruit.id} id={fruit.id}>
          {fruit.name}
        </ComboboxItem>
      ))}
    </Combobox>
  ),
  args: {
    label: 'Select a fruit',
    placeholder: 'Search fruits...',
  },
}

export const Small: Story = {
  render: (args) => (
    <Combobox {...args}>
      {fruits.map((fruit) => (
        <ComboboxItem key={fruit.id} id={fruit.id}>
          {fruit.name}
        </ComboboxItem>
      ))}
    </Combobox>
  ),
  args: {
    label: 'Select a fruit',
    placeholder: 'Search...',
    size: 'sm',
  },
}

export const Large: Story = {
  render: (args) => (
    <Combobox {...args}>
      {fruits.map((fruit) => (
        <ComboboxItem key={fruit.id} id={fruit.id}>
          {fruit.name}
        </ComboboxItem>
      ))}
    </Combobox>
  ),
  args: {
    label: 'Select a fruit',
    placeholder: 'Search...',
    size: 'lg',
  },
}

export const WithError: Story = {
  render: (args) => (
    <Combobox {...args}>
      {fruits.map((fruit) => (
        <ComboboxItem key={fruit.id} id={fruit.id}>
          {fruit.name}
        </ComboboxItem>
      ))}
    </Combobox>
  ),
  args: {
    label: 'Select a fruit',
    placeholder: 'Search...',
    errorMessage: 'Please select a valid fruit',
  },
}

export const Disabled: Story = {
  render: (args) => (
    <Combobox {...args}>
      {fruits.map((fruit) => (
        <ComboboxItem key={fruit.id} id={fruit.id}>
          {fruit.name}
        </ComboboxItem>
      ))}
    </Combobox>
  ),
  args: {
    label: 'Select a fruit',
    placeholder: 'Search...',
    isDisabled: true,
  },
}

export const Loading: Story = {
  render: (args) => (
    <Combobox {...args}>
      {fruits.map((fruit) => (
        <ComboboxItem key={fruit.id} id={fruit.id}>
          {fruit.name}
        </ComboboxItem>
      ))}
    </Combobox>
  ),
  args: {
    label: 'Select a fruit',
    placeholder: 'Loading...',
    isLoading: true,
  },
}

export const WithClearButton: Story = {
  render: (args) => (
    <Combobox {...args}>
      {fruits.map((fruit) => (
        <ComboboxItem key={fruit.id} id={fruit.id}>
          {fruit.name}
        </ComboboxItem>
      ))}
    </Combobox>
  ),
  args: {
    label: 'Select a fruit',
    placeholder: 'Search...',
    allowsClear: true,
    inputValue: 'Apple',
  },
}
