import { createHash } from 'node:crypto'

import { NodeServices } from '@effect/platform-node'
import {
  CheckEvent,
  CheckRun,
  ChecksState,
  ChangedFile,
  gh,
  GhApi,
  GhError,
  PullRequestData,
  type PullRequestFile,
  PullRequestChecksSummary,
  PrSummary,
  WorkflowRunDetails,
} from '@vista/blocks/internal/provider-contracts'
import { Context, Duration, Effect, Layer, Metric, Ref, Schedule, Schema, Stream } from 'effect'
import { ChildProcess } from 'effect/process'

import { providerRateLimitRemaining } from '../../metrics.ts'
import { implement, mountProvider } from '../provider.ts'

export { CheckEvent, ChecksState, ChangedFile, GhApi, GhError, PullRequestData, PrSummary }

const strict = { onExcessProperty: 'error' } as const
const prViewFields = [
  'number',
  'title',
  'url',
  'author',
  'state',
  'baseRefName',
  'headRefName',
  'additions',
  'deletions',
  'body',
  'commits',
].join(',')
const fileProjection =
  'map({filename, status, previous_filename, patch, additions, deletions} | with_entries(select(.value != null)))'
const commitProjection =
  '{sha, message: .commit.message, author: ({name: .commit.author.name, email: .commit.author.email, date: .commit.author.date} + (if .author.login == null then {} else {login: .author.login} end)), files: [.files[] | {filename, status, previous_filename, patch, additions, deletions} | with_entries(select(.value != null))]}'
const checksViewProjection = [
  '{pullRequest:{number,title,url,state,isDraft,mergeable,reviewDecision,headRefName,headRefOid},',
  'checks:[.statusCheckRollup[] | if .__typename == "CheckRun" then ',
  '{source:"check-run",name,state:.status,conclusion:(.conclusion // null),startedAt:(.startedAt // null),completedAt:(.completedAt // null),url:(.detailsUrl // "")}',
  ' else ',
  '{source:"status",name:.context,state:.state,conclusion:(.state // null),startedAt:(.startedAt // .createdAt // null),completedAt:(.completedAt // null),url:(.targetUrl // "")}',
  ' end]}',
].join('')
const jobsProjection =
  '{jobs:[.jobs[] | {id,name,status,conclusion,createdAt:.created_at,startedAt:(.started_at // null),completedAt:(.completed_at // null),runner:(.runner_name // ""),url:.html_url,steps:[(.steps // [])[] | {number,name,status,conclusion,startedAt:(.started_at // null),completedAt:(.completed_at // null)}]}]}'

const GhAuthorJson = Schema.Struct({
  id: Schema.String,
  is_bot: Schema.Boolean,
  login: Schema.String,
  name: Schema.String,
}).annotate({
  identifier: 'Vista.Gh.RawAuthor',
})
const GhCommitAuthorJson = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  login: Schema.String,
  name: Schema.String,
}).annotate({
  identifier: 'Vista.Gh.RawCommitAuthor',
})
const GhViewCommitJson = Schema.Struct({
  authoredDate: Schema.String,
  authors: Schema.Array(GhCommitAuthorJson),
  committedDate: Schema.String,
  messageBody: Schema.String,
  messageHeadline: Schema.String,
  oid: Schema.String,
}).annotate({
  identifier: 'Vista.Gh.RawViewCommit',
})
/**
 * Strict schema describing a raw gh pull request view payload, including counts, author, refs,
 * body, commit list, state, title, and URL, rejecting unknown fields.
 */
export const GhPullRequestViewJson = Schema.Struct({
  additions: Schema.Int,
  author: Schema.NullOr(GhAuthorJson),
  baseRefName: Schema.String,
  body: Schema.String,
  commits: Schema.Array(GhViewCommitJson),
  deletions: Schema.Int,
  headRefName: Schema.String,
  number: Schema.Int,
  state: Schema.String,
  title: Schema.String,
  url: Schema.String,
}).annotate({
  identifier: 'Vista.Gh.RawPullRequestView',
})

