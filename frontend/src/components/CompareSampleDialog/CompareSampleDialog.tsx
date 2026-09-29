import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from 'react-router'
import type { DiagnosticsSampleDetail, RunDetail } from '../../api/client'
import { useSampleAcrossRuns } from '../../api/queries/runDiagnostics'
import { cn } from '../../utils/cn'
import { seriesBgClassName } from '../../utils/compareSeriesColor'
import { isNotFoundError } from '../../utils/isNotFoundError'
import { paths } from '../../utils/paths'
import { Badge } from '../Badge/Badge'
import { Dialog } from '../Dialog/Dialog'
import { ErrorState } from '../ErrorState/ErrorState'
import { IfevalRuleChecklist } from '../IfevalRuleChecklist/IfevalRuleChecklist'
import { ModelName } from '../ModelName/ModelName'
import { SampleDetail } from '../SampleDetail/SampleDetail'
import { outcomeBadge } from '../SampleList/SampleList.helper'
import { Skeleton } from '../Skeleton/Skeleton'
import { gridColumnsClassName, resolveSharedPrompt } from './CompareSampleDialog.helper'

interface CompareSampleDialogProps {
  // Baseline first.
  runs: RunDetail[]
  sampleKey: string
  onClose: () => void
}

// §8.8 item 7: the prompt once, then one column per run -- how a
// flipped sample (or any sample opened from a flip row) is read now,
// replacing the page-to-page navigation FlipList used before this
// phase. Driven entirely by the URL's own &sample=; Esc or the
// overlay maps straight to onClose, which removes that param.
export function CompareSampleDialog({ runs, sampleKey, onClose }: CompareSampleDialogProps) {
  const sampleQueries = useSampleAcrossRuns(runs.map((run) => run.id), sampleKey)
  const sharedPrompt = resolveSharedPrompt(sampleQueries)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="xl"
      title={`Sample ${sampleKey}`}
    >
      <div className="space-y-4">
        {sharedPrompt !== null && (
          <section>
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Prompt</h2>
            <p className="mt-1 rounded-lg border border-border bg-muted p-3 text-sm whitespace-pre-wrap text-foreground">
              {sharedPrompt}
            </p>
          </section>
        )}

        <div className={cn('grid grid-cols-1 gap-4', gridColumnsClassName(runs.length))}>
          {runs.map((run, index) => (
            <CompareSampleColumn key={run.id} run={run} index={index} sampleKey={sampleKey} query={sampleQueries[index]} />
          ))}
        </div>
      </div>
    </Dialog>
  )
}

interface CompareSampleColumnProps {
  run: RunDetail
  index: number
  sampleKey: string
  query: UseQueryResult<DiagnosticsSampleDetail>
}

// Not exported -- CompareSampleDialog renders one per run; nothing
// else needs a single column on its own.
function CompareSampleColumn({ run, index, sampleKey, query }: CompareSampleColumnProps) {
  const badge = query.data ? outcomeBadge(query.data.passed) : null

  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', seriesBgClassName(index))} aria-hidden="true" />
        <span className="font-medium text-foreground">#{run.id}</span>
        {index === 0 && <Badge tone="info">Baseline</Badge>}
        {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
      </div>
      <ModelName name={run.checkpoint_name} />

      {query.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {query.isError && isNotFoundError(query.error) && (
        <p className="text-sm text-muted-foreground">Not in this run.</p>
      )}

      {query.isError && !isNotFoundError(query.error) && (
        <ErrorState
          message="Could not load this sample"
          details={String(query.error)}
          onRetry={() => query.refetch()}
        />
      )}

      {query.data && (
        <>
          <SampleDetail sample={query.data} showPrompt={false} />
          <IfevalRuleChecklist rules={query.data.rules} />
        </>
      )}

      <Link to={paths.runSample(run.id, sampleKey)} className="text-xs font-medium text-primary hover:underline">
        Open in run #{run.id}
      </Link>
    </div>
  )
}
