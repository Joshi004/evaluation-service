import { useState } from 'react'
import type { ReactNode } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { MemoryRouter } from 'react-router'
import { Button } from '../components/Button/Button'
import { IconButton } from '../components/IconButton/IconButton'
import { CopyButton } from '../components/CopyButton/CopyButton'
import { Badge } from '../components/Badge/Badge'
import { Card } from '../components/Card/Card'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { Tabs } from '../components/Tabs/Tabs'
import { TabNav } from '../components/TabNav/TabNav'
import { Dialog } from '../components/Dialog/Dialog'
import { ConfirmDialog } from '../components/ConfirmDialog/ConfirmDialog'
import { Tooltip } from '../components/Tooltip/Tooltip'
import { Popover } from '../components/Popover/Popover'
import { Menu } from '../components/Menu/Menu'
import { HoverCard } from '../components/HoverCard/HoverCard'
import { MultiSelectMenu } from '../components/MultiSelectMenu/MultiSelectMenu'
import { IntervalWhisker } from '../components/IntervalWhisker/IntervalWhisker'
import { CopyLinkButton } from '../components/CopyLinkButton/CopyLinkButton'
import { TextInput } from '../components/TextInput/TextInput'
import { SearchInput } from '../components/SearchInput/SearchInput'
import { SelectField } from '../components/SelectField/SelectField'
import { Checkbox } from '../components/Checkbox/Checkbox'
import { SegmentedControl } from '../components/SegmentedControl/SegmentedControl'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { Spinner } from '../components/Spinner/Spinner'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { KeyValueList } from '../components/KeyValueList/KeyValueList'
import { Table, TableCell, TableHeaderCell } from '../components/Table/Table'
import { AvailabilityBadge } from '../components/AvailabilityBadge/AvailabilityBadge'
import { ModelName } from '../components/ModelName/ModelName'
import { BenchmarkName } from '../components/BenchmarkName/BenchmarkName'
import { SetupChip } from '../components/SetupChip/SetupChip'
import { ScoreValue } from '../components/ScoreValue/ScoreValue'
import { FingerprintChip } from '../components/FingerprintChip/FingerprintChip'
import { RelativeTime } from '../components/RelativeTime/RelativeTime'
import { RunStatusChip } from '../components/RunStatusChip/RunStatusChip'
import { BatchProgressBar } from '../components/BatchProgressBar/BatchProgressBar'
import { RunFailureReason } from '../components/RunFailureReason/RunFailureReason'
import { RunsLiveIndicator } from '../components/RunsLiveIndicator/RunsLiveIndicator'
import { classifyRunError } from '../utils/classifyRunError'
import { shortenModelName } from '../utils/shortenModelName'
import { familyKey } from '../utils/familyKey'
import { formatScore, formatMargin } from '../utils/formatScore'
import { intervalsOverlap } from '../utils/intervalsOverlap'
import type { ConfidenceInterval, RunListItem } from '../api/client'

// Written out literally (not built from a template string) so
// Tailwind's build-time scanner, which only recognises complete class
// names appearing as literal text in source, actually generates these
// utilities -- `bg-${name}` would never match anything.
const SERIES_SWATCH_CLASSES = [
  'bg-series-1',
  'bg-series-2',
  'bg-series-3',
  'bg-series-4',
  'bg-series-5',
  'bg-series-6',
  'bg-series-7',
  'bg-series-8',
]

const HEAT_SWATCH_CLASSES = ['bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4', 'bg-heat-5']

