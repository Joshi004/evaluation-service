import { Info } from 'lucide-react'
import { TERM_HINTS } from '../../utils/labels'
import { Button } from '../Button/Button'
import { Popover } from '../Popover/Popover'

// §8.6 item 11: replaces the old jargon paragraph that used to sit
// under the page title. Reuses §4.3's own term hints (utils/labels.ts)
// rather than re-writing the same sentences a second time here.
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
          {TERM_HINTS.marginOfError} A ★ marks the leader and every row within its margin of error -- read that as
          "within margin of error", never "statistically tied".
        </p>
        <p className="text-muted-foreground">
          GPQA-Diamond repeats each question, so its samples are not fully independent and its interval is
          approximate.
        </p>
      </div>
    </Popover>
  )
}
