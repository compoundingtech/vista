import type { Meta, StoryObj } from '@storybook/react'

import { Phone } from '../src/components/Phone/Phone.tsx'

const meta = {
  title: 'Components/Phone',
  component: Phone,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    notchVariant: {
      control: 'select',
      options: ['none', 'notch', 'dynamicIsland'],
    },
    frameColor: {
      control: 'select',
      options: ['dark', 'light', 'blue'],
    },
  },
} satisfies Meta<typeof Phone>

export default meta
type Story = StoryObj<typeof meta>

const SampleContent = () => (
  <div style={{ padding: '20px', paddingTop: '50px' }}>
    <h2 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Welcome</h2>
    <p style={{ margin: 0, fontSize: '14px', color: 'gray' }}>
      This is sample mobile content displayed inside the phone mockup.
    </p>
  </div>
)

export const Default: Story = {
  args: {
    children: <SampleContent />,
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    children: <SampleContent />,
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
    children: <SampleContent />,
  },
}

export const WithNotch: Story = {
  args: {
    notchVariant: 'notch',
    children: <SampleContent />,
  },
}

export const DynamicIsland: Story = {
  args: {
    notchVariant: 'dynamicIsland',
    children: <SampleContent />,
  },
}

export const NoNotch: Story = {
  args: {
    notchVariant: 'none',
    children: <SampleContent />,
  },
}

export const LightFrame: Story = {
  args: {
    frameColor: 'light',
    children: <SampleContent />,
  },
}

export const BlueFrame: Story = {
  args: {
    frameColor: 'blue',
    children: <SampleContent />,
  },
}

export const WithStatusBar: Story = {
  args: {
    showStatusBar: true,
    statusBarTime: '10:30',
    children: <SampleContent />,
  },
}

export const NoHomeIndicator: Story = {
  args: {
    showHomeIndicator: false,
    children: <SampleContent />,
  },
}

export const FullConfiguration: Story = {
  args: {
    size: 'lg',
    notchVariant: 'dynamicIsland',
    frameColor: 'dark',
    showStatusBar: true,
    showHomeIndicator: true,
    statusBarTime: '9:41',
    children: (
      <div
        style={{
          padding: '20px',
          paddingTop: '60px',
          height: '100%',
          background: 'linear-gradient(to bottom, #667eea, #764ba2)',
        }}
      >
        <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: 'white' }}>My App</h2>
        <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
          A beautiful mobile experience
        </p>
      </div>
    ),
  },
}
