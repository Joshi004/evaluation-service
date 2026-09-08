import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import type { ScatterPoint } from './QualitySpeedScatter.helper'

interface QualitySpeedScatterProps {
  points: ScatterPoint[]
  benchmarkName: string
}

interface ScatterTooltipProps {
  active?: boolean
  payload?: { payload: ScatterPoint }[]
}

function ScatterTooltip({ active, payload, benchmarkName }: ScatterTooltipProps & { benchmarkName: string }) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 shadow-lg">
      <p className="font-medium text-slate-100">{point.checkpointName}</p>
      <p>
        {benchmarkName}: {(point.score * 100).toFixed(1)}%
      </p>
      <p>{point.outputTokensPerSec} tok/sec</p>
      <p>{point.gpuHours.toFixed(2)} GPU-hours</p>
    </div>
  )
}

// Score against speed, bubble size = GPU-hours spent finding out — the
// angle Artificial Analysis can't take because they call other people's
// hosted APIs instead of hosting the models themselves (EVAL_SERVICE_PLAN.md
// Section 14).
export function QualitySpeedScatter({ points, benchmarkName }: QualitySpeedScatterProps) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">No standard runs with performance data for {benchmarkName} yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis
          type="number"
          dataKey="outputTokensPerSec"
          name="Output tokens/sec"
          stroke="#94a3b8"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          label={{ value: 'Output tokens/sec', position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="score"
          name={benchmarkName}
          stroke="#94a3b8"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
          label={{ value: benchmarkName, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
        />
        <ZAxis type="number" dataKey="gpuHours" range={[80, 500]} name="GPU-hours" />
        <Tooltip content={<ScatterTooltip benchmarkName={benchmarkName} />} />
        <Scatter data={points} fill="#38bdf8" fillOpacity={0.75} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