/**
 * Strict schema for a single raw pull request file entry covering filename, status, optional
 * rename and patch text, and addition/deletion counts.
 */
export const GhPullRequestFileJson = Schema.Struct({
  filename: Schema.String,
  status: Schema.String,
  previous_filename: Schema.optionalKey(Schema.String),
  patch: Schema.optionalKey(Schema.String),
  additions: Schema.Int,
  deletions: Schema.Int,
}).annotate({
  identifier: 'Vista.Gh.RawPullRequestFile',
})
/** Strict schema describing an array of raw pull request changed-file entries as returned by gh. */
export const GhPullRequestFilesJson = Schema.Array(GhPullRequestFileJson).annotate({
  identifier: 'Vista.Gh.RawPullRequestFiles',
})

const GhSelectedCommitAuthorJson = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  date: Schema.String,
  login: Schema.optionalKey(Schema.String),
}).annotate({
  identifier: 'Vista.Gh.RawSelectedCommitAuthor',
})
/**
 * Strict schema for a raw pull request commit combining its sha, message, author details, and the
 * list of files it changed.
 */
export const GhPullRequestCommitJson = Schema.Struct({
  sha: Schema.String,
  message: Schema.String,
  author: GhSelectedCommitAuthorJson,
  files: Schema.Array(GhPullRequestFileJson),
}).annotate({
  identifier: 'Vista.Gh.RawPullRequestCommit',
})
/**
 * Strict schema describing an array of raw pull request commit entries including their embedded
 * file changes.
 */
export const GhPullRequestCommitsJson = Schema.Array(GhPullRequestCommitJson).annotate({
  identifier: 'Vista.Gh.RawPullRequestCommits',
})

const GhCheckJson = Schema.Struct({
  source: Schema.Literals(['check-run', 'status']),
  name: Schema.String,
  state: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
  url: Schema.String,
}).annotate({
  identifier: 'Vista.Gh.RawCheck',
})
/**
 * Strict schema for the gh status-check rollup view, carrying pull request metadata (number,
 * title, URL, state, draft/mergeable status, review decision, head ref) together with its check
 * results.
 */
export const GhChecksViewJson = Schema.Struct({
  pullRequest: Schema.Struct({
    number: Schema.Int,
    title: Schema.String,
    url: Schema.String,
    state: Schema.String,
    isDraft: Schema.Boolean,
    mergeable: Schema.String,
    reviewDecision: Schema.String,
    headRefName: Schema.String,
    headRefOid: Schema.String,
  }),
  checks: Schema.Array(GhCheckJson),
}).annotate({
  identifier: 'Vista.Gh.RawChecksView',
})
const GhWorkflowRunJson = Schema.Struct({
  databaseId: Schema.Int,
  attempt: Schema.Int,
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  startedAt: Schema.NullOr(Schema.String),
  updatedAt: Schema.String,
  url: Schema.String,
  headSha: Schema.String,
}).annotate({
  identifier: 'Vista.Gh.RawWorkflowRun',
})
/** Strict schema describing an array of raw GitHub Actions workflow run entries. */
export const GhWorkflowRunsJson = Schema.Array(GhWorkflowRunJson).annotate({
  identifier: 'Vista.Gh.RawWorkflowRuns',
})

const GhJobStepJson = Schema.Struct({
  number: Schema.Int,
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
}).annotate({
  identifier: 'Vista.Gh.RawJobStep',
})
const GhJobJson = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
  runner: Schema.String,
  url: Schema.String,
  steps: Schema.Array(GhJobStepJson),
}).annotate({
  identifier: 'Vista.Gh.RawJob',
})
/** Strict schema for a single page of workflow job results as returned by the gh API. */
export const GhJobsPageJson = Schema.Struct({
  jobs: Schema.Array(GhJobJson),
}).annotate({
  identifier: 'Vista.Gh.RawJobsPage',
})

/** Outcome of one gh CLI invocation: captured stdout and stderr text plus the process exit code. */
export interface GhCommandResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

