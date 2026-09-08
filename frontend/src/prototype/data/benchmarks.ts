import type { Benchmark } from './types'

// The 95% confidence interval for a single greedy run, from
// EVAL_SERVICE_PLAN.md Section 5: "Sample size, and why we should show
// error bars". IFEval, GSM8K, GPQA-Diamond and AIME25 use the exact
// question counts quoted there; the other four are plausible values in
// the same spirit, not quoted from anywhere.
export const benchmarks: Benchmark[] = [
  {
    id: 'ifeval',
    name: 'IFEval',
    family: 'instruction-following',
    modality: 'text',
    frameworkId: 'EvalScope',
    whereItRuns: 'service',
    questionCount: 541,
    metrics: [
      {
        key: 'prompt_level_strict',
        displayName: 'Prompt-level (strict)',
        unit: '%',
        higherIsBetter: true,
        isPrimary: true,
        harnessKey: 'prompt_level_strict',
      },
      {
        key: 'inst_level_strict',
        displayName: 'Instruction-level (strict)',
        unit: '%',
        higherIsBetter: true,
        isPrimary: false,
        harnessKey: 'inst_level_strict',
      },
      {
        key: 'prompt_level_loose',
        displayName: 'Prompt-level (loose)',
        unit: '%',
        higherIsBetter: true,
        isPrimary: false,
        harnessKey: 'prompt_level_loose',
      },
      {
        key: 'inst_level_loose',
        displayName: 'Instruction-level (loose)',
        unit: '%',
        higherIsBetter: true,
        isPrimary: false,
        harnessKey: 'inst_level_loose',
      },
    ],
    primaryMetricKey: 'prompt_level_strict',
    typicalGpuHours: 0.06,
    plausibleScoreRange: [0.55, 0.75],
  },
  {
    id: 'gsm8k',
    name: 'GSM8K',
    family: 'math',
    modality: 'text',
    frameworkId: 'EvalScope',
    whereItRuns: 'service',
    questionCount: 1319,
    metrics: [
      {
        key: 'accuracy',
        displayName: 'Accuracy',
        unit: '%',
        higherIsBetter: true,
        isPrimary: true,
        harnessKey: 'AverageAccuracy',
      },
    ],
    primaryMetricKey: 'accuracy',
    typicalGpuHours: 0.08,
    plausibleScoreRange: [0.65, 0.9],
  },
  {
    id: 'mmlu-pro',
    name: 'MMLU-Pro',
    family: 'knowledge',
    modality: 'text',
    frameworkId: 'lm-evaluation-harness',
    whereItRuns: 'service',
    questionCount: 12032,
    metrics: [
      {
        key: 'accuracy',
        displayName: 'Accuracy',
        unit: '%',
        higherIsBetter: true,
        isPrimary: true,
        harnessKey: 'exact_match,custom-extract',
      },
    ],
    primaryMetricKey: 'accuracy',
    typicalGpuHours: 0.4,
    plausibleScoreRange: [0.45, 0.75],
  },
  {
    id: 'gpqa-diamond',
    name: 'GPQA-Diamond',
    family: 'knowledge',
    modality: 'text',
    frameworkId: 'lm-evaluation-harness',
    whereItRuns: 'service',
    questionCount: 198,
    metrics: [
      {
        key: 'accuracy',
        displayName: 'Accuracy',
        unit: '%',
        higherIsBetter: true,
        isPrimary: true,
        harnessKey: 'acc_norm,none',
      },
    ],
    primaryMetricKey: 'accuracy',
    typicalGpuHours: 0.15,
    plausibleScoreRange: [0.3, 0.5],
  },
  {
    id: 'aime25',
    name: 'AIME25',
    family: 'math',
    modality: 'text',
    frameworkId: 'lm-evaluation-harness',
    whereItRuns: 'service',
    questionCount: 30,
    metrics: [
      {
        key: 'accuracy',
        displayName: 'Accuracy (avg@8)',
        unit: '%',
        higherIsBetter: true,
        isPrimary: true,
        harnessKey: 'exact_match,none',
      },
    ],
    primaryMetricKey: 'accuracy',
    typicalGpuHours: 0.3,
    plausibleScoreRange: [0.15, 0.55],
  },
  {
    id: 'bfcl-v3',
    name: 'BFCL v3',
    family: 'tool-use',
    modality: 'tool-use',
    frameworkId: 'EvalScope',
    whereItRuns: 'service',
    questionCount: 1700,
    metrics: [
      {
        key: 'overall_accuracy',
        displayName: 'Overall accuracy',
        unit: '%',
        higherIsBetter: true,
        isPrimary: true,
        harnessKey: 'overall_accuracy',
      },
    ],
    primaryMetricKey: 'overall_accuracy',
    typicalGpuHours: 0.5,
    plausibleScoreRange: [0.5, 0.8],
  },
  {
    id: 'healthbench',
    name: 'HealthBench',
    family: 'medical',
    modality: 'medical',
    frameworkId: 'medpsy-eval',
    whereItRuns: 'service',
    questionCount: 5000,
    metrics: [
      {
        key: 'rubric_score',
        displayName: 'Rubric score',
        unit: '%',
        higherIsBetter: true,
        isPrimary: true,
        harnessKey: 'rubric_score',
      },
    ],
    primaryMetricKey: 'rubric_score',
    typicalGpuHours: 0.8,
    plausibleScoreRange: [0.55, 0.85],
  },
  {
    id: 'omnidocbench',
    name: 'OmniDocBench',
    family: 'document-understanding',
    modality: 'vision',
    frameworkId: 'VLMEvalKit',
    whereItRuns: 'cluster',
    questionCount: 981,
    metrics: [
      {
        // Deliberately the one metric in this fixture set where a lower
        // value is better — see EVAL_SERVICE_PLAN.md Section 10 on why
        // recipe_metric carries higherIsBetter per metric rather than
        // assuming "bigger is better" everywhere.
        key: 'edit_distance',
        displayName: 'Edit distance',
        unit: 'edit-distance',
        higherIsBetter: false,
        isPrimary: true,
        harnessKey: 'edit_dist',
      },
    ],
    primaryMetricKey: 'edit_distance',
    typicalGpuHours: 1.2,
    plausibleScoreRange: [0.08, 0.25],
  },
]

export function getBenchmark(benchmarkId: string): Benchmark {
  const benchmark = benchmarks.find((b) => b.id === benchmarkId)
  if (!benchmark) {
    throw new Error(`Unknown benchmark id: ${benchmarkId}`)
  }
  return benchmark
}
