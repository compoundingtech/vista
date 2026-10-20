import type { Meta, StoryObj } from '@storybook/react-vite'

import { CodeBlock } from '../blocks/CodeBlock.tsx'

const samples = {
  kdl: 'mission "release" {\n  step "verify" seat="reviewer"\n  step "ship" after="verify"\n}',
  ts: 'export const greeting = (name: string): string => `Hello ${name}`',
  tsx: 'export const Greeting = ({ name }: { name: string }) => <h2>{name}</h2>',
  json: '{ "ready": true, "steps": ["verify", "ship"] }',
  nix: '{ pkgs, ... }: { packages = [ pkgs.git ]; }',
  bash: '# Run only the focused suite\nCI=1 pnpm exec vitest run CodeBlock.test.tsx',
  rust: 'fn main() {\n    let ready = true;\n    println!("ready: {}", ready);\n}',
}
const meta = {
  title: 'Vista/Blocks/Code/Code Block',
  component: CodeBlock,
  args: { code: samples.ts, language: 'ts' },
} satisfies Meta<typeof CodeBlock>
export default meta
type Story = StoryObj<typeof meta>
/** Highlights an explicitly labelled TypeScript snippet. */
export const Default: Story = {}
/** Shows the line-number gutter beside a KDL snippet. */
export const LineNumbers: Story = {
  args: { code: samples.kdl, language: 'kdl', lineNumbers: true },
}
/** Wraps long source lines within the available document width. */
export const Wrapped: Story = {
  args: {
    code: `const explanation = "${'A long line stays readable without widening the document. '.repeat(8)}"`,
    language: 'ts',
    wrap: true,
  },
}
/** Infers the grammar from the supplied source filename. */
export const FilenameInference: Story = {
  args: { code: samples.rust, language: undefined, filename: 'main.rs' },
}
/** Compares supported grammars, unlabelled text, and empty snippets. */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
      {Object.entries(samples).map(([language, code]) => (
        <CodeBlock key={language} code={code} language={language} lineNumbers />
      ))}
      <CodeBlock code={'Unlabelled plain text\n<script>never executable</script>'} />
      <CodeBlock code="" />
    </div>
  ),
}
