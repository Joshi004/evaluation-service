import type { EndpointListItem } from '../../api/client'

// "Job 12345 · 2 GPUs" -- slurm_job_id (not serving_profile_id) is
// what actually tells two simultaneous servers for the same model
// apart at a glance, since nothing stops two endpoints from sharing
// one serving profile.
export function describeEndpointOption(endpoint: EndpointListItem): string {
  const jobLabel = endpoint.slurm_job_id === null ? `Endpoint ${endpoint.id}` : `Job ${endpoint.slurm_job_id}`
  return `${jobLabel} \u00b7 ${endpoint.gpus} GPU${endpoint.gpus === 1 ? '' : 's'}`
}
