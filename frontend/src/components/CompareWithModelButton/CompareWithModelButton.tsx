import { useState } from 'react'
import { Link } from 'react-router'
import type { CheckpointListItem } from '../../api/client'
import type { LeaderboardBoard } from '../../utils/buildLeaderboard'
import { findSharedSetups } from '../../utils/modelResults'
import { paths } from '../../utils/paths'
import { Button } from '../Button/Button'
import type { ButtonSize } from '../Button/Button.helper'
import { Dialog } from '../Dialog/Dialog'
import { orderCandidatesParentFirst } from './CompareWithModelButton.helper'

interface CompareWithModelButtonProps {
  checkpoint: CheckpointListItem
  allCheckpoints: CheckpointListItem[]
  board: LeaderboardBoard
  size?: ButtonSize
}

// Phase 11's own "Compare with..." entry point (docs/UI_REDESIGN_PLAN.md
// §8.11), used by both a Models-list card/row and the model page's own
// header: a dialog listing every other model, parent first, with the
// setups both models share. Picking a setup picks both the other model
// and the comparison in one click, straight to
// /compare?runs=<this model's run>,<other model's run> (findSharedSetups'
// own baseline-first convention, baseline = this model). A model with
// no shared setup still appears, muted, with the reason -- never
// silently dropped, so "why isn't X here" never comes up.
export function CompareWithModelButton({ checkpoint, allCheckpoints, board, size = 'sm' }: CompareWithModelButtonProps) {
  const [open, setOpen] = useState(false)

  const otherModels = allCheckpoints.filter((candidate) => candidate.id !== checkpoint.id)
  const ordered = orderCandidatesParentFirst(otherModels, checkpoint.parent_checkpoint_id)

  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)}>
        Compare with…
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Compare ${checkpoint.name} with…`}
        description="Pick a shared setup to open it side by side."
        size="lg"
      >
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no other registered models yet.</p>
        ) : (
          <div className="max-h-96 space-y-4 overflow-y-auto">
            {ordered.map((candidate) => {
              const shared = findSharedSetups(board, checkpoint.id, candidate.id)
              return (
                <div key={candidate.id}>
                  <p className="text-sm font-medium text-foreground">
                    {candidate.name}
                    {candidate.id === checkpoint.parent_checkpoint_id && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">(parent)</span>
                    )}
                  </p>
                  {shared.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No shared setup</p>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {shared.map((comparison) => (
                        <Link
                          key={comparison.setup.comparisonHash}
                          to={paths.compare([comparison.baselineCell.evalRunId, comparison.otherCell.evalRunId])}
                          onClick={() => setOpen(false)}
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-border-strong hover:bg-muted"
                        >
                          {comparison.benchmarkDisplayName}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Dialog>
    </>
  )
}
