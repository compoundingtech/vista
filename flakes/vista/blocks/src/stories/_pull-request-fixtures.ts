/**
 * Deterministic pull-request fixtures for the `PullRequestViewer` stories and
 * tests. They continue the `_fixtures.ts` narrative (the `axe` provider-registry
 * app): PR #482 is the change that reaps the provider process group.
 *
 * Every patch is git-framed (`diff --git` + `index`), which is what a real
 * captured review payload carries and what the viewer's parser expects.
 */
import {
  provenanceFor,
  type PullRequestData,
  type PullRequestFile,
} from '../blocks/pull-request.ts'

const supervisorPatch = `diff --git a/src/supervisor.ts b/src/supervisor.ts
index 3f1a2b4..9c4d1e7 100644
--- a/src/supervisor.ts
+++ b/src/supervisor.ts
@@ -1,9 +1,10 @@
 import { spawn } from 'node:child_process'
+import { reapGroup } from './reap.ts'
${' '}
 export const supervise = (cmd: string) => {
-  const child = spawn(cmd, { detached: false })
+  const child = spawn(cmd, { detached: true })
   child.on('exit', () => {
-    console.log('child exited')
+    reapGroup(child.pid)
   })
   return child
 }
@@ -20,3 +21,4 @@ export const shutdown = async (child: ChildProcess) => {
   child.kill('SIGTERM')
   await once(child, 'exit')
+  reapGroup(child.pid)
 }
`

const reapPatch = `diff --git a/src/reap.ts b/src/reap.ts
new file mode 100644
index 0000000..7ab19cd
--- /dev/null
+++ b/src/reap.ts
@@ -0,0 +1,8 @@
+/** Reap the whole detached process group so esbuild children never orphan. */
+export const reapGroup = (pid: number | undefined) => {
+  if (pid === undefined) return
+  try {
+    process.kill(-pid, 'SIGTERM')
+  } catch {}
+}
+
`

const legacyViewerPatch = `diff --git a/src/viewer/legacy.ts b/src/viewer/legacy.ts
deleted file mode 100644
index 5e0aa31..0000000
--- a/src/viewer/legacy.ts
+++ /dev/null
@@ -1,6 +0,0 @@
-export const attachLegacy = (pid: number) => {
-  // superseded by the supervised-PTY embed composition
-  return { pid, mode: 'legacy' as const }
-}
-
-export default attachLegacy
`

const tmuxProjectionPatch = `diff --git a/src/projection/tmux-legacy.ts b/src/projection/tmux.ts
similarity index 74%
rename from src/projection/tmux-legacy.ts
rename to src/projection/tmux.ts
index 1122334..4455667 100644
--- a/src/projection/tmux-legacy.ts
+++ b/src/projection/tmux.ts
@@ -1,3 +1,3 @@
-export const projectOuter = (session: string) => {
-  return { session, host: 'tmux' }
+export const projectOuter = (session: string, host = 'tmux') => {
+  return { session, host }
 }
`

const killOld = `export const grace = 0
export const kill = () => process.exit(1)

export const describe = () => 'immediate'
`

const killNew = `export const grace = 5_000
export const kill = (signal: NodeJS.Signals = 'SIGTERM') => {
  process.kill(-process.pid, signal)
}

export const describe = () => 'bounded graceful shutdown'
`

/** The full, mixed-status review payload: patches plus one content pair. */
export const pullRequest: PullRequestData = {
  number: 482,
  title: 'Reap the provider process group on shutdown',
  url: 'https://github.com/schickling/axe/pull/482',
  author: 'schickling-assistant',
  state: 'open',
  body: [
    'Detaches the provider so the supervisor can reap the whole process group,',
    'closing the esbuild-orphan leak observed in the agent-run dogfood.',
    '',
    'Shutdown is bounded: SIGTERM, wait for exit, then reap the group.',
  ].join('\n'),
  files: [
    { path: 'src/supervisor.ts', status: 'modified', patch: supervisorPatch },
    { path: 'src/reap.ts', status: 'added', patch: reapPatch },
    { path: 'src/viewer/legacy.ts', status: 'deleted', patch: legacyViewerPatch },
    {
      path: 'src/projection/tmux.ts',
      status: 'renamed',
      previousPath: 'src/projection/tmux-legacy.ts',
      patch: tmuxProjectionPatch,
    },
    // Authored from full contents: the only shape where @pierre can expand
    // unchanged context beyond the hunks.
    { path: 'src/kill.ts', status: 'modified', oldContents: killOld, newContents: killNew },
  ],
}

