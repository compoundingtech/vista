type Cluster<Frame> = {
  readonly representative: Frame
  count: number
}

const clusterFrames = <Frame>(
  frames: readonly Frame[],
  equivalent: (left: Frame, right: Frame) => boolean,
): readonly Cluster<Frame>[] => {
  const clusters: Cluster<Frame>[] = []
  for (const frame of frames) {
    const cluster = clusters.find(({ representative }) => equivalent(frame, representative))
    if (cluster === undefined) clusters.push({ representative: frame, count: 1 })
    else cluster.count += 1
  }
  return clusters
}

/**
 * Clusters reference and candidate frames by the given equivalence relation, returns the most
 * frequent member of each cluster, and throws unless the reference's dominant cluster reaches the
 * minimum support count.
 */
export const selectDominantPair = <Frame>(
  references: readonly Frame[],
  candidates: readonly Frame[],
  equivalent: (left: Frame, right: Frame) => boolean,
  minimumSupport: number,
): readonly [reference: Frame, candidate: Frame] => {
  const reference = clusterFrames(references, equivalent).toSorted((a, b) => b.count - a.count)[0]
  const candidate = clusterFrames(candidates, equivalent).toSorted((a, b) => b.count - a.count)[0]

  if (reference === undefined || reference.count < minimumSupport) {
    throw new Error(`Reference frames have no ${minimumSupport}-sample dominant cluster`)
  }
  if (candidate === undefined || candidate.count < minimumSupport) {
    throw new Error(`Candidate frames have no ${minimumSupport}-sample dominant cluster`)
  }
  if (!equivalent(candidate.representative, reference.representative)) {
    throw new Error('Dominant reference and candidate frame clusters differ')
  }
  return [reference.representative, candidate.representative]
}
