import type { Meta, StoryObj } from '@storybook/react'

import { CodeBlock } from '../src/components/CodeBlock/CodeBlock.tsx'

const meta = {
  title: 'Components/CodeBlock',
  component: CodeBlock,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    language: {
      control: 'select',
      options: [
        'javascript',
        'typescript',
        'jsx',
        'tsx',
        'html',
        'css',
        'json',
        'bash',
        'shell',
        'python',
        'go',
        'rust',
        'sql',
        'markdown',
        'yaml',
        'text',
      ],
    },
  },
} satisfies Meta<typeof CodeBlock>

export default meta
type Story = StoryObj<typeof meta>

const jsCode = `function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return true;
}

greet("World");`

const tsCode = `interface User {
  id: string;
  name: string;
  email: string;
}

const getUser = async (id: string): Promise<User> => {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
};`

const jsonCode = `{
  "name": "geist-design-system",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "tailwind-variants": "^0.1.0"
  }
}`

const bashCode = `# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build`

export const Default: Story = {
  args: {
    code: jsCode,
    language: 'javascript',
  },
}

export const TypeScript: Story = {
  args: {
    code: tsCode,
    language: 'typescript',
  },
}

export const JSON: Story = {
  args: {
    code: jsonCode,
    language: 'json',
  },
}

export const Bash: Story = {
  args: {
    code: bashCode,
    language: 'bash',
  },
}

export const WithFilename: Story = {
  args: {
    code: tsCode,
    language: 'typescript',
    filename: 'user-service.ts',
  },
}

export const WithLineNumbers: Story = {
  args: {
    code: tsCode,
    language: 'typescript',
    showLineNumbers: true,
  },
}

export const WithHighlightedLines: Story = {
  args: {
    code: tsCode,
    language: 'typescript',
    showLineNumbers: true,
    highlightLines: [1, 2, 3, 4, 5],
  },
}

export const NoCopyButton: Story = {
  args: {
    code: jsCode,
    language: 'javascript',
    showCopyButton: false,
  },
}

export const CustomStartLine: Story = {
  args: {
    code: jsCode,
    language: 'javascript',
    showLineNumbers: true,
    startingLineNumber: 42,
  },
}

export const PlainText: Story = {
  args: {
    code: 'This is plain text without any syntax highlighting.',
    language: 'text',
  },
}
