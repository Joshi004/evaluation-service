import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import type { RadarPoint } from './BenchmarkRadar.helper'

interface BenchmarkRadarProps {
  points: RadarPoint[]
}

export function BenchmarkRadar({ points }: BenchmarkRadarProps) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">No published standard runs yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={points}>
        <PolarGrid stroke="#1e293b" />
        <PolarAngleAxis dataKey="family" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="displayScore" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