const runGhCommand = (args: ReadonlyArray<string>): Effect.Effect<GhCommandResult, GhError> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ 'gh.args': args.join(' ') })
    const process = yield* ChildProcess.make(globalThis.process.env.VISTA_GH_BIN ?? 'gh', [...args])
    return yield* Effect.all(
      {
        stdout: Stream.runCollect(Stream.decodeText(process.stdout)).pipe(
          Effect.map((chunks) => Array.from(chunks).join('')),
        ),
        stderr: Stream.runCollect(Stream.decodeText(process.stderr)).pipe(
          Effect.map((chunks) => Array.from(chunks).join('')),
        ),
        exitCode: process.exitCode,
      },
      { concurrency: 'unbounded' },
    )
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.catch((error) => new GhError({ message: `gh failed: ${String(error)}` })),
    Effect.withSpan('vista.provider.gh.command'),
  )

/**
 * Context.Service tag 'Vista/GhCommand' exposing a run function that executes gh with the given
 * arguments as an Effect failing with GhError, so the CLI can be swapped in tests.
 */
export class GhCommand extends Context.Service<
  GhCommand,
  {
    readonly run: (args: ReadonlyArray<string>) => Effect.Effect<GhCommandResult, GhError>
  }
>()('Vista/GhCommand') {}

/**
 * Production layer binding GhCommand to runGhCommand, which spawns the real gh process and returns
 * its stdout, stderr, and exit code.
 */
export const GhCommandLive = Layer.succeed(GhCommand, { run: runGhCommand })

const SUCCESS_EXIT_CODES: Readonly<Record<number, true>> = { 0: true }

const requireExitCode = (
  result: GhCommandResult,
  accepted: Readonly<Record<number, true>> = SUCCESS_EXIT_CODES,
): Effect.Effect<GhCommandResult, GhError> =>
  accepted[result.exitCode] === true
    ? Effect.succeed(result)
    : new GhError({
        message:
          result.exitCode === 4
            ? `gh authentication required for GH_CONFIG_DIR=${process.env.GH_CONFIG_DIR ?? '(unset)'}: ${result.stderr.trim() || result.stdout.trim()}`
            : `gh exited ${result.exitCode}: ${result.stderr.trim() || result.stdout.trim()}`,
      })

const observeRateLimit = (included: string): Effect.Effect<void, GhError> => {
  const matches = [...included.matchAll(/^x-ratelimit-remaining:\s*(\d+)\s*$/gimu)]
  const value = Number(matches.at(-1)?.[1])
  if (!Number.isSafeInteger(value) || value < 0) {
    return new GhError({ message: 'gh api response omitted x-ratelimit-remaining' })
  }
  return Metric.update(
    Metric.withAttributes(providerRateLimitRemaining, {
      provider: 'gh',
      resource: 'core',
    }),
    value,
  )
}

