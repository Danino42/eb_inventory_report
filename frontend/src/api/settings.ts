import { request } from './client'

export interface MailSettings {
  test_recipients: string[]
  production_recipients: string[]
  /** true: reports go to the production addresses, false: only to the test addresses */
  use_production: boolean
}

export interface MailSettingsInfo extends MailSettings {
  /** false: the server has no way of sending yet (Brevo / SMTP), reports are only saved */
  email_configured: boolean
}

export function getMailSettings(): Promise<MailSettingsInfo> {
  return request('/settings/mail')
}

export function saveMailSettings(settings: MailSettings): Promise<MailSettingsInfo> {
  return request('/settings/mail', { method: 'PUT', body: JSON.stringify(settings) })
}
