import { request } from './client'

export interface MailSettings {
  test_recipients: string[]
  production_recipients: string[]
  /** true: reports go to the production addresses, false: only to the test addresses */
  use_production: boolean
  /** Sender address (with Brevo: verified there); null: the server's default sender */
  sender: string | null
}

export interface MailSettingsInfo extends MailSettings {
  /** false: the server has no way of sending yet (Brevo / SMTP), reports are only saved */
  email_configured: boolean
  /** Sender used when none is set here */
  server_sender: string
}

export interface TestMailResult {
  sender: string
  recipients: string[]
}

export function getMailSettings(): Promise<MailSettingsInfo> {
  return request('/settings/mail')
}

export function saveMailSettings(settings: MailSettings): Promise<MailSettingsInfo> {
  return request('/settings/mail', { method: 'PUT', body: JSON.stringify(settings) })
}

/** Sends a test email with these (unsaved) settings; fails with the server's reason */
export function sendTestMail(settings: MailSettings): Promise<TestMailResult> {
  return request('/settings/mail/test', { method: 'POST', body: JSON.stringify(settings) })
}
