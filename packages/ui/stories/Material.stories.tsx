import type { Meta, StoryObj } from '@storybook/react'

import { Material } from '../src/components/Material/Material.tsx'

const meta: Meta<typeof Material> = {
  title: 'Components/Material',
  component: Material,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['glass', 'frosted', 'subtle', 'solid', 'gradient'],
    },
    radius: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', 'full'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl'],
    },
    shadow: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl'],
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '40px',
          borderRadius: '12px',
        }}
      >
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Glass: Story = {
  args: {
    variant: 'glass',
    children: (
      <div style={{ width: '300px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Glass Material</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>
          A transparent glass-like surface with blur effect.
        </p>
      </div>
    ),
  },
}

export const Frosted: Story = {
  args: {
    variant: 'frosted',
    children: (
      <div style={{ width: '300px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Frosted Material</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>A heavier frosted glass effect.</p>
      </div>
    ),
  },
}

export const Subtle: Story = {
  args: {
    variant: 'subtle',
    children: (
      <div style={{ width: '300px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Subtle Material</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>A lighter, more subtle blur effect.</p>
      </div>
    ),
  },
}

export const Solid: Story = {
  args: {
    variant: 'solid',
    children: (
      <div style={{ width: '300px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Solid Material</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>A solid background without blur.</p>
      </div>
    ),
  },
}

export const Gradient: Story = {
  args: {
    variant: 'gradient',
    children: (
      <div style={{ width: '300px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Gradient Material</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>A gradient background with blur.</p>
      </div>
    ),
  },
}

export const WithShadow: Story = {
  args: {
    variant: 'glass',
    shadow: 'lg',
    children: (
      <div style={{ width: '300px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>With Shadow</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>Material with a large shadow.</p>
      </div>
    ),
  },
}

export const LargePadding: Story = {
  args: {
    variant: 'glass',
    padding: 'xl',
    children: (
      <div style={{ width: '300px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Large Padding</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>More internal spacing.</p>
      </div>
    ),
  },
}

export const RoundedCorners: Story = {
  args: {
    variant: 'glass',
    radius: 'xl',
    children: (
      <div style={{ width: '300px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Rounded</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>Extra large border radius.</p>
      </div>
    ),
  },
}

export const FullRounded: Story = {
  args: {
    variant: 'glass',
    radius: 'full',
    padding: 'lg',
    children: (
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '24px' }}>42</span>
      </div>
    ),
  },
}