const jsonBodies = (included: string): ReadonlyArray<string> =>
  included
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') || line.startsWith('['))

const runApi = (
  args: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<string>, GhError, GhCommand> =>
  Effect.gen(function* () {
    const command = yield* GhCommand
    const result = yield* command
      .run(['api', '-i', ...args])
      .pipe(Effect.flatMap((output) => requireExitCode(output)))
    yield* observeRateLimit(result.stdout)
    const bodies = jsonBodies(result.stdout)
    if (bodies.length === 0) {
      return yield* new GhError({ message: 'gh api response omitted a JSON body' })
    }
    return bodies
  }).pipe(Effect.withSpan('vista.provider.gh.api'))

const observeCliRateLimit = Effect.gen(function* () {
  const bodies = yield* runApi(['rate_limit'])
  return bodies[0]
})

const runCliJson = (
  args: ReadonlyArray<string>,
  accepted: Readonly<Record<number, true>> = SUCCESS_EXIT_CODES,
): Effect.Effect<string, GhError, GhCommand> =>
  Effect.gen(function* () {
    const command = yield* GhCommand
    const result = yield* command
      .run(args)
      .pipe(Effect.flatMap((output) => requireExitCode(output, accepted)))
    yield* observeCliRateLimit
    return result.stdout
  }).pipe(Effect.withSpan('vista.provider.gh.cli'))

const decodePullRequestView = (body: string) =>
  Schema.decodeEffect(Schema.fromJsonString(GhPullRequestViewJson))(body, strict).pipe(
    Effect.mapError(
      (cause) => new GhError({ message: `invalid gh pr view response: ${String(cause)}` }),
    ),
  )

const decodePullRequestFiles = (bodies: ReadonlyArray<string>) =>
  Effect.forEach(bodies, (body) =>
    Schema.decodeEffect(Schema.fromJsonString(GhPullRequestFilesJson))(body, strict).pipe(
      Effect.mapError(
        (cause) => new GhError({ message: `invalid gh pull files response: ${String(cause)}` }),
      ),
    ),
  ).pipe(Effect.map((pages) => pages.flat()))

const decodePullRequestCommit = (body: string) =>
  Schema.decodeEffect(Schema.fromJsonString(GhPullRequestCommitJson))(body, strict).pipe(
    Effect.mapError(
      (cause) => new GhError({ message: `invalid gh commit response: ${String(cause)}` }),
    ),
  )

const decodeChecksView = (body: string) =>
  Schema.decodeEffect(Schema.fromJsonString(GhChecksViewJson))(body, strict).pipe(
    Effect.mapError(
      (cause) => new GhError({ message: `invalid gh pr checks response: ${String(cause)}` }),
    ),
  )

const decodeWorkflowRuns = (body: string) =>
  Schema.decodeEffect(Schema.fromJsonString(GhWorkflowRunsJson))(body, strict).pipe(
    Effect.mapError(
      (cause) => new GhError({ message: `invalid gh workflow runs response: ${String(cause)}` }),
    ),
  )

const decodeJobPages = (bodies: ReadonlyArray<string>) =>
  Effect.forEach(bodies, (body) =>
    Schema.decodeEffect(Schema.fromJsonString(GhJobsPageJson))(body, strict).pipe(
      Effect.mapError(
        (cause) => new GhError({ message: `invalid gh workflow jobs response: ${String(cause)}` }),
      ),
    ),
  ).pipe(Effect.map((pages) => pages.flatMap(({ jobs }) => jobs)))
const normalizeFileStatus = (status: string): Effect.Effect<PullRequestFile['status'], GhError> => {
  switch (status.toLowerCase()) {
    case 'added':
      return Effect.succeed('added')
    case 'removed':
    case 'deleted':
      return Effect.succeed('deleted')
    case 'renamed':
      return Effect.succeed('renamed')
    case 'changed':
    case 'copied':
    case 'modified':
      return Effect.succeed('modified')
    default:
      return new GhError({ message: `unsupported GitHub file status: ${status}` })
  }
}

const normalizeFile = (file: typeof GhPullRequestFileJson.Type) =>
  normalizeFileStatus(file.status).pipe(
    Effect.map(
      (status): PullRequestFile => ({
        path: file.filename,
        status,
        ...(file.previous_filename === undefined ? {} : { previousPath: file.previous_filename }),
        ...(file.patch === undefined ? {} : { patch: file.patch }),
        additions: file.additions,
        deletions: file.deletions,
      }),
    ),
  )

/**
 * Effect that fetches a pull request's metadata for the given repo and PR number by invoking the
 * gh CLI (`pr view --json`) through the GhCommand service, annotating the current span with
 * repo/pr and decoding the JSON into PullRequestData, failing with GhError on command or parse
 * failure.
 */
export const readPullRequest = (
  repo: string,
  pr: number,
): Effect.Effect<PullRequestData, GhError, GhCommand> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ repo, pr })
    const view = yield* runCliJson([
      'pr',
      'view',
      String(pr),
      '--repo',
      repo,
      '--json',
      prViewFields,
    ]).pipe(Effect.flatMap(decodePullRequestView))
    const files = yield* runApi([
      '--paginate',
      `repos/${repo}/pulls/${pr}/files?per_page=100`,
      '--jq',
      fileProjection,
    ]).pipe(Effect.flatMap(decodePullRequestFiles), Effect.flatMap(Effect.forEach(normalizeFile)))
    const commits = yield* Effect.forEach(
      view.commits,
      (commit) =>
        runApi([`repos/${repo}/commits/${commit.oid}`, '--jq', commitProjection]).pipe(
          Effect.flatMap((bodies) =>
            bodies.length === 1
              ? decodePullRequestCommit(bodies[0]!)
              : new GhError({ message: `gh commit ${commit.oid} returned multiple bodies` }),
          ),
          Effect.flatMap((detail) =>
            Effect.forEach(detail.files, normalizeFile).pipe(
              Effect.map((commitFiles) => ({
                sha: detail.sha,
                message: detail.message,
                author: detail.author.login ?? detail.author.name,
                date: detail.author.date,
                files: commitFiles,
              })),
            ),
          ),
        ),
      { concurrency: 1 },
    )
    return yield* Schema.decodeEffect(PullRequestData)(
      {
        number: view.number,
        title: view.title,
        url: view.url,
        author: view.author?.login ?? 'unknown',
        state: view.state.toLowerCase(),
        repository: repo,
        baseRef: view.baseRefName,
        headRef: view.headRefName,
        additions: view.additions,
        deletions: view.deletions,
        body: view.body,
        files,
        commits,
      },
      strict,
    ).pipe(
      Effect.mapError(
        (cause) => new GhError({ message: `invalid normalized pull request: ${String(cause)}` }),
      ),
    )
  }).pipe(Effect.withSpan('vista.provider.gh.pullRequest'))

