/** Preserve the installed Effect/Vista instances shared with Vite-loaded providers. */
export const serviceBundleExternal = [
  'effect',
  '@vista/blocks',
  '@effect/*',
  '@effect/atom-react',
  '@effect/opentelemetry',
  '@effect/platform-node',
  '@effect/vitest',
  '@vitejs/plugin-react',
  '@playwright/test',
  'vite',
  'typescript',
  'lightningcss',
  '@vista/telemetry-island',
  '@vista/interview/component',
  '@vista/interview',
  '@xterm/xterm',
  '@xterm/xterm/css/xterm.css?inline',
] as const

/** Node cannot strip workspace TypeScript reached through node_modules. */
export const publishWorkerBundleArgs = ({
  entrypoint,
  outfile,
  target,
}: {
  readonly entrypoint: string
  readonly outfile: string
  readonly target: 'bun' | 'node'
}): readonly string[] => [
  'build',
  entrypoint,
  `--target=${target}`,
  '--format=esm',
  `--outfile=${outfile}`,
  ...serviceBundleExternal
    .filter((name) => target !== 'node' || name !== '@vista/blocks')
    .map((name) => `--external=${name}`),
]
