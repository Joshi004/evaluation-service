// Middle-ellipsis a long model name, keeping the suffix that actually
// discriminates one checkpoint from another -- training-run names like
// "Qwen3.5-0.8B-Think-MOPD-mixv2-RL-v11c-s810" put the step/seed at the
// end, so truncating the end the way a filename ellipsis normally does
// would hide the one part that tells two runs apart.
const ELLIPSIS = '\u2026'
const SUFFIX_LENGTH = 9

export function shortenModelName(name: string, maxLength = 25): string {
  if (name.length <= maxLength) {
    return name
  }
  const prefixLength = Math.max(0, maxLength - ELLIPSIS.length - SUFFIX_LENGTH)
  return `${name.slice(0, prefixLength)}${ELLIPSIS}${name.slice(-SUFFIX_LENGTH)}`
}
