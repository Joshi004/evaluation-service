import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react'
import {
  ariaSortFor,
  DENSITY_CELL_PADDING,
  nextSortState,
  resolveSetupForBenchmark,
  type ResolvedLeaderboardView,
  type SortDirection,
} from '../../pages/LeaderboardPage.helper'
import { benchmarkVersion } from '../../utils/benchmarkDisplayName'
import { groupColumnsByCategory, type BenchmarkColumn, type ModelRow, type SetupOption } from '../../utils/buildLeaderboard'
import { cn } from '../../utils/cn'
import { paths } from '../../utils/paths'
import { samplingProfileDisplayName } from '../../utils/samplingProfileDisplayName'
import { Badge } from '../Badge/Badge'
import { LeaderboardScoreCell } from '../LeaderboardScoreCell/LeaderboardScoreCell'
import { Menu } from '../Menu/Menu'
import { ModelName } from '../ModelName/ModelName'
import { TableCell, TableHeaderCell } from '../Table/Table'
import {
  HEADER_ROW1_HEIGHT_CLASS,
  HEADER_ROW1_TOP_CLASS,
  HEADER_ROW2_HEIGHT_CLASS,
  HEADER_ROW2_TOP_CLASS,
  HEADER_ROW3_HEIGHT_CLASS,
  HEADER_ROW3_TOP_CLASS,
  isActiveLeafSetup,
  leafSetupsForColumn,
  totalLeafColumns,
} from './LeaderboardOverviewTable.helper'

interface LeaderboardOverviewTableProps {
  // Already filtered (Benchmarks selection) and, for `models`, already
  // filtered (search, Family) and sorted (LeaderboardPage.helper.ts) --
  // this component renders; it does not decide what belongs on screen.
  columns: BenchmarkColumn[]
  models: ModelRow[]
  view: ResolvedLeaderboardView
  onSortChange: (next: { sortBenchmark: string; dir: SortDirection }) => void
  onSetupChange: (benchmark: string, comparisonHash: string) => void
}

// z-30 (the corner) > z-20 (header rows) > z-10 (body's own sticky
// column) > body cells with no z -- the order scrolling needs both
// axes to occlude correctly: a header row must sit above a body row's
// sticky first cell as it scrolls past underneath, and the corner must
// sit above both header and body wherever they'd otherwise overlap.
const HEADER_CORNER_CLASSES = 'sticky left-0 z-30 bg-muted align-bottom'
const HEADER_ROW_CLASSES = 'sticky z-20'
const BODY_FIRST_COLUMN_CLASSES = 'sticky left-0 z-10 bg-card'

