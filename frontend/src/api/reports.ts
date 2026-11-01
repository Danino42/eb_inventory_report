import type { Unit, Variant } from '../types/fruit'
import { request } from './client'

/** Mirrors backend/app/models/report.py */
export interface StockLine {
  article_number: string
  dev_name: string
  name_de: string
  unit: Unit
  variant: Variant
  /** null = field left empty */
  quantity: number | null
  custom: boolean
}

export interface IfcoReport {
  returned: number | null
  enough_clean: boolean | null
  reorder_small: boolean
  reorder_large: boolean
}

export interface InventoryReport {
  /** Created once per report on the tablet; resending the same id never emails twice */
  report_id: string
  /** YYYY-MM-DD */
  report_date: string
  worker: string
  lines: StockLine[]
  ifco: IfcoReport | null
  hq_notes: string
}

export interface ReportResult {
  /** "sent" = emailed, "saved" = email sending not set up yet, only saved on the server */
  delivery: 'sent' | 'saved'
  recipients: string[]
  subject: string
  files: string[]
}

export interface DeliveryInfo {
  recipients: string[]
  /** false = email sending not set up yet: reports are only saved on the server */
  email_enabled: boolean
}

/** Where reports go, to show it before sending */
export function getDeliveryInfo(): Promise<DeliveryInfo> {
  return request('/reports/delivery', undefined, { timeoutMs: 5_000 })
}

/** Creates the A4 PDF + CSV on the server and emails them to the office */
export function sendReport(report: InventoryReport, timeoutMs?: number): Promise<ReportResult> {
  return request('/reports', { method: 'POST', body: JSON.stringify(report) }, { timeoutMs })
}
