import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { inspectStaticPublication } from './publish.ts'
import { scanAll, versionDir } from './registry.ts'
import { makeBrowserMountSmoke, type RenderSmoke } from './render-smoke.ts'

/** Local admin operation: only derive missing previews; never replace a publication or receipt. */
export const backfillThumbnails = async (
  baseUrl: string,
  smoke: RenderSmoke = makeBrowserMountSmoke(baseUrl),
): Promise<{ written: number; skipped: number }> => {
  let written = 0
  let skipped = 0
  for (const app of scanAll().values()) {
    if (app.latest === null) continue
    const { owner, slug, latest: version } = app
    const destination = join(versionDir(owner, slug, version), 'thumbnail.png')
    if (existsSync(destination)) {
      skipped++
      continue
    }
    try {
      if (inspectStaticPublication(owner, slug, version)._tag !== 'verified') {
        console.warn(`Vista thumbnail backfill skipped unverified ${owner}/${slug}/v${version}`)
        skipped++
        continue
      }
      const result = await smoke(owner, slug, version)
      if (result._tag === 'failed' || result.thumbnail === undefined) {
        console.warn(
          `Vista thumbnail backfill skipped ${owner}/${slug}/v${version}: ${result._tag === 'failed' ? result.reason : 'capture unavailable'}`,
        )
        skipped++
        continue
      }
      writeFileSync(destination, result.thumbnail, { flag: 'wx', mode: 0o644 })
      written++
    } catch (cause) {
      console.warn(
        `Vista thumbnail backfill skipped ${owner}/${slug}/v${version}: ${String(cause)}`,
      )
      skipped++
    }
  }
  return { written, skipped }
}