const normalizeTimestamp = (value: string | null): string | null =>
  value === null || value === '' || value.startsWith('0001-01-01T00:00:00') ? null : value

const normalizeCheckStatus = (value: string): CheckRun['status'] => {
  switch (value.toUpperCase()) {
    case 'QUEUED':
    case 'REQUESTED':
    case 'WAITING':
      return 'queued'
    case 'EXPECTED':
    case 'IN_PROGRESS':
    case 'PENDING':
      return 'in_progress'
    default:
      return 'completed'
  }
}

const normalizeCheckConclusion = (
  value: string | null,
  status: CheckRun['status'],
): CheckRun['conclusion'] => {
  if (status !== 'completed') return null
  switch ((value ?? '').toUpperCase()) {
    case 'SUCCESS':
      return 'success'
    case 'SKIPPED':
      return 'skipped'
    case 'CANCELLED':
    case 'CANCELED':
      return 'cancelled'
    case 'TIMED_OUT':
      return 'timed_out'
    case 'ACTION_REQUIRED':
      return 'action_required'
    case 'NEUTRAL':
      return 'neutral'
    default:
      return 'failure'
  }
}

const normalizeCheck = (raw: typeof GhCheckJson.Type): Effect.Effect<CheckRun, GhError> => {
  const status = normalizeCheckStatus(raw.state)
  return Schema.decodeEffect(CheckRun)(
    {
      source: raw.source,
      name: raw.name,
      status,
      conclusion: normalizeCheckConclusion(raw.conclusion, status),
      startedAt: normalizeTimestamp(raw.startedAt),
      completedAt: normalizeTimestamp(raw.completedAt),
      url: raw.url,
    },
    strict,
  ).pipe(
    Effect.mapError(
      (cause) => new GhError({ message: `invalid normalized check: ${String(cause)}` }),
    ),
  )
}

