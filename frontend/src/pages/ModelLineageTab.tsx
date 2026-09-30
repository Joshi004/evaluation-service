import { Link } from 'react-router'
import { AvailabilityBadge } from '../components/AvailabilityBadge/AvailabilityBadge'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { Card } from '../components/Card/Card'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ModelParentComparison } from '../components/ModelParentComparison/ModelParentComparison'
import { resolveModelLineage } from '../utils/modelLineage'
import { buildModelResults, findSharedSetups } from '../utils/modelResults'
import { paths } from '../utils/paths'
import { useModelPage } from './ModelDetailPage.helper'

// The model page's Lineage tab: the parent, compared setup-by-setup
// via ModelParentComparison (baseline = parent, the same
// findSharedSetups helper Compare with... uses), then the children
// list. Lineage itself is read-only here -- it's set once at
// registration (see the note at the bottom).
export function ModelLineageTab() {
  const { checkpoint, allCheckpoints, board, standards } = useModelPage()
  const { parent, parentMissing, children } = resolveModelLineage(checkpoint, allCheckpoints)

  const sharedWithParent = parent ? findSharedSetups(board, parent.id, checkpoint.id) : []

  // Every standard the parent itself has a done result on -- what
  // "Evaluate on the parent's benchmarks" prefills, the same
  // models+benchmarks querystring contract ModelHeader's own "Evaluate
  // on missing benchmarks" action already uses.
  const parentStandardIds = parent
    ? [...new Set(buildModelResults(board, standards, parent.id).evaluated.map((entry) => entry.setup.standardId))]
    : []

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-sm font-medium text-foreground">Parent</h2>

        {parentMissing && <p className="mt-2 text-sm text-danger">Parent model no longer exists.</p>}

        {!parentMissing && parent === null && (
          <p className="mt-2 text-sm text-muted-foreground">This model has no parent.</p>
        )}

        {parent !== null && (
          <div className="mt-3 space-y-3">
            <p className="text-sm">
              <Link to={paths.model(parent.id)} className="font-medium text-primary hover:underline">
                {parent.name}
              </Link>
            </p>

            {sharedWithParent.length === 0 ? (
              <EmptyState
                title="No shared setup with the parent yet"
                description={`${checkpoint.name} hasn't been evaluated on any of the same setups as ${parent.name}.`}
                actions={
                  parentStandardIds.length > 0 ? (
                    <Link
                      to={paths.newEvaluation({ models: [checkpoint.id], benchmarks: parentStandardIds })}
                      className={buttonClassName('secondary', BUTTON_LABEL_SIZE.sm)}
                    >
                      Evaluate on the parent's benchmarks
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <ModelParentComparison comparisons={sharedWithParent} />
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-foreground">Children</h2>
        {children.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No other models are based on this one yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {children.map((child) => (
              <li key={child.id} className="flex items-center gap-2 text-sm">
                <Link to={paths.model(child.id)} className="font-medium text-primary hover:underline">
                  {child.name}
                </Link>
                <AvailabilityBadge status={child.availability_status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">Lineage is set at registration and can't be changed yet.</p>
    </div>
  )
}
