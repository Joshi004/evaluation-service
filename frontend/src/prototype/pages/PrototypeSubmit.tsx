import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { EvalRun, ProfileSource, RunProfileSources, ThinkHandling } from '../data/types'
import { benchmarks, getBenchmark } from '../data/benchmarks'
import { findCheckpoint } from '../data/checkpoints'
import { getRecipe } from '../data/recipes'
import { usePrototypeStore } from '../state/usePrototypeStore'
import { ProfileSourceSelector } from '../components/ProfileSourceSelector/ProfileSourceSelector'
import { HashChip } from '../components/HashChip/HashChip'
import { computeMockProfileHash, resolveProfile, type ProfileOverrides } from '../utils/resolveProfile'
import {
  buildSubmittedRun,
  computeIsStandard,
  estimateGpuHours,
  pairKey,
  parsePairKey,
  type SubmissionIntent,
} from './PrototypeSubmit.helper'

const THINK_HANDLING_OPTIONS: ThinkHandling[] = ['strip', 'raw', 'disallowed']

export function PrototypeSubmit() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { checkpoints, submitRuns } = usePrototypeStore()

  // Supports the Model History page's "Submit evals" deep link
  // (/vision/submit?checkpointId=...&benchmarkIds=a,b), which preselects
  // exactly the pairs a fresh merge only has an *estimate* for — replacing
  // that estimate with a measured number is the whole point of the link.
  // Read directly into useState's initializer (rather than an effect) so
  // it only ever runs once, from the params the page was opened with, and
  // can't later clobber a selection the presenter is still editing.
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(() => {
    const checkpointId = searchParams.get('checkpointId')
    const benchmarkIdsParam = searchParams.get('benchmarkIds')
    if (!checkpointId || !benchmarkIdsParam) return new Set()
    const benchmarkIds = benchmarkIdsParam.split(',').filter(Boolean)
    return new Set(benchmarkIds.map((benchmarkId) => pairKey(checkpointId, benchmarkId)))
  })
  const [isExploratoryIntent, setIsExploratoryIntent] = useState(false)
  const [sources, setSources] = useState<RunProfileSources>({
    sampling: 'benchmark_default',
    thinkHandling: 'benchmark_default',
    maxTokens: 'benchmark_default',
  })
  const [overrides, setOverrides] = useState<ProfileOverrides>({})

  function togglePair(checkpointId: string, benchmarkId: string) {
    setSelectedPairs((previous) => {
      const next = new Set(previous)
      const key = pairKey(checkpointId, benchmarkId)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function setSource(setting: keyof RunProfileSources, source: ProfileSource) {
    setSources((previous) => ({ ...previous, [setting]: source }))
  }

  const selectedList = useMemo(() => Array.from(selectedPairs).map(parsePairKey), [selectedPairs])
  const isStandard = computeIsStandard(sources, isExploratoryIntent)

  // A single representative pair to preview resolved values against —
  // different selected benchmarks can resolve to different recipe
  // defaults, so this previews the first selection and the per-row dry
  // run below carries the real, pair-specific values.
  const referencePair = selectedList[0] ?? null
  const referenceCheckpoint = referencePair ? findCheckpoint(checkpoints, referencePair.checkpointId) : null
  const referenceResolvedProfile =
    referencePair && referenceCheckpoint
      ? resolveProfile(getBenchmark(referencePair.benchmarkId), referenceCheckpoint, sources, overrides)
      : null

  const totalEstimatedGpuHours = selectedList.reduce((sum, { benchmarkId }) => sum + estimateGpuHours(getBenchmark(benchmarkId)), 0)

  function handleSubmit() {
    const batchId = Date.now().toString()
    const intent: SubmissionIntent = { sources, overrides, isExploratoryIntent, submittedBy: 'demo-user' }
    const newRuns = selectedList
      .map(({ checkpointId, benchmarkId }) => {
        const checkpoint = findCheckpoint(checkpoints, checkpointId)
        return checkpoint ? buildSubmittedRun(checkpoint, getBenchmark(benchmarkId), intent, batchId) : null
      })
      .filter((run): run is EvalRun => run !== null)
    submitRuns(newRuns)
    navigate('/vision/runs')
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Submit</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Pick checkpoints and benchmarks, choose where each Layer 2 setting comes from, and preview the run before
        anything happens.
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-100">1. Checkpoints × benchmarks</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Checkpoint</th>
                {benchmarks.map((benchmark) => (
                  <th key={benchmark.id} className="px-3 py-2 text-left text-xs font-medium text-slate-500">
                    {benchmark.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {checkpoints.map((checkpoint) => (
                <tr key={checkpoint.id} className="border-b border-slate-800/60">
                  <td className="px-4 py-2 font-medium text-slate-200">
                    {checkpoint.name}
                    <div className="text-xs text-slate-500">{checkpoint.team}</div>
                  </td>
                  {benchmarks.map((benchmark) => (
                    <td key={benchmark.id} className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="accent-sky-500"
                        checked={selectedPairs.has(pairKey(checkpoint.id, benchmark.id))}
                        onChange={() => togglePair(checkpoint.id, benchmark.id)}
                        aria-label={`${checkpoint.name} × ${benchmark.name}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-100">2. Intent</h2>
        <div className="mt-3 flex gap-1 rounded-md bg-slate-950 p-1 sm:w-96">
          <button
            type="button"
            onClick={() => setIsExploratoryIntent(false)}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${
              !isExploratoryIntent ? 'bg-sky-500/20 text-sky-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Standard run
          </button>
          <button
            type="button"
            onClick={() => setIsExploratoryIntent(true)}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${
              isExploratoryIntent ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Exploratory / smoke test
          </button>
        </div>
        <p className="mt-2 max-w-xl text-xs text-slate-500">
          {isExploratoryIntent
            ? "Won't be published to the leaderboard, even if every setting below is left on its default."
            : isStandard
              ? 'Every Layer 2 setting is on benchmark default, so this will be recorded as standard and published once it completes.'
              : "At least one setting below isn't on benchmark default, so this can't be marked standard — it will be recorded as exploratory regardless of this toggle."}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-100">3. Layer 2 — where each setting comes from</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ProfileSourceSelector
            label="Sampling"
            value={sources.sampling}
            onChange={(source) => setSource('sampling', source)}
            resolvedPreview={
              referenceResolvedProfile
                ? `temp ${referenceResolvedProfile.temperature}, top_p ${referenceResolvedProfile.topP}, top_k ${referenceResolvedProfile.topK}`
                : 'Select a checkpoint × benchmark pair to preview'
            }
          >
            <div className="grid grid-cols-3 gap-1">
              <input
                type="number"
                step="0.1"
                placeholder="temp"
                value={overrides.temperature ?? ''}
                onChange={(event) => setOverrides((prev) => ({ ...prev, temperature: Number(event.target.value) }))}
                className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-200"
              />
              <input
                type="number"
                step="0.05"
                placeholder="top_p"
                value={overrides.topP ?? ''}
                onChange={(event) => setOverrides((prev) => ({ ...prev, topP: Number(event.target.value) }))}
                className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-200"
              />
              <input
                type="number"
                step="1"
                placeholder="top_k"
                value={overrides.topK ?? ''}
                onChange={(event) => setOverrides((prev) => ({ ...prev, topK: Number(event.target.value) }))}
                className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-200"
              />
            </div>
          </ProfileSourceSelector>

          <ProfileSourceSelector
            label="Think handling"
            value={sources.thinkHandling}
            onChange={(source) => setSource('thinkHandling', source)}
            resolvedPreview={referenceResolvedProfile ? referenceResolvedProfile.thinkHandling : 'Select a checkpoint × benchmark pair to preview'}
          >
            <select
              value={overrides.thinkHandling ?? 'strip'}
              onChange={(event) => setOverrides((prev) => ({ ...prev, thinkHandling: event.target.value as ThinkHandling }))}
              className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-200"
            >
              {THINK_HANDLING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </ProfileSourceSelector>

          <ProfileSourceSelector
            label="Max tokens"
            value={sources.maxTokens}
            onChange={(source) => setSource('maxTokens', source)}
            resolvedPreview={referenceResolvedProfile ? String(referenceResolvedProfile.maxTokens) : 'Select a checkpoint × benchmark pair to preview'}
          >
            <input
              type="number"
              step="256"
              placeholder="max_tokens"
              value={overrides.maxTokens ?? ''}
              onChange={(event) => setOverrides((prev) => ({ ...prev, maxTokens: Number(event.target.value) }))}
              className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-200"
            />
          </ProfileSourceSelector>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-100">4. Dry run</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Job</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Staging</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Est. GPU-hours</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">profile_hash</th>
              </tr>
            </thead>
            <tbody>
              {selectedList.map(({ checkpointId, benchmarkId }) => {
                const checkpoint = findCheckpoint(checkpoints, checkpointId)
                const benchmark = getBenchmark(benchmarkId)
                if (!checkpoint) return null
                const resolvedProfile = resolveProfile(benchmark, checkpoint, sources, overrides)
                const profileHash = computeMockProfileHash(resolvedProfile, getRecipe(benchmarkId).recipeHash)
                return (
                  <tr key={pairKey(checkpointId, benchmarkId)} className="border-b border-slate-800/60">
                    <td className="px-4 py-2 text-slate-200">
                      {checkpoint.name} · {benchmark.name}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {checkpoint.staged ? 'Already staged' : `Will stage from ${checkpoint.storage.toUpperCase()}`}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{estimateGpuHours(benchmark).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <HashChip label="profile" hash={profileHash} />
                    </td>
                  </tr>
                )
              })}
              {selectedList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Select at least one checkpoint × benchmark pair above.
                  </td>
                </tr>
              )}
            </tbody>
            {selectedList.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-800 text-slate-300">
                  <td className="px-4 py-2 font-medium" colSpan={2}>
                    Total ({selectedList.length} job{selectedList.length === 1 ? '' : 's'})
                  </td>
                  <td className="px-3 py-2 font-medium">{totalEstimatedGpuHours.toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={selectedList.length === 0}
          className="mt-4 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Submit {selectedList.length > 0 ? `${selectedList.length} job${selectedList.length === 1 ? '' : 's'}` : ''}
        </button>
      </section>
    </div>
  )
}
