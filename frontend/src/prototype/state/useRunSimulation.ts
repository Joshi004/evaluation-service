import { useEffect, useRef, type Dispatch } from 'react'
import type { Benchmark, Checkpoint, EvalRun, RunPhase } from '../data/types'
import { findCheckpoint } from '../data/checkpoints'
import { getBenchmark } from '../data/benchmarks'
import { generatePlausibleScore } from '../utils/generateScore'
import { standardErrorForProportion } from '../utils/confidenceInterval'
import type { PrototypeAction } from './prototypeStoreContext'

const TICK_MS = 1000

// Compressed phase durations, in seconds. A real cold start is ~350s and a
// full IFEval run is ~206s (EVAL_SERVICE_PLAN.md Section 11) — this keeps
// the same shape of pipeline (queued -> staging? -> waiting_endpoint ->
// inference -> scoring -> completed) but small enough to watch happen
// live during a demo.
const PHASE_DURATION_SECONDS: Record<RunPhase, number> = {
  queued: 2,
  staging: 4,
  waiting_endpoint: 5,
  inference: 6,
  scoring: 3,
  completed: 0,
  failed: 0,
}

function phaseSequence(alreadyStaged: boolean): RunPhase[] {
  return alreadyStaged
    ? ['queued', 'waiting_endpoint', 'inference', 'scoring', 'completed']
    : ['queued', 'staging', 'waiting_endpoint', 'inference', 'scoring', 'completed']
}

// A short, deterministic, 6-digit-looking SLURM job id for a run that
// doesn't have one yet (only the hand-authored history in data/runs.ts
// does). Doesn't need to be unique across all time, only stable per run
// and distinct enough to look real in the log stream.
function mockSlurmJobId(runId: string): string {
  let hash = 0
  for (let i = 0; i < runId.length; i++) {
    hash = (hash * 31 + runId.charCodeAt(i)) >>> 0
  }
  return String(271000 + (hash % 8999))
}

function buildLogLines(phase: RunPhase, run: EvalRun, checkpoint: Checkpoint, benchmark: Benchmark, jobId: string): string[] {
  switch (phase) {
    case 'queued':
      return [`[${run.id}] queued — waiting for the reconciler's next tick`]

    case 'staging':
      return [
        `[${run.id}] no verified artifact_location for ${checkpoint.name} on this cluster`,
        `[${run.id}] sbatch --partition=main --time=02:00:00 stage_weights.sh (job ${jobId})`,
        `[${run.id}] aws s3 sync s3://tether-ai-dev/checkpoints/${checkpoint.id}/ /home/shared/eval-service/models/${checkpoint.id}/`,
      ]

    case 'waiting_endpoint': {
      const lines: string[] = []
      if (checkpoint.staged) {
        lines.push(`[${run.id}] artifact_location ready — skipping the sync, going straight to serving`)
      } else {
        lines.push(`[${run.id}] sync verified — object count and bytes match the registered inventory`)
      }
      lines.push(
        `[${run.id}] sbatch --partition=main --gpus=1 --time=00:30:00 serve_vllm.sh (job ${jobId})`,
        `[${run.id}] launching vLLM with --generation-config vllm — checkpoint defaults are read explicitly, never applied implicitly`,
        `[${run.id}] waiting for GET /v1/models to report ${checkpoint.name}...`,
        `[${run.id}] endpoint ready`,
      )
      return lines
    }

    case 'inference':
      return [
        `[${run.id}] ${benchmark.name}: 0/${benchmark.questionCount} prompts scored`,
        `[${run.id}] ${benchmark.name}: ${Math.round(benchmark.questionCount * 0.62)}/${benchmark.questionCount} prompts scored`,
      ]

    case 'scoring': {
      const secondaryCount = benchmark.metrics.length - 1
      return [
        secondaryCount > 0
          ? `[${run.id}] computing ${benchmark.primaryMetricKey} and ${secondaryCount} other metric(s)...`
          : `[${run.id}] computing ${benchmark.primaryMetricKey}...`,
      ]
    }

    case 'completed':
      return [
        run.isStandard
          ? `[${run.id}] run complete — published to the leaderboard under profile_hash ${run.profileHash}`
          : `[${run.id}] run complete — exploratory, not published`,
      ]

    case 'failed':
      return [`[${run.id}] run failed`]

    default:
      return []
  }
}

