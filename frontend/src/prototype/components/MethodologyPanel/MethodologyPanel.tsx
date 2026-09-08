import type { Benchmark, Checkpoint, EvalRun, Recipe } from '../../data/types'
import { HashChip } from '../HashChip/HashChip'
import { StatusBadge } from '../StatusBadge/StatusBadge'
import { formatPercent, profileSourceLabel, profileSourceTone } from './MethodologyPanel.helper'

interface MethodologyPanelProps {
  run: EvalRun
  benchmark: Benchmark
  recipe: Recipe
  checkpoint: Checkpoint
  onClose: () => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  )
}

// What a leaderboard cell is actually claiming: the Layer 1 protocol that
// produced it and the Layer 2 profile that was resolved for this specific
// run — the two hashes from EVAL_SERVICE_PLAN.md Section 5, made visible
// rather than trusted blindly.
export function MethodologyPanel({ run, benchmark, recipe, checkpoint, onClose }: MethodologyPanelProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-12"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{benchmark.name} methodology</h2>
            <p className="text-sm text-slate-400">{checkpoint.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close">
            ✕
          </button>
        </div>

        {run.flaggedReason && (
          <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {run.flaggedReason}
          </div>
        )}

        <section className="mt-4">
          <h3 className="text-sm font-medium text-slate-300">Layer 1 — protocol (recipe {recipe.version})</h3>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <DetailRow label="Dataset revision" value={recipe.datasetRevision} />
            <DetailRow label="Few-shot" value={String(recipe.fewShot)} />
            <DetailRow label="Repeats" value={String(recipe.repeats)} />
            <DetailRow label="Extraction" value={recipe.extraction} />
          </dl>
          <p className="mt-2 text-xs text-slate-500">{recipe.sourceNote}</p>
          <div className="mt-2">
            <HashChip label="recipe_hash" hash={recipe.recipeHash} />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-medium text-slate-300">Layer 2 — this run's profile</h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-1 font-medium">Setting</th>
                <th className="pb-1 font-medium">Source</th>
                <th className="pb-1 font-medium">Resolved value</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr>
                <td className="py-1 pr-2">Sampling</td>
                <td className="py-1 pr-2">
                  <StatusBadge
                    label={profileSourceLabel(run.profileSources.sampling)}
                    tone={profileSourceTone(run.profileSources.sampling)}
                  />
                </td>
                <td className="py-1">
                  temp {run.resolvedProfile.temperature}, top_p {run.resolvedProfile.topP}, top_k {run.resolvedProfile.topK}
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-2">Think handling</td>
                <td className="py-1 pr-2">
                  <StatusBadge
                    label={profileSourceLabel(run.profileSources.thinkHandling)}
                    tone={profileSourceTone(run.profileSources.thinkHandling)}
                  />
                </td>
                <td className="py-1 capitalize">{run.resolvedProfile.thinkHandling}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2">Max tokens</td>
                <td className="py-1 pr-2">
                  <StatusBadge
                    label={profileSourceLabel(run.profileSources.maxTokens)}
                    tone={profileSourceTone(run.profileSources.maxTokens)}
                  />
                </td>
                <td className="py-1">{run.resolvedProfile.maxTokens}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <HashChip label="profile_hash" hash={run.profileHash} />
            {run.isStandard ? (
              <StatusBadge label="Standard" tone="positive" />
            ) : (
              <StatusBadge label="Exploratory — not published" tone="warning" />
            )}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <DetailRow label="Truncation rate" value={formatPercent(run.truncationRate)} />
          <DetailRow label="Error rate" value={formatPercent(run.errorRate)} />
        </section>
      </div>
    </div>
  )
}
