// The one family-grouping rule: every screen that groups checkpoints
// by family -- the Models list, the New evaluation ModelPicker, the
// Leaderboard's own family filter, and the registration wizard's
// family input's "matches an existing family" hint -- reads this
// instead of each computing its own label for a family whose stored
// spelling is inconsistent ("QWen3.5" vs "Qwen-3.5"). familyKey.ts is
// what makes the two spellings collapse into one group; this file
// decides which spelling represents the group on screen.
import type { CheckpointListItem } from '../api/client'
import { familyKey } from './familyKey'

// Used by the URL's `family=none` value (Leaderboard) and by every
// grouping below for a checkpoint with no family string at all.
export const NO_FAMILY_KEY = 'none'

export interface FamilyGroup {
  key: string
  // The most common spelling in this group; ties go to the spelling
  // used by the most recently registered checkpoint (see
  // `pickLabelAndSpellings` below).
  label: string
  // Every distinct spelling seen in this group, most common first --
  // the Models list' own "2 spellings" hint reads this array's length
  // (familySpellingsHint below); the registration family input's own
  // matching hint names `label` specifically.
  spellings: string[]
  checkpoints: CheckpointListItem[]
}

interface SpellingStat {
  spelling: string
  count: number
  latestCreatedAt: string
}

// "Most common spelling shown" -- ties broken by the spelling
// belonging to the most recently registered checkpoint, since that is
// the spelling whoever is looking at the group typed most recently.
function pickLabelAndSpellings(checkpoints: CheckpointListItem[]): { label: string; spellings: string[] } {
  const statsBySpelling = new Map<string, SpellingStat>()
  for (const checkpoint of checkpoints) {
    // Non-null by construction -- every caller below only puts a
    // checkpoint with a family string into this bucket.
    const spelling = checkpoint.family as string
    const existing = statsBySpelling.get(spelling)
    if (existing) {
      existing.count += 1
      if (checkpoint.created_at > existing.latestCreatedAt) {
        existing.latestCreatedAt = checkpoint.created_at
      }
    } else {
      statsBySpelling.set(spelling, { spelling, count: 1, latestCreatedAt: checkpoint.created_at })
    }
  }

  const spellings = [...statsBySpelling.values()]
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.latestCreatedAt.localeCompare(a.latestCreatedAt)))
    .map((stat) => stat.spelling)

  return { label: spellings[0], spellings }
}

// Groups every checkpoint by its normalised family, each labelled with
// its most common real spelling -- "No family" sorts last.
export function groupCheckpointsByFamily(checkpoints: CheckpointListItem[]): FamilyGroup[] {
  const checkpointsByKey = new Map<string, CheckpointListItem[]>()
  const noFamily: CheckpointListItem[] = []

  for (const checkpoint of checkpoints) {
    if (checkpoint.family === null) {
      noFamily.push(checkpoint)
      continue
    }
    const key = familyKey(checkpoint.family)
    const group = checkpointsByKey.get(key)
    if (group) {
      group.push(checkpoint)
    } else {
      checkpointsByKey.set(key, [checkpoint])
    }
  }

  const groups = [...checkpointsByKey.entries()].map(([key, groupCheckpoints]) => ({
    key,
    ...pickLabelAndSpellings(groupCheckpoints),
    checkpoints: [...groupCheckpoints].sort((a, b) => a.name.localeCompare(b.name)),
  }))
  groups.sort((a, b) => a.label.localeCompare(b.label))

  if (noFamily.length > 0) {
    groups.push({
      key: NO_FAMILY_KEY,
      label: 'No family',
      spellings: [],
      checkpoints: [...noFamily].sort((a, b) => a.name.localeCompare(b.name)),
    })
  }
  return groups
}

// "2 spellings" -- `null` for a group with one spelling (the common
// case), so a caller renders the hint only when there is something to
// disambiguate.
export function familySpellingsHint(group: Pick<FamilyGroup, 'spellings'>): string | null {
  return group.spellings.length > 1 ? `${group.spellings.length} spellings` : null
}

// The registration family input's own "matches an existing family"
// hint: `null` for an empty input, a brand-new family, or an input
// that already exactly matches the winning spelling (nothing to
// suggest switching to). Never matches the "No family" bucket -- that
// is an absence of a family, not a family a new checkpoint could join.
export function findMatchingFamily(input: string, groups: FamilyGroup[]): FamilyGroup | null {
  const trimmed = input.trim()
  if (trimmed === '') {
    return null
  }
  const key = familyKey(trimmed)
  return groups.find((group) => group.key === key && group.key !== NO_FAMILY_KEY && group.label !== trimmed) ?? null
}
