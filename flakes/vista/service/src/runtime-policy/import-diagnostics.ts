import { relative } from 'node:path'

import { Schema } from 'effect'

import { diagnoseVistaClientImport } from './import-classifier.ts'
import { ImportPolicyProblem, RuntimePolicyError } from './schema.ts'

const decodeImportPolicyProblem = Schema.decodeUnknownSync(ImportPolicyProblem)

/**
 * Builds a structured import-policy problem record for a source specifier, annotating it with its
 * diagnostic and resolving the importer path relative to the app root when possible.
 */
export const importPolicyProblem = ({
  root,
  importer,
  source,
}: {
  readonly root: string
  readonly importer?: string
  readonly source: string
}): ImportPolicyProblem => {
  const diagnostic = diagnoseVistaClientImport(source)
  return decodeImportPolicyProblem({
    source,
    ...(importer === undefined ? {} : { importer, relativeImporter: relative(root, importer) }),
    diagnostic,
  })
}

/**
 * Renders a policy problem as one human-readable line joining the importer, the imported source,
 * the classification reason, and the remediation guidance.
 */
export const formatImportPolicyProblem = (problem: ImportPolicyProblem): string =>
  [
    `${problem.relativeImporter ?? problem.importer ?? '<unknown>'} imports ${problem.source}`,
    problem.diagnostic.classification.reason,
    problem.diagnostic.guidance,
  ].join(' - ')

/** Constructs a RuntimePolicyError indicating that the given Vista app source root is not a directory. */
export const runtimePolicySourceRootError = (root: string): RuntimePolicyError =>
  new RuntimePolicyError({
    message: `Vista app source root is not a directory: ${root}`,
    problems: [`not a directory: ${root}`],
  })

/**
 * Constructs a RuntimePolicyError for a source root whose imports violate policy, embedding a
 * bulleted list of the formatted problems for reporting.
 */
export const runtimePolicyImportError = ({
  root,
  problems,
}: {
  readonly root: string
  readonly problems: readonly ImportPolicyProblem[]
}): RuntimePolicyError =>
  new RuntimePolicyError({
    message: [
      `Vista app source imports are outside the runtime policy: ${root}`,
      ...problems.map((problem) => `- ${formatImportPolicyProblem(problem)}`),
    ].join('\n'),
    problems: problems.map(formatImportPolicyProblem),
    importProblems: [...problems],
  })
