import { TERM_HINTS } from '../../utils/labels'
import { FingerprintChip } from '../FingerprintChip/FingerprintChip'
import { Table, TableCell, TableHeaderCell } from '../Table/Table'
import { TermLabel } from '../TermLabel/TermLabel'

export interface ProfileTableRow {
  id: number
  hash: string
  name: string
  summary: string
  // Already formatted by the caller (ProfilesPage.helper.ts's
  // formatUsedBy) -- sampling and serving profiles count "used by"
  // differently (decision #8), so this table only ever renders text,
  // never re-derives it.
  usedBy: string
}

interface ProfilesTableProps {
  rows: ProfileTableRow[]
  onSelectProfile: (id: number) => void
}

// Shared by SamplingProfilesTab and ServingProfilesTab (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12): Name, Summary, Used by and
// Fingerprint columns for either catalog. A row click or the name
// button opens the ?profile=-driven drawer -- the button exists
// alongside the row's own onClick so the same action stays reachable
// by keyboard, not only by mouse.
export function ProfilesTable({ rows, onSelectProfile }: ProfilesTableProps) {
  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Summary</TableHeaderCell>
          <TableHeaderCell>Used by</TableHeaderCell>
          <TableHeaderCell>
            <TermLabel hint={TERM_HINTS.fingerprint}>Fingerprint</TermLabel>
          </TableHeaderCell>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} onClick={() => onSelectProfile(row.id)} className="cursor-pointer hover:bg-muted">
            <TableCell>
              <button
                type="button"
                onClick={() => onSelectProfile(row.id)}
                className="font-medium text-primary hover:underline"
              >
                {row.name}
              </button>
            </TableCell>
            <TableCell className="text-muted-foreground">{row.summary}</TableCell>
            <TableCell className="text-muted-foreground">{row.usedBy}</TableCell>
            <TableCell>
              <FingerprintChip hash={row.hash} />
            </TableCell>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
