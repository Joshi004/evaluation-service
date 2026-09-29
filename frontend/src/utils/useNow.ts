import { useEffect, useState } from 'react'

// A `Date` that updates every `intervalMs` -- the run report's own live
// progress view (a queued or running run, RunLiveProgress) uses this to
// keep its elapsed-time text ticking between the 5s server polls that
// would otherwise be the only thing re-rendering it.
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])

  return now
}
