export type VistaRuntimeAliasTarget =
  | { readonly kind: 'root-relative'; readonly path: string }
  | { readonly kind: 'service-src'; readonly path: string }
  | { readonly kind: 'blocks'; readonly path: string }
  | { readonly kind: 'island'; readonly path: string }

export type VistaRuntimeAliasContribution = {
  readonly specifier: string
  readonly target: VistaRuntimeAliasTarget
  readonly public: boolean
}

export type VistaRemoteImportRule = {
  readonly name: string
  readonly pattern: string
  readonly description: string
}

export type VistaRuntimePolicyContribution = {
  readonly publicImportRoots?: readonly string[]
  readonly serviceOwnedImportRoots?: readonly string[]
  readonly optimizeInclude?: readonly string[]
  readonly optimizeExcludeRoots?: readonly string[]
  readonly cssImports?: readonly string[]
  readonly aliases?: readonly VistaRuntimeAliasContribution[]
  readonly remoteImports?: readonly VistaRemoteImportRule[]
  readonly ssrExternal?: readonly string[]
  readonly dedupe?: readonly string[]
  readonly slices?: readonly VistaRuntimePolicySlice[]
}

export type VistaRuntimePolicySlice = VistaRuntimePolicyContribution & {
  /**
   * Human-readable ownership label for a block family, provider family, or
   * service bridge. Validation errors report the slice so runtime-policy drift
   * points at the owning boundary instead of one flat package list.
  */
  readonly name: string
}

export const vistaRuntimePolicyContribution = <const T extends VistaRuntimePolicyContribution>(
  contribution: T,
): T => contribution

type PackageComposition = {
  readonly dependencies?: Record<string, string>
  readonly devDependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
}

type VistaRuntimePolicyFromCompositionArgs<TPublicPackages extends readonly string[]> = {
  readonly packageName?: string
  readonly composition: PackageComposition
  /**
   * Package roots review code may import directly. The helper checks these
   * against the composed manifest closure so the list cannot drift from Genie's
   * package dependency source of truth.
   */
  readonly publicPackages?: TPublicPackages
  readonly serviceOwnedImportRoots?: readonly string[]
  readonly optimizeSubpaths?: readonly string[]
  readonly optimizeAdditionalRoots?: readonly string[]
  readonly optimizeExcludeRoots?: readonly string[]
  readonly cssImports?: readonly string[]
  readonly aliases?: readonly VistaRuntimeAliasContribution[]
  readonly remoteImports?: readonly VistaRemoteImportRule[]
  readonly ssrExternal?: readonly string[]
  readonly dedupe?: readonly string[]
  readonly slices?: readonly VistaRuntimePolicySlice[]
}

const uniqueSorted = (values: Iterable<string>): string[] => [...new Set(values)].toSorted()

const packageRoot = (specifier: string): string =>
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : (specifier.split('/')[0] ?? specifier)

const packageClosure = ({
  packageName,
  composition,
}: Pick<VistaRuntimePolicyFromCompositionArgs<readonly string[]>, 'composition' | 'packageName'>) =>
  new Set([
    ...(packageName === undefined ? [] : [packageName]),
    ...Object.keys(composition.dependencies ?? {}),
    ...Object.keys(composition.devDependencies ?? {}),
    ...Object.keys(composition.peerDependencies ?? {}),
  ])

export const vistaRuntimePolicyFromComposition = <TPublicPackages extends readonly string[]>({
  packageName,
  composition,
  publicPackages = [] as unknown as TPublicPackages,
  serviceOwnedImportRoots = [],
  optimizeSubpaths = [],
  optimizeAdditionalRoots = [],
  optimizeExcludeRoots = [],
  cssImports = [],
  aliases = [],
  remoteImports = [],
  ssrExternal = [],
  dedupe = [],
  slices = [],
}: VistaRuntimePolicyFromCompositionArgs<TPublicPackages>): VistaRuntimePolicyContribution => {
  const closure = packageClosure({ packageName, composition })
  const sliceServiceOwnedImportRoots = slices.flatMap((slice) => slice.serviceOwnedImportRoots ?? [])
  const serviceOwned = new Set([...serviceOwnedImportRoots, ...sliceServiceOwnedImportRoots])
  const missingPublicPackages = publicPackages.filter(
    (name) => !closure.has(name) && !serviceOwned.has(name),
  )
  const missingOptimizedRoots = optimizeAdditionalRoots.filter(
    (name) => !closure.has(name) && !serviceOwned.has(name),
  )
  const sliceProblems = slices.flatMap((slice) => {
    const missingSlicePublic = (slice.publicImportRoots ?? []).filter(
      (name) => !closure.has(name) && !serviceOwned.has(name),
    )
    const missingSliceOptimized = (slice.optimizeInclude ?? []).filter((name) => {
      const root = packageRoot(name)
      return !closure.has(root) && !serviceOwned.has(root)
    })
    return [
      ...(missingSlicePublic.length === 0
        ? []
        : [`Slice ${slice.name} missing public packages: ${missingSlicePublic.join(', ')}`]),
      ...(missingSliceOptimized.length === 0
        ? []
        : [`Slice ${slice.name} missing optimized packages: ${missingSliceOptimized.join(', ')}`]),
    ]
  })
  if (
    missingPublicPackages.length > 0 ||
    missingOptimizedRoots.length > 0 ||
    sliceProblems.length > 0
  ) {
    throw new Error(
      [
        'Vista runtime policy is not derivable from the Genie package composition.',
        missingPublicPackages.length === 0
          ? undefined
          : `Missing public packages: ${missingPublicPackages.join(', ')}`,
        missingOptimizedRoots.length === 0
          ? undefined
          : `Missing optimized packages: ${missingOptimizedRoots.join(', ')}`,
        ...sliceProblems,
      ]
        .filter((line): line is string => line !== undefined)
        .join(' '),
    )
  }

  const optimizeExcluded = new Set(optimizeExcludeRoots)
  const publicImportRoots = uniqueSorted([...publicPackages, ...serviceOwnedImportRoots])

  return vistaRuntimePolicyContribution({
    publicImportRoots,
    ...(serviceOwnedImportRoots.length === 0
      ? {}
      : { serviceOwnedImportRoots: uniqueSorted(serviceOwnedImportRoots) }),
    optimizeInclude: uniqueSorted([
      ...publicPackages.filter((root) => !optimizeExcluded.has(root) && !serviceOwned.has(root)),
      ...optimizeAdditionalRoots,
      ...optimizeSubpaths,
    ]),
    ...(cssImports.length === 0
      ? {}
      : { cssImports: uniqueSorted(cssImports) }),
    ...(aliases.length === 0
      ? {}
      : { aliases }),
    ...(remoteImports.length === 0
      ? {}
      : { remoteImports }),
    ...(ssrExternal.length === 0
      ? {}
      : { ssrExternal: uniqueSorted(ssrExternal) }),
    ...(dedupe.length === 0
      ? {}
      : { dedupe: uniqueSorted(dedupe) }),
    ...(slices.length === 0 ? {} : { slices }),
  })
}
