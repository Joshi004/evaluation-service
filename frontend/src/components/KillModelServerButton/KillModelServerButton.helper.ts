import type { EndpointListItem } from '../../api/client'

// The ConfirmDialog's own description text: states exactly what Kill
// does (ground rule 14) rather than a generic "are you sure?".
export function killModelServerDescription(
  endpoint: Pick<EndpointListItem, 'slurm_job_id' | 'gpus'>,
): string {
  const jobPhrase = endpoint.slurm_job_id === null ? 'Its SLURM job' : `SLURM job ${endpoint.slurm_job_id}`
  const gpuPhrase = `${endpoint.gpus} GPU${endpoint.gpus === 1 ? '' : 's'}`
  const gpuVerb = endpoint.gpus === 1 ? 'is' : 'are'
  return `${jobPhrase} is cancelled now and its ${gpuPhrase} ${gpuVerb} freed. Any run still using this server loses it.`
}