export function LeaderboardOverviewTable({ columns, models, view, onSortChange, onSetupChange }: LeaderboardOverviewTableProps) {
  const categoryGroups = groupColumnsByCategory(columns)

  function handleHeaderClick(column: BenchmarkColumn): void {
    onSortChange(nextSortState({ sortBenchmark: view.sortBenchmark, dir: view.dir }, column))
  }

  function handleSubColumnClick(column: BenchmarkColumn, comparisonHash: string): void {
    onSetupChange(column.benchmark, comparisonHash)
    onSortChange(nextSortState({ sortBenchmark: view.sortBenchmark, dir: view.dir }, column))
  }

  return (
    <div className="relative max-h-[70vh] overflow-auto rounded-lg border border-border">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <TableHeaderCell rowSpan={view.mode === 'all' ? 3 : 2} className={cn(HEADER_CORNER_CLASSES, HEADER_ROW1_TOP_CLASS)}>
              Model
            </TableHeaderCell>
            {categoryGroups.map((group) => (
              <TableHeaderCell
                key={group.category ?? 'uncategorised'}
                colSpan={totalLeafColumns(group.columns, view.mode)}
                className={cn(HEADER_ROW_CLASSES, HEADER_ROW1_HEIGHT_CLASS, HEADER_ROW1_TOP_CLASS, 'uppercase tracking-wide')}
              >
                {group.category ?? 'Uncategorised'}
              </TableHeaderCell>
            ))}
          </tr>
          <tr>
            {columns.map((column) => {
              const activeSetup = resolveSetupForBenchmark(column, view.setupOverrides)
              return (
                <TableHeaderCell
                  key={column.benchmark}
                  colSpan={view.mode === 'all' ? column.setups.length : 1}
                  aria-sort={view.mode === 'like' ? ariaSortFor(column.benchmark, view) : undefined}
                  className={cn(HEADER_ROW_CLASSES, HEADER_ROW2_HEIGHT_CLASS, HEADER_ROW2_TOP_CLASS)}
                >
                  <div className="flex h-full items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleHeaderClick(column)}
                      className="flex items-center gap-1 text-left font-medium text-foreground hover:text-primary"
                    >
                      {column.displayName}
                      {column.hasMultipleStandardVersions && (
                        <Badge tone="neutral">{benchmarkVersion(activeSetup.standardLabel) ?? 'custom'}</Badge>
                      )}
                      <SortIcon active={view.sortBenchmark === column.benchmark} dir={view.dir} />
                    </button>
                    {view.mode === 'like' && column.setups.length > 1 && (
                      <SetupPickerMenu
                        column={column}
                        activeSetup={activeSetup}
                        onSelect={(hash) => onSetupChange(column.benchmark, hash)}
                      />
                    )}
                  </div>
                </TableHeaderCell>
              )
            })}
          </tr>
          {view.mode === 'all' && (
            <tr>
              {columns.flatMap((column) =>
                column.setups.map((setup) => {
                  const active = isActiveLeafSetup(column, setup, view)
                  return (
                    <TableHeaderCell
                      key={setup.comparisonHash}
                      aria-sort={active ? ariaSortFor(column.benchmark, view) : 'none'}
                      className={cn(HEADER_ROW_CLASSES, HEADER_ROW3_HEIGHT_CLASS, HEADER_ROW3_TOP_CLASS)}
                    >
                      <button
                        type="button"
                        onClick={() => handleSubColumnClick(column, setup.comparisonHash)}
                        className={cn(
                          'flex items-center gap-1 font-normal',
                          active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {samplingProfileDisplayName(setup.samplingProfileLabel, setup.samplingProfileHash)}
                        <SortIcon active={active} dir={view.dir} />
                      </button>
                    </TableHeaderCell>
                  )
                }),
              )}
            </tr>
          )}
        </thead>
        <tbody>
          {models.map((model) => (
            <tr key={model.checkpointId}>
              <TableCell className={cn(BODY_FIRST_COLUMN_CLASSES, DENSITY_CELL_PADDING[view.density])}>
                <ModelName name={model.name} family={model.family} to={paths.model(model.checkpointId)} />
              </TableCell>
              {columns.flatMap((column) =>
                leafSetupsForColumn(column, view.mode, view.setupOverrides).map((setup) => (
                  <LeaderboardScoreCell
                    key={`${column.benchmark}-${setup.comparisonHash}`}
                    column={column}
                    model={model}
                    setup={setup}
                    heatEnabled={view.heatEnabled}
                    density={view.density}
                    showOtherSetupsChip={view.mode === 'like'}
                  />
                )),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDirection }) {
  if (!active) {
    return <ArrowUpDown className="h-3 w-3 text-subtle-foreground" aria-hidden="true" />
  }
  return dir === 'asc' ? (
    <ArrowUp className="h-3 w-3" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-3 w-3" aria-hidden="true" />
  )
}

interface SetupPickerMenuProps {
  column: BenchmarkColumn
  activeSetup: SetupOption
  onSelect: (comparisonHash: string) => void
}

// Like-for-like mode's own per-benchmark setup switch -- a Menu rather
// than a native <select> so each option can carry a model count, which
// is what actually explains why one setup is the default.
function SetupPickerMenu({ column, activeSetup, onSelect }: SetupPickerMenuProps) {
  return (
    <Menu
      trigger={
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs font-normal text-muted-foreground hover:border-border-strong hover:text-foreground"
        >
          {samplingProfileDisplayName(activeSetup.samplingProfileLabel, activeSetup.samplingProfileHash)}
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      }
      items={column.setups.map((setup) => ({
        label: `${samplingProfileDisplayName(setup.samplingProfileLabel, setup.samplingProfileHash)} \u00b7 ${setup.modelCount} model${setup.modelCount === 1 ? '' : 's'}`,
        onSelect: () => onSelect(setup.comparisonHash),
      }))}
    />
  )
}
