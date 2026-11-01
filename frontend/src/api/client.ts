// In development, Vite forwards /api to FastAPI (see vite.config.ts).
// For a hosted build, set VITE_API_URL to the backend address, e.g. https://api.example.com
const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Turns FastAPI error bodies ({detail: string} or validation lists) into one readable line */
function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const fields = detail.map((d: { loc?: unknown[] }) => (d.loc ?? []).slice(1).join('.')).join(', ')
    return `Some fields are not filled in correctly (${fields}).`
  }
  return fallback
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, errorMessage(body, `${response.status} ${response.statusText}`))
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
