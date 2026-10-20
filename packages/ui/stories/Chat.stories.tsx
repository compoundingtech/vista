/**
 * @see https://v0.app/chat - Design reference for AI chat components
 */

import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'

import { Avatar } from '../src/components/Avatar/mod.ts'
import {
  ChatMessage,
  ReasoningBlock,
  ToolCallBlock,
  ToolCallGroup,
  ChatInput,
  StreamingIndicator,
  FeedbackButtons,
  CopyIcon,
  type FeedbackValue,
} from '../src/components/Chat/mod.ts'
import { scale } from '../src/foundations/tokens.stylex.ts'

// Chat's v0 surface stays black in both themes; the theme's light background
// and gray tokens do not match the original fixed oklch chat palette.
const storyStyles = stylex.create({
  canvas: {
    width: '600px',
    padding: scale.space4,
    backgroundColor: '#000',
  },
  canvasWide: {
    width: '700px',
    padding: scale.space6,
    backgroundColor: '#000',
  },
  stack1: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
  },
  stack2: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space2,
  },
  stack6: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space6,
  },
  row2: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
  },
  foregroundText: {
    color: 'oklch(0.946 0 0)',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  mutedText: {
    color: 'oklch(0.706 0 0)',
  },
  textXs: {
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  marginTop2: {
    marginTop: scale.space2,
  },
  list: {
    marginTop: scale.space2,
    listStylePosition: 'inside',
    listStyleType: 'disc',
  },
  listItemSpaced: {
    marginTop: scale.space1,
  },
  copyButton: {
    padding: '0.375rem',
    borderRadius: '0.375rem',
    color: {
      default: 'oklch(0.5 0 0)',
      ':hover': {
        default: 'oklch(0.5 0 0)',
        '@media (hover: hover)': 'oklch(0.706 0 0)',
      },
    },
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: 'transparent',
        '@media (hover: hover)': 'oklch(0.2 0 0)',
      },
    },
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
})

/** Reusable copy button for user messages */
const CopyButton = () => (
  <button {...stylex.props(storyStyles.copyButton)} onClick={() => console.log('copy')}>
    <CopyIcon />
  </button>
)

/* =============================================================================
 * ChatMessage Stories
 * ============================================================================= */

const chatMessageMeta = {
  title: 'Components/Chat/Message',
  component: ChatMessage,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ChatMessage>

export default chatMessageMeta
type ChatMessageStory = StoryObj<typeof chatMessageMeta>

export const User: ChatMessageStory = {
  args: {
    role: 'user',
    children: 'Help me build a dashboard with real-time analytics',
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ChatMessage {...args} avatar={<Avatar size="sm" fallback="JS" />} actions={<CopyButton />} />
    </div>
  ),
}

export const Assistant: ChatMessageStory = {
  args: {
    role: 'assistant',
    children:
      "I'll help you build a real-time analytics dashboard. Let me break this down into manageable steps: setting up the data layer, creating visualization components, and implementing live updates.",
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ChatMessage {...args} />
    </div>
  ),
}

export const System: ChatMessageStory = {
  args: {
    role: 'system',
    children: 'System initialized. Model: claude-3.5-sonnet',
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ChatMessage {...args} />
    </div>
  ),
}

export const WithActions: ChatMessageStory = {
  args: {
    role: 'assistant',
    children:
      "I've completed the dashboard implementation with all the requested features including charts, filters, and export functionality.",
  },
  render: (args) => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ChatMessage
        {...args}
        actions={
          <FeedbackButtons
            onUpvote={() => console.log('upvote')}
            onDownvote={() => console.log('downvote')}
          />
        }
      />
    </div>
  ),
}

/* =============================================================================
 * ReasoningBlock Stories
 * ============================================================================= */

export const ReasoningCollapsed: StoryObj<typeof ReasoningBlock> = {
  name: 'Reasoning / Collapsed',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ReasoningBlock title="Thought for 5s">
        The user wants a real-time analytics dashboard. I should consider the data sources, update
        frequency, and which visualization libraries would work best for their use case.
      </ReasoningBlock>
    </div>
  ),
}

