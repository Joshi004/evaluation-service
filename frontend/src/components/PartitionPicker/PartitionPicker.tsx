import { useClusterPartitions } from '../../api/queries/cluster'
import { Button } from '../Button/Button'
import { SelectField } from '../SelectField/SelectField'
import { buildPartitionOptions } from './PartitionPicker.helper'

interface PartitionPickerProps {
  // Controlled, mirroring ServingProfilePicker's own idiom: `null`
  // means "use this deployment's own default", the same meaning as the
  // request field's absence (CreateRunsRequest.partition,
  // app/api/client.ts) -- an untouched picker must never resolve to
  // some particular partition name the frontend picked on its own.
  value: string | null
  onValueChange: (value: string | null) => void
}

// New evaluation's own partition picker (per-run SLURM partition
// selection, an Advanced setting -- docs/UI_REDESIGN_PLAN.md §4.3):
// shows the cluster's real partition list -- including a hidden,
// lower-priority one like `background` that never appears in SLURM's
// own unqualified listing commands. useClusterPartitions never fetches
// on its own (ground rule 15); Refresh below is what calls the
// cluster. The default option stays selectable and un-disabled no
// matter what this query is doing, so a slow or failed cluster call
// never blocks a submit.
export function PartitionPicker({ value, onValueChange }: PartitionPickerProps) {
  const partitionsQuery = useClusterPartitions()

  const defaultPartitionName = partitionsQuery.data?.default_partition
  const options = partitionsQuery.data ? buildPartitionOptions(partitionsQuery.data) : []

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Cluster partition</span>
        <Button variant="ghost" size="sm" onClick={() => partitionsQuery.refetch()} loading={partitionsQuery.isFetching}>
          Refresh
        </Button>
      </div>
      <SelectField
        value={value ?? ''}
        onChange={(event) => onValueChange(event.target.value === '' ? null : event.target.value)}
        className="mt-1"
      >
        <option value="">{defaultPartitionName ? `Default (${defaultPartitionName})` : 'Default'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </SelectField>
      {partitionsQuery.isLoading && <p className="mt-1 text-xs text-muted-foreground">Loading partitions…</p>}
      {partitionsQuery.isError && (
        <p className="mt-1 text-xs text-danger">
          Could not load partitions from the cluster: {String(partitionsQuery.error)}
          {partitionsQuery.data ? ' — showing a cached list.' : ' — only the default is available.'}
        </p>
      )}
    </div>
  )
}
