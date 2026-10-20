import React from 'react'

/**
 * Shared `@overeng/tui-react` primitives for vista's *block* commands (decision
 * 0063): the problems-first, `label: value` key-value layout that
 * `render.ts` produced by hand. Non-table commands (open/retire/new/rehydrate and
 * the debug family) compose these instead of concatenating strings, so colour and
 * symbol selection follow the resolved output mode (`ci-plain`/`log` degrade to
 * ASCII) with no manual ANSI.
 */
import { Box, Text } from '@overeng/tui-react'

/** A problem/warning item: a headline and its remediation. */
export interface Problem {
  readonly name: string
  readonly fix: string
}

/** A section heading (no indent), e.g. `service`, `diagnostics`, `next`. */
export const Heading = ({ children }: { children: React.ReactNode }): React.ReactElement => (
  <Text>{children}</Text>
)

/** A blank spacer line. */
export const Blank = (): React.ReactElement => <Text>{''}</Text>

/** A `  label: value` field line. `value` may be a coloured `<Text>` node. */
export const Field = ({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}): React.ReactElement => (
  <Text>
    {`  ${label}: `}
    {value}
  </Text>
)

/** An indented free-form line (`  text`). */
export const Item = ({ children }: { children: React.ReactNode }): React.ReactElement => (
  <Text>
    {'  '}
    {children}
  </Text>
)

/**
 * A problems-first `CRITICAL` section — rendered above the body so the reader
 * hits blockers before details (sk-cli-design). Empty → nothing.
 */
export const Problems = ({ items }: { items: readonly Problem[] }): React.ReactElement | null => {
  if (items.length === 0) return null
  return (
    <Box flexDirection="column">
      <Text bold color="red">
        CRITICAL
      </Text>
      <Blank />
      {items.map((item) => (
        <Box key={item.name} flexDirection="column">
          <Text bold>{`  ${item.name}`}</Text>
          <Text dim>{`    fix: ${item.fix}`}</Text>
        </Box>
      ))}
      <Blank />
      <Text dim>---</Text>
      <Blank />
    </Box>
  )
}

/**
 * The one-line marker appended after a non-canonical (loopback) URL so a human is
 * never misled into treating a `--local` loopback link as shareable (SVC-R55).
 */
export const NonCanonicalNote = ({
  canonical,
}: {
  canonical: boolean
}): React.ReactElement | null =>
  canonical ? null : (
    <Text color="yellow">
      {'  note: non-canonical loopback URL (--local); not reachable cross-host'}
    </Text>
  )

const yesNo = (value: boolean): string => (value ? 'yes' : 'no')

/** A `  label: yes|no` field. */
export const BoolField = ({
  label,
  value,
}: {
  label: string
  value: boolean
}): React.ReactElement => <Field label={label} value={yesNo(value)} />

/** The four resolved filesystem roots shared by the paths + service inspectors. */
export interface PathRoots {
  readonly root: string
  readonly apps: string
  readonly cache: string
  readonly deps: string
}

/** The writability/closure diagnostics a `debug paths`/`debug service` state carries. */
export interface PathDiagnostics {
  readonly rootInNixStore: boolean
  readonly rootWritable: boolean
  readonly reviewsWritable: boolean
  readonly cacheWritable: boolean
  readonly depsExists: boolean
}

/**
 * The writability/closure blockers shared by `debug paths` and `debug service`: a
 * non-writable apps/cache root or a missing dependency closure, each with its
 * remediation. Empty when the service dirs are all healthy.
 */
export const pathsProblems = (
  d: Pick<PathDiagnostics, 'reviewsWritable' | 'cacheWritable' | 'depsExists'>,
): readonly Problem[] => [
  ...(d.reviewsWritable
    ? []
    : [{ name: 'apps root is not writable', fix: 'set VISTA_APPS to a writable directory' }]),
  ...(d.cacheWritable
    ? []
    : [{ name: 'cache root is not writable', fix: 'set VISTA_CACHE to a writable directory' }]),
  ...(d.depsExists
    ? []
    : [{ name: 'dependency closure is missing', fix: 'run through the packaged vista wrapper' }]),
]

/**
 * The shared roots + diagnostics blocks of the `debug paths` / `debug service`
 * inspectors: the four resolved filesystem roots under `heading`, then the
 * writability/closure diagnostics. Emitted as a fragment so the caller owns the
 * surrounding layout (the leading spacer + any command-specific blocks above).
 */
export const PathsDiagnostics = ({
  heading,
  roots,
  diagnostics,
}: {
  heading: string
  roots: PathRoots
  diagnostics: PathDiagnostics
}): React.ReactElement => (
  <>
    <Heading>{heading}</Heading>
    <Field label="root" value={roots.root} />
    <Field label="apps" value={roots.apps} />
    <Field label="cache" value={roots.cache} />
    <Field label="deps" value={roots.deps} />
    <Blank />
    <Heading>diagnostics</Heading>
    <BoolField label="root in nix store" value={diagnostics.rootInNixStore} />
    <BoolField label="root writable" value={diagnostics.rootWritable} />
    <BoolField label="apps writable" value={diagnostics.reviewsWritable} />
    <BoolField label="cache writable" value={diagnostics.cacheWritable} />
    <BoolField label="deps exists" value={diagnostics.depsExists} />
  </>
)
