import type { EndpointListItem } from '../../api/client'
import { SelectField } from '../SelectField/SelectField'
import { describeEndpointOption } from './ChatServerPicker.helper'

interface ChatServerPickerProps {
  // Every currently-live endpoint for this one model -- the caller
  // (ChatPage.tsx) has already filtered /endpoints down to this
  // checkpoint's own rows.
  endpoints: EndpointListItem[]
  // null only when `endpoints` is empty -- the component itself still
  // never renders in that case (0 <= 1 below), so this is about
  // honest typing, not a state the SelectField actually has to show.
  selectedEndpointId: number | null
  onSelectedEndpointIdChange: (endpointId: number) => void
}

// A model only ever needs this when it has more than one server
// running at once (two serving profiles tried side by side, say) --
// the common case, one model with one server, never renders it at all.
export function ChatServerPicker({ endpoints, selectedEndpointId, onSelectedEndpointIdChange }: ChatServerPickerProps) {
  if (endpoints.length <= 1) {
    return null
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Server</span>
      <SelectField
        value={selectedEndpointId === null ? '' : String(selectedEndpointId)}
        onValueChange={(value) => onSelectedEndpointIdChange(Number(value))}
        groups={[
          {
            options: endpoints.map((endpoint) => ({
              value: String(endpoint.id),
              label: describeEndpointOption(endpoint),
            })),
          },
        ]}
        size="sm"
      />
    </label>
  )
}
