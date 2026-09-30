import type { CheckpointListItem } from '../../api/client'
import { findMatchingFamily, groupCheckpointsByFamily, NO_FAMILY_KEY } from '../../utils/familyGroups'
import { TextInput } from '../TextInput/TextInput'

interface FamilyInputProps {
  value: string
  onChange: (value: string) => void
  checkpoints: CheckpointListItem[]
}

const DATALIST_ID = 'family-input-options'

// Registration step 2's family field (docs/UI_REDESIGN_PLAN.md §8.11):
// a plain text input backed by a native <datalist> of every family
// already on file, so typing a close variant of an existing spelling
// ("qwen 3.5") surfaces a hint to use the winning one instead
// (familyGroups.ts's own "one family rule everywhere") rather than
// quietly minting a second, near-duplicate family.
export function FamilyInput({ value, onChange, checkpoints }: FamilyInputProps) {
  const groups = groupCheckpointsByFamily(checkpoints).filter((group) => group.key !== NO_FAMILY_KEY)
  const matchingFamily = findMatchingFamily(value, groups)

  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">Family (optional)</span>
      <TextInput
        list={DATALIST_ID}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="e.g. Qwen-3.5"
        className="mt-1 w-full"
      />
      <datalist id={DATALIST_ID}>
        {groups.map((group) => (
          <option key={group.key} value={group.label} />
        ))}
      </datalist>
      {matchingFamily && (
        <p className="mt-1 text-xs text-muted-foreground">
          Matches existing family "{matchingFamily.label}" — use that spelling.
        </p>
      )}
    </label>
  )
}