export const ReasoningExpanded: StoryObj<typeof ReasoningBlock> = {
  name: 'Reasoning / Expanded',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ReasoningBlock title="Thought for 5s" defaultExpanded>
        The user wants a real-time analytics dashboard. I need to consider several aspects:
        <ul {...stylex.props(storyStyles.list)}>
          <li>Data sources and API integration</li>
          <li {...stylex.props(storyStyles.listItemSpaced)}>
            WebSocket vs polling for live updates
          </li>
          <li {...stylex.props(storyStyles.listItemSpaced)}>
            Chart library selection (recharts, chart.js, etc.)
          </li>
          <li {...stylex.props(storyStyles.listItemSpaced)}>State management for real-time data</li>
        </ul>
      </ReasoningBlock>
    </div>
  ),
}

export const ReasoningAnimated: StoryObj<typeof ReasoningBlock> = {
  name: 'Reasoning / Animated',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ReasoningBlock title="Thinking..." animated>
        Currently processing...
      </ReasoningBlock>
    </div>
  ),
}

export const ReasoningWithDuration: StoryObj<typeof ReasoningBlock> = {
  name: 'Reasoning / With Duration',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ReasoningBlock duration={3}>Quick thought about the implementation approach.</ReasoningBlock>
    </div>
  ),
}

/* =============================================================================
 * ToolCallBlock Stories
 * ============================================================================= */

export const ToolCallPending: StoryObj<typeof ToolCallBlock> = {
  name: 'Tool Call / Pending',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ToolCallBlock name="read_file" status="pending">
        Reading file: src/components/Dashboard.tsx
      </ToolCallBlock>
    </div>
  ),
}

export const ToolCallRunning: StoryObj<typeof ToolCallBlock> = {
  name: 'Tool Call / Running',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ToolCallBlock name="execute_command" status="running">
        Running: npm install
      </ToolCallBlock>
    </div>
  ),
}

export const ToolCallSuccess: StoryObj<typeof ToolCallBlock> = {
  name: 'Tool Call / Success',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ToolCallBlock name="Created dashboard components" status="success" defaultExpanded>
        <div {...stylex.props(storyStyles.stack1)}>
          <div {...stylex.props(storyStyles.mutedText)}>components/Chart.tsx</div>
          <div {...stylex.props(storyStyles.mutedText)}>components/MetricCard.tsx</div>
          <div {...stylex.props(storyStyles.mutedText)}>components/DataTable.tsx</div>
        </div>
      </ToolCallBlock>
    </div>
  ),
}

export const ToolCallError: StoryObj<typeof ToolCallBlock> = {
  name: 'Tool Call / Error',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ToolCallBlock name="error_occurred" status="error">
        Failed to connect to the server. Please check your network connection.
      </ToolCallBlock>
    </div>
  ),
}

export const ToolCallIconVariants: StoryObj<typeof ToolCallBlock> = {
  name: 'Tool Call / Icon Variants',
  render: () => (
    <div {...stylex.props(storyStyles.canvas, storyStyles.stack2)}>
      <ToolCallBlock name="read_file" status="success" />
      <ToolCallBlock name="write_file" status="success" />
      <ToolCallBlock name="search_code" status="success" />
      <ToolCallBlock name="execute_command" status="running" />
      <ToolCallBlock name="thinking" status="pending" />
      <ToolCallBlock name="complete_task" status="success" />
      <ToolCallBlock name="generic_tool" status="success" />
    </div>
  ),
}

/* =============================================================================
 * ToolCallGroup Stories
 * ============================================================================= */

export const ToolGroupCollapsed: StoryObj<typeof ToolCallGroup> = {
  name: 'Tool Group / Collapsed',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ToolCallGroup>
        <ToolCallBlock name="read_file" status="success" />
        <ToolCallBlock name="read_file" status="success" />
        <ToolCallBlock name="grep_code" status="success" />
        <ToolCallBlock name="read_file" status="success" />
        <ToolCallBlock name="grep_code" status="success" />
      </ToolCallGroup>
    </div>
  ),
}

