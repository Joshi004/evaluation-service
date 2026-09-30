import { Skeleton } from '../Skeleton/Skeleton'

// Shaped like the Benchmarks list' own grouped card grid (§4.5: "shaped
// like the final layout") -- two category groups, three cards each, is
// enough to read as "a list of cards" without matching any one real
// count.
export function BenchmarksSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {[0, 1].map((groupIndex) => (
        <div key={groupIndex} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((cardIndex) => (
              <Skeleton key={cardIndex} className="h-36 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
