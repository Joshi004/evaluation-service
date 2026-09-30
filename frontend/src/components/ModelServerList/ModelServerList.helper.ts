// Non-DOM logic for ModelServerList.tsx: totalling GPU usage across
// every live endpoint (moved from the deleted EndpointsPage.helper.ts)
// and the section header's own caption, which carries the same counts
// in words next to LiveIndicator's dot (§4.5: never colour alone).
import type { EndpointListItem } from '../../api/client'

export function sumGpus(endpoints: EndpointListItem[]): number {
  return endpoints.reduce((total, endpoint) => total + endpoint.gpus, 0)
}

// "2 live · 3 GPUs in use" -- the heading itself supplies "Model
// servers", so this only carries the counts (mirrors
// RunsBatchHeaderRow.helper's own "N run(s) · M shown" shape).
export function modelServerListSummary(serverCount: number, totalGpus: number): string {
  const gpuWord = totalGpus === 1 ? 'GPU' : 'GPUs'
  return `${serverCount} live \u00b7 ${totalGpus} ${gpuWord} in use`
}
