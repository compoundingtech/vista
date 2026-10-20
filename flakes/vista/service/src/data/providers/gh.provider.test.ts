import { readFileSync } from 'node:fs'

import { describe, it } from '@effect/vitest'
import {
  CheckEvent,
  checksStream as checksOperation,
} from '@vista/blocks/internal/provider-contracts'
import { Effect, Layer, Schema, Stream } from 'effect'
import { afterEach, expect, vi } from 'vitest'

import { ghChecksFixtures } from './gh.fixture.ts'
import ghProvider, {
  GhChecksViewJson,
  GhCommand,
  GhCommandLive,
  type GhCommandResult,
  ghChecksLiveDriver,
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
const checksPullRequestJson = {
  number: 2935,
  title: 'Live runtime checks',
  url: 'https://github.com/schickling/dotfiles/pull/2935',
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  reviewDecision: '',
  headRefName: 'schickling/vista-live',
  headRefOid: '0123456789abcdef0123456789abcdef01234567',
}
const checksViewJson = Schema.decodeSync(
  GhChecksViewJson,
  strict,
)({
  pullRequest: checksPullRequestJson,
  checks: [
    {
      source: 'check-run',
      name: 'source/shape',
      state: 'QUEUED',
      conclusion: null,
      startedAt: null,
      completedAt: null,
      url: 'https://github.com/schickling/dotfiles/actions/runs/1',
    },
    {
      source: 'status',
      name: 'pr/topology',
      state: 'SUCCESS',
      conclusion: 'SUCCESS',
      startedAt: '2026-09-20T01:00:00Z',
      completedAt: null,
      url: 'https://example.com/status',
    },
  ],
})
const workflowRunsJson = Schema.decodeSync(
  GhWorkflowRunsJson,
  strict,
)([
  {
    databaseId: 2,
    attempt: 1,
    name: 'CI',
    status: 'completed',
    conclusion: 'failure',
    createdAt: '2026-09-20T02:00:00Z',
    updatedAt: '2026-09-20T02:05:00Z',
    startedAt: '2026-09-20T02:00:10Z',
    url: 'https://github.com/schickling/dotfiles/actions/runs/2',
    headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
  {
    databaseId: 1,
    attempt: 1,
    name: 'Auto-request review',
    status: 'completed',
    conclusion: 'cancelled',
    createdAt: '2026-09-20T01:00:00Z',
    updatedAt: '2026-09-20T01:05:00Z',
    startedAt: '2026-09-20T01:00:10Z',
    url: 'https://github.com/schickling/dotfiles/actions/runs/1',
    headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
])
const commitsFixtureJson = Schema.decodeSync(
  Schema.fromJsonString(GhPullRequestCommitsJson),
  strict,
)(readFixture('gh-pr-2910-commits.json'))
const filesFixtureJson = Schema.decodeSync(
  Schema.fromJsonString(GhPullRequestFilesJson),
  strict,
)(readFixture('gh-pr-2910-files.json'))
const viewFixtureJson = Schema.decodeSync(
  Schema.fromJsonString(GhPullRequestViewJson),
  strict,
)(readFixture('gh-pr-2910-view.json'))
const recordedJobsFixtureJson = Schema.decodeSync(
  Schema.fromJsonString(GhJobsPageJson),
  strict,
)(readFixture('gh-run-35628602056-jobs.json'))
const encodeChecksViewFixture = Schema.encodeSync(Schema.fromJsonString(GhChecksViewJson))
const encodeWorkflowRunsFixture = Schema.encodeSync(Schema.fromJsonString(GhWorkflowRunsJson))
const encodeCommitFixture = Schema.encodeSync(Schema.fromJsonString(GhPullRequestCommitJson))
const encodeJobsPageFixture = Schema.encodeSync(Schema.fromJsonString(GhJobsPageJson))
const encodeFilesFixture = Schema.encodeSync(Schema.fromJsonString(GhPullRequestFilesJson))
const encodeViewFixture = Schema.encodeSync(Schema.fromJsonString(GhPullRequestViewJson))
const encodeUnknownJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown))

const included = (body: string): string =>
  [
    'HTTP/2.0 200 OK',
    'X-RateLimit-Remaining: 4999',
    'X-RateLimit-Resource: core',
    '',
    body,
    '',
  ].join('\n')

const makeFixtureLayer = (
  options: {
    readonly checksView?: typeof GhChecksViewJson.Type
    readonly workflowRuns?: typeof GhWorkflowRunsJson.Type
    readonly jobPages?: ReadonlyArray<typeof GhJobsPageJson.Type>
  } = {},
) => {
  const calls: Array<ReadonlyArray<string>> = []
  const result = (stdout: string, exitCode = 0): GhCommandResult => ({
    stdout,
    stderr: '',
    exitCode,
  })
  const layer = Layer.succeed(GhCommand, {
    run: (args) =>
      Effect.gen(function* () {
        calls.push(args)
        const command = args.join(' ')
        if (command.startsWith('pr view ') && command.includes('statusCheckRollup')) {
          return result(encodeChecksViewFixture(options.checksView ?? checksViewJson))
        }
        if (command.startsWith('pr view ')) {
          return result(encodeViewFixture(viewFixtureJson))
        }
        if (command.startsWith('run list ')) {
          return result(encodeWorkflowRunsFixture(options.workflowRuns ?? workflowRunsJson))
        }
        if (command.includes('/actions/runs/') && command.includes('/jobs?per_page=100')) {
          return result(
            (options.jobPages ?? [])
              .map((page) => included(encodeJobsPageFixture(page)))
              .join('\n'),
          )
        }
        if (command.includes('/pulls/2910/files')) {
          return result(included(encodeFilesFixture(filesFixtureJson)))
        }
        if (command.includes('/commits/')) {
          const sha = args
            .find((arg) => arg.includes('/commits/'))
            ?.split('/')
            .at(-1)
          const commit = commitsFixtureJson.find((entry) => entry.sha === sha)
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
        return yield* new GhError({ message: `unexpected gh invocation: ${command}` })
      }),
  })
  return { calls, layer }
}

describe('gh provider', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.effect('uses the declared executable rather than an ambient gh wrapper', () =>
    Effect.gen(function* () {
      vi.stubEnv('VISTA_GH_BIN', process.execPath)
      const command = yield* GhCommand
      const result = yield* command.run(['-e', 'process.stdout.write("declared-binary")'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('declared-binary')
    }).pipe(Effect.provide(GhCommandLive)),
  )

  it.effect('reports a missing login with the declared config path', () =>
    Effect.gen(function* () {
      vi.stubEnv('GH_CONFIG_DIR', '/declared/gh-assistant')
      const layer = Layer.succeed(GhCommand, {
        run: () =>
          Effect.succeed({
            stdout: '',
            stderr: 'To get started with GitHub CLI, please run: gh auth login',
            exitCode: 4,
          }),
      })
      const error = yield* ghProvider.core
        .pullRequest({ repo: 'schickling/dotfiles', pr: 2910 })
        .pipe(Effect.provide(layer), Effect.flip)
      expect(error).toBeInstanceOf(GhError)
      expect(error.message).toContain('gh authentication required')
      expect(error.message).toContain('GH_CONFIG_DIR=/declared/gh-assistant')
    }),
  )

  it('is effectful and declares all three operations', () => {
    expect(ghProvider.id).toBe('gh')
    expect(ghProvider.purity).toBe('effectful')
    expect(Object.keys(ghProvider.core).sort()).toEqual([
      'changedFiles',
      'checksStream',
      'pullRequest',
    ])
  })

  it('decodes a v14 live event emitted before workflow waterfall details existed', () => {
    const event = Schema.decodeSync(
      Schema.fromJsonString(CheckEvent),
      strict,
    )(readFixture('checks-stream-v14-pr-2959.json'))

    expect(event._tag).toBe('Synced')
    if (event._tag === 'Synced') expect(event.state.run).toBeNull()
  })

  it('strictly decodes the recorded public GitHub fixtures', () => {
    expect(Schema.decodeSync(GhPullRequestViewJson, strict)(viewFixtureJson).number).toBe(2910)
    expect(Schema.decodeSync(GhPullRequestFilesJson, strict)(filesFixtureJson)).toHaveLength(4)
    expect(Schema.decodeSync(GhPullRequestCommitsJson, strict)(commitsFixtureJson)).toHaveLength(2)
    expect(Schema.decodeSync(GhChecksViewJson, strict)(checksViewJson).checks).toHaveLength(2)
    expect(Schema.decodeSync(GhWorkflowRunsJson, strict)(workflowRunsJson)).toHaveLength(2)
    expect(Schema.decodeSync(GhJobsPageJson, strict)(recordedJobsFixtureJson).jobs).toHaveLength(32)
    expect(ghChecksFixtures.mixed.jobPages[0]?.jobs.map(({ status }) => status)).toEqual([
      'completed',
      'in_progress',
      'queued',
    ])
    expect(ghChecksFixtures.failed.jobPages[0]?.jobs[1]?.steps[0]?.conclusion).toBe('failure')
    expect(ghChecksFixtures.noRun.workflowRuns).toEqual([])

    expect(() =>
      Schema.decodeUnknownSync(
        GhPullRequestFilesJson,
        strict,
      )([{ ...filesFixtureJson[0], unexpected: true }]),
    ).toThrow()
  })

  it.effect('builds a review payload through an alternate GhCommand Layer', () =>
    Effect.gen(function* () {
      const fixtures = makeFixtureLayer()
      const pullRequest = yield* ghProvider.core
        .pullRequest({
          repo: 'schickling/dotfiles',
          pr: 2910,
        })
        .pipe(Effect.provide(fixtures.layer))

      expect(pullRequest.number).toBe(2910)
      expect(pullRequest.state).toBe('merged')
      expect(pullRequest.repository).toBe('schickling/dotfiles')
      expect(pullRequest.files).toHaveLength(4)
      expect(pullRequest.commits).toHaveLength(2)
      expect(pullRequest.commits?.map((commit) => commit.sha)).toEqual([
        '3a8b32791c85125b6aedc045bf1f093116c6a08a',
        'eb45a2a6ec4785c599ccef3e60ee1f3cec416afb',
      ])
      expect(fixtures.calls.filter((args) => args.join(' ') === 'api -i rate_limit')).toHaveLength(
        1,
      )
      expect(
        fixtures.calls.filter((args) => args.some((arg) => arg.includes('/commits/'))),
      ).toHaveLength(2)
    }),
  )

  it.effect('tags full-state polling results explicitly', () =>
    Effect.gen(function* () {
      const fixtures = makeFixtureLayer()
      const result = yield* ghChecksLiveDriver
        .poll({ repo: 'schickling/dotfiles', pr: 2935 }, 'expired-cursor')
        .pipe(Effect.provide(fixtures.layer))

      expect(result._tag).toBe('state')
      if (result._tag === 'state') expect(result.state.pullRequest.number).toBe(2935)
    }),
  )

  it.effect('emits head check runs and statuses before workflow history', () =>
    Effect.gen(function* () {
      const fixtures = makeFixtureLayer()
      const events = yield* ghProvider.core
        .checksStream({
          repo: 'schickling/dotfiles',
          pr: 2935,
          since: 'expired-cursor',
        })
        .pipe(Stream.provide(fixtures.layer), Stream.take(1), Stream.runCollect)
      const first = events[0]
      expect(first?._tag).toBe('Synced')
      if (first?._tag !== 'Synced') return
      expect(Object.keys(first.state.checks)).toHaveLength(2)
      expect(first.state.checks['source/shape']?.source).toBe('check-run')
      expect(first.state.checks['source/shape']?.status).toBe('queued')
      expect(first.state.checks['pr/topology']?.source).toBe('status')
      expect(first.state.checks['pr/topology']?.conclusion).toBe('success')
      expect(first.state.workflowRunCount).toBe(2)
      expect(first.state.latestWorkflowRun?.name).toBe('CI')
      expect(first.state.pullRequest.headSha).toBe(checksPullRequestJson.headRefOid)
      expect(first.state.run).toBeNull()
    }),
  )

  it.effect('captures the latest run of the PR head with paginated job and step timing', () =>
    Effect.gen(function* () {
      const fixtures = makeFixtureLayer({
        workflowRuns: ghChecksFixtures.mixed.workflowRuns,
        jobPages: ghChecksFixtures.mixed.jobPages,
      })
      const events = yield* ghProvider.core
        .checksStream({
          repo: 'schickling/dotfiles',
          pr: 2935,
        })
        .pipe(Stream.provide(fixtures.layer), Stream.take(1), Stream.runCollect)
      const first = events[0]
      expect(first?._tag).toBe('Synced')
      if (first?._tag !== 'Synced') return

      expect(first.state.run?.id).toBe(35_628_602_056)
      expect(first.state.run?.attempt).toBe(1)
      expect(first.state.run?.jobs.map(({ status }) => status)).toEqual([
        'completed',
        'in_progress',
        'queued',
      ])
      expect(first.state.run?.jobs[1]?.steps[0]?.name).toBe('Run tests')
      expect(
        fixtures.calls.some(
          (args) =>
            args.includes('--paginate') &&
            args.some((arg) => arg.includes('/actions/runs/35628602056/jobs?per_page=100')),
        ),
      ).toBe(true)
    }),
  )

  it.effect('uses the latest run per workflow when the head has no checks', () =>
    Effect.gen(function* () {
      const checksView = yield* Schema.decodeEffect(
        GhChecksViewJson,
        strict,
      )({
        pullRequest: checksPullRequestJson,
        checks: [],
      })
      const fixtures = makeFixtureLayer({ checksView })
      const events = yield* ghProvider.core
        .checksStream({
          repo: 'schickling/dotfiles',
          pr: 2935,
        })
        .pipe(Stream.provide(fixtures.layer), Stream.take(1), Stream.runCollect)
      const first = events[0]
      expect(first?._tag).toBe('Synced')
      if (first?._tag !== 'Synced') return
      expect(Object.keys(first.state.checks).toSorted()).toEqual(['Auto-request review', 'CI'])
      expect(first.state.checks.CI?.source).toBe('workflow-run')
      expect(first.state.checks.CI?.conclusion).toBe('failure')
      expect(first.state.workflowRunCount).toBe(2)
    }),
  )

  it.effect('returns a typed PR-aware empty state when neither source has runs', () =>
    Effect.gen(function* () {
      const checksView = yield* Schema.decodeEffect(
        GhChecksViewJson,
        strict,
      )({
        pullRequest: checksPullRequestJson,
        checks: [],
      })
      const workflowRuns = yield* Schema.decodeEffect(GhWorkflowRunsJson, strict)([])
      const fixtures = makeFixtureLayer({ checksView, workflowRuns })
      const events = yield* ghProvider.core
        .checksStream({
          repo: 'schickling/dotfiles',
          pr: 2959,
        })
        .pipe(Stream.provide(fixtures.layer), Stream.take(1), Stream.runCollect)
      const first = events[0]
      expect(first?._tag).toBe('Synced')
      if (first?._tag !== 'Synced') return
      expect(first.state.pullRequest.number).toBe(2935)
      expect(first.state.checks).toEqual({})
      expect(first.state.workflowRunCount).toBe(0)
      expect(first.state.latestWorkflowRun).toBeNull()
      expect(first.state.run).toBeNull()
      expect(first.state.cursor).toMatch(/^gh-checks:/)
    }),
  )

  it('folds the same ordered events deterministically', () => {
    const queued = {
      source: 'check-run' as const,
      name: 'quality',
      status: 'queued' as const,
      conclusion: null,
      startedAt: null,
      completedAt: null,
      url: 'https://github.com/schickling/dotfiles/actions/runs/1',
    }
    const completed = {
      ...queued,
      status: 'completed' as const,
      conclusion: 'success' as const,
      completedAt: '2026-09-20T01:00:00Z',
    }
    const initial = {
      pullRequest: {
        number: 2935,
        title: 'Checks',
        url: 'https://github.com/schickling/dotfiles/pull/2935',
        state: 'open' as const,
        isDraft: false,
        mergeable: 'mergeable' as const,
        reviewDecision: null,
        headRef: 'schickling/vista-live',
        headSha: checksPullRequestJson.headRefOid,
      },
      workflowRunCount: 0,
      latestWorkflowRun: null,
      run: null,
      checks: { quality: queued },
      cursor: 'cursor-1',
    }
    const event = {
      _tag: 'CheckUpdated' as const,
      check: completed,
      cursor: 'cursor-2',
    }

    const first = checksOperation.fold(initial, event)
    const second = checksOperation.fold(initial, event)
    expect(first).toEqual(second)
    expect(checksOperation.fold(first, event)).toEqual(first)
  })
})