const normalizeWorkflowRunDetails = (
  run: typeof GhWorkflowRunJson.Type,
  jobs: ReadonlyArray<typeof GhJobJson.Type>,
): Effect.Effect<WorkflowRunDetails, GhError> => {
  const status = normalizeCheckStatus(run.status)
  return Schema.decodeEffect(WorkflowRunDetails)(
    {
      id: run.databaseId,
      name: run.name,
      attempt: run.attempt,
      status,
      conclusion: normalizeCheckConclusion(run.conclusion, status),
      createdAt: run.createdAt,
      startedAt: normalizeTimestamp(run.startedAt),
      updatedAt: run.updatedAt,
      url: run.url,
      jobs: jobs.map((job) => {
        const jobStatus = normalizeCheckStatus(job.status)
        return {
          id: job.id,
          name: job.name,
          status: jobStatus,
          conclusion: normalizeCheckConclusion(job.conclusion, jobStatus),
          createdAt: job.createdAt,
          startedAt: normalizeTimestamp(job.startedAt),
          completedAt: normalizeTimestamp(job.completedAt),
          runner: job.runner,
          url: job.url,
          steps: job.steps.map((step) => {
            const stepStatus = normalizeCheckStatus(step.status)
            return {
              number: step.number,
              name: step.name,
              status: stepStatus,
              conclusion: normalizeCheckConclusion(step.conclusion, stepStatus),
              startedAt: normalizeTimestamp(step.startedAt),
              completedAt: normalizeTimestamp(step.completedAt),
            }
          }),
        }
      }),
    },
    strict,
  ).pipe(
    Effect.mapError(
      (cause) => new GhError({ message: `invalid normalized workflow run: ${String(cause)}` }),
    ),
  )
}

const checksCursor = (state: {
  readonly pullRequest: object
  readonly checks: Readonly<Record<string, CheckRun>>
  readonly workflowRunCount: number
  readonly latestWorkflowRun: object | null
  readonly run: WorkflowRunDetails | null
}): string => {
  const orderedChecks = Object.keys(state.checks)
    .toSorted()
    .map((name) => state.checks[name])
  return `gh-checks:${createHash('sha256')
    .update(
      JSON.stringify({
        pullRequest: state.pullRequest,
        checks: orderedChecks,
        workflowRunCount: state.workflowRunCount,
        latestWorkflowRun: state.latestWorkflowRun,
        run: state.run,
      }),
    )
    .digest('hex')}`
}

const normalizePullRequestState = (
  value: string,
): Effect.Effect<PullRequestChecksSummary['state'], GhError> => {
  switch (value.toUpperCase()) {
    case 'OPEN':
      return Effect.succeed('open')
    case 'CLOSED':
      return Effect.succeed('closed')
    case 'MERGED':
      return Effect.succeed('merged')
    default:
      return new GhError({ message: `unsupported pull request state: ${value}` })
  }
}

const normalizeMergeable = (
  value: string,
): Effect.Effect<PullRequestChecksSummary['mergeable'], GhError> => {
  switch (value.toUpperCase()) {
    case 'MERGEABLE':
      return Effect.succeed('mergeable')
    case 'CONFLICTING':
      return Effect.succeed('conflicting')
    case 'UNKNOWN':
      return Effect.succeed('unknown')
    default:
      return new GhError({ message: `unsupported pull request mergeability: ${value}` })
  }
}

const normalizeReviewDecision = (
  value: string,
): Effect.Effect<PullRequestChecksSummary['reviewDecision'], GhError> => {
  switch (value.toUpperCase()) {
    case '':
      return Effect.succeed(null)
    case 'APPROVED':
      return Effect.succeed('approved')
    case 'CHANGES_REQUESTED':
      return Effect.succeed('changes_requested')
    case 'REVIEW_REQUIRED':
      return Effect.succeed('review_required')
    default:
      return new GhError({ message: `unsupported pull request review decision: ${value}` })
  }
}

/**
 * Effect that reads the current CI check state for a pull request by querying the gh CLI's `pr
 * view --json` output and normalizing it into a ChecksState, failing with GhError if the command
 * or decoding fails.
 */
