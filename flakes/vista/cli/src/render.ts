/**
 * Residual terminal rendering for the `vista` CLI commands NOT yet migrated to
 * `@overeng/tui-react` (decision 0063): `publish` (union result/preview + freeze
 * irreversibility, coupled to `canonical-url.test.ts`) and the `ask`/`await`
 * interview round-trip (no schema-derived wire contract yet — `JSON.stringify`).
 *
 * Everything else (list/open/retire/new/rehydrate + the debug family) now renders
 * through `commands/<cmd>/view.tsx`; this file shrinks to those three commands and
 * is removed entirely once they migrate. Colour is applied only when stdout is a
 * TTY (agents and pipes get clean text); `--json` callers bypass this.
 */

type PublishResultView = {
  readonly slug: string
  readonly version: number
  readonly frozen: number
  readonly live: number
  readonly url: string
  readonly canonical: boolean
}

type PublishPreviewView = {
  readonly slug: string
  readonly nextVersion: number
  readonly title?: string
  readonly template?: string
  readonly url: string
  readonly canonical: boolean
}

type AskResultView = {
  readonly appId: string
  readonly questionId: string
}

type AwaitOutcomeView =
  | {
      readonly _tag: 'answered'
      readonly answer?: {
        readonly chosenOptionIds: readonly string[]
      }
    }
  | { readonly _tag: 'pending' }
  | { readonly _tag: 'timeout' }
  | { readonly _tag: 'unknown' }

const useColor = process.stdout.isTTY === true && process.env.NO_COLOR === undefined

const dim = (s: string): string => (useColor ? `\x1b[2m${s}\x1b[22m` : s)
const bold = (s: string): string => (useColor ? `\x1b[1m${s}\x1b[22m` : s)
const yellow = (s: string): string => (useColor ? `\x1b[33m${s}\x1b[39m` : s)

const warningLines = (
  items: readonly { readonly name: string; readonly fix: string }[],
): string[] =>
  items.length === 0
    ? []
    : [
        'WARNING',
        '',
        ...items.flatMap((item) => [`  ${bold(item.name)}`, `    fix: ${item.fix}`]),
        '',
        '---',
        '',
      ]

/**
 * A one-line marker appended after a non-canonical (loopback) URL so a human is
 * never misled into treating a `--local` loopback link as shareable (SVC-R55).
 */
const nonCanonicalNote = (canonical: boolean): readonly string[] =>
  canonical
    ? []
    : [`  ${yellow('note: non-canonical loopback URL (--local); not reachable cross-host')}`]

/**
 * Formats a dry-run publish preview into multi-line CLI text showing the app slug, next version,
 * template, and the follow-up publish command to run.
 */
export const renderPublishPreview = (result: PublishPreviewView): string =>
  [
    'publish preview (--dry-run)',
    `  app: ${result.slug}`,
    `  next: v${result.nextVersion}`,
    `  title: ${result.title ?? dim('(derived from doc.meta at publish)')}`,
    ...(result.template === undefined ? [] : [`  template: ${result.template}`]),
    `  url: ${result.url}`,
    ...nonCanonicalNote(result.canonical),
    '',
    'next',
    '  vista publish <local-slug> -m "<change summary>"',
  ].join('\n')

/**
 * Formats a completed publish into CLI text reporting the app slug, published version, frozen
 * versus live data counts, and result URL.
 */
export const renderPublishResult = (result: PublishResultView): string =>
  [
    'publish',
    `  app: ${result.slug}`,
    `  version: v${result.version}`,
    `  data: ${result.frozen} frozen · ${result.live} live`,
    `  url: ${result.url}`,
    ...nonCanonicalNote(result.canonical),
  ].join('\n')

/**
 * Formats an ask submission into CLI text identifying the app and question and suggesting the
 * await command to poll for its answer.
 */
export const renderAskResult = (result: AskResultView): string =>
  [
    'ask',
    `  app: ${result.appId}`,
    `  question: ${result.questionId}`,
    '',
    'next',
    `  vista await ${result.appId} ${result.questionId}`,
  ].join('\n')

/**
 * Formats a question polling outcome for display, appending warnings with a retry hint when the
 * question is unknown or still unanswered.
 */
export const renderAwaitOutcome = (
  appId: string,
  questionId: string,
  outcome: AwaitOutcomeView,
): string => {
  const warnings =
    outcome._tag === 'answered'
      ? []
      : [
          {
            name: outcome._tag === 'unknown' ? 'unknown question' : 'no answer yet',
            fix: `vista await ${appId} ${questionId}`,
          },
        ]

  return [
    ...warningLines(warnings),
    'await',
    `  app: ${appId}`,
    `  question: ${questionId}`,
    `  status: ${outcome._tag}`,
    ...(outcome._tag === 'answered' && outcome.answer !== undefined
      ? [`  chosen: ${outcome.answer.chosenOptionIds.join(', ')}`]
      : []),
  ].join('\n')
}
