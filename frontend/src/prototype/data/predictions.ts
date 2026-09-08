import type { PredictionExample } from './types'

// A small illustrative slice of stored predictions for one comparison pair
// (pre- and post-quantization on the Qwen3-4B lineage, on IFEval) — real
// runs store all 541, this is 10 for the demo. Deliberately not one-sided:
// includes cases where the newer checkpoint regresses (q6) and cases where
// both fail the same instruction (q3, q8), because a diff table that only
// ever shows wins isn't credible and isn't how instruction-following
// actually behaves.
const PAIR_CHECKPOINT_IDS = ['qwen3-4b-rl-step400', 'qwen3-4b-allternary-ep03'] as const

interface QuestionFixture {
  questionId: string
  prompt: string
  responses: Record<(typeof PAIR_CHECKPOINT_IDS)[number], { text: string; correct: boolean }>
}

const questionFixtures: QuestionFixture[] = [
  {
    questionId: 'q1',
    prompt:
      'Write a short bio of a fictional astronaut. Your entire response must be in English and in all lowercase letters.',
    responses: {
      'qwen3-4b-rl-step400': {
        text: 'Maria Okafor was born on a research station orbiting Mars in 2091...',
        correct: false,
      },
      'qwen3-4b-allternary-ep03': {
        text: 'maria okafor was born on a research station orbiting mars in 2091...',
        correct: true,
      },
    },
  },
  {
    questionId: 'q2',
    prompt: 'Give me three tips for staying focused while studying. Exactly 3 bullet points, each starting with "*".',
    responses: {
      'qwen3-4b-rl-step400': { text: '* Remove your phone\n* Study in blocks\n* Take short breaks', correct: true },
      'qwen3-4b-allternary-ep03': {
        text: '* Put your phone away\n* Use 25-minute blocks\n* Take a 5-minute break between blocks',
        correct: true,
      },
    },
  },
  {
    questionId: 'q3',
    prompt: "Explain what a firewall is in networking. Do not use the word 'security' anywhere in your response.",
    responses: {
      'qwen3-4b-rl-step400': {
        text: 'A firewall filters network traffic to protect a security perimeter around a device or network.',
        correct: false,
      },
      'qwen3-4b-allternary-ep03': {
        text: 'A firewall inspects incoming and outgoing traffic and blocks connections that violate a set of rules protecting the network.',
        correct: false,
      },
    },
  },
  {
    questionId: 'q4',
    prompt: 'Describe your favorite season. Your response must be at least 300 words.',
    responses: {
      'qwen3-4b-rl-step400': { text: 'Autumn is my favorite season... (210 words)', correct: false },
      'qwen3-4b-allternary-ep03': { text: 'Autumn is my favorite season... (340 words)', correct: true },
    },
  },
  {
    questionId: 'q5',
    prompt: 'Write a haiku about the ocean. Wrap your entire response in double quotation marks.',
    responses: {
      'qwen3-4b-rl-step400': { text: '"waves fold into waves / salt air carries the horizon / the tide keeps no time"', correct: true },
      'qwen3-4b-allternary-ep03': { text: '"the sea breathes slowly / light scatters on rolling waves / the shore listens back"', correct: true },
    },
  },
  {
    questionId: 'q6',
    prompt: 'Summarize the plot of a mystery novel in exactly two sentences.',
    responses: {
      'qwen3-4b-rl-step400': {
        text: 'A detective is called to investigate a locked-room murder at a remote estate. Following a trail of forged letters, she discovers the victim\'s own business partner staged the crime to inherit the estate.',
        correct: true,
      },
      'qwen3-4b-allternary-ep03': {
        text: 'A detective is called to investigate a locked-room murder at a remote estate. She follows a trail of forged letters. The trail leads to the victim\'s own business partner, who staged the crime to inherit the estate.',
        correct: false,
      },
    },
  },
  {
    questionId: 'q7',
    prompt: 'List five programming languages, separated by commas, with no line breaks.',
    responses: {
      'qwen3-4b-rl-step400': { text: 'Python, Rust, TypeScript, Go, Kotlin', correct: true },
      'qwen3-4b-allternary-ep03': { text: 'Python, Rust, TypeScript, Go, Swift', correct: true },
    },
  },
  {
    questionId: 'q8',
    prompt: 'Write a formal email requesting a deadline extension. Do not use any contractions.',
    responses: {
      'qwen3-4b-rl-step400': { text: "I don't think I can meet the deadline as scheduled...", correct: false },
      'qwen3-4b-allternary-ep03': { text: "I understand the deadline is close, but it isn't feasible given the current scope...", correct: false },
    },
  },
  {
    questionId: 'q9',
    prompt: 'Provide a definition of photosynthesis in exactly one sentence, and your entire response must be in English.',
    responses: {
      'qwen3-4b-rl-step400': {
        text: 'Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose.',
        correct: true,
      },
      'qwen3-4b-allternary-ep03': {
        text: 'Photosynthesis is the process green plants and some other organisms use to convert light energy into chemical energy.',
        correct: true,
      },
    },
  },
  {
    questionId: 'q10',
    prompt: "Recommend a book for someone who loves science fiction. Title your response with a single markdown heading using exactly one '#' symbol.",
    responses: {
      'qwen3-4b-rl-step400': { text: '## A Recommendation\n\nTry "The Left Hand of Darkness" by Ursula K. Le Guin.', correct: false },
      'qwen3-4b-allternary-ep03': { text: '# A Recommendation\n\nTry "The Left Hand of Darkness" by Ursula K. Le Guin.', correct: true },
    },
  },
]

export const predictions: PredictionExample[] = questionFixtures.flatMap((question) =>
  PAIR_CHECKPOINT_IDS.map((checkpointId) => ({
    id: `${question.questionId}-${checkpointId}`,
    questionId: question.questionId,
    benchmarkId: 'ifeval',
    prompt: question.prompt,
    checkpointId,
    response: question.responses[checkpointId].text,
    correct: question.responses[checkpointId].correct,
  })),
)

/** True only if we have stored predictions for both checkpoints on the same benchmark. */
export function hasPredictionDiff(checkpointIdA: string, checkpointIdB: string): boolean {
  const ids = new Set(predictions.map((p) => p.checkpointId))
  return ids.has(checkpointIdA) && ids.has(checkpointIdB)
}

export interface PredictionDiffRow {
  questionId: string
  prompt: string
  a?: PredictionExample
  b?: PredictionExample
}

export function getPredictionDiffRows(checkpointIdA: string, checkpointIdB: string): PredictionDiffRow[] {
  const byQuestion = new Map<string, PredictionDiffRow>()
  for (const prediction of predictions) {
    if (prediction.checkpointId !== checkpointIdA && prediction.checkpointId !== checkpointIdB) continue
    const row = byQuestion.get(prediction.questionId) ?? { questionId: prediction.questionId, prompt: prediction.prompt }
    if (prediction.checkpointId === checkpointIdA) row.a = prediction
    if (prediction.checkpointId === checkpointIdB) row.b = prediction
    byQuestion.set(prediction.questionId, row)
  }
  return Array.from(byQuestion.values())
}
