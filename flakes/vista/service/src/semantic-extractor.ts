import type { SemanticManifest } from '@vista/blocks/internal/authoring'
import type { Plugin, ViteDevServer } from 'vite'

import type { CapturePlan } from './data/app.ts'

interface SemanticExtraction {
  readonly manifest: SemanticManifest
  readonly capturePlan: CapturePlan
}

const publicPrefix = 'virtual:vista-semantic-extractor:'
const resolvedPrefix = `\0${publicPrefix}`

/**
 * Evaluates trusted app source in Vite's SSR realm. The generated module imports
 * only the default zero-prop component, renders that same component twice, and
 * rejects changing semantic output before publication can mutate durable state.
 */
export const semanticExtractor = (): Plugin => ({
  name: 'vista-semantic-extractor',
  enforce: 'pre',
  resolveId: (id) => (id.startsWith(publicPrefix) ? `\0${id}` : undefined),
  load: (id) => {
    if (!id.startsWith(resolvedPrefix)) return undefined
    const encodedModulePath = id.slice(resolvedPrefix.length).split('?', 1)[0]!
    const modulePath = decodeURIComponent(encodedModulePath)
    return `
      import { createElement } from 'react'
      import { extractSemanticProjection } from '@vista/blocks/internal/authoring'
      import App from ${JSON.stringify(modulePath)}

      if (typeof App !== 'function') {
        throw new Error(${JSON.stringify(`${modulePath}: app.tsx must default-export a zero-prop React component`)})
      }
      if (App.length > 0) {
        throw new Error(${JSON.stringify(`${modulePath}: the default React component must take no props`)})
      }

      const extract = () => {
        try {
          return extractSemanticProjection(createElement(App))
        } catch (cause) {
          const detail = cause instanceof Error ? cause.message : String(cause)
          throw new Error(${JSON.stringify(`${modulePath}: semantic evaluation failed: `)} + detail, { cause })
        }
      }
      const first = extract()
      const repeated = extract()
      if (JSON.stringify(first.manifest) !== JSON.stringify(repeated.manifest)) {
        throw new Error(${JSON.stringify(`${modulePath}: semantic evaluation is nondeterministic; two evaluations produced different manifests`)})
      }
      export default first
    `
  },
})

/**
 * Invalidates the Vite module graph and SSR-loads the given module path under a unique
 * extraction-pass cache key, returning its default semantic projection and wrapping any load
 * failure in a descriptive error that preserves the original cause.
 */
export const extractSemanticProjectionWithVite = async (
  vite: ViteDevServer,
  modulePath: string,
  extractionPass = 0,
): Promise<SemanticExtraction> => {
  vite.moduleGraph.invalidateAll()
  const id = `${publicPrefix}${encodeURIComponent(modulePath)}?extraction-pass=${extractionPass}`
  try {
    return (await vite.ssrLoadModule(id)).default as SemanticExtraction
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`could not extract semantic manifest from ${modulePath}: ${detail}`, { cause })
  }
}

/**
 * Extracts just the semantic manifest by delegating to the projection extractor with the same Vite
 * server, module path, and extraction pass, then returning the manifest field of the result.
 */
export const extractSemanticManifestWithVite = async (
  vite: ViteDevServer,
  modulePath: string,
  extractionPass = 0,
): Promise<SemanticManifest> =>
  (await extractSemanticProjectionWithVite(vite, modulePath, extractionPass)).manifest
