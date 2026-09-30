import { Link } from 'react-router'
import type { CheckpointListItem, SamplingProfileSummary, ServingProfileSummary } from '../../api/client'
import { paths } from '../../utils/paths'
import { engineOptionEntries, servingFieldRows } from '../../utils/runConfigFieldRows'
import { buildSamplingValueRows } from '../../utils/samplingProfileValueRows'
import { FingerprintChip } from '../FingerprintChip/FingerprintChip'
import { KeyValueList } from '../KeyValueList/KeyValueList'
import { SidePanel } from '../SidePanel/SidePanel'

interface ProfileDetailPanelSharedProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Every model whose default_*_profile_id currently points at this
  // profile (the caller's own filter over useCheckpoints(), since
  // that's shared with the table's "Used by" count -- computing it
  // twice from two different places would risk the two disagreeing).
  defaultForModels: CheckpointListItem[]
}

// A discriminated union rather than one loosely-typed props object --
// `profile`'s own shape (and whether a run count exists at all,
// decision #8) genuinely differs by kind, so each branch below reads
// the exact fields that branch has, with tsc checking it rather than a
// comment promising it.
type ProfileDetailPanelProps =
  | (ProfileDetailPanelSharedProps & {
      kind: 'sampling'
      profile: SamplingProfileSummary
      usedInRunsCount: number
    })
  | (ProfileDetailPanelSharedProps & {
      kind: 'serving'
      profile: ServingProfileSummary
    })

// Shared by SamplingProfilesTab and ServingProfilesTab (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12): the fingerprint and every field for
// one profile, plus who's using it. Selection lives in the URL
// (decision #3) -- the caller owns the `?profile=` param and passes
// `open`/`onOpenChange` through to it.
export function ProfileDetailPanel(props: ProfileDetailPanelProps) {
  const { open, onOpenChange, profile, defaultForModels } = props
  const name = profile.label ?? 'Custom'

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={name}
      description={<FingerprintChip hash={profile.hash} />}
    >
      <div className="space-y-4">
        {props.kind === 'sampling' ? (
          <KeyValueList rows={buildSamplingValueRows(props.profile)} />
        ) : (
          <>
            <KeyValueList rows={servingFieldRows(props.profile)} />
            {engineOptionEntries(props.profile).length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                {engineOptionEntries(props.profile).map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="font-mono text-muted-foreground">{key}</dt>
                    <dd className="font-mono text-foreground">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}

        <div>
          <h3 className="text-sm font-medium text-foreground">Default for</h3>
          {defaultForModels.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No models currently.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {defaultForModels.map((model) => (
                <li key={model.id}>
                  <Link to={paths.model(model.id)} className="text-sm text-primary hover:underline">
                    {model.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {props.kind === 'sampling' && (
          <p className="text-sm text-muted-foreground">
            Used in {props.usedInRunsCount} run{props.usedInRunsCount === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </SidePanel>
  )
}
