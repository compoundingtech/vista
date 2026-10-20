import type { Meta, StoryObj } from '@storybook/react'

import { Button } from '../src/components/Button/Button.tsx'
import { ProjectBanner } from '../src/components/ProjectBanner/ProjectBanner.tsx'

const meta = {
  title: 'Components/ProjectBanner',
  component: ProjectBanner,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'error', 'building'],
    },
  },
} satisfies Meta<typeof ProjectBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Project Status',
    description: 'Your project is ready to deploy',
  },
}

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Deployment Successful',
    description: 'Your changes are now live',
  },
}

export const Warning: Story = {
  args: {
    variant: 'warning',
    title: 'Action Required',
    description: 'Your domain certificate expires in 7 days',
  },
}

export const Error: Story = {
  args: {
    variant: 'error',
    title: 'Build Failed',
    description: 'There was an error during the build process',
  },
}

export const Building: Story = {
  args: {
    variant: 'building',
    title: 'Building...',
    description: 'Your deployment is in progress',
  },
}

export const WithActions: Story = {
  args: {
    variant: 'success',
    title: 'Deployment Ready',
    description: 'Your preview is ready to view',
    actions: (
      <>
        <Button size="sm" variant="secondary">
          View Logs
        </Button>
        <Button size="sm">Visit Site</Button>
      </>
    ),
  },
}

export const WarningWithAction: Story = {
  args: {
    variant: 'warning',
    title: 'Certificate Expiring',
    description: 'Your SSL certificate expires in 3 days',
    actions: <Button size="sm">Renew Now</Button>,
  },
}

export const ErrorWithRetry: Story = {
  args: {
    variant: 'error',
    title: 'Deployment Failed',
    description: 'Unable to connect to the database',
    actions: (
      <>
        <Button size="sm" variant="secondary">
          View Logs
        </Button>
        <Button size="sm" variant="error">
          Retry
        </Button>
      </>
    ),
  },
}

export const TitleOnly: Story = {
  args: {
    variant: 'success',
    title: 'All systems operational',
  },
}
