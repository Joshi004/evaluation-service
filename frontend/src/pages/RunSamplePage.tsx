import { Link, useParams } from 'react-router'
import { useRunDiagnostics, useRunSample } from '../api/queries/runDiagnostics'
import { IfevalRuleChecklist } from '../components/IfevalRuleChecklist/IfevalRuleChecklist'
import { SampleDetail } from '../components/SampleDetail/SampleDetail'
import { isNotFoundError } from './RunSamplePage.helper'

// Layer 5 (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 7): one
// sample, fully explained. Two queries, matching RunDiagnosticsPage's
// own pattern -- /diagnostics for the header identity (benchmark,
// served model name), /samples/:key for the sample itself, including
// its full text and, for IFEval/IFBench, its rule checklist.
export function RunSamplePage() {
  const { runId, sampleKey } = useParams<{ runId: string; sampleKey: string }>()
  const id = Number(runId)

  const diagnostics = useRunDiagnostics(id)
  // A 404 here means this sample_key doesn't exist on this run -- the
  // hook already sets `retry: false`, so a genuine not-found state
  // shows immediately instead of after three delayed attempts.
  const sample = useRunSample(id, sampleKey)

  if (!Number.isFinite(id) || sampleKey === undefined) {
    return <p className="text-sm text-red-400">Invalid run or sample.</p>
  }

  return (
    <div>
      <Link to={`/runs/${id}/diagnostics`} className="text-sm text-blue-400 hover:underline">
        ← Back to diagnostics
      </Link>

      <h1 className="mt-2 text-2xl font-semibold">Sample {sampleKey}</h1>
      {diagnostics.data && (
        <p className="mt-1 text-sm text-slate-400">
          Run #{id} · {diagnostics.data.source.benchmark} ·{' '}
          {diagnostics.data.source.served_model_name}
        </p>
      )}

      {sample.isLoading && <p className="mt-4 text-sm text-slate-500">Loading sample…</p>}

      {sample.isError && isNotFoundError(sample.error) && (
        <p className="mt-4 text-sm text-slate-500">
          No sample found with key "{sampleKey}" on this run.
        </p>
      )}

      {sample.isError && !isNotFoundError(sample.error) && (
        <p className="mt-4 text-sm text-red-400">Could not load sample: {String(sample.error)}</p>
      )}

      {sample.data && (
        <>
          <SampleDetail sample={sample.data} />
          <IfevalRuleChecklist rules={sample.data.rules} />
        </>
      )}
    </div>
  )
}
