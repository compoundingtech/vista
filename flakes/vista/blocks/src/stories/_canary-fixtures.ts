/**
 * Real captured data for the pull-request review surfaces: the
 * `overengineeringstudio/effect-utils` #1260 → #1261 → #1262 stack (Buck2
 * TypeScript authority transfer), frozen with
 * `node flakes/vista/scripts/gh-pull-request.mjs overengineeringstudio/effect-utils#1262 --stack`.
 *
 * Deliberately large (243 + 88 + 157 files plus per-commit patches for 59
 * commits, ~5 MB): the review parts must stay usable on a request of this size,
 * and a synthetic fixture would not surface where the churn actually concentrates.
 */
import type { PullRequestData } from '../blocks/pull-request.ts'
import stack from './canary/effect-utils-1260-stack.json' with { type: 'json' }

/** Base→top as captured. */
export const canaryStack: readonly PullRequestData[] = stack as readonly PullRequestData[]

/**
 * The bottom (earliest) entry of the canary stack, exposed as a convenient baseline measurement
 * for canary-related stories.
 */
export const canaryBase = canaryStack[0]!
/**
 * The top (most recent) entry of the canary stack, exposed as the latest measurement for
 * canary-related stories.
 */
export const canaryTop = canaryStack.at(-1)!
