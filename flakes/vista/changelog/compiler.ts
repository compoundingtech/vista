import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Schema } from 'effect'

import {
  ChangelogManifestV1Schema,
  decodeChangelogEntrySource,
  decodeChangelogManifestV1,
  type ChangelogManifestV1,
  type ChangelogSourceRegistration,
} from './contract.ts'

const encodeManifest = Schema.encodeSync(Schema.fromJsonString(ChangelogManifestV1Schema))
const ENTRY_FILENAME = /^(?<date>\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/u

export class ChangelogCompileError extends Error {
  readonly _tag = 'Vista.ChangelogCompileError'

  constructor(message: string) {
    super(message)
    this.name = 'ChangelogCompileError'
  }
}

const fail = (message: string): never => {
  throw new ChangelogCompileError(message)
}

const duplicateValues = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].toSorted()
}

const assertCalendarDate = ({ date, file }: { date: string; file: string }): void => {
  const [yearText, monthText, dayText] = date.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    fail(`changelog filename has an invalid calendar date: ${file}`)
  }
}

const identityFromFilename = (file: string): { readonly id: string; readonly date: string } => {
  const match = ENTRY_FILENAME.exec(file)
  const date = match?.groups?.date
  if (date === undefined) {
    return fail(`changelog entry must be named YYYY-MM-DD-slug.ts: ${file}`)
  }
  assertCalendarDate({ date, file })
  return { id: file.slice(0, -'.ts'.length), date }
}

export const compileChangelog = ({
  registry,
  product,
  machineVersion,
}: {
  readonly registry: readonly ChangelogSourceRegistration[]
  readonly product: string
  readonly machineVersion: string
}): { readonly manifest: ChangelogManifestV1; readonly bytes: string } => {
  const entries = registry
    .map(({ file, source }) => ({
      ...identityFromFilename(file),
      ...decodeChangelogEntrySource(source),
    }))
    .toSorted((left, right) => {
      if (left.date !== right.date) return left.date < right.date ? 1 : -1
      if (left.id === right.id) return 0
      return left.id < right.id ? 1 : -1
    })

  const duplicateIds = duplicateValues(entries.map(({ id }) => id))
  if (duplicateIds.length > 0) {
    fail(`duplicate changelog entry ids: ${duplicateIds.join(', ')}`)
  }

  const manifest = decodeChangelogManifestV1({
    schemaVersion: 1,
    product,
    build: { machineVersion },
    entries,
  })
  return { manifest, bytes: `${encodeManifest(manifest)}\n` }
}

interface CompilerArguments {
  readonly machineVersion: string
  readonly output: string
  readonly sourceDirectory: string
}

const requiredValue = ({ args, name }: { args: readonly string[]; name: string }): string => {
  const index = args.indexOf(name)
  const value = index < 0 ? undefined : args[index + 1]
  if (value === undefined || value.startsWith('--')) return fail(`missing required ${name} value`)
  return value
}

const parseArguments = (args: readonly string[]): CompilerArguments => ({
  machineVersion: requiredValue({ args, name: '--machine-version' }),
  output: requiredValue({ args, name: '--output' }),
  sourceDirectory:
    args.includes('--source-directory') === true
      ? requiredValue({ args, name: '--source-directory' })
      : fileURLToPath(new URL('../.changelog/', import.meta.url)),
})

export const discoverChangelogEntries = async (
  sourceDirectory: string,
): Promise<readonly ChangelogSourceRegistration[]> => {
  const files = (await readdir(sourceDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .toSorted()
  return Promise.all(
    files.map(async (file) => {
      identityFromFilename(file)
      const url = pathToFileURL(resolve(sourceDirectory, file)).href
      // Entry modules are selected at runtime, not a shared index.
      // oxlint-disable-next-line import/no-dynamic-require
      const module: { readonly entry?: unknown } = await import(/* @vite-ignore */ url)
      return { file, source: decodeChangelogEntrySource(module.entry) }
    }),
  )
}

const runCompiler = async (): Promise<void> => {
  const { machineVersion, output, sourceDirectory } = parseArguments(process.argv.slice(2))
  const { bytes } = compileChangelog({
    registry: await discoverChangelogEntries(sourceDirectory),
    product: 'vista',
    machineVersion,
  })
  await Bun.write(output, bytes)
}

if (import.meta.main) await runCompiler()
