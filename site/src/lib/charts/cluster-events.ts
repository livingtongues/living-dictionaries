// Single-linkage proximity clustering for timeline event markers (deploys): points
// whose pixel x-positions are within `min_gap` chain into one cluster, so a burst of
// deploys collapses to a single tick instead of a pile of overlapping chips. Pure +
// scale-agnostic — the caller passes already-projected x (viewBox units).

export interface ClusterPoint<T> { item: T, x: number }
export interface EventCluster<T> { x: number, items: T[] }

export function cluster_events<T>({ points, min_gap }: { points: ClusterPoint<T>[], min_gap: number }): EventCluster<T>[] {
  if (points.length === 0)
    return []
  const sorted = [...points].sort((left, right) => left.x - right.x)
  const clusters: EventCluster<T>[] = []
  let group: ClusterPoint<T>[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].x - group[group.length - 1].x <= min_gap) {
      group.push(sorted[i])
    } else {
      clusters.push(finalize(group))
      group = [sorted[i]]
    }
  }
  clusters.push(finalize(group))
  return clusters
}

function finalize<T>(group: ClusterPoint<T>[]): EventCluster<T> {
  const x = group.reduce((sum, point) => sum + point.x, 0) / group.length
  return { x, items: group.map(point => point.item) }
}

if (import.meta.vitest) {
  describe(cluster_events, () => {
    it('returns empty for no points', () => {
      expect(cluster_events({ points: [], min_gap: 10 })).toEqual([])
    })

    it('merges nearby points and splits far ones', () => {
      const result = cluster_events({
        points: [{ item: 'a', x: 0 }, { item: 'b', x: 6 }, { item: 'c', x: 100 }],
        min_gap: 20,
      })
      expect(result).toHaveLength(2)
      expect(result[0].items).toEqual(['a', 'b'])
      expect(result[1].items).toEqual(['c'])
    })

    it('chains a run of evenly-spaced points within the gap into one cluster', () => {
      const result = cluster_events({
        points: [0, 10, 20, 30].map((x, i) => ({ item: i, x })),
        min_gap: 12,
      })
      expect(result).toHaveLength(1)
      expect(result[0].items).toEqual([0, 1, 2, 3])
    })

    it('sorts unordered input and centroids each cluster', () => {
      const result = cluster_events({
        points: [{ item: 'c', x: 100 }, { item: 'a', x: 0 }, { item: 'b', x: 4 }],
        min_gap: 20,
      })
      expect(result.map(cluster => cluster.x)).toEqual([2, 100])
      expect(result[0].items).toEqual(['a', 'b'])
    })
  })
}
