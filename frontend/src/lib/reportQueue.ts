// Reports that could not be sent (offline, server problem) wait here on the tablet and are
// sent automatically later (F-4). Each report keeps its report_id, so the backend never emails
// the same report twice, even if an earlier attempt got through but its answer was lost.

import { ApiError, isTemporaryFailure } from '../api/client'
import { sendReport, type InventoryReport } from '../api/reports'
import { readJson, writeJson } from './storage'

const KEY = 'eb-report-queue-v1'
const CHANGE_EVENT = 'eb-report-queue-change'
const RETRY_EVERY_MS = 30_000
const SEND_TIMEOUT_MS = 20_000

export interface QueuedReport {
  report: InventoryReport
  queuedAt: string
  /** Set when the server rejected the report (not a connection problem); it is not retried */
  failed?: string
}

export function queuedReports(): QueuedReport[] {
  return readJson<QueuedReport[]>(KEY, [])
}

function save(list: QueuedReport[]) {
  writeJson(KEY, list)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function enqueueReport(report: InventoryReport): boolean {
  const list = queuedReports().filter((q) => q.report.report_id !== report.report_id)
  list.push({ report, queuedAt: new Date().toISOString() })
  const ok = writeJson(KEY, list)
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return ok
}

/** Calls listener whenever the queue changes (in this tab or another one) */
export function onQueueChange(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === KEY && listener()
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}

let flushing = false

/** Tries to send every waiting report; stops at the first connection problem */
export async function flushQueue(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    for (const item of queuedReports()) {
      if (item.failed) continue
      try {
        await sendReport(item.report, SEND_TIMEOUT_MS)
        save(queuedReports().filter((q) => q.report.report_id !== item.report.report_id))
      } catch (e) {
        if (isTemporaryFailure(e)) return // still offline: try again later
        const message = e instanceof ApiError ? e.message : 'Unbekannter Fehler'
        save(queuedReports().map((q) => (q.report.report_id === item.report.report_id ? { ...q, failed: message } : q)))
      }
    }
  } finally {
    flushing = false
  }
}

/** Runs for the whole app: on start, when the tablet comes back online, and every 30 s */
export function startAutoFlush(): () => void {
  void flushQueue()
  const onOnline = () => void flushQueue()
  window.addEventListener('online', onOnline)
  const timer = window.setInterval(() => {
    if (queuedReports().some((q) => !q.failed)) void flushQueue()
  }, RETRY_EVERY_MS)
  return () => {
    window.removeEventListener('online', onOnline)
    window.clearInterval(timer)
  }
}
