import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { ShowMore } from '../src/components/ShowMore/ShowMore.tsx'
import { tokens } from '../src/foundations/tokens.stylex.ts'

const meta = {
  title: 'Components/ShowMore',
  component: ShowMore,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    maxHeight: {
      control: 'number',
    },
  },
} satisfies Meta<typeof ShowMore>

export default meta
type Story = StoryObj<typeof meta>

const storyStyles = stylex.create({
  prose: {
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  list: {
    margin: 0,
    paddingLeft: '20px',
  },
  listItem: {
    marginBottom: '8px',
  },
  cardStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    padding: '16px',
    backgroundColor: tokens['--ds-gray-100'],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '8px',
  },
  cardHeading: {
    margin: 0,
    marginBottom: '8px',
  },
  cardCopy: {
    margin: 0,
    color: tokens['--ds-gray-900'],
    fontSize: '14px',
  },
  shortCopy: {
    margin: 0,
  },
})

const longText = `
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. 

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
`

export const Default: Story = {
  args: {
    children: <p {...stylex.props(storyStyles.prose)}>{longText}</p>,
    maxHeight: 100,
  },
}

export const TallerMaxHeight: Story = {
  args: {
    children: <p {...stylex.props(storyStyles.prose)}>{longText}</p>,
    maxHeight: 150,
  },
}

export const CustomButtonText: Story = {
  args: {
    children: <p {...stylex.props(storyStyles.prose)}>{longText}</p>,
    maxHeight: 100,
    moreText: 'Read more',
    lessText: 'Collapse',
  },
}

export const DefaultExpanded: Story = {
  args: {
    children: <p {...stylex.props(storyStyles.prose)}>{longText}</p>,
    maxHeight: 100,
    defaultExpanded: true,
  },
}

export const WithListContent: Story = {
  args: {
    children: (
      <ul {...stylex.props(storyStyles.list)}>
        {Array.from({ length: 15 }).map((_, i) => (
          <li key={i} {...stylex.props(storyStyles.listItem)}>
            Item {i + 1}: This is a list item with some descriptive text.
          </li>
        ))}
      </ul>
    ),
    maxHeight: 120,
  },
}

export const WithCardContent: Story = {
  args: {
    children: (
      <div {...stylex.props(storyStyles.cardStack)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} {...stylex.props(storyStyles.card)}>
            <h4 {...stylex.props(storyStyles.cardHeading)}>Card {i + 1}</h4>
            <p {...stylex.props(storyStyles.cardCopy)}>Some card content here.</p>
          </div>
        ))}
      </div>
    ),
    maxHeight: 200,
  },
}

export const ShortContent: Story = {
  args: {
    children: (
      <p {...stylex.props(storyStyles.shortCopy)}>
        This content is short and doesn't need to be truncated.
      </p>
    ),
    maxHeight: 100,
  },
}
