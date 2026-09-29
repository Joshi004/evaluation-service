import { Button } from '../Button/Button'

interface NewEvaluationSummaryBarProps {
  modelCount: number
  benchmarkCount: number
  runCount: number
  gpuCount: number
  showBack: boolean
  onBack: () => void
  primaryLabel: string
  onPrimaryAction: () => void
  primaryDisabled: boolean
  primaryLoading: boolean
  // Shown next to the primary button whenever it's disabled -- "one
  // primary action per screen" (§3 principle 1) still needs to say why
  // that action isn't available yet, not just grey it out.
  blockReason: string | null
}

// The wizard's own sticky footer (Phase 10, docs/UI_REDESIGN_PLAN.md
// §8.10, sketch §4.4.6): "N models × M benchmarks = R runs · G GPUs" on
// the left, Back/Continue or Run evaluation on the right, docked to the
// bottom of the page's own scroll area so it's reachable without
// scrolling past the step's content -- above the compare tray, which
// docks to the bottom of the whole app shell instead.
export function NewEvaluationSummaryBar({
  modelCount,
  benchmarkCount,
  runCount,
  gpuCount,
  showBack,
  onBack,
  primaryLabel,
  onPrimaryAction,
  primaryDisabled,
  primaryLoading,
  blockReason,
}: NewEvaluationSummaryBarProps) {
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-md">
      {modelCount === 0 || benchmarkCount === 0 ? (
        <p className="text-sm text-muted-foreground">Select at least one model and one benchmark to continue.</p>
      ) : (
        <p className="text-sm text-foreground">
          <span className="font-medium">{modelCount}</span> model{modelCount === 1 ? '' : 's'} ×{' '}
          <span className="font-medium">{benchmarkCount}</span> benchmark{benchmarkCount === 1 ? '' : 's'} ={' '}
          <span className="font-medium">{runCount}</span> run{runCount === 1 ? '' : 's'}
          {gpuCount > 0 && (
            <>
              {' '}
              · <span className="font-medium">{gpuCount}</span> GPU{gpuCount === 1 ? '' : 's'}
            </>
          )}
        </p>
      )}

      <div className="flex items-center gap-3">
        {blockReason && <span className="text-xs text-muted-foreground">{blockReason}</span>}
        {showBack && (
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        )}
        <Button onClick={onPrimaryAction} disabled={primaryDisabled} loading={primaryLoading}>
          {primaryLabel}
        </Button>
      </div>
    </div>
  )
}