export const ToolGroupExpanded: StoryObj<typeof ToolCallGroup> = {
  name: 'Tool Group / Expanded',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ToolCallGroup defaultExpanded>
        <ToolCallBlock name="read_file" status="success" />
        <ToolCallBlock name="read_file" status="success" />
        <ToolCallBlock name="grep_code" status="success" />
        <ToolCallBlock name="read_file" status="success" />
        <ToolCallBlock name="grep_code" status="success" />
      </ToolCallGroup>
    </div>
  ),
}

export const ToolGroupWithLabel: StoryObj<typeof ToolCallGroup> = {
  name: 'Tool Group / With Label',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ToolCallGroup label="Explored codebase">
        <ToolCallBlock name="read_file" status="success" />
        <ToolCallBlock name="grep_code" status="success" />
        <ToolCallBlock name="read_file" status="success" />
      </ToolCallGroup>
    </div>
  ),
}

export const ToolGroupMixed: StoryObj<typeof ToolCallGroup> = {
  name: 'Tool Group / Mixed with Reasoning',
  render: () => (
    <div {...stylex.props(storyStyles.canvas, storyStyles.stack2)}>
      <ReasoningBlock duration={3}>
        Let me explore the codebase to understand the structure.
      </ReasoningBlock>
      <ToolCallGroup label="Explored codebase">
        <ToolCallBlock name="read_file" status="success" />
        <ToolCallBlock name="read_file" status="success" />
        <ToolCallBlock name="grep_code" status="success" />
        <ToolCallBlock name="read_file" status="success" />
      </ToolCallGroup>
      <ReasoningBlock duration={2}>
        Now I understand the architecture, let me implement the changes.
      </ReasoningBlock>
      <ToolCallGroup label="Made changes">
        <ToolCallBlock name="write_file" status="success" />
        <ToolCallBlock name="write_file" status="success" />
      </ToolCallGroup>
    </div>
  ),
}

/* =============================================================================
 * ChatInput Stories
 * ============================================================================= */

export const InputEmpty: StoryObj<typeof ChatInput> = {
  name: 'Input / Empty',
  render: () => {
    const [value, setValue] = useState('')
    return (
      <div {...stylex.props(storyStyles.canvas)}>
        <ChatInput
          value={value}
          onChange={setValue}
          onSubmit={() => console.log('Submit:', value)}
          placeholder="Type a message..."
        />
      </div>
    )
  },
}

export const InputWithValue: StoryObj<typeof ChatInput> = {
  name: 'Input / With Value',
  render: () => {
    const [value, setValue] = useState(
      'Build a modern dashboard with charts and data visualization',
    )
    return (
      <div {...stylex.props(storyStyles.canvas)}>
        <ChatInput
          value={value}
          onChange={setValue}
          onSubmit={() => console.log('Submit:', value)}
        />
      </div>
    )
  },
}

export const InputDisabled: StoryObj<typeof ChatInput> = {
  name: 'Input / Disabled',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <ChatInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        placeholder="Wait for response..."
        disabled
      />
    </div>
  ),
}

/* =============================================================================
 * StreamingIndicator Stories
 * ============================================================================= */

export const StreamingCursor: StoryObj<typeof StreamingIndicator> = {
  name: 'Streaming / Cursor',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <p {...stylex.props(storyStyles.foregroundText)}>
        I'm currently generating a response
        <StreamingIndicator variant="cursor" />
      </p>
    </div>
  ),
}

export const StreamingDots: StoryObj<typeof StreamingIndicator> = {
  name: 'Streaming / Dots',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <p {...stylex.props(storyStyles.foregroundText, storyStyles.row2)}>
        Generating response
        <StreamingIndicator variant="dots" />
      </p>
    </div>
  ),
}

/* =============================================================================
 * FeedbackButtons Stories
 * ============================================================================= */

export const FeedbackDefault: StoryObj<typeof FeedbackButtons> = {
  name: 'Feedback / Default',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <FeedbackButtons
        onUpvote={() => console.log('upvote')}
        onDownvote={() => console.log('downvote')}
      />
    </div>
  ),
}

