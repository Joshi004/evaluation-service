import { Card } from '../components/Card/Card'
import { CodeBlock } from '../components/CodeBlock/CodeBlock'
import { Disclosure } from '../components/Disclosure/Disclosure'
import { KeyValueList } from '../components/KeyValueList/KeyValueList'
import { standardFieldRows } from '../utils/runConfigFieldRows'
import { buildSamplingMandateRows } from './BenchmarkProtocolTab.helper'
import { useBenchmarkPage } from './BenchmarkDetailPage.helper'

// The Benchmark detail page's Protocol tab: everything
// standardFieldRows itself leaves out of a run's own Configuration tab
// -- prompt/few-shot templates, extraction and the raw source file --
// because there it's "better suited to the Benchmarks page's own
// raw-YAML view" (that function's own comment); this tab is that view.
export function BenchmarkProtocolTab() {
  const { standard } = useBenchmarkPage()
  const mandateRows = buildSamplingMandateRows(standard)

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-medium text-foreground">Settings</h2>
        <div className="mt-3">
          <KeyValueList rows={standardFieldRows(standard)} />
        </div>
      </Card>

      {mandateRows.length > 0 && (
        <Card>
          <h2 className="text-sm font-medium text-foreground">Sampling this benchmark mandates</h2>
          <div className="mt-3">
            <KeyValueList rows={mandateRows.map(({ label, value }) => ({ label, value }))} />
          </div>
          {standard.warnings.length > 0 && (
            <ul className="mt-3 space-y-1">
              {standard.warnings.map((warning) => (
                <li key={warning.field} className="rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
                  {warning.field}: {warning.message}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-medium text-foreground">Prompt template</h2>
        <div className="mt-3">
          <CodeBlock value={standard.prompt_template} copyLabel="Copy prompt template" />
        </div>
      </Card>

      {standard.few_shot_prompt_template !== null && (
        <Card>
          <h2 className="text-sm font-medium text-foreground">Few-shot prompt template</h2>
          <div className="mt-3">
            <CodeBlock value={standard.few_shot_prompt_template} copyLabel="Copy few-shot prompt template" />
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-medium text-foreground">Answer extraction</h2>
        <div className="mt-3">
          <CodeBlock value={JSON.stringify(standard.extraction, null, 2)} copyLabel="Copy extraction config" />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-foreground">Metrics</h2>
        <div className="mt-3">
          <KeyValueList
            rows={standard.metrics.map((metric) => ({
              label: metric.is_primary ? `${metric.display_name} (primary)` : metric.display_name,
              value: metric.harness_key,
            }))}
          />
        </div>
      </Card>

      {standard.source_yaml !== null && (
        <Card>
          {/* Disclosure, not a Card-nested Callout -- CatalogPanel's own
          "What these states mean" legend uses the same shared
          collapsible-section primitive. */}
          <Disclosure summary="Source file" size="md">
            <div className="mt-3">
              <CodeBlock value={standard.source_yaml} copyLabel="Copy source YAML" />
            </div>
          </Disclosure>
        </Card>
      )}
    </div>
  )
}