function buildCompletionPatch(run: EvalRun, benchmark: Benchmark): Partial<EvalRun> {
  const metrics =
    run.metrics.length > 0
      ? run.metrics
      : (() => {
          const value = generatePlausibleScore(run.checkpointId, benchmark)
          return [{ metricKey: benchmark.primaryMetricKey, value, stderr: standardErrorForProportion(value, benchmark.questionCount) }]
        })()

  return {
    finishedAt: new Date().toISOString(),
    gpuSeconds: run.gpuSeconds ?? Math.round(benchmark.typicalGpuHours * 3600),
    truncationRate: run.truncationRate ?? 0.02,
    errorRate: run.errorRate ?? 0,
    outputTokensPerSec: run.outputTokensPerSec ?? 900,
    timeToFirstTokenMs: run.timeToFirstTokenMs ?? 420,
    metrics,
    published: run.isStandard,
  }
}

// Carries every non-terminal run forward through its phases on a timer,
// deterministically from elapsed time since `queuedAt` rather than a tick
// counter — so a backgrounded tab that misses several ticks catches up to
// the correct phase in one jump instead of drifting. Lives at the store
// provider level (see PrototypeStore.tsx) so runs keep advancing no matter
// which page is on screen.
//
// `checkpoints` comes from the store, not the static fixture, because a
// merged checkpoint (built at runtime on the Model History page) has to
// resolve here too the moment its first run is submitted.
export function useRunSimulation(runs: EvalRun[], checkpoints: Checkpoint[], dispatch: Dispatch<PrototypeAction>): void {
  const runsRef = useRef(runs)
  useEffect(() => {
    runsRef.current = runs
  }, [runs])

  const checkpointsRef = useRef(checkpoints)
  useEffect(() => {
    checkpointsRef.current = checkpoints
  }, [checkpoints])

  // How many phase-steps have already been applied (and logged) per run,
  // so a tick that finds "no change" doesn't re-append the same lines.
  const appliedStepIndexByRunId = useRef(new Map<string, number>())
  const jobIdByRunId = useRef(new Map<string, string>())

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()

      for (const run of runsRef.current) {
        if (run.phase === 'completed' || run.phase === 'failed') continue

        // Skip rather than throw on an unresolved checkpoint — this runs
        // inside setInterval, where no error boundary would catch a throw,
        // and it would silently stop every other run's simulation too.
        // Shouldn't happen in steady state, only possible for one tick if
        // a run were ever dispatched before its checkpoint's own store
        // update landed.
        const checkpoint = findCheckpoint(checkpointsRef.current, run.checkpointId)
        if (!checkpoint) continue
        const benchmark = getBenchmark(run.benchmarkId)
        const sequence = phaseSequence(checkpoint.staged)

        const elapsedSeconds = (now - new Date(run.queuedAt).getTime()) / 1000

        let targetIndex = 0
        let cumulativeSeconds = 0
        for (let i = 0; i < sequence.length; i++) {
          cumulativeSeconds += PHASE_DURATION_SECONDS[sequence[i]]
          targetIndex = i
          if (elapsedSeconds < cumulativeSeconds) break
        }

        const appliedIndex = appliedStepIndexByRunId.current.get(run.id) ?? -1
        if (targetIndex <= appliedIndex) continue

        const jobId = jobIdByRunId.current.get(run.id) ?? run.slurmJobId ?? mockSlurmJobId(run.id)
        jobIdByRunId.current.set(run.id, jobId)

        // Apply every step between what's already been applied and the
        // target, in order — if a tick is late, this replays the whole
        // sequence at once rather than skipping straight to the end.
        for (let i = appliedIndex + 1; i <= targetIndex; i++) {
          const phase = sequence[i]
          for (const line of buildLogLines(phase, run, checkpoint, benchmark, jobId)) {
            dispatch({ type: 'append_log', runId: run.id, line })
          }

          const patch: Partial<EvalRun> = { phase, slurmJobId: jobId }
          if (phase === 'staging' || phase === 'waiting_endpoint') {
            patch.startedAt = run.startedAt ?? new Date().toISOString()
          }
          if (phase === 'completed') {
            Object.assign(patch, buildCompletionPatch(run, benchmark))
          }
          dispatch({ type: 'patch_run', runId: run.id, patch })
        }

        appliedStepIndexByRunId.current.set(run.id, targetIndex)
      }
    }, TICK_MS)

    return () => clearInterval(interval)
    // `dispatch` from useReducer is referentially stable, so this sets the
    // interval up once and lets runsRef (updated every render above)
    // supply fresh data instead of resetting the timer on every change.
  }, [dispatch])
}
