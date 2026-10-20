import type { Meta, StoryObj } from '@storybook/react'

import { Grid, GridItem } from '../src/components/Grid/Grid.tsx'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta: Meta<typeof Grid> = {
  title: 'Components/Grid',
  component: Grid,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    columns: {
      control: 'select',
      options: [1, 2, 3, 4, 5, 6, 12],
    },
    gap: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch'],
    },
    justify: {
      control: 'select',
      options: ['start', 'center', 'end', 'between'],
    },
    flow: {
      control: 'select',
      options: ['row', 'col', 'dense', 'rowDense', 'colDense'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

const Box = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      padding: '16px',
      background: tokens['--ds-gray-200'],
      borderRadius: '8px',
      textAlign: 'center',
    }}
  >
    {children}
  </div>
)

export const Default: Story = {
  render: (args) => (
    <Grid {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
      <Box>Item 4</Box>
    </Grid>
  ),
  args: {
    columns: 2,
    gap: 4,
  },
}

export const ThreeColumns: Story = {
  render: (args) => (
    <Grid {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
      <Box>Item 4</Box>
      <Box>Item 5</Box>
      <Box>Item 6</Box>
    </Grid>
  ),
  args: {
    columns: 3,
    gap: 4,
  },
}

export const FourColumns: Story = {
  render: (args) => (
    <Grid {...args}>
      <Box>1</Box>
      <Box>2</Box>
      <Box>3</Box>
      <Box>4</Box>
      <Box>5</Box>
      <Box>6</Box>
      <Box>7</Box>
      <Box>8</Box>
    </Grid>
  ),
  args: {
    columns: 4,
    gap: 4,
  },
}

export const WithSpanning: Story = {
  render: (args) => (
    <Grid {...args}>
      <GridItem colSpan={2}>
        <Box>Span 2 columns</Box>
      </GridItem>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
      <GridItem colSpan={3}>
        <Box>Span 3 columns</Box>
      </GridItem>
    </Grid>
  ),
  args: {
    columns: 3,
    gap: 4,
  },
}

export const TwelveColumnLayout: Story = {
  render: (args) => (
    <Grid {...args}>
      <GridItem colSpan={4}>
        <Box>Sidebar (4 cols)</Box>
      </GridItem>
      <GridItem colSpan={8}>
        <Box>Main Content (8 cols)</Box>
      </GridItem>
    </Grid>
  ),
  args: {
    columns: 12,
    gap: 4,
  },
}

export const DifferentGaps: Story = {
  render: (args) => (
    <Grid {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
      <Box>Item 4</Box>
    </Grid>
  ),
  args: {
    columns: 2,
    gapX: 8,
    gapY: 2,
  },
}

export const CenterAligned: Story = {
  render: (args) => (
    <Grid {...args}>
      <Box>Short</Box>
      <div style={{ padding: '32px', background: tokens['--ds-gray-200'], borderRadius: '8px' }}>
        Tall Item
      </div>
      <Box>Short</Box>
    </Grid>
  ),
  args: {
    columns: 3,
    gap: 4,
    align: 'center',
  },
}

export const SingleColumn: Story = {
  render: (args) => (
    <Grid {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Grid>
  ),
  args: {
    columns: 1,
    gap: 4,
  },
}
