#!/usr/bin/env node
/**
 * Author-time GitHub capture (decision 0080): freeze a pull request — or the whole
 * stack it sits on — into the serializable `PullRequestData` the `pull-request`
 * blocks render. This is the ONE impure, forge-touching step; the kit never fetches.
 *
 * Usage:
 *   node flakes/vista/scripts/gh-pull-request.mjs <owner>/<repo>#<number> [--stack] [--out <file>]
 *   node flakes/vista/scripts/gh-pull-request.mjs overengineeringstudio/effect-utils#1262 --stack
 *
 * Output: without `--stack`, one `PullRequestData`. With `--stack`, a `PullRequestData[]`
 * ordered base→top: starting at the given request, each request whose head branch is
 * the previous one's base branch is prepended until the base is the repository's
 * default branch. Per-file `additions`/`deletions` come from the forge so churn stays
 * exact even when GitHub omits a patch (binary, oversized, or pure rename). Provenance
 * is resolved from every applicable `.gitattributes` in the head commit and frozen onto
 * both request-level and per-commit files.
 *
 * Requires an authenticated `gh` CLI.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

import { provenanceFor } from '../blocks/src/blocks/pull-request.ts'

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
const outPath = outFlag === -1 ? undefined : args[outFlag + 1]
const stack = args.includes('--stack')
const target = args.find((a, i) => !a.startsWith('--') && i !== outFlag + 1)
const match = target === undefined ? null : /^([^/]+)\/([^#]+)#(\d+)$/u.exec(target)

if (match === null) {
  process.stderr.write(
    'usage: gh-pull-request.mjs <owner>/<repo>#<number> [--stack] [--out <file>]\n',
  )
  process.exit(2)
}

const [, owner, repo, firstNumber] = match
const api = (path) =>
  JSON.parse(
    execFileSync('gh', ['api', '--paginate', '--slurp', path], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    }),
  ).flat()

/** GitHub's file-status vocabulary onto the kit's `GitStatus`. */
const STATUS = {
  added: 'added',
  copied: 'added',
  removed: 'deleted',
  renamed: 'renamed',
  modified: 'modified',
  changed: 'modified',
  unchanged: 'modified',
}

const gitattributesAt = (repository, headSha) => {
  const [tree] = api(`repos/${repository}/git/trees/${encodeURIComponent(headSha)}?recursive=1`)
  if (tree?.truncated === true) {
    throw new Error(`GitHub truncated the recursive tree for ${repository}@${headSha}`)
  }

  return (tree?.tree ?? [])
    .filter(
      (entry) =>
        entry.type === 'blob' &&
        (entry.path === '.gitattributes' || entry.path.endsWith('/.gitattributes')),
    )
    .map((entry) => {
      const contentPath = entry.path.split('/').map(encodeURIComponent).join('/')
      const [response] = api(
        `repos/${repository}/contents/${contentPath}?ref=${encodeURIComponent(headSha)}`,
      )
      if (typeof response?.content !== 'string') {
        throw new Error(`GitHub returned no content for ${repository}/${entry.path}@${headSha}`)
      }
      const slash = entry.path.lastIndexOf('/')
      return {
        dir: slash === -1 ? '' : entry.path.slice(0, slash),
        text: Buffer.from(response.content.replaceAll('\n', ''), 'base64').toString('utf8'),
      }
    })
}

const captureFile = (file, gitattributesFiles) => {
  const provenance = provenanceFor(file.filename, gitattributesFiles)
  return {
    path: file.filename,
    status: STATUS[file.status] ?? 'modified',
    ...(file.previous_filename === undefined ? {} : { previousPath: file.previous_filename }),
    additions: file.additions,
    deletions: file.deletions,
    ...(typeof file.patch === 'string' ? { patch: file.patch } : {}),
    ...(provenance === undefined ? {} : { provenance }),
  }
}

const capture = (number) => {
  const [pr] = api(`repos/${owner}/${repo}/pulls/${number}`)
  const gitattributesFiles = gitattributesAt(
    pr.head.repo?.full_name ?? `${owner}/${repo}`,
    pr.head.sha,
  )
  const files = api(`repos/${owner}/${repo}/pulls/${number}/files?per_page=100`).map((file) =>
    captureFile(file, gitattributesFiles),
  )
  const commits = api(`repos/${owner}/${repo}/pulls/${number}/commits?per_page=100`).map(
    ({ sha }) => {
      const [detail, ...additionalPages] = api(`repos/${owner}/${repo}/commits/${sha}?per_page=100`)
      const commitFiles = [
        ...(detail.files ?? []),
        ...additionalPages.flatMap((page) => page.files ?? []),
      ]
      return {
        sha: detail.sha,
        message: detail.commit.message,
        author: detail.commit.author?.name ?? detail.author?.login ?? 'unknown',
        date: detail.commit.author?.date ?? detail.commit.committer.date,
        files: commitFiles.map((file) => captureFile(file, gitattributesFiles)),
      }
    },
  )
  return {
    data: {
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      author: pr.user.login,
      state: pr.merged_at ? 'merged' : pr.draft ? 'draft' : pr.state,
      repository: `${owner}/${repo}`,
      baseRef: pr.base.ref,
      headRef: pr.head.ref,
      additions: pr.additions,
      deletions: pr.deletions,
      body: pr.body ?? '',
      files,
      commits,
    },
    defaultBranch: pr.base.repo.default_branch,
  }
}

const first = capture(firstNumber)
const chain = [first.data]
if (stack) {
  let base = first.data.baseRef
  while (base !== first.defaultBranch) {
    const [below] = api(
      `repos/${owner}/${repo}/pulls?state=all&head=${encodeURIComponent(`${owner}:${base}`)}`,
    )
    if (below === undefined) {
      process.stderr.write(`no pull request has head ${base}; stack stops here\n`)
      break
    }
    chain.unshift(capture(below.number).data)
    base = below.base.ref
  }
}

const payload = stack ? chain : first.data
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`
const budgetBytes = 6 * 1024 * 1024
const withCommitPatches = serialize(payload)
const withCommitPatchesBytes = Buffer.byteLength(withCommitPatches)

let json
if (withCommitPatchesBytes <= budgetBytes) {
  json = withCommitPatches
  process.stderr.write(
    `payload budget: retained per-commit patches (${withCommitPatchesBytes} bytes <= ${budgetBytes} bytes)\n`,
  )
} else {
  const withoutCommitPatches = (stack ? chain : [first.data]).map((pullRequest) => ({
    ...pullRequest,
    commits: pullRequest.commits?.map((commit) => ({
      ...commit,
      files: commit.files.map(({ patch: _patch, ...file }) => file),
    })),
  }))
  const budgetedPayload = stack ? withoutCommitPatches : withoutCommitPatches[0]
  json = serialize(budgetedPayload)
  const budgetedBytes = Buffer.byteLength(json)
  process.stderr.write(
    `payload budget: omitted per-commit patches (${withCommitPatchesBytes} bytes > ${budgetBytes} bytes; ${budgetedBytes} bytes after omission)\n`,
  )
}

if (outPath === undefined) process.stdout.write(json)
else writeFileSync(outPath, json)
