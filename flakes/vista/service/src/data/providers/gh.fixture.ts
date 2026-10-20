import { readFileSync } from 'node:fs'

import { Effect, Layer, Schema } from 'effect'

import {
  GhChecksViewJson,
  GhCommand,
  type GhCommandResult,
  GhJobsPageJson,
  GhError,
  GhPullRequestCommitJson,
  GhPullRequestCommitsJson,
  GhPullRequestFilesJson,
  GhPullRequestViewJson,
  GhWorkflowRunsJson,
} from './gh.provider.ts'

const readFixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')

const strict = { onExcessProperty: 'error' } as const
const checksFixture = Schema.decodeSync(
  GhChecksViewJson,
  strict,
)({
  pullRequest: {
    number: 2935,
    title: 'Fixture checks',
    url: 'https://github.com/schickling/dotfiles/pull/2935',
    state: 'OPEN',
    isDraft: false,
    mergeable: 'MERGEABLE',
    reviewDecision: '',
    headRefName: 'fixture/checks',
    headRefOid: '0123456789abcdef0123456789abcdef01234567',
  },
  checks: [
    {
      source: 'check-run',
      name: 'fixture/check',
      state: 'SUCCESS',
      conclusion: 'SUCCESS',
      startedAt: '2026-09-20T01:00:00Z',
      completedAt: '2026-09-20T01:01:00Z',
      url: 'https://github.com/schickling/dotfiles/actions/runs/1',
    },
  ],
})
const run = {
  databaseId: 35628602056,
  attempt: 1,
  name: 'CI',
  status: 'in_progress',
  conclusion: '',
  createdAt: '2026-09-20T01:00:00Z',
  startedAt: '2026-09-20T01:00:10Z',
  updatedAt: '2026-09-20T01:05:00Z',
  url: 'https://github.com/schickling/dotfiles/actions/runs/35628602056',
  headSha: checksFixture.pullRequest.headRefOid,
}
const mixedJobs = Schema.decodeSync(
  GhJobsPageJson,
  strict,
)({
  jobs: [
    {
      id: 1,
      name: 'typecheck',
      status: 'completed',
      conclusion: 'success',
      createdAt: '2026-09-20T01:00:00Z',
      startedAt: '2026-09-20T01:00:20Z',
      completedAt: '2026-09-20T01:02:20Z',
      runner: 'dev3',
      url: `${run.url}/job/1`,
      steps: [
        {
          number: 1,
          name: 'Checkout',
          status: 'completed',
          conclusion: 'success',
          startedAt: '2026-09-20T01:00:20Z',
          completedAt: '2026-09-20T01:00:40Z',
        },
      ],
    },
    {
      id: 2,
      name: 'tests',
      status: 'in_progress',
      conclusion: null,
      createdAt: '2026-09-20T01:00:00Z',
      startedAt: '2026-09-20T01:02:30Z',
      completedAt: null,
      runner: 'mbp2025',
      url: `${run.url}/job/2`,
      steps: [
        {
          number: 1,
          name: 'Run tests',
          status: 'in_progress',
          conclusion: null,
          startedAt: '2026-09-20T01:02:30Z',
          completedAt: null,
        },
      ],
    },
    {
      id: 3,
      name: 'deploy',
      status: 'queued',
      conclusion: null,
      createdAt: '2026-09-20T01:00:00Z',
      startedAt: null,
      completedAt: null,
      runner: '',
      url: `${run.url}/job/3`,
      steps: [],
    },
  ],
})
const failedRun = {
  ...run,
  status: 'completed',
  conclusion: 'failure',
  updatedAt: '2026-09-20T01:06:00Z',
}
const failedJobs = Schema.decodeSync(
  GhJobsPageJson,
  strict,
)({
  jobs: mixedJobs.jobs.map((job) =>
    job.id === 2
      ? {
          ...job,
          status: 'completed',
          conclusion: 'failure',
          completedAt: '2026-09-20T01:05:30Z',
          steps: job.steps.map((step) => ({
            ...step,
            status: 'completed',
            conclusion: 'failure',
            completedAt: '2026-09-20T01:05:30Z',
          })),
        }
      : job,
  ),
})

/**
 * Named fixture sets of decoded workflow runs and job pages covering mixed, fully failed, and
 * no-run check scenarios for tests.
 */
