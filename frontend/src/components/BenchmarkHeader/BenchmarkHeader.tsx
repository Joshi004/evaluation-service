import { Link } from 'react-router'
import type { StandardSummary } from '../../api/client'
import { benchmarkVersion } from '../../utils/benchmarkDisplayName'
import { paths } from '../../utils/paths'
import { Badge } from '../Badge/Badge'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../Button/Button.helper'
import { CopyLinkButton } from '../CopyLinkButton/CopyLinkButton'
import { FingerprintChip } from '../FingerprintChip/FingerprintChip'
import { PageHeader } from '../PageHeader/PageHeader'
import { RelativeTime } from '../RelativeTime/RelativeTime'

interface BenchmarkHeaderProps {
  standard: StandardSummary
}

// The Benchmark detail page's own header: identity (display name,
// version, category, fingerprint, loaded-when), then the actions
// every tab needs regardless of which one is open -- mirrors
// ModelHeader's own split, rendered once above the <Outlet>.
export function BenchmarkHeader({ standard }: BenchmarkHeaderProps) {
  const version = benchmarkVersion(standard.label)

  return (
    <PageHeader
      breadcrumb={
        <Link to={paths.benchmarks()} className="hover:text-foreground hover:underline">
          Benchmarks
        </Link>
      }
      title={
        <span className="inline-flex items-center gap-2">
          {standard.display_name ?? standard.benchmark}
          {version && <Badge tone="neutral">{version}</Badge>}
        </span>
      }
      description={
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {standard.category && <Badge tone="neutral">{standard.category}</Badge>}
            <FingerprintChip hash={standard.hash} />
          </div>
          <p className="text-xs text-muted-foreground">
            Loaded <RelativeTime timestamp={standard.created_at} />
          </p>
        </div>
      }
      actions={
        <>
          <Link
            to={paths.newEvaluation({ benchmarks: [standard.id] })}
            className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}
          >
            Evaluate
          </Link>
          <CopyLinkButton />
        </>
      }
    />
  )
}
