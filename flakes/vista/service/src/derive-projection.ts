import type { SemanticManifest, SemanticStatus, Template } from '@vista/blocks/internal/authoring'
import type { ViteDevServer } from 'vite'
import type { CapturePlan } from './data/app.ts'

import { extractSemanticProjectionWithVite } from './semantic-extractor.ts'

/** Index metadata is a projection of the one derived semantic manifest. */
export interface DerivedProjection {
  readonly title: string
  readonly template: Template
  readonly status: SemanticStatus
  readonly semantics: SemanticManifest
  readonly capturePlan: CapturePlan
}

/**
 * Evaluate the trusted default React component and return its validated semantic
 * manifest together with its small index projection. No browser globals are
 * installed and there is no secondary authored metadata path.
 */
export const deriveProjection = async (
  vite: ViteDevServer,
  modulePath: string,
  options: { readonly invalidate?: boolean } = {},
): Promise<DerivedProjection> => {
  if (options.invalidate === true) {
    const modules = vite.moduleGraph.getModulesByFile(modulePath) ?? new Set()
    for (const module of modules) vite.moduleGraph.invalidateModule(module)
    vite.moduleGraph.invalidateAll()
  }
  const extraction = await extractSemanticProjectionWithVite(vite, modulePath)
  return {
    title: extraction.manifest.app.title,
    template: extraction.manifest.app.template as Template,
    status: extraction.manifest.app.status,
    semantics: extraction.manifest,
    capturePlan: extraction.capturePlan,
  }
}