export const ghChecksFixtures = {
  mixed: {
    workflowRuns: Schema.decodeSync(GhWorkflowRunsJson, strict)([run]),
    jobPages: [mixedJobs],
  },
  failed: {
    workflowRuns: Schema.decodeSync(GhWorkflowRunsJson, strict)([failedRun]),
    jobPages: [failedJobs],
  },
  noRun: {
    workflowRuns: Schema.decodeSync(GhWorkflowRunsJson, strict)([]),
    jobPages: [],
  },
} as const
const workflowRunsFixture = ghChecksFixtures.mixed.workflowRuns
const commitsFixture = Schema.decodeSync(
  Schema.fromJsonString(GhPullRequestCommitsJson),
  strict,
)(readFixture('gh-pr-2910-commits.json'))
const filesFixture = Schema.decodeSync(
  Schema.fromJsonString(GhPullRequestFilesJson),
  strict,
)(readFixture('gh-pr-2910-files.json'))
const viewFixture = Schema.decodeSync(
  Schema.fromJsonString(GhPullRequestViewJson),
  strict,
)(readFixture('gh-pr-2910-view.json'))
const encodeChecksFixture = Schema.encodeSync(Schema.fromJsonString(GhChecksViewJson))
const encodeWorkflowRunsFixture = Schema.encodeSync(Schema.fromJsonString(GhWorkflowRunsJson))
const encodeJobsPageFixture = Schema.encodeSync(Schema.fromJsonString(GhJobsPageJson))
const encodeCommitFixture = Schema.encodeSync(Schema.fromJsonString(GhPullRequestCommitJson))
const encodeFilesFixture = Schema.encodeSync(Schema.fromJsonString(GhPullRequestFilesJson))
const encodeViewFixture = Schema.encodeSync(Schema.fromJsonString(GhPullRequestViewJson))
const encodeUnknownJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown))

/**
 * Registered symbol used as a globalThis key to count how many times the gh command fixture has
 * been invoked during a test run.
 */
export const ghFixtureCalls = Symbol.for('vista.samples.review.ghFixtureCalls')

const included = (body: string): string =>
  [
    'HTTP/2.0 200 OK',
    'X-RateLimit-Remaining: 4999',
    'X-RateLimit-Resource: core',
    '',
    body,
    '',
  ].join('\n')

const result = (stdout: string, exitCode = 0): GhCommandResult => ({
  stdout,
  stderr: '',
  exitCode,
})

/**
 * Layer providing a fake GhCommand that records each invocation via the global counter and returns
 * canned gh CLI responses chosen by matching the command arguments, such as status rollups, pull
 * request views, files listings, workflow runs, and job pages.
 */
export const GhCommandFixture = Layer.succeed(GhCommand, {
  run: (args) =>
    Effect.gen(function* () {
      const previous = Reflect.get(globalThis, ghFixtureCalls)
      Reflect.set(globalThis, ghFixtureCalls, typeof previous === 'number' ? previous + 1 : 1)
      const command = args.join(' ')
      if (command.startsWith('pr view ') && command.includes('statusCheckRollup')) {
        return result(encodeChecksFixture(checksFixture))
      }
      if (command.startsWith('pr view ')) return result(encodeViewFixture(viewFixture))
      if (command.includes('/pulls/2910/files')) {
        return result(included(encodeFilesFixture(filesFixture)))
      }
      if (command.includes('/commits/')) {
        const sha = args
          .find((arg) => arg.includes('/commits/'))
          ?.split('/')
          .at(-1)
        const commit = commitsFixture.find((entry) => entry.sha === sha)
        if (commit === undefined) {
          return yield* new GhError({ message: `missing fixture for commit ${sha ?? 'unknown'}` })
        }
        return result(included(encodeCommitFixture(commit)))
      }
      if (command === 'api -i rate_limit') {
        return result(
          included(
            encodeUnknownJson({
              resources: { core: { limit: 5_000, used: 1, remaining: 4_999 } },
            }),
          ),
        )
      }
      if (command.startsWith('run list ')) {
        return result(encodeWorkflowRunsFixture(workflowRunsFixture))
      }
      if (command.includes('/actions/runs/') && command.includes('/jobs?per_page=100')) {
        return result(included(encodeJobsPageFixture(ghChecksFixtures.mixed.jobPages[0]!)))
      }
      return yield* new GhError({ message: `unexpected gh fixture invocation: ${command}` })
    }),
})
