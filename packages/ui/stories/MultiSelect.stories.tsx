import type { Meta, StoryObj } from '@storybook/react'

import { MultiSelect } from '../src/components/MultiSelect/MultiSelect.tsx'

const meta = {
  title: 'Components/MultiSelect',
  component: MultiSelect,
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
} satisfies Meta<typeof MultiSelect>

export default meta
type Story = StoryObj<typeof meta>

const frameworkOptions = [
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'angular', label: 'Angular' },
  { id: 'svelte', label: 'Svelte' },
  { id: 'solid', label: 'Solid' },
  { id: 'qwik', label: 'Qwik' },
  { id: 'preact', label: 'Preact' },
  { id: 'lit', label: 'Lit' },
]

export const Default: Story = {
  args: {
    label: 'Select frameworks',
    placeholder: 'Search frameworks...',
    options: frameworkOptions,
  },
}

export const WithDefaultValue: Story = {
  args: {
    label: 'Select frameworks',
    placeholder: 'Search frameworks...',
    options: frameworkOptions,
    defaultValue: ['react', 'vue'],
  },
}

export const Small: Story = {
  args: {
    label: 'Select frameworks',
    placeholder: 'Search...',
    options: frameworkOptions,
    size: 'sm',
    defaultValue: ['react'],
  },
}

export const Large: Story = {
  args: {
    label: 'Select frameworks',
    placeholder: 'Search...',
    options: frameworkOptions,
    size: 'lg',
    defaultValue: ['react', 'vue'],
  },
}

export const WithMaxSelections: Story = {
  args: {
    label: 'Select up to 3 frameworks',
    placeholder: 'Search frameworks...',
    options: frameworkOptions,
    maxSelections: 3,
    defaultValue: ['react', 'vue'],
  },
}

export const WithError: Story = {
  args: {
    label: 'Select frameworks',
    placeholder: 'Search...',
    options: frameworkOptions,
    errorMessage: 'Please select at least one framework',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Select frameworks',
    placeholder: 'Search...',
    options: frameworkOptions,
    isDisabled: true,
    defaultValue: ['react'],
  },
}

export const WithDisabledOptions: Story = {
  args: {
    label: 'Select frameworks',
    placeholder: 'Search...',
    options: [
      { id: 'react', label: 'React' },
      { id: 'vue', label: 'Vue' },
      { id: 'angular', label: 'Angular (deprecated)', disabled: true },
      { id: 'svelte', label: 'Svelte' },
    ],
  },
}

export const ManySelections: Story = {
  args: {
    label: 'Selected technologies',
    placeholder: 'Add more...',
    options: frameworkOptions,
    defaultValue: ['react', 'vue', 'angular', 'svelte', 'solid'],
  },
}