export const FeedbackUpvoted: StoryObj<typeof FeedbackButtons> = {
  name: 'Feedback / Upvoted',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <FeedbackButtons
        onUpvote={() => console.log('upvote')}
        onDownvote={() => console.log('downvote')}
        value="up"
      />
    </div>
  ),
}

export const FeedbackDownvoted: StoryObj<typeof FeedbackButtons> = {
  name: 'Feedback / Downvoted',
  render: () => (
    <div {...stylex.props(storyStyles.canvas)}>
      <FeedbackButtons
        onUpvote={() => console.log('upvote')}
        onDownvote={() => console.log('downvote')}
        value="down"
      />
    </div>
  ),
}

export const FeedbackInteractive: StoryObj<typeof FeedbackButtons> = {
  name: 'Feedback / Interactive',
  render: () => {
    const [value, setValue] = useState<FeedbackValue>(null)
    return (
      <div {...stylex.props(storyStyles.canvas)}>
        <FeedbackButtons
          onUpvote={() => setValue(value === 'up' ? null : 'up')}
          onDownvote={() => setValue(value === 'down' ? null : 'down')}
          value={value}
        />
        <p {...stylex.props(storyStyles.mutedText, storyStyles.textXs, storyStyles.marginTop2)}>
          Current value: {value ?? 'none'}
        </p>
      </div>
    )
  },
}

/* =============================================================================
 * Full Conversation Examples
 * ============================================================================= */

export const FullConversation: StoryObj<typeof ChatMessage> = {
  name: 'Full Conversation',
  render: () => (
    <div {...stylex.props(storyStyles.canvasWide, storyStyles.stack6)}>
      {/* User message - right aligned with bubble */}
      <ChatMessage role="user" avatar={<Avatar size="sm" fallback="JS" />} actions={<CopyButton />}>
        Help me build a dashboard with real-time analytics
      </ChatMessage>

      {/* Assistant response with reasoning and tool calls */}
      <div {...stylex.props(storyStyles.stack2)}>
        <ReasoningBlock duration={5}>
          The user wants a real-time analytics dashboard. I should consider data sources, update
          frequency, and visualization libraries.
        </ReasoningBlock>

        <ChatMessage role="assistant">
          I'll help you build a real-time analytics dashboard. Let me break this down into
          manageable steps and set up the core components.
        </ChatMessage>

        <ToolCallGroup label="Analyzed codebase">
          <ToolCallBlock name="read_file" status="success" />
          <ToolCallBlock name="read_file" status="success" />
          <ToolCallBlock name="grep_code" status="success" />
        </ToolCallGroup>

        <ToolCallBlock name="Created dashboard components" status="success" defaultExpanded>
          <div {...stylex.props(storyStyles.stack1, storyStyles.textXs)}>
            <div>components/Chart.tsx</div>
            <div>components/MetricCard.tsx</div>
            <div>hooks/useRealtimeData.ts</div>
          </div>
        </ToolCallBlock>

        <ChatMessage role="assistant">
          I've set up the dashboard with real-time data fetching, interactive charts, and metric
          cards that update automatically.
        </ChatMessage>

        <div {...stylex.props(storyStyles.row2)}>
          <FeedbackButtons
            onUpvote={() => console.log('upvote')}
            onDownvote={() => console.log('downvote')}
          />
          <span {...stylex.props(storyStyles.mutedText, storyStyles.textXs)}>2m ago</span>
        </div>
      </div>

      {/* Input */}
      <ChatInput value="" onChange={() => {}} onSubmit={() => {}} placeholder="Type a message..." />
    </div>
  ),
}

