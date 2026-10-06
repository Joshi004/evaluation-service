import { Info } from 'lucide-react'
import { TERM_HINTS } from '../../utils/labels'
import { Button } from '../Button/Button'
import { Popover } from '../Popover/Popover'

// Reuses term hints (utils/labels.ts) rather than re-writing the same
// sentences a second time here.
export function LeaderboardHowToRead() {
  return (
    <Popover
      align="end"
      trigger={
        <Button variant="ghost" size="sm">
          <Info className="h-4 w-4" aria-hidden="true" />
          How to read this
        </Button>
      }
    >
      <div className="w-80 space-y-2 text-sm text-foreground">
        <p>{TERM_HINTS.setup}</p>
        <p>
          Each score is that model&rsquo;s best result on the benchmark. A small +N beside it means the model also
          ran N other setups -- hover the score to see them and what changed.
        </p>
        <p>
          {TERM_HINTS.marginOfError} A ★ marks the leader and every row within its margin of error -- read that as
          "within margin of error", never "statistically tied". Stars compare each model&rsquo;s best result, which
          may come from different setups; switch to All setups for a strict like-for-like view.
        </p>
        <p className="text-muted-foreground">
          GPQA-Diamond repeats each question, so its samples are not fully independent and its interval is
          approximate.
        </p>
      </div>
    </Popover>
  )
}
