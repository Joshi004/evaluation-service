import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Card } from '../components/Card/Card'
import { CopyButton } from '../components/CopyButton/CopyButton'
import { FingerprintChip } from '../components/FingerprintChip/FingerprintChip'
import { KeyValueList } from '../components/KeyValueList/KeyValueList'
import { RelativeTime } from '../components/RelativeTime/RelativeTime'
import { Tooltip } from '../components/Tooltip/Tooltip'
import { formatDuration } from '../utils/formatDuration'
import { TERM_HINTS } from '../utils/labels'
import { paths } from '../utils/paths'
import { displayOrDash, samplingFieldRows, servingFieldRows, standardFieldRows } from '../utils/runConfigFieldRows'
import { useRunReport } from './RunReportPage.helper'
import { engineOptionEntries } from './ServingProfilesPage.helper'

interface ConfigCardProps {
  title: string
  // A resolved profile's own identity -- omitted for the two cards
  // (Model server, Execution) that summarise the run itself rather than
  // one specific hashed, reusable resource.
  fingerprint?: { hash: string; label: string | null }
  children: ReactNode
}

// Not exported -- every card on this tab shares the same
// title-plus-fingerprint header; kept local because nothing outside
// this file renders one on its own.
function ConfigCard({ title, fingerprint, children }: ConfigCardProps) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {fingerprint && <FingerprintChip hash={fingerprint.hash} label={fingerprint.label ?? undefined} />}
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  )
}

// The Configuration tab (docs/UI_REDESIGN_PLAN.md §8.7, item 5):
// resolved benchmark, sampling, serving, model server and execution
// details as grouped key-value lists -- everything the old run page's
// five stacked configuration blocks showed, moved off the default view
// and onto its own tab so results lead instead (§3 rule 2).
export function RunConfigTab() {
  const { run } = useRunReport()
  const now = new Date()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ConfigCard title="Benchmark protocol" fingerprint={{ hash: run.standard.hash, label: run.standard.label }}>
        <KeyValueList rows={standardFieldRows(run.standard)} />
      </ConfigCard>

      <ConfigCard title="Sampling" fingerprint={{ hash: run.sampling.hash, label: run.sampling.label }}>
        <KeyValueList rows={samplingFieldRows(run.sampling)} />
        {run.sampling.warnings.length > 0 && (
          <ul className="mt-3 space-y-1">
            {run.sampling.warnings.map((warning) => (
              <li key={warning.field} className="rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
                {warning.field}: {warning.message}
              </li>
            ))}
          </ul>
        )}
      </ConfigCard>

      <ConfigCard title="Serving" fingerprint={{ hash: run.serving.hash, label: run.serving.label }}>
        <KeyValueList rows={servingFieldRows(run.serving)} />
        {engineOptionEntries(run.serving).length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {engineOptionEntries(run.serving).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="font-mono text-muted-foreground">{key}</dt>
                <dd className="font-mono text-foreground">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </ConfigCard>

      <ConfigCard title="Model server">
        {run.endpoint === null ? (
          // Not only a cancel-before-endpoint gap (Phase 5's own known
          // one) -- a run also lands here 'failed' with no endpoint at
          // all if starting or reusing one itself threw before
          // attach_endpoint ever ran (worker.py's own try block), so
          // this stays status-agnostic rather than naming one cause.
          <p className="text-sm text-muted-foreground">No model server was assigned to this run.</p>
        ) : (
          <KeyValueList
            rows={[
              {
                label: 'URL',
                value: run.endpoint.url ? (
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    {run.endpoint.url}
                    <CopyButton value={run.endpoint.url} label="Copy model server URL" />
                  </span>
                ) : (
                  '\u2014'
                ),
              },
              { label: 'SLURM job', value: displayOrDash(run.endpoint.slurm_job_id) },
              { label: 'Partition', value: displayOrDash(run.endpoint.partition) },
              { label: 'Expires', value: <RelativeTime timestamp={run.endpoint.expires_at} /> },
            ]}
          />
        )}
      </ConfigCard>

      <ConfigCard title="Execution">
        <KeyValueList
          rows={[
            { label: 'Submitted by', value: run.submitted_by ?? '\u2014' },
            {
              label: 'Batch',
              value: (
                <Link to={paths.runs({ batch: run.run_group_id })} className="text-primary hover:underline">
                  {run.run_group_name}
                </Link>
              ),
            },
            { label: 'Requested partition', value: displayOrDash(run.partition) },
            { label: 'Created', value: <RelativeTime timestamp={run.created_at} /> },
            { label: 'Started', value: <RelativeTime timestamp={run.started_at} /> },
            { label: 'Finished', value: <RelativeTime timestamp={run.finished_at} /> },
            { label: 'Wall time', value: formatDuration(run.created_at, run.finished_at, now) },
            {
              label: 'Output directory',
              value: run.output_dir ? (
                <span className="inline-flex items-center gap-1 font-mono text-xs">
                  {run.output_dir}
                  <CopyButton value={run.output_dir} label="Copy output directory" />
                </span>
              ) : (
                '\u2014'
              ),
            },
            {
              label: 'Setup',
              value: (
                <Tooltip content={TERM_HINTS.setup}>
                  <span tabIndex={0}>
                    <FingerprintChip hash={run.comparison_hash} />
                  </span>
                </Tooltip>
              ),
            },
          ]}
        />
      </ConfigCard>
    </div>
  )
}
