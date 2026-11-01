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

/** The server could not be reached at all (offline, Wi-Fi down, timeout) */
export class NetworkError extends Error {}

/** Worth trying again later: no connection, or the server/proxy had a temporary problem (5xx) */
export function isTemporaryFailure(e: unknown): boolean {
  return e instanceof NetworkError || (e instanceof ApiError && e.status >= 500)
}

interface RequestOptions {
  /** Give up after this many milliseconds (default: wait for the browser) */
  timeoutMs?: number
}

export async function request<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timer = options.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new NetworkError('Keine Verbindung zum Server.')
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, errorMessage(body, `${response.status} ${response.statusText}`))
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