/**
 * Capture-shaped provenance fixture. The viewer receives only the parsed result:
 * the same `.gitattributes` rules used by the author-time capture stamp each file.
 */
const provenanceGitattributes = `
/src/*.ts linguist-generated=true
/src/viewer/** linguist-vendored=true
`

/**
 * Derives a pull-request fixture that attaches provenance metadata to each file via the fixture
 * .gitattributes rules, leaving unresolvable files untouched.
 */
export const provenancePullRequest: PullRequestData = {
  ...pullRequest,
  number: 488,
  title: 'Regenerate supervised provider sources',
  files: pullRequest.files.map((file) => {
    const provenance = provenanceFor(file.path, provenanceGitattributes)
    return provenance === undefined ? file : { ...file, provenance }
  }),
}

/** Only the content-pair file, to exercise expandable (non-partial) context. */
export const contentPairPullRequest: PullRequestData = {
  ...pullRequest,
  number: 483,
  title: 'Bound provider shutdown at five seconds',
  files: [{ path: 'src/kill.ts', status: 'modified', oldContents: killOld, newContents: killNew }],
}

/** A 48-file changeset: exercises the rail, sticky headers, and virtualization. */
export const largePullRequest: PullRequestData = {
  number: 484,
  title: 'Supervise every registry provider',
  url: 'https://github.com/schickling/axe/pull/484',
  author: 'schickling-assistant',
  state: 'draft',
  body: 'Mechanical rollout of the supervised provider contract across the registry.',
  files: Array.from({ length: 48 }, (_unused, index): PullRequestFile => {
    const path = `packages/registry/src/providers/provider-${String(index + 1).padStart(2, '0')}.ts`
    return {
      path,
      status: (index + 1) % 7 === 0 ? 'added' : 'modified',
      patch: `diff --git a/${path} b/${path}
index aaaaaa${index}..bbbbbb${index} 100644
--- a/${path}
+++ b/${path}
@@ -1,6 +1,8 @@
 import { defineProvider } from '../define.ts'
+import { reapGroup } from '../../reap.ts'
${' '}
 export const provider${index} = defineProvider({
-  name: 'provider-${index}',
+  name: 'provider-${index}-supervised',
   start: () => spawn('node', ['worker.js'], { detached: true }),
+  stop: (pid: number) => reapGroup(pid),
 })
`,
    }
  }),
}

/** A pull request that changes nothing — the bounded empty state. */
export const emptyPullRequest: PullRequestData = {
  number: 485,
  title: 'Retarget the release branch',
  url: 'https://github.com/schickling/axe/pull/485',
  author: 'schickling-assistant',
  state: 'open',
  body: 'Branch retarget only; no file changes.',
  files: [],
}

/** Mixed renderable/unrenderable files: partial failure must stay bounded. */
export const partiallyBrokenPullRequest: PullRequestData = {
  number: 486,
  title: 'Vendor the provider snapshots',
  url: 'https://github.com/schickling/axe/pull/486',
  author: 'schickling-assistant',
  state: 'open',
  body: 'Two of these files were captured without a usable patch.',
  files: [
    { path: 'src/supervisor.ts', status: 'modified', patch: supervisorPatch },
    { path: 'assets/provider-snapshot.bin', status: 'added' },
    { path: 'src/corrupt.ts', status: 'modified', patch: 'this is not a patch at all\n' },
  ],
}

/** Nothing renderable at all: the whole-viewer error state. */
export const brokenPullRequest: PullRequestData = {
  ...partiallyBrokenPullRequest,
  number: 487,
  title: 'Capture the binary provider snapshots',
  files: partiallyBrokenPullRequest.files.filter((file) => file.path !== 'src/supervisor.ts'),
}
