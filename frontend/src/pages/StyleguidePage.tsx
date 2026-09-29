import { useState } from 'react'
import type { ReactNode } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { Button } from '../components/Button/Button'
import { IconButton } from '../components/IconButton/IconButton'
import { CopyButton } from '../components/CopyButton/CopyButton'
import { Badge } from '../components/Badge/Badge'
import { Card } from '../components/Card/Card'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { Tabs } from '../components/Tabs/Tabs'
import { Dialog } from '../components/Dialog/Dialog'
import { ConfirmDialog } from '../components/ConfirmDialog/ConfirmDialog'
import { Tooltip } from '../components/Tooltip/Tooltip'
import { Popover } from '../components/Popover/Popover'
import { Menu } from '../components/Menu/Menu'
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
import { StatusBadge } from '../components/StatusBadge/StatusBadge'
import { AvailabilityBadge } from '../components/AvailabilityBadge/AvailabilityBadge'

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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [tab, setTab] = useState('one')
  const [checked, setChecked] = useState(true)
  const [segment, setSegment] = useState('comfortable')
  const [search, setSearch] = useState('leaderboard')

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

        <Section title="Badge, StatusBadge, AvailabilityBadge">
          <Badge>Neutral</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <StatusBadge status="running" />
          <StatusBadge status="failed" />
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
              { label: 'Status', value: <StatusBadge status="done" /> },
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
