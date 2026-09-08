import { confidenceIntervalHalfWidth } from '../../utils/confidenceInterval'

export type MetricUnit = '%' | 'edit-distance'

export function formatValue(value: number, unit: MetricUnit): string {
  return unit === '%' ? `${(value * 100).toFixed(1)}%` : value.toFixed(3)
}

export function formatHalfWidth(stderr: number, unit: MetricUnit): string {
  const halfWidth = confidenceIntervalHalfWidth(stderr)
  return unit === '%' ? (halfWidth * 100).toFixed(1) : halfWidth.toFixed(3)
}