export const readChecksState = (
  repo: string,
  pr: number,
): Effect.Effect<ChecksState, GhError, GhCommand> =>
  Effect.gen(function* () {
    const checksBody = yield* runCliJson([
      'pr',
      'view',
      String(pr),
      '--repo',
      repo,
      '--json',
      'number,title,url,state,isDraft,mergeable,reviewDecision,headRefName,headRefOid,statusCheckRollup',
      '--jq',
      checksViewProjection,
    ])
    const view = yield* decodeChecksView(checksBody)
    const workflowRunsBody = yield* runCliJson([
      'run',
      'list',
      '--repo',
      repo,
      '--commit',
      view.pullRequest.headRefOid,
      '--json',
      'databaseId,attempt,name,status,conclusion,createdAt,startedAt,updatedAt,url,headSha',
    ])
    const rawWorkflowRuns = yield* decodeWorkflowRuns(workflowRunsBody)
    const rawHeadRun = rawWorkflowRuns
      .filter(({ headSha }) => headSha === view.pullRequest.headRefOid)
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
    const headRun =
      rawHeadRun === undefined
        ? null
        : yield* runApi([
            '--paginate',
            `repos/${repo}/actions/runs/${rawHeadRun.databaseId}/jobs?per_page=100`,
            '--jq',
            jobsProjection,
          ]).pipe(
            Effect.flatMap(decodeJobPages),
            Effect.flatMap((jobs) => normalizeWorkflowRunDetails(rawHeadRun, jobs)),
          )
    const normalizedChecks = yield* Effect.forEach(view.checks, normalizeCheck)
    const workflowRuns = rawWorkflowRuns
      .map((workflowRun) => {
        const status = normalizeCheckStatus(workflowRun.status)
        const conclusion = normalizeCheckConclusion(workflowRun.conclusion, status)
        return {
          summary: {
            name: workflowRun.name,
            status,
            conclusion,
            url: workflowRun.url,
            headSha: workflowRun.headSha,
            createdAt: workflowRun.createdAt,
          },
          check: {
            source: 'workflow-run' as const,
            name: workflowRun.name,
            status,
            conclusion,
            startedAt: workflowRun.createdAt,
            completedAt: status === 'completed' ? workflowRun.updatedAt : null,
            url: workflowRun.url,
          },
        }
      })
      .toSorted((left, right) => right.summary.createdAt.localeCompare(left.summary.createdAt))
    const latestWorkflowRuns = workflowRuns.filter(
      (workflowRun, index, runs) =>
        runs.findIndex((candidate) => candidate.summary.name === workflowRun.summary.name) ===
        index,
    )
    const checks = Object.fromEntries(
      (normalizedChecks.length === 0
        ? latestWorkflowRuns.map(({ check }) => check)
        : normalizedChecks
      ).map((check) => [check.name, check]),
    )
    const pullRequest = yield* Schema.decodeEffect(PullRequestChecksSummary)(
      {
        number: view.pullRequest.number,
        title: view.pullRequest.title,
        url: view.pullRequest.url,
        state: yield* normalizePullRequestState(view.pullRequest.state),
        isDraft: view.pullRequest.isDraft,
        mergeable: yield* normalizeMergeable(view.pullRequest.mergeable),
        reviewDecision: yield* normalizeReviewDecision(view.pullRequest.reviewDecision),
        headRef: view.pullRequest.headRefName,
        headSha: view.pullRequest.headRefOid,
      },
      strict,
    )
    const state = {
      pullRequest,
      checks,
      workflowRunCount: rawWorkflowRuns.length,
      latestWorkflowRun: workflowRuns[0]?.summary ?? null,
      run: headRun,
    }
    return yield* Schema.decodeEffect(ChecksState)(
      { ...state, cursor: checksCursor(state) },
      strict,
    )
  }).pipe(
    Effect.mapError((cause) =>
      cause instanceof GhError
        ? cause
        : new GhError({ message: `invalid normalized checks state: ${String(cause)}` }),
    ),
    Effect.withSpan('vista.provider.gh.checksState', { attributes: { repo, pr } }),
  )

const checksEqual = (left: CheckRun, right: CheckRun): boolean =>
  left.source === right.source &&
  left.name === right.name &&
  left.status === right.status &&
  left.conclusion === right.conclusion &&
  left.startedAt === right.startedAt &&
  left.completedAt === right.completedAt &&
  left.url === right.url

const checksMetadataEqual = (left: ChecksState, right: ChecksState): boolean =>
  JSON.stringify(left.pullRequest) === JSON.stringify(right.pullRequest) &&
  left.workflowRunCount === right.workflowRunCount &&
  JSON.stringify(left.latestWorkflowRun) === JSON.stringify(right.latestWorkflowRun) &&
  JSON.stringify(left.run) === JSON.stringify(right.run)