/** Full conversation example matching v0 design with multiple grouped tool calls */
export const FullConversationGrouped: StoryObj<typeof ChatMessage> = {
  name: 'Full Conversation / Grouped Tools',
  render: () => (
    <div {...stylex.props(storyStyles.canvasWide, storyStyles.stack6)}>
      {/* First user message */}
      <ChatMessage role="user" avatar={<Avatar size="sm" fallback="JS" />} actions={<CopyButton />}>
        build a tiny garden planner demo
      </ChatMessage>

      {/* First assistant response */}
      <div {...stylex.props(storyStyles.stack2)}>
        <ReasoningBlock duration={5}>
          I'll help you build a tiny garden planner demo! This synthetic example explores a cozy
          seasonal planting space.
        </ReasoningBlock>

        <ChatMessage role="assistant">
          I'll help you build a tiny garden planner demo! Let me break this down into smaller tasks
          and create a cheerful seasonal planting experience.
        </ChatMessage>

        <ToolCallGroup label="Generated garden design inspiration">
          <ToolCallBlock name="search_design" status="success" />
          <ToolCallBlock name="read_file" status="success" />
        </ToolCallGroup>

        <ToolCallGroup label="Planned garden demo structure">
          <ToolCallBlock name="create_file" status="success" />
          <ToolCallBlock name="create_file" status="success" />
          <ToolCallBlock name="create_file" status="success" />
        </ToolCallGroup>

        <ReasoningBlock duration={3}>
          Now let me set up the planting board with a simple seasonal garden look.
        </ReasoningBlock>

        <ToolCallGroup label="Set up garden planting board">
          <ToolCallBlock name="write_file" status="success" />
          <ToolCallBlock name="write_file" status="success" />
          <ToolCallBlock name="write_file" status="success" />
        </ToolCallGroup>

        <ChatMessage role="assistant">
          I've successfully set up the planting board for the garden planner demo with a cheerful
          seasonal aesthetic. The implementation includes updated color shades that match the
          soft leaf green/sand theme.
        </ChatMessage>

        <ReasoningBlock duration={2}>
          Let me build out the planting list interface next.
        </ReasoningBlock>

        <ToolCallGroup label="Built planting list interface">
          <ToolCallBlock name="read_file" status="success" />
          <ToolCallBlock name="write_file" status="success" />
          <ToolCallBlock name="write_file" status="success" />
          <ToolCallBlock name="write_file" status="success" />
        </ToolCallGroup>

        <ChatMessage role="assistant">
          I've successfully built the complete planting list interface with a cheerful garden style.
          The implementation includes a searchable planting list organized by season groups
          (Spring/Summer/Autumn), draggable plot cards with planting history, and a summary bar with
          view controls.
        </ChatMessage>

        <ToolCallBlock name="No issues found" status="success" />
        <ToolCallBlock name="Worked for 6m 49s" status="success" />

        <div {...stylex.props(storyStyles.row2)}>
          <FeedbackButtons
            onUpvote={() => console.log('upvote')}
            onDownvote={() => console.log('downvote')}
          />
          <span {...stylex.props(storyStyles.mutedText, storyStyles.textXs)}>141d ago</span>
        </div>
      </div>

      {/* Second user message */}
      <ChatMessage role="user" avatar={<Avatar size="sm" fallback="JS" />} actions={<CopyButton />}>
        add more detail
      </ChatMessage>

      {/* Second assistant response */}
      <div {...stylex.props(storyStyles.stack2)}>
        <ReasoningBlock duration={1}>
          Let me read the current files and improve the garden demo with more seasonal details.
        </ReasoningBlock>

        <ToolCallGroup label="Read current files">
          <ToolCallBlock name="read_file" status="success" />
          <ToolCallBlock name="read_file" status="success" />
          <ToolCallBlock name="read_file" status="success" />
          <ToolCallBlock name="read_file" status="success" />
          <ToolCallBlock name="read_file" status="success" />
          <ToolCallBlock name="read_file" status="success" />
          <ToolCallBlock name="read_file" status="success" />
          <ToolCallBlock name="read_file" status="success" />
        </ToolCallGroup>

        <ChatMessage role="assistant">
          Now I have a good understanding of the current state. Let me thoughtfully improve this
          garden demo with more seasonal details and clearer visuals.
        </ChatMessage>

        <ToolCallBlock name="Enhancing garden demo" status="running" />
      </div>

      {/* Input */}
      <ChatInput value="" onChange={() => {}} onSubmit={() => {}} placeholder="Type a message..." />
    </div>
  ),
}