// Real values from the running stack's data (docs/UI_REDESIGN_PLAN.md
// §2.4) -- the same runs the redesign plan's own acceptance criteria
// reference, so this page's Helpers section doubles as a live check of
// Phase 4's formatting and classification examples.
const RUN_13_INTERVAL: ConfidenceInterval = { lower: 0.8217496511368982, upper: 0.8812585245424298 }
const RUN_15_INTERVAL: ConfidenceInterval = { lower: 0.8177707308088564, upper: 0.8778896193054617 }
const RUN_9_INTERVAL: ConfidenceInterval = { lower: 0.5888376499705013, upper: 0.6699249638459293 }
const RUN_13_SCORE = 0.854
const MODEL_NAME_EXAMPLE = 'Qwen3.5-0.8B-Think-MOPD-mixv2-RL-v11c-s810'
// Computed once at module load, not inline in JSX -- calling Date.now()
// during render is flagged as an impure call (its result would drift
// on every re-render for no reason this static example needs).
const RECENT_TIMESTAMP_EXAMPLE = new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString()
const NOW_EXAMPLE_MS = Date.now()
const RUN_8_ERROR =
  "FileNotFoundError: [Errno 2] No such file or directory: '/data/evalsvc/runs/run-8/reports/Qwen3.5-0.8B-Think-MOPD-mixv2-RL-v11c-s810/ifeval.json'"

// Run 8's own real shape (docs/UI_REDESIGN_PLAN.md §2.4) -- RunFailureReason
// only reads `id` and `error`, but its prop is the full RunListItem, so
// this fills the rest in with that run's other real values.
const RUN_8_EXAMPLE: RunListItem = {
  id: 8,
  run_group_id: 3,
  run_group_name: 'if-eval-01',
  checkpoint_id: 2,
  checkpoint_name: MODEL_NAME_EXAMPLE,
  standard_id: 1,
  standard_label: 'ifeval/v1',
  standard_hash: 'ifeval-v1-hash',
  benchmark: 'ifeval',
  endpoint_id: 4,
  status: 'failed',
  truncation_rate: null,
  error: RUN_8_ERROR,
  submitted_by: 'Naresh Joshi',
  created_at: '2026-09-15T06:02:15.648911Z',
  started_at: '2026-09-15T06:02:15.648911Z',
  finished_at: '2026-09-15T06:26:05.261506Z',
  comparison_hash: 'ifeval-qwen3-5-think-hash',
  sampling_profile_label: 'qwen3_5_think',
  sampling_profile_hash: '5aed9f401a82b31a',
  primary_metric_name: null,
  primary_metric_value: null,
  primary_metric_n_samples: null,
  primary_metric_confidence_interval: null,
}
// classifyRunError falls back to a generic title for a message it
// doesn't recognise -- this run otherwise mirrors RUN_8_EXAMPLE.
const UNRECOGNISED_ERROR_RUN_EXAMPLE: RunListItem = {
  ...RUN_8_EXAMPLE,
  id: 99,
  error: 'OutOfMemoryError: CUDA out of memory',
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  )
}