/**
 * Compares two ChecksState snapshots and returns the ordered list of CheckEvents, emitting a
 * single 'Synced' event carrying the full next state whenever run metadata changed or a previously
 * present check disappeared, and per-check transitions otherwise.
 */
export const diffChecks = (previous: ChecksState, next: ChecksState): ReadonlyArray<CheckEvent> => {
  if (
    !checksMetadataEqual(previous, next) ||
    Object.keys(previous.checks).some((name) => !(name in next.checks))
  ) {
    return [{ _tag: 'Synced', state: next }]
  }
  return Object.keys(next.checks)
    .toSorted()
    .flatMap((name) => {
      const check = next.checks[name]!
      const prior = previous.checks[name]
      return prior !== undefined && checksEqual(prior, check)
        ? []
        : [{ _tag: 'CheckUpdated' as const, check, cursor: next.cursor }]
    })
}

const checkEvents = (repo: string, pr: number): Stream.Stream<CheckEvent, GhError, GhCommand> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const initial = yield* readChecksState(repo, pr)
      const previous = yield* Ref.make(initial)
      const updates = Stream.fromEffectSchedule(
        readChecksState(repo, pr),
        Schedule.spaced('10 seconds'),
      ).pipe(
        Stream.mapEffect((next) =>
          Ref.modify(previous, (current) => [diffChecks(current, next), next] as const),
        ),
        Stream.flatMap(Stream.fromIterable),
      )
      return Stream.concat(Stream.succeed<CheckEvent>({ _tag: 'Synced', state: initial }), updates)
    }),
  ).pipe(Stream.withSpan('vista.provider.gh.checksStream'))

/** Hub-driven checks polling: one refresh consumes five gh commands from the shared budget. */
export const ghChecksLiveDriver = {
  _tag: 'pollable' as const,
  initial: ({ repo, pr }: { readonly repo: string; readonly pr: number }) =>
    readChecksState(repo, pr),
  poll: ({ repo, pr }: { readonly repo: string; readonly pr: number }, _since: string) =>
    Effect.map(readChecksState(repo, pr), (state) => ({ _tag: 'state' as const, state })),
  cost: 5,
  interval: { min: Duration.seconds(6), max: Duration.seconds(60) },
}

const changedFiles = (repo: string, pr: number): Effect.Effect<PrSummary, GhError, GhCommand> =>
  readPullRequest(repo, pr).pipe(
    Effect.map((pullRequest) => {
      const files = pullRequest.files.map(
        (file) =>
          new ChangedFile({
            path: file.path,
            additions: file.additions ?? 0,
            deletions: file.deletions ?? 0,
            status:
              file.status === 'deleted'
                ? 'deleted'
                : file.status === 'renamed'
                  ? 'renamed'
                  : file.status === 'added'
                    ? 'added'
                    : 'modified',
          }),
      )
      return new PrSummary({
        number: pullRequest.number,
        title: pullRequest.title,
        files,
        totalAdditions: files.reduce((total, file) => total + file.additions, 0),
        totalDeletions: files.reduce((total, file) => total + file.deletions, 0),
      })
    }),
  )

/**
 * Effectful provider implementation for the gh capability that wires the changedFiles,
 * pullRequest, and checksStream handlers to the gh CLI-backed functions and registers
 * ghChecksLiveDriver as the live driver for the checks stream.
 */
export const ghImplementation = implement(gh, {
  purity: 'effectful',
  handlers: {
    changedFiles: ({ repo, pr }) => changedFiles(repo, pr),
    pullRequest: ({ repo, pr }) => readPullRequest(repo, pr),
    checksStream: ({ repo, pr }) => checkEvents(repo, pr),
  },
  live: {
    checksStream: ghChecksLiveDriver,
  },
})

/**
 * Factory that mounts the gh CLI provider implementation onto the supplied GhCommand layer to
 * produce a provider, with the module default mounting it on GhCommandLive.
 */
export const makeGhProvider = (layer: Layer.Layer<GhCommand>) =>
  mountProvider(ghImplementation, layer)

export default makeGhProvider(GhCommandLive)
