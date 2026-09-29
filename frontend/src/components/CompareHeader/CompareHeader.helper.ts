// Non-DOM logic for CompareHeader.tsx: the page's own one-line
// description.
export function compareRunsDescription(benchmarkDisplayName: string, runCount: number): string {
  return `${benchmarkDisplayName} · ${runCount} run${runCount === 1 ? '' : 's'}`
}