// Dev-only design-system reference (registered in routes.tsx only when
// import.meta.env.DEV). Shows every Phase 1 primitive so a change to a
// token or a primitive's class list is visible in one place, in either
// theme, without hunting through real pages for an example of each.
// Longer than the usual ~200-line component guideline on purpose: an
// exhaustive catalogue is this page's entire job.
export function StyleguidePage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lgDialogOpen, setLgDialogOpen] = useState(false)
  const [xlDialogOpen, setXlDialogOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [tab, setTab] = useState('one')
  const [checked, setChecked] = useState(true)
  const [segment, setSegment] = useState('comfortable')
  const [search, setSearch] = useState('leaderboard')
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(['ifeval'])

  return (
    <div
      data-theme={theme === 'light' ? 'light' : undefined}
      className="min-h-screen bg-background p-8 text-foreground"
    >
      <div className="mx-auto max-w-5xl space-y-10">
        <PageHeader
          title="Styleguide"
          description="Every Phase 1 primitive, for a visual check against the tokens in index.css."
          actions={
            <Button variant="secondary" onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}>
              Switch to {theme === 'dark' ? 'light' : 'dark'} theme
            </Button>
          }
        />

        <Section title="Button">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
        </Section>

        <Section title="IconButton & CopyButton">
          <IconButton aria-label="Search">
            <Search className="h-4 w-4" />
          </IconButton>
          <IconButton aria-label="Delete" variant="danger">
            <Trash2 className="h-4 w-4" />
          </IconButton>
          <IconButton aria-label="Disabled search" disabled>
            <Search className="h-4 w-4" />
          </IconButton>
          <CopyButton value="ifeval/qwen3_5_think" />
        </Section>

        <Section title="Badge & AvailabilityBadge">
          <Badge>Neutral</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <AvailabilityBadge status="incomplete" />
        </Section>

        <Section title="Card & PageHeader">
          <Card className="w-64">A Card is the one panel primitive every boxed section sits inside.</Card>
        </Section>

        <Section title="Tabs">
          <Tabs
            value={tab}
            onValueChange={setTab}
            items={[
              { value: 'one', label: 'One', content: <p className="text-sm text-muted-foreground">Panel one.</p> },
              { value: 'two', label: 'Two', content: <p className="text-sm text-muted-foreground">Panel two.</p> },
            ]}
          />
        </Section>

        {/* Phase 7 (docs/UI_REDESIGN_PLAN.md §8.7): a NavLink-based tab
            strip for path-based tabs (the run report's own tabs;
            Phases 11-12's Model and Benchmark detail pages reuse it) --
            wrapped in its own MemoryRouter so clicking through the demo
            never navigates the real page away from /styleguide. */}
        <Section title="TabNav">
          <MemoryRouter initialEntries={['/overview']}>
            <TabNav
              items={[
                { to: '/overview', label: 'Overview', end: true },
                { to: '/samples', label: 'Samples', badge: 79 },
                { to: '/config', label: 'Configuration' },
              ]}
            />
          </MemoryRouter>
        </Section>

        <Section title="Dialog, ConfirmDialog, Tooltip, Popover, Menu">
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Dialog title"
            description="A generic modal; ConfirmDialog composes this for destructive actions."
          >
            <p className="text-sm text-foreground">Dialog body content goes here.</p>
          </Dialog>

          {/* Phase 8 (docs/UI_REDESIGN_PLAN.md §8.8): `size="lg"` is
              Compare's own Add run picker; `size="xl"` is its
              side-by-side sample view, wide enough for 2-4 answer
              columns. `size` defaults to 'md' (the dialog above). */}
          <Button variant="secondary" onClick={() => setLgDialogOpen(true)}>
            Open lg dialog
          </Button>
          <Dialog open={lgDialogOpen} onOpenChange={setLgDialogOpen} title="size=&quot;lg&quot;" size="lg">
            <p className="text-sm text-foreground">Compare's own Add run picker uses this size.</p>
          </Dialog>

          <Button variant="secondary" onClick={() => setXlDialogOpen(true)}>
            Open xl dialog
          </Button>
          <Dialog open={xlDialogOpen} onOpenChange={setXlDialogOpen} title="size=&quot;xl&quot;" size="xl">
            <p className="text-sm text-foreground">Compare's own side-by-side sample view uses this size.</p>
          </Dialog>

          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Open confirm dialog
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Cancel run #14?"
            description="The SLURM job is stopped. This cannot be undone."
            destructive
            onConfirm={() => setConfirmOpen(false)}
          />

          <Tooltip content="Full name in a tooltip">
            <Button variant="secondary">Hover me</Button>
          </Tooltip>

          <Popover trigger={<Button variant="secondary">Open popover</Button>}>
            <p className="text-sm text-foreground">Popover content.</p>
          </Popover>

          <Menu
            trigger={<Button variant="secondary">Open menu</Button>}
            items={[
              { label: 'Rename', onSelect: () => {} },
              { label: 'Delete', onSelect: () => {}, destructive: true },
              { label: 'Disabled action', onSelect: () => {}, disabled: true },
            ]}
          />
        </Section>

        {/* Phase 6 (docs/UI_REDESIGN_PLAN.md §8.6): the Leaderboard's own
            four new primitives, checked here first per the phase's own
            plan -- HoverCard's focus/hover handling in particular is
            "the riskiest piece" and easiest to verify in isolation. */}
        <Section title="HoverCard, MultiSelectMenu, IntervalWhisker, CopyLinkButton">
          <HoverCard trigger={<Button variant="secondary">Hover or focus me</Button>}>
            <p className="text-sm text-foreground">85.4% · 462 of 541 passed</p>
            <p className="mt-1 text-xs text-muted-foreground">Tab moves into the actions below; Esc closes.</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm">Open run</Button>
              <Button size="sm" variant="secondary">
                Add to compare
              </Button>
            </div>
          </HoverCard>

          <MultiSelectMenu
            trigger={<Button variant="secondary">Benchmarks ({selectedBenchmarks.length})</Button>}
            groups={[
              {
                heading: 'Instruction following',
                options: [
                  { value: 'ifeval', label: 'IFEval' },
                  { value: 'ifbench', label: 'IFBench' },
                ],
              },
              { heading: 'Math', options: [{ value: 'gsm8k', label: 'GSM8K' }] },
            ]}
            selected={selectedBenchmarks}
            onChange={setSelectedBenchmarks}
          />

          <IntervalWhisker
            lower={0.822}
            upper={0.881}
            value={0.854}
            domainMin={0.75}
            domainMax={0.95}
            className="text-foreground"
          />

          {/* Phase 8's own forest plot draws these at 240px, wide
              enough for 2-4 overlapping intervals to stay legible on
              one shared axis (default is 96px, above). */}
          <IntervalWhisker
            lower={0.822}
            upper={0.881}
            value={0.854}
            domainMin={0.55}
            domainMax={0.95}
            width={240}
            className="text-series-1"
          />

          <CopyLinkButton url="https://example.com/?bench=ifeval" />
        </Section>

        <Section title="TextInput, SearchInput, SelectField, Checkbox, SegmentedControl">
          <TextInput placeholder="Text input" className="w-48" />
          <TextInput placeholder="Invalid" invalid className="w-48" />
          <TextInput placeholder="Disabled" disabled className="w-48" />
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch('')}
            className="w-56"
            placeholder="Search"
          />
          <SelectField className="w-40" defaultValue="ifeval">
            <option value="ifeval">IFEval</option>
            <option value="gsm8k">GSM8K</option>
          </SelectField>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            Checkbox
          </label>
          <SegmentedControl
            value={segment}
            onValueChange={setSegment}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </Section>

        <Section title="Skeleton & Spinner">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-24" />
          <Spinner />
        </Section>

        <Section title="EmptyState & ErrorState">
          <EmptyState message="No runs match these filters yet." />
          <ErrorState
            message="Couldn't load this run."
            details="FileNotFoundError: [Errno 2] No such file or directory: '.../ifeval.json'"
            onRetry={() => {}}
          />
        </Section>

        <Section title="KeyValueList">
          <KeyValueList
            className="w-72"
            rows={[
              { label: 'Status', value: <RunStatusChip status="done" /> },
              { label: 'Submitted by', value: 'a.researcher' },
            ]}
          />
        </Section>

        <Section title="Table">
          <Table>
            <thead>
              <tr>
                <TableHeaderCell>Benchmark</TableHeaderCell>
                <TableHeaderCell className="text-right">Score</TableHeaderCell>
              </tr>
            </thead>
            <tbody>
              <tr>
                <TableCell>IFEval</TableCell>
                <TableCell className="text-right tabular-nums">85.4%</TableCell>
              </tr>
            </tbody>
          </Table>
        </Section>

        {/* Phase 4 (docs/UI_REDESIGN_PLAN.md §8.4, item 6/7): the seven
            domain display components every later phase composes from,
            each shown against real data from the running stack. */}
        <Section title="Domain components">
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <ModelName name={MODEL_NAME_EXAMPLE} family="Qwen3.5" copyable />
              <ModelName name="merged_global_step_810" />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <BenchmarkName benchmark="ifeval" standardLabel="ifeval/v1" />
              <BenchmarkName benchmark="gpqa_diamond" standardLabel="gpqa_diamond/v1" />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <SetupChip samplingProfileLabel="qwen3_5_think" samplingProfileHash="5aed9f401a82b31a" />
              <SetupChip samplingProfileLabel={null} samplingProfileHash="77f35859ab387706" />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <ScoreValue value={RUN_13_SCORE} interval={RUN_13_INTERVAL} samples={541} />
              <ScoreValue value={null} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <FingerprintChip hash="5aed9f401a82b31a" label="qwen3_5_think" />
              <FingerprintChip hash="77f35859ab387706" />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <RelativeTime timestamp={RECENT_TIMESTAMP_EXAMPLE} />
              <RelativeTime timestamp="2026-09-11T07:13:37.051248Z" />
              <RelativeTime timestamp={null} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <RunStatusChip status="queued" />
              <RunStatusChip status="running" />
              <RunStatusChip status="done" />
              <RunStatusChip status="failed" />
              <RunStatusChip status="cancelled" />
            </div>
          </div>
        </Section>

        {/* Phase 9 (docs/UI_REDESIGN_PLAN.md §8.9): today's data has no
            active run and no batch with a mixed-status spread, so these
            three states can only be seen here, not on the real page. */}
        <Section title="Runs activity">
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <RunsLiveIndicator pollIntervalMs={5_000} isRefetchError={false} lastCheckedAt={NOW_EXAMPLE_MS} />
              <RunsLiveIndicator pollIntervalMs={30_000} isRefetchError={false} lastCheckedAt={NOW_EXAMPLE_MS} />
              <RunsLiveIndicator pollIntervalMs={30_000} isRefetchError lastCheckedAt={NOW_EXAMPLE_MS - 45_000} />
            </div>
            <BatchProgressBar
              runs={[{ status: 'done' }, { status: 'done' }, { status: 'failed' }, { status: 'running' }]}
              className="max-w-xs"
            />
            {/* RunFailureReason's own "Open logs" link would otherwise
                navigate the real page away from /styleguide -- the same
                reason TabNav above gets its own MemoryRouter. */}
            <MemoryRouter initialEntries={['/runs/8']}>
              <div className="flex flex-wrap items-start gap-6">
                <RunFailureReason run={RUN_8_EXAMPLE} />
                <RunFailureReason run={UNRECOGNISED_ERROR_RUN_EXAMPLE} />
              </div>
            </MemoryRouter>
          </div>
        </Section>

        {/* Live output of the Phase 4 helper functions against the
            plan's own acceptance examples (§8.4) -- a change to one of
            these that breaks an example is visible here, not just in a
            page that happens to call it. */}
        <Section title="Helpers">
          <KeyValueList
            className="w-full max-w-2xl"
            rows={[
              { label: "classifyRunError(run 8's error)", value: classifyRunError(RUN_8_ERROR)?.title ?? '(none)' },
              {
                label: 'classifyRunError(unrecognised message)',
                value: classifyRunError('OutOfMemoryError: CUDA out of memory')?.title ?? '(none)',
              },
              {
                label: 'classifyRunError(null)',
                value: classifyRunError(null) === null ? '(null -- no error object)' : 'unexpected',
              },
              { label: `shortenModelName("${MODEL_NAME_EXAMPLE}")`, value: shortenModelName(MODEL_NAME_EXAMPLE) },
              {
                label: 'familyKey("QWen3.5") === familyKey("Qwen-3.5")',
                value: familyKey('QWen3.5') === familyKey('Qwen-3.5') ? 'true' : 'false',
              },
              { label: 'formatScore(run 13, 0.854)', value: formatScore(RUN_13_SCORE) },
              { label: 'formatMargin(run 13 interval)', value: formatMargin(RUN_13_INTERVAL) ?? '(none)' },
              {
                label: 'intervalsOverlap(run 13, run 15)',
                value: intervalsOverlap(RUN_13_INTERVAL, RUN_15_INTERVAL) ? 'true' : 'false',
              },
              {
                label: 'intervalsOverlap(run 9, run 15)',
                value: intervalsOverlap(RUN_9_INTERVAL, RUN_15_INTERVAL) ? 'true' : 'false',
              },
            ]}
          />
        </Section>

        <Section title="Data-viz tokens">
          {SERIES_SWATCH_CLASSES.map((swatchClassName) => (
            <div key={swatchClassName} className="flex flex-col items-center gap-1">
              <div className={`h-8 w-8 rounded-full ${swatchClassName}`} />
              <span className="text-xs text-muted-foreground">{swatchClassName.replace('bg-', '')}</span>
            </div>
          ))}
          {HEAT_SWATCH_CLASSES.map((swatchClassName) => (
            <div key={swatchClassName} className="flex flex-col items-center gap-1">
              <div className={`h-8 w-8 rounded-full ${swatchClassName}`} />
              <span className="text-xs text-muted-foreground">{swatchClassName.replace('bg-', '')}</span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}
