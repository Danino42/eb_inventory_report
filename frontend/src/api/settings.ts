import { request } from './client'

export interface MailSettingsInfo {
  recipients: string[]
  /** The address the emails come from (fixed on the server) */
  sender: string
  /** false: the server has no way of sending yet (Brevo / SMTP), reports are only saved */
  email_configured: boolean
}

export interface TestMailResult {
  sender: string
  recipients: string[]
}

export function getMailSettings(): Promise<MailSettingsInfo> {
  return request('/settings/mail')
}

export function saveRecipients(recipients: string[]): Promise<MailSettingsInfo> {
  return request('/settings/mail', { method: 'PUT', body: JSON.stringify({ recipients }) })
}

/** Sends a test email to these (unsaved) addresses; fails with the server's reason */
export function sendTestMail(recipients: string[]): Promise<TestMailResult> {
  return request('/settings/mail/test', { method: 'POST', body: JSON.stringify({ recipients }) })
}
