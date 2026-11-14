import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

import { expect, it } from 'vitest'

// Isolate the native callback cycle without Vite, React, StyleX or build caches.
// The service declares Vite (not Rolldown); resolve the experimental entry through
// Vite's own dependency edge so the child imports exactly the publication bundler's
// Rolldown without loading Vite into the isolated process.
const viteOwnedRolldownExperimental = pathToFileURL(
  createRequire(createRequire(import.meta.url).resolve('vite/package.json')).resolve(
    'rolldown/experimental',
  ),
).href

it('releases native resolver callback owners under the publication heap cap', () => {
  const result = execFileSync(
    process.execPath,
    [
      '--max-old-space-size=2048',
      '--expose-gc',
      '--input-type=module',
      '--eval',
      String.raw`
      import assert from 'node:assert/strict'
      import { setImmediate } from 'node:timers/promises'
      import { viteResolvePlugin } from ${JSON.stringify(viteOwnedRolldownExperimental)}

      // Callback identity is intentionally shared between all resolver owners.
      const ignoreSubpathImports = () => undefined
      const releasedOwner = (captureOwner) => {
        const owner = {}
        owner.plugin = viteResolvePlugin({
          resolveOptions: {
            isBuild: false, isProduction: false, asSrc: true,
            preferRelative: false, root: process.cwd(), scan: false,
            mainFields: ['module', 'main'], conditions: [], externalConditions: [],
            extensions: ['.js', '.json'], tryIndex: true,
            preserveSymlinks: false, tsconfigPaths: false,
          },
          environmentConsumer: 'client', environmentName: 'client',
          builtins: [], external: [], noExternal: [], dedupe: [],
          resolveSubpathImports: ignoreSubpathImports,
          onWarn: captureOwner ? message => { owner.warning = message } : console.warn,
        })
        return new WeakRef(owner)
      }
      const controls = Array.from({ length: 12 }, () => releasedOwner(false))
      const references = Array.from({ length: 12 }, () => releasedOwner(true))
      // WeakRef targets survive the current job. Cross job boundaries, not delays.
      for (let attempt = 0; attempt < 8; attempt++) {
        await setImmediate()
        global.gc()
      }
      assert.equal(controls.filter(ref => ref.deref()).length, 0)
      assert.equal(references.filter(ref => ref.deref()).length, 0,
        'native resolver callbacks retain released publication environments')
      console.log('released 12 callback owners')
    `,
    ],
    { encoding: 'utf8' },
  )
  expect(result).toContain('released 12 callback owners')
})
