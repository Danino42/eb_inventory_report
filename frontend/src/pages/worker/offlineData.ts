// The fruit list and worker names the form needs. The last successful download is kept on the
// tablet, so the form also opens when the server cannot be reached.

import { NetworkError, isTemporaryFailure } from '../../api/client'
import { listFruits } from '../../api/fruits'
import { listWorkers } from '../../api/workers'
import { readJson, writeJson } from '../../lib/storage'
import type { FruitWithDerived } from '../../types/fruit'

const KEY = 'eb-form-data-v1'
const LOAD_TIMEOUT_MS = 8_000

interface FormData {
  fruits: FruitWithDerived[]
  workers: string[]
}

export interface LoadedFormData extends FormData {
  /** True if the server was unreachable and the saved copy is used */
  fromCache: boolean
}

export async function loadFormData(): Promise<LoadedFormData> {
  try {
    const [fruits, workers] = await Promise.all([
      withTimeout(listFruits(), LOAD_TIMEOUT_MS),
      withTimeout(listWorkers(), LOAD_TIMEOUT_MS),
    ])
    writeJson(KEY, { fruits, workers } satisfies FormData)
    return { fruits, workers, fromCache: false }
  } catch (e) {
    const cached = readJson<FormData | null>(KEY, null)
    if (cached && isTemporaryFailure(e)) return { ...cached, fromCache: true }
    throw e
  }
}

/** Slow Wi-Fi should not keep the form waiting forever: fall back to the saved copy */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new NetworkError('Zeitüberschreitung')), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
