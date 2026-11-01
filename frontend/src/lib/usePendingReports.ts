import { useSyncExternalStore } from 'react'
import { onQueueChange, queuedReports } from './reportQueue'

// Snapshot as a short string, so React only re-renders when the numbers really change
function snapshot(): string {
  const list = queuedReports()
  return `${list.filter((q) => !q.failed).length}/${list.filter((q) => q.failed).length}`
}

/** How many reports wait on this tablet, and how many the server rejected */
export function usePendingReports(): { waiting: number; failed: number } {
  const value = useSyncExternalStore(onQueueChange, snapshot)
  const [waiting, failed] = value.split('/').map(Number)
  return { waiting, failed }
}
